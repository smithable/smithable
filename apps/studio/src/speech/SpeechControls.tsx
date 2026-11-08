// Smith's speech controls beside the chat box (docs/design/smith-speech.md §2): the mic (off,
// press to talk; a click without holding listens for one utterance), sound on or off, and the
// voice. The first press of the mic says where the voice goes before the browser asks for it.
import { useRef, useState } from "react";
import { cx } from "../ui";
import type { Speech } from "./useSpeech";

const BUTTON =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-sm hover:border-accent disabled:opacity-40";

export function SpeechControls({ speech }: { speech: Speech }) {
  // Held past a moment it listens until let go; a shorter click listens for one utterance.
  const holding = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);
  const [showWhere, setShowWhere] = useState(false);
  const down = () => {
    if (!speech.told) setShowWhere(true);
    held.current = false;
    holding.current = setTimeout(() => {
      holding.current = undefined;
      held.current = true;
      speech.listen(true);
    }, 250);
  };
  const up = () => {
    if (holding.current) {
      clearTimeout(holding.current);
      holding.current = undefined;
      speech.listen(false);
    } else if (held.current) {
      held.current = false;
      speech.release();
    }
  };
  if (!speech.canHear && !speech.canSpeak)
    return (
      <p data-speech-off className="text-xs text-quiet">
        {speech.why}
      </p>
    );
  return (
    <div data-speech className="space-y-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={cx(BUTTON, speech.listening && "border-red-500 text-red-600")}
          disabled={!speech.canHear}
          title={
            speech.canHear
              ? "Hold to talk (or Ctrl+Shift+Space); click to say one thing"
              : speech.why
          }
          aria-label={`Mic: ${speech.mic === "off" ? "off" : "press to talk"}${speech.listening ? ", listening" : ""}`}
          aria-pressed={speech.listening}
          onPointerDown={(e) => {
            e.preventDefault();
            // Let go anywhere still releases (the pointer stays the button's).
            e.currentTarget.setPointerCapture(e.pointerId);
            down();
          }}
          onPointerUp={up}
          onPointerCancel={up}
          onLostPointerCapture={() => held.current && up()}
          onKeyDown={(e) => {
            if (e.key !== " " || e.repeat) return;
            e.preventDefault();
            down();
          }}
          onKeyUp={(e) => {
            if (e.key !== " ") return;
            e.preventDefault();
            up();
          }}
          onClick={(e) => e.preventDefault()}
        >
          🎙
        </button>
        <button
          type="button"
          className={cx(BUTTON, speech.blocked && "animate-pulse border-accent")}
          disabled={!speech.canSpeak}
          title={speech.canSpeak ? undefined : speech.why}
          aria-label={speech.blocked ? "Turn on sound" : `Sound: ${speech.sound ? "on" : "off"}`}
          aria-pressed={speech.sound}
          onClick={() => speech.setSound(speech.blocked ? true : !speech.sound)}
        >
          {speech.sound && !speech.blocked ? "🔊" : "🔈"}
        </button>
        {speech.canSpeak && speech.voices.length > 1 && (
          <select
            aria-label="Voice"
            title={speech.where}
            value={speech.voice}
            onChange={(e) => speech.setVoice(e.target.value)}
            className="h-8 max-w-32 rounded-md border border-line bg-panel text-xs"
          >
            {speech.voices.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        )}
        {speech.speaking && (
          <button
            type="button"
            className="h-8 rounded-md border border-line px-2 text-xs"
            onClick={speech.stopSpeaking}
          >
            Stop
          </button>
        )}
      </div>
      {showWhere && <p className="text-xs text-quiet">{speech.where}</p>}
      {speech.interim && (
        <p aria-live="polite" className="text-xs text-quiet italic">
          {speech.interim}
        </p>
      )}
    </div>
  );
}
