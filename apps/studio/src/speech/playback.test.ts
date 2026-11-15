import { afterEach, expect, test, vi } from "vitest";
import { playback } from "./playback";

afterEach(() => vi.unstubAllGlobals());

function fixture() {
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
  const utterances: SpeechSynthesisUtterance[] = [];
  const synth = {
    speaking: false,
    speak: vi.fn((utterance: SpeechSynthesisUtterance) => {
      utterances.push(utterance);
      synth.speaking = true;
      utterance.onstart?.({} as SpeechSynthesisEvent);
    }),
    pause: vi.fn(),
    resume: vi.fn(),
    cancel: vi.fn(() => {
      synth.speaking = false;
    }),
  };
  const changed = vi.fn();
  const player = playback(synth as unknown as SpeechSynthesis, changed, vi.fn());
  const voice = { name: "Fixture", lang: "en-US" } as SpeechSynthesisVoice;
  return { synth, utterances, changed, player, voice };
}

test("pause/resume retains the utterance and advances only when it finishes", () => {
  const { player, synth, utterances, voice } = fixture();
  player.speak("First sentence. Second sentence.", voice, 1);
  player.pause();
  expect(synth.pause).toHaveBeenCalledOnce();
  player.resume();
  expect(synth.resume).toHaveBeenCalledOnce();
  expect(utterances.map((u) => u.text)).toEqual(["First sentence."]);
  utterances[0]?.onend?.({} as SpeechSynthesisEvent);
  expect(utterances.map((u) => u.text)).toEqual(["First sentence.", "Second sentence."]);
});

test("a browser that loses paused audio restarts only the unfinished sentence", () => {
  const { player, synth, utterances, voice } = fixture();
  player.speak("First. Second. Third.", voice, 1);
  utterances[0]?.onend?.({} as SpeechSynthesisEvent);
  player.pause();
  synth.speaking = false;
  player.resume();
  expect(utterances.map((u) => u.text)).toEqual(["First.", "Second.", "Second."]);
  utterances[2]?.onend?.({} as SpeechSynthesisEvent);
  expect(utterances.at(-1)?.text).toBe("Third.");
});

test("stop discards remaining sentences and ignores a late completion", () => {
  const { player, utterances, voice } = fixture();
  player.speak("First. Second.", voice, 1);
  const late = utterances[0]?.onend;
  player.stop();
  if (utterances[0]) late?.call(utterances[0], {} as SpeechSynthesisEvent);
  player.resume();
  expect(utterances).toHaveLength(1);
});

test("stop after pause releases the native synthesizer for the next reply", () => {
  const { player, synth, utterances, voice } = fixture();
  player.speak("First.", voice, 1);
  player.pause();
  player.stop();
  expect(synth.resume).toHaveBeenCalledOnce();
  player.speak("Next reply.", voice, 1);
  expect(utterances.at(-1)?.text).toBe("Next reply.");
});
test("late canceled events cannot finish the restarted sentence", () => {
  const { player, synth, utterances, voice } = fixture();
  player.speak("First. Second.", voice, 1);
  const old = utterances[0];
  player.pause();
  synth.speaking = false;
  player.resume();
  expect(utterances[1]).not.toBe(old);
  old?.onend?.({} as SpeechSynthesisEvent);
  old?.onerror?.({ error: "canceled" } as SpeechSynthesisErrorEvent);
  expect(utterances).toHaveLength(2);
  utterances[1]?.onend?.({} as SpeechSynthesisEvent);
  expect(utterances.at(-1)?.text).toBe("Second.");
});
test("one failed sentence does not discard subsequent replies", () => {
  const { player, utterances, voice } = fixture();
  player.speak("First. Second.", voice, 1);
  expect(player.busy).toBe(true);
  utterances[0]?.onerror?.({ error: "synthesis-failed" } as SpeechSynthesisErrorEvent);
  expect(utterances.at(-1)?.text).toBe("Second.");
  utterances[1]?.onend?.({} as SpeechSynthesisEvent);
  expect(player.busy).toBe(false);
});
