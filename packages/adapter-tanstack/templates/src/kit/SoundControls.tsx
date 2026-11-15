// Smithable app kit: answer playback.
// Smith's sound toggle, voice samples and speed without a microphone, shared by Ask and the inspector.
// No answer is read until the person plays it.
import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { playback } from "./speech";
import { language, w } from "./words";

const KEY = "ask:speech";
function settings(): { voice: string; rate: number } {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return {
      voice: typeof kept.voice === "string" ? kept.voice : "",
      rate: [1, 1.5, 2].includes(kept.rate) ? kept.rate : 1,
    };
  } catch {
    return { voice: "", rate: 1 };
  }
}

export function SoundControls({ text }: { text: string }) {
  const [synth, setSynth] = useState<SpeechSynthesis>();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [choice, setChoice] = useState({ voice: "", rate: 1 });
  const [playing, setPlaying] = useState(false);
  const [sampling, setSampling] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const player = useRef<ReturnType<typeof playback> | undefined>(undefined);
  const sample = useRef<ReturnType<typeof playback> | undefined>(undefined);
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    setSynth(synth);
    const restore = () => setChoice(settings());
    restore();
    window.addEventListener(KEY, restore);
    const read = () => setVoices(synth.getVoices());
    read();
    synth.addEventListener("voiceschanged", read);
    player.current = playback(synth, setPlaying, () => setBlocked(true));
    sample.current = playback(synth, setSampling, () => setBlocked(true));
    return () => {
      synth.removeEventListener("voiceschanged", read);
      window.removeEventListener(KEY, restore);
      player.current?.stop();
      sample.current?.stop();
      player.current = undefined;
      sample.current = undefined;
    };
  }, []);
  // A changed answer or person cannot resume the previous person's speech.
  useEffect(
    () => () => {
      player.current?.stop();
      sample.current?.stop();
    },
    [text],
  );
  const matching = voices.filter((v) => v.lang.split("-")[0] === language().split("-")[0]);
  const offered = matching.length ? matching : voices;
  const voice = offered.find((v) => v.name === choice.voice) ?? offered[0];
  useEffect(() => {
    if (voice) player.current?.configure(voice, choice.rate);
  }, [voice, choice.rate]);
  const save = (next: typeof choice) => {
    setChoice(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(KEY));
    } catch {}
  };
  if (!synth || !text) return null;
  return (
    <div data-sound className="flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!voice}
        aria-label={blocked ? w.turnOnSound : playing ? w.soundOn : w.soundOff}
        aria-pressed={playing}
        title={playing ? w.pauseSpeech : w.playSpeech}
        onClick={() => {
          if (!voice) return;
          setBlocked(false);
          if (playing) player.current?.pause();
          else if (player.current?.busy) player.current.resume();
          else player.current?.speak(text, voice, choice.rate);
        }}
      >
        {playing ? (
          <Volume2 aria-hidden className="size-4" />
        ) : (
          <VolumeX aria-hidden className="size-4" />
        )}
        {blocked ? w.turnOnSound : playing ? w.soundOn : w.soundOff}
      </Button>
      <label className="flex items-center gap-1 text-xs">
        {w.speechVoice}
        <select
          aria-label={w.speechVoice}
          value={voice?.name ?? ""}
          disabled={!voice}
          className="h-8 max-w-32 rounded-md border border-input bg-background text-xs"
          onChange={(e) => {
            const selected = offered.find((v) => v.name === e.target.value);
            if (!selected) return;
            save({ ...choice, voice: selected.name });
            if (!player.current?.busy) sample.current?.speak(w.voiceSample, selected, choice.rate);
          }}
        >
          {offered.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1 text-xs">
        {w.speechSpeed}
        <select
          aria-label={w.speakingSpeed}
          value={choice.rate}
          className="h-8 rounded-md border border-input bg-background text-xs"
          onChange={(e) => save({ ...choice, rate: Number(e.target.value) })}
        >
          <option value={1}>1.0x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2.0x</option>
        </select>
      </label>
      {(playing || sampling) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            player.current?.stop();
            sample.current?.stop();
          }}
        >
          {w.stopSpeech}
        </Button>
      )}
    </div>
  );
}
