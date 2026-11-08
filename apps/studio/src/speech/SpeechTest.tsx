// The speech test mode (smith-speech.md §4.1, §4.3), opened with ?speech-test in Studio's address:
// the measurements step 2 asks for on real speakers, in each browser and with each kind of voice,
// written out to copy into the action file. Nothing is sent anywhere.
//  1. Two captures: the detector's stream beside the browser's recognition, started at the onset
//     as automatic mode does; whether the first word survives.
//  2. Smith must never stop himself: he speaks while the barge-in watch listens.
//  3. Talking over him stops him: the watch must fire within half a second of the person speaking.
import { useRef, useState } from "react";
import { Button } from "../ui";
import { loadDetector, openEar } from "./vad";
import { bargeWatch, framer, segmenter } from "./vad-core";
import { sentences } from "./words";

const PASSAGE =
  "I am Smith, and I am reading this so the test can hear whether I interrupt myself. " +
  "Your app keeps its records in one place. Each change you ask for is written down first. " +
  "You can undo any of them later, by its number. Now I will keep talking for a little while. " +
  "When the line below says so, talk over me.";

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

export function SpeechTest({ voice }: { voice?: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const [busy, setBusy] = useState<string>();
  const say = (line: string) => setLines((l) => [...l, line]);
  const stop = useRef<() => void>(() => undefined);

  // Listens through the detector until `until` resolves, calling `each` with every probability.
  const withDetector = async (each: (p: number, ms: number) => void, until: Promise<void>) => {
    const detector = await loadDetector();
    let frames: ((c: Float32Array) => Float32Array[]) | undefined;
    let queue = Promise.resolve();
    const t0 = performance.now();
    const ear = await openEar((chunk, rate) => {
      frames ??= framer(rate);
      for (const frame of frames(chunk))
        queue = queue
          .then(async () => each(await detector.detect(frame), performance.now() - t0))
          .catch(() => undefined);
    });
    say(
      `Detector: ${detector.kind}. Capture: echo cancellation ${ear.settings.echoCancellation}, noise suppression ${ear.settings.noiseSuppression}, gain control ${ear.settings.autoGainControl}.`,
    );
    try {
      await until;
    } finally {
      ear.stop();
    }
  };

  const twoCaptures = async () => {
    setBusy("Say: one, two, three, four, five. Then wait.");
    const Class = ((window as unknown as { SpeechRecognition?: new () => Rec }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition) as
      | (new () => Rec)
      | undefined;
    if (!Class) {
      say("1. Two captures: this browser has no speech recognition. FAIL");
      return setBusy(undefined);
    }
    let heard = "";
    let onsetAt = -1;
    let error = "";
    const segments = segmenter();
    let rec: Rec | undefined;
    const done = new Promise<void>((resolve) => {
      stop.current = resolve;
      setTimeout(resolve, 15_000);
    });
    try {
      await withDetector((p, ms) => {
        const event = segments.push(p);
        if (event === "start" && !rec) {
          onsetAt = ms;
          rec = new Class();
          rec.lang = "en-US";
          rec.continuous = true;
          rec.interimResults = false;
          rec.onresult = (e) => {
            heard = Array.from(e.results, (r) => r[0]?.transcript ?? "").join(" ");
          };
          rec.onerror = (e) => {
            error = e.error;
          };
          rec.onend = () => stop.current();
          rec.start();
        } else if (event === "end") rec?.stop();
      }, done);
    } catch (e) {
      say(`1. Two captures: the microphone could not be opened (${(e as Error).message}). FAIL`);
      return;
    } finally {
      // Stopped, or out of time: no recognition goes on listening after the test.
      rec?.abort();
      setBusy(undefined);
    }
    const first = heard.trim().toLowerCase().split(/\s+/)[0] ?? "";
    say(
      `1. Two captures: onset ${onsetAt < 0 ? "not seen" : `at ${Math.round(onsetAt)} ms`}; heard "${heard.trim()}"${error ? `; recognition error ${error}` : ""}. Recognition beside the detector: ${heard ? "PASS" : "FAIL"}. First word kept: ${["one", "1", "won"].includes(first) ? "PASS" : "FAIL"}.`,
    );
  };

  // Smith speaks the passage with the chosen voice; the watch counts any barge-in.
  const speakWatching = async (prompt: string, label: string, mustFire: boolean) => {
    const synth = window.speechSynthesis;
    const chosen = synth.getVoices().find((v) => v.name === voice);
    if (!chosen) {
      say(`${label}: no voice chosen. FAIL`);
      return;
    }
    setBusy(prompt);
    const watch = bargeWatch();
    let fired = -1;
    // Where the run of speech that fired began: the person's onset, not an earlier echo.
    let runStart = -1;
    let firedRunStart = -1;
    let max = 0;
    let speaking = false;
    const done = new Promise<void>((resolve) => {
      stop.current = () => {
        synth.cancel();
        resolve();
      };
      const pieces = sentences(PASSAGE);
      pieces.forEach((piece, i) => {
        const u = new SpeechSynthesisUtterance(piece);
        u.voice = chosen;
        u.lang = chosen.lang;
        u.onstart = () => {
          speaking = true;
          watch.sentenceStarted();
        };
        if (i === pieces.length - 1) u.onend = () => resolve();
        synth.speak(u);
      });
    });
    try {
      await withDetector((p, ms) => {
        if (!speaking || fired >= 0) return;
        max = Math.max(max, p);
        runStart = p >= 0.5 ? (runStart < 0 ? ms : runStart) : -1;
        if (watch.push(p)) {
          fired = ms;
          firedRunStart = runStart;
          if (mustFire) stop.current();
        }
      }, done);
    } catch (e) {
      say(`${label}: the microphone could not be opened (${(e as Error).message}). FAIL`);
      return;
    } finally {
      synth.cancel();
      setBusy(undefined);
    }
    const latency = fired - firedRunStart;
    if (mustFire)
      say(
        `${label} (${chosen.name}): ${fired < 0 ? "he was not stopped. FAIL" : `stopped ${Math.round(latency)} ms after the person began. ${latency <= 500 ? "PASS" : "FAIL"}`}`,
      );
    else
      say(
        `${label} (${chosen.name}): ${fired < 0 ? `he never stopped himself (highest ${max.toFixed(2)}). PASS` : `he would have stopped himself at ${Math.round(fired)} ms. FAIL`}`,
      );
  };

  const report = () =>
    [`Browser: ${navigator.userAgent}`, `Voice: ${voice ?? "none"}`, ...lines].join("\n");
  return (
    <section
      aria-label="Speech test"
      className="space-y-2 rounded-md border border-line p-2 text-xs"
    >
      <p className="font-medium">Speech test (through the speakers, no headset)</p>
      <div className="flex flex-wrap gap-1.5">
        <Button disabled={Boolean(busy)} onClick={() => void twoCaptures()}>
          1. Two captures
        </Button>
        <Button
          disabled={Boolean(busy)}
          onClick={() =>
            void speakWatching(
              "Stay silent while Smith speaks.",
              "2. Smith never stops himself",
              false,
            )
          }
        >
          2. Stay silent
        </Button>
        <Button
          disabled={Boolean(busy)}
          onClick={() =>
            void speakWatching(
              "Talk over Smith now, in a normal voice.",
              "3. Talking over him stops him",
              true,
            )
          }
        >
          3. Talk over him
        </Button>
        {busy && (
          <Button variant="ghost" onClick={() => stop.current()}>
            Stop
          </Button>
        )}
      </div>
      {busy && <p role="status">{busy}</p>}
      {lines.length > 0 && (
        <>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-line bg-surface p-2">
            {report()}
          </pre>
          <Button variant="ghost" onClick={() => void navigator.clipboard?.writeText(report())}>
            Copy the results
          </Button>
        </>
      )}
    </section>
  );
}
