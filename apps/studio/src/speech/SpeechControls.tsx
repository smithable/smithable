// Smith's speech controls beside the chat box (docs/design/smith-speech.md §2): the mic (off,
// press to talk; a click without holding listens for one utterance), sound on or off, and the
// voice. The first press of the mic says where the voice goes before the browser asks for it.
import { useRef, useState } from "react";
import { cx } from "../ui";
import { SpeechTest } from "./SpeechTest";
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
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className={cx(BUTTON, speech.listening && "border-red-500 text-red-600")}
          disabled={!speech.canHear || speech.checkingHearing}
          title={
            speech.needsLocalCheck
              ? "Check whether speech recognition can run on this computer"
              : speech.canHear
                ? "Hold to talk (or Ctrl+Shift+Space); click to say one thing"
                : speech.why
          }
          aria-label={
            speech.needsLocalCheck
              ? "Check on-device speech support"
              : `Mic: ${speech.mic === "off" ? "off" : "press to talk"}${speech.listening ? ", listening" : ""}`
          }
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
          <MicIcon />
        </button>
        <button
          type="button"
          className={cx(
            "flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-line px-2 text-xs hover:border-accent disabled:opacity-40",
            speech.blocked && "animate-pulse border-accent",
          )}
          disabled={!speech.canSpeak}
          title={speech.canSpeak ? undefined : speech.why}
          aria-label={speech.blocked ? "Turn on sound" : `Sound: ${speech.sound ? "on" : "off"}`}
          aria-pressed={speech.sound}
          onClick={() => speech.setSound(speech.blocked ? true : !speech.sound)}
        >
          <SpeakerIcon on={speech.sound && !speech.blocked} />
          {speech.blocked ? "Turn on sound" : `Sound ${speech.sound ? "on" : "off"}`}
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
        {speech.canSpeak && (
          <label className="flex items-center gap-1 text-xs">
            Speed
            <select
              aria-label="Speaking speed"
              value={speech.rate}
              onChange={(e) => speech.setRate(Number(e.target.value))}
              className="h-8 rounded-md border border-line bg-panel text-xs"
            >
              <option value={0.85}>Slower</option>
              <option value={1}>Normal</option>
              <option value={1.2}>Faster</option>
            </select>
          </label>
        )}
        {speech.canHear && !speech.needsLocalCheck && (
          <button
            type="button"
            className={cx(
              "h-8 rounded-md border border-line px-2 text-xs",
              speech.auto && "border-accent text-accent",
            )}
            aria-pressed={speech.auto}
            title="Listens by itself while Smith is silent; a headset works best"
            onClick={() => {
              if (!speech.told) setShowWhere(true);
              speech.setAuto(!speech.auto);
            }}
          >
            Automatic
          </button>
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
      {speech.hearingNote && (
        <p role="status" className="text-xs text-quiet">
          {speech.hearingNote}
        </p>
      )}
      {speech.auto && (
        <p className="text-xs text-quiet">
          Listening while Smith is silent; a headset works best.
          {speech.simpleDetector && " A simpler voice detector is in use."}
        </p>
      )}
      {speech.autoNote && (
        <p role="status" className="text-xs text-quiet">
          {speech.autoNote}
        </p>
      )}
      {new URLSearchParams(window.location.search).has("speech-test") && (
        <SpeechTest {...(speech.voice ? { voice: speech.voice } : {})} />
      )}
      {speech.interim && (
        <p aria-live="polite" className="text-xs text-quiet italic">
          {speech.interim}
        </p>
      )}
    </div>
  );
}

/** Drawn, not an emoji: a font without the emoji showed an empty box. */
function MicIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      {on ? (
        <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
      ) : (
        <path d="M17 9l5 6M22 9l-5 6" />
      )}
    </svg>
  );
}
