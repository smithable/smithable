// Smithable app kit: the sentence queue used by Ask and the inspector. Like Smith's player,
// pausing keeps the unfinished sentence, including in browsers that discard paused audio.
const sentences = (text: string) =>
  text
    .match(/[^.!?]+(?:[.!?]+|$)/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [];

// Speech synthesis belongs to the window: starting another answer stops its previous reader.
let owner: (() => void) | undefined;

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
      if (current !== utterance) return;
      queue.shift();
      current = undefined;
      next();
    };
    utterance.onerror = (event) => {
      if (current !== utterance || paused) return;
      if (event.error === "not-allowed") {
        stop();
        blocked();
        return;
      }
      current = undefined;
      queue.shift();
      next();
    };
    synth.speak(utterance);
  };
  const stop = () => {
    current = undefined;
    queue = [];
    paused = false;
    if (owner === stop) {
      owner = undefined;
      synth.cancel();
      synth.resume();
    }
    changed(false);
  };
  return {
    get busy() {
      return queue.length > 0;
    },
    speak(text: string, voice: SpeechSynthesisVoice, rate: number) {
      if (owner !== stop) {
        owner?.();
        owner = stop;
      }
      if (!queue.length && paused) {
        paused = false;
        synth.resume();
      }
      for (const piece of sentences(text)) {
        const utterance = new SpeechSynthesisUtterance(piece);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = rate;
        queue.push(utterance);
      }
      next();
    },
    configure(voice: SpeechSynthesisVoice, rate: number) {
      // The native voice finishes its current sentence; the remaining ones use the new choice.
      for (const utterance of queue) {
        if (utterance === current) continue;
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = rate;
      }
    },
    pause() {
      paused = true;
      if (owner === stop) synth.pause();
      changed(false);
    },
    resume() {
      if (owner !== stop) return;
      paused = false;
      synth.resume();
      if (current && synth.speaking) {
        changed(true);
      } else {
        // Some browsers discard paused audio. Replay only its unfinished sentence.
        if (current) {
          const restart = new SpeechSynthesisUtterance(current.text);
          restart.voice = current.voice;
          restart.lang = current.lang;
          restart.rate = current.rate;
          queue[0] = restart;
          current = undefined;
          synth.cancel();
        }
        next();
      }
    },
    stop,
  };
}
