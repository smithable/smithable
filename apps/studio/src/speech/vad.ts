// The voice detector in the browser (docs/design/smith-speech.md §4.1, §4.2): Silero through
// onnxruntime's WebAssembly runtime, whose two large files are fetched only when automatic mode
// starts, from Studio's own host when it serves them (hosted) and else from docs.smithable.ai,
// each checked against the hash Studio's build carries. When neither answers (offline, a blocked
// host), the simple detector runs instead and the controls say so. Nothing comes from anyone else.
import { simpleDetector } from "./vad-core";

declare const __VAD__: { version: string; integrity: Record<string, string> } | undefined;
const ASSETS = typeof __VAD__ === "undefined" ? undefined : __VAD__;

async function fetchChecked(name: string): Promise<ArrayBuffer> {
  if (!ASSETS) throw new Error("This build carries no voice detector files.");
  const integrity = ASSETS.integrity[name];
  let failure: unknown;
  for (const base of [
    `/vad/${ASSETS.version}/`,
    `https://docs.smithable.ai/vad/${ASSETS.version}/`,
  ])
    try {
      const response = await fetch(`${base}${name}`, { integrity, mode: "cors" });
      if (response.ok) return await response.arrayBuffer();
    } catch (error) {
      // A wrong hash or a host that does not answer: the next one.
      failure = error;
    }
  throw failure ?? new Error(`${name} could not be fetched.`);
}

export interface Detector {
  /** Silero, or the simple detector when Silero's files could not be had. */
  kind: "silero" | "simple";
  /** The probability that a 16 kHz frame of 512 samples is speech. */
  detect: (frame: Float32Array) => Promise<number> | number;
  release: () => void;
}

let loading: Promise<Detector> | undefined;

/** The detector, loaded once per page. */
export function loadDetector(): Promise<Detector> {
  loading ??= silero().catch(
    (): Detector => ({ kind: "simple", detect: simpleDetector(), release: () => undefined }),
  );
  return loading;
}

async function silero(): Promise<Detector> {
  const [ort, glue, wasm, model] = await Promise.all([
    import("onnxruntime-web/wasm"),
    import("onnxruntime-web/ort-wasm-simd-threaded.mjs?raw"),
    fetchChecked("ort-wasm-simd-threaded.wasm"),
    fetchChecked("silero_vad_v5.onnx"),
  ]);
  // One thread: no workers, no cross-origin isolation needed. The runtime's small loader is in
  // Studio's bundle; the binary is the one just checked.
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmBinary = wasm;
  ort.env.wasm.wasmPaths = {
    mjs: URL.createObjectURL(new Blob([glue.default], { type: "text/javascript" })),
  };
  const session = await ort.InferenceSession.create(model);
  // Silero v5: a frame with the last 64 samples of the one before, and a state carried along.
  const sr = new ort.Tensor("int64", BigInt64Array.from([16000n]));
  let state = new ort.Tensor("float32", new Float32Array(256), [2, 1, 128]);
  let context = new Float32Array(64);
  return {
    kind: "silero",
    detect: async (frame) => {
      const input = new Float32Array(64 + frame.length);
      input.set(context);
      input.set(frame, 64);
      context = frame.slice(-64);
      const out = await session.run({
        input: new ort.Tensor("float32", input, [1, input.length]),
        state,
        sr,
      });
      if (out.stateN) state = out.stateN as typeof state;
      return Number(out.output?.data[0] ?? 0);
    },
    release: () => void session.release(),
  };
}

export interface Ear {
  /** What the browser gave for the three constraints (§4.1), for the test mode. */
  settings: MediaTrackSettings;
  stop: () => void;
}

const WORKLET = `registerProcessor("smithable-ear", class extends AudioWorkletProcessor {
  process(inputs) { const c = inputs[0] && inputs[0][0]; if (c) this.port.postMessage(c.slice(0)); return true; }
});`;

/** Opens the microphone with the echo canceller, noise suppression and gain control on. */
export async function openEar(onChunk: (chunk: Float32Array, rate: number) => void): Promise<Ear> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const context = new AudioContext();
  try {
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
    await context.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const node = new AudioWorkletNode(context, "smithable-ear");
    node.port.onmessage = (e: MessageEvent<Float32Array>) => onChunk(e.data, context.sampleRate);
    // Pulled by the output at no volume, so the browser keeps it running.
    const silent = context.createGain();
    silent.gain.value = 0;
    context
      .createMediaStreamSource(stream)
      .connect(node)
      .connect(silent)
      .connect(context.destination);
  } catch (error) {
    for (const track of stream.getTracks()) track.stop();
    void context.close();
    throw error;
  }
  return {
    settings: stream.getAudioTracks()[0]?.getSettings() ?? {},
    stop: () => {
      for (const track of stream.getTracks()) track.stop();
      void context.close();
    },
  };
}
