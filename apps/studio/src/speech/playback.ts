import { sentences } from "./words";

/** Keep the current sentence until it finishes, including when a browser loses a paused voice. */
export function playback(
  synth: SpeechSynthesis,
  changed: (speaking: boolean) => void,
  blocked: () => void,
) {
  let queue: SpeechSynthesisUtterance[] = [];
  let current: SpeechSynthesisUtterance | undefined;
  let paused = false;
  const next = () => {
    if (paused || current) return;
    current = queue[0];
    if (!current) return changed(false);
    const utterance = current;
    utterance.onstart = () => {
      if (current === utterance && !paused) changed(true);
    };
    utterance.onend = () => {
      if (current !== utterance || paused) return;
      queue.shift();
      current = undefined;
      next();
    };
    utterance.onerror = (event) => {
      if (current !== utterance || paused) return;
      if (event.error === "not-allowed") blocked();
      current = undefined;
      queue = [];
      changed(false);
    };
    synth.speak(utterance);
  };
  return {
    speak(text: string, voice: SpeechSynthesisVoice, rate: number) {
      for (const piece of sentences(text)) {
        const utterance = new SpeechSynthesisUtterance(piece);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = rate;
        queue.push(utterance);
      }
      next();
    },
    pause() {
      paused = true;
      synth.pause();
      changed(false);
    },
    resume() {
      paused = false;
      synth.resume();
      if (current && synth.speaking) {
        changed(true);
      } else {
        // Some browsers discard paused audio. Replay only its unfinished sentence.
        if (current) {
          current.onend = null;
          current.onerror = null;
          current = undefined;
          synth.cancel();
        }
        next();
      }
    },
    stop() {
      current = undefined;
      queue = [];
      paused = false;
      synth.cancel();
      changed(false);
    },
  };
}
