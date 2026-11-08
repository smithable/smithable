import { expect, test } from "vitest";
import { bargeWatch, FRAME, framer, segmenter, simpleDetector } from "./vad-core";

test("the microphone's chunks become 16 kHz frames of 512 samples", () => {
  const push = framer(48000);
  let frames: Float32Array[] = [];
  // One second at 48 kHz in chunks of 128 (an AudioWorklet's), a constant level.
  for (let i = 0; i < 375; i++) frames = frames.concat(push(new Float32Array(128).fill(0.5)));
  expect(frames).toHaveLength(Math.floor(16000 / FRAME));
  expect(frames[0]?.length).toBe(FRAME);
  expect(frames[0]?.[0]).toBeCloseTo(0.5);
  // A rate that does not divide evenly loses nothing over time.
  const odd = framer(44100);
  let count = 0;
  for (let i = 0; i < 345; i++) count += odd(new Float32Array(128)).length;
  expect(count).toBe(Math.floor(Math.floor((345 * 128 * 16000) / 44100) / FRAME));
});

test("an utterance starts at the first speech and ends after about 800 ms of silence; a blip is a misfire", () => {
  const seg = segmenter();
  const run = (ps: number[]) => ps.map((p) => seg.push(p)).filter(Boolean);
  // 32 ms frames: half a second of speech, a short pause that does not end it, more, then silence.
  expect(
    run([
      ...Array(16).fill(0.9),
      ...Array(10).fill(0.1),
      ...Array(5).fill(0.9),
      ...Array(25).fill(0.1),
    ]),
  ).toEqual(["start", "end"]);
  // Between the thresholds it goes on.
  expect(run([0.9, ...Array(40).fill(0.4)])).toEqual(["start"]);
  seg.reset();
  expect(run([0.9, 0.9, ...Array(25).fill(0.1)])).toEqual(["start", "misfire"]);
});

test("barge-in needs an onset held 300 ms above the raised threshold, not in a sentence's first 300 ms", () => {
  const watch = bargeWatch();
  watch.sentenceStarted();
  // Smith's own sentence start, loud: ignored.
  expect(Array.from({ length: 9 }, () => watch.push(0.95)).some(Boolean)).toBe(false);
  // Below the raised threshold: never.
  expect(Array.from({ length: 30 }, () => watch.push(0.7)).some(Boolean)).toBe(false);
  // Held: after ten frames (320 ms).
  const held = Array.from({ length: 12 }, () => watch.push(0.9));
  expect(held.indexOf(true)).toBe(9);
});

test("the simple detector hears a voice-like sound over the room, not the room", () => {
  const detect = simpleDetector();
  const noise = () => Float32Array.from({ length: FRAME }, () => (Math.random() - 0.5) * 0.002);
  const voice = () => Float32Array.from({ length: FRAME }, (_, i) => 0.3 * Math.sin(i / 4));
  let quiet = 0;
  for (let i = 0; i < 50; i++) quiet = Math.max(quiet, detect(noise()));
  expect(quiet).toBeLessThan(0.3);
  expect(detect(voice())).toBeGreaterThan(0.8);
});
