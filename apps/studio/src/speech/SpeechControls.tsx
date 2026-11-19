// Smith’s speech controls beside the chat box. The first mic press explains where voice goes.
import { cx } from "../ui";
import { SpeechTest } from "./SpeechTest";
import type { Speech } from "./useSpeech";

const BUTTON =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm hover:border-accent disabled:opacity-40";

export function SpeechControls({
  speech,
  inputDisabled = false,
}: {
  speech: Speech;
  inputDisabled?: boolean;
}) {
  const onCall = speech.call !== "idle";
  const listening = speech.listening || speech.call === "active";
  if (!speech.canHear && !speech.canSpeak)
    return (
      <p data-speech-off className="text-xs text-quiet">
        {speech.why}
      </p>
    );
  return (
    <div data-speech className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="inline-flex items-center rounded-md border border-line">
          <button
            type="button"
            className={cx(BUTTON, listening && "w-auto gap-1 px-2 text-red-700 dark:text-red-300")}
            disabled={inputDisabled || onCall || !speech.canHear || speech.checkingHearing}
            title={
              speech.needsLocalCheck
                ? "Check whether speech recognition can run on this computer"
                : speech.canHear
                  ? speech.listening
                    ? "Turn microphone off"
                    : "Turn microphone on"
                  : speech.why
            }
            aria-label={
              speech.needsLocalCheck
                ? "Check on-device speech support"
                : `Mic: ${listening ? "on" : "off"}`
            }
            aria-pressed={listening}
            onClick={speech.toggleMic}
          >
            <MicIcon />
            {listening && <span className="text-xs">Listening</span>}
          </button>
          <button
            type="button"
            className="flex h-8 items-center gap-1.5 rounded-md border-l border-line px-2 text-xs hover:bg-subtle disabled:opacity-40"
            disabled={
              !onCall &&
              (inputDisabled || !speech.canHear || !speech.canSpeak || speech.checkingHearing)
            }
            title={!onCall && (!speech.canHear || !speech.canSpeak) ? speech.why : undefined}
            onClick={onCall ? speech.endCall : speech.startCall}
          >
            <PhoneIcon />
            {onCall ? "End call" : "Start call"}
          </button>
          {!onCall && speech.canHear && !speech.needsLocalCheck && (
            <button
              type="button"
              className={cx(
                "h-8 rounded-md px-2 text-xs",
                speech.auto && "border-accent text-accent",
              )}
              aria-pressed={speech.auto}
              disabled={inputDisabled}
              title="Listens by itself while Smith is silent; a headset works best"
              onClick={() => {
                speech.setAuto(!speech.auto);
              }}
            >
              Auto {speech.auto ? "on" : "off"}
            </button>
          )}
        </div>
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
        {speech.canSpeak && (
          <label className="flex items-center gap-1 text-xs">
            Voice
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
          </label>
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
              <option value={1}>1.0x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2.0x</option>
            </select>
          </label>
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
      {speech.notice && (
        <p role="status" className="text-xs text-quiet">
          {speech.notice}
        </p>
      )}
      {speech.hearingNote && (
        <p role="status" className="text-xs text-quiet">
          {speech.hearingNote}
        </p>
      )}
      {speech.call === "starting" && (
        <p role="status" className="text-xs text-quiet">
          Starting call…
        </p>
      )}
      {speech.auto && speech.call === "idle" && (
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

function PhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 3H4a1 1 0 0 0-1 1 17 17 0 0 0 17 17 1 1 0 0 0 1-1v-3l-5-2-2 2a13 13 0 0 1-7-7l2-2-2-5Z" />
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
