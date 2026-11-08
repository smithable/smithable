// The voice detector's arithmetic (docs/design/smith-speech.md §4.2, §4.3), apart from the
// browser so it can be tested: 16 kHz frames of 512 samples, where speech starts and ends, the
// barge-in watch, and the simple detector used when Silero's files cannot be had.

export const RATE = 16000;
export const FRAME = 512;
const FRAME_MS = (FRAME / RATE) * 1000;

/** Turns the microphone's chunks at its own rate into 16 kHz frames (an average per sample). */
export function framer(nativeRate: number) {
  const ratio = nativeRate / RATE;
  let pending: number[] = [];
  let out: number[] = [];
  let k = 0;
  let taken = 0;
  return (chunk: ArrayLike<number>): Float32Array[] => {
    for (let i = 0; i < chunk.length; i++) pending.push(chunk[i] as number);
    const frames: Float32Array[] = [];
    for (;;) {
      const n = Math.round((k + 1) * ratio) - taken;
      if (pending.length < n) break;
      let sum = 0;
      for (let i = 0; i < n; i++) sum += pending[i] as number;
      out.push(n ? sum / n : 0);
      pending = pending.slice(n);
      taken += n;
      k++;
      if (out.length === FRAME) {
        frames.push(Float32Array.from(out));
        out = [];
      }
    }
    return frames;
  };
}

export interface SegmentOptions {
  /** A frame at or above this is speech; below `negative` it is silence; between, it goes on. */
  positive: number;
  negative: number;
  /** Silence this long ends an utterance (§4.2: about 800 ms). */
  endMs: number;
  /** An utterance shorter than this was a misfire: nothing is sent. */
  minSpeechMs: number;
}
export const LISTENING: SegmentOptions = {
  positive: 0.5,
  negative: 0.35,
  endMs: 800,
  minSpeechMs: 250,
};
export type SegmentEvent = "start" | "end" | "misfire";

/** Where an utterance starts and ends, from each frame's speech probability. */
export function segmenter(o: SegmentOptions = LISTENING) {
  let speaking = false;
  let speechMs = 0;
  let silentMs = 0;
  return {
    push(p: number): SegmentEvent | undefined {
      if (!speaking) {
        if (p < o.positive) return undefined;
        speaking = true;
        speechMs = FRAME_MS;
        silentMs = 0;
        return "start";
      }
      if (p < o.negative) silentMs += FRAME_MS;
      else {
        speechMs += FRAME_MS + silentMs;
        silentMs = 0;
      }
      if (silentMs < o.endMs) return undefined;
      speaking = false;
      return speechMs >= o.minSpeechMs ? "end" : "misfire";
    },
    reset() {
      speaking = false;
      speechMs = 0;
      silentMs = 0;
    },
  };
}

/**
 * The barge-in watch (§4.3): while Smith speaks, an onset held about 300 ms above a raised
 * threshold, the first 300 ms after each sentence starts playing ignored.
 */
export function bargeWatch({ threshold = 0.8, holdMs = 300, quietAfterStartMs = 300 } = {}) {
  let held = 0;
  let sinceStart = Number.POSITIVE_INFINITY;
  return {
    sentenceStarted() {
      sinceStart = 0;
      held = 0;
    },
    push(p: number): boolean {
      sinceStart += FRAME_MS;
      if (sinceStart <= quietAfterStartMs) {
        held = 0;
        return false;
      }
      held = p >= threshold ? held + FRAME_MS : 0;
      return held >= holdMs;
    },
  };
}

/**
 * The simple detector, used when Silero's files cannot be fetched: loudness over a noise floor
 * that follows the room, weighed by a zero-crossing rate in the range of a voice.
 */
export function simpleDetector() {
  let floor = -50;
  return (frame: Float32Array): number => {
    let sum = 0;
    let crossings = 0;
    for (let i = 0; i < frame.length; i++) {
      const x = frame[i] as number;
      sum += x * x;
      if (i && (frame[i - 1] as number) < 0 !== x < 0) crossings++;
    }
    const db = 10 * Math.log10(sum / frame.length + 1e-10);
    // The floor drops to quiet at once and rises slowly (about 1.5 dB a second), so a long
    // sentence is not taken for the room.
    floor = db < floor ? db : floor + 0.05;
    const loud = Math.min(1, Math.max(0, (db - floor - 6) / 12));
    const zcr = crossings / frame.length;
    return zcr > 0.01 && zcr < 0.4 ? loud : loud * 0.3;
  };
}
