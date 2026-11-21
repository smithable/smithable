// Smith’s speech controls beside the chat box. The first mic press explains where voice goes.
import { type ComponentProps, type KeyboardEvent, useId, useRef, useState } from "react";
import { cx } from "../ui";
import { SpeechTest } from "./SpeechTest";
import type { Speech } from "./useSpeech";

function IconButton({
  label,
  tip = label,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { label: string; tip?: string }) {
  const tipId = useId();
  return (
    <button
      type="button"
      {...props}
      aria-label={label}
      aria-describedby={tip === label ? undefined : tipId}
      className={cx(
        "group relative flex size-8 shrink-0 items-center justify-center rounded-md border border-line text-fg-soft hover:bg-subtle focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40",
        className,
      )}
    >
      {children}
      <span
        id={tipId}
        role="tooltip"
        className={cx(
          "pointer-events-none invisible absolute bottom-full left-0 z-30 mb-1 w-max max-w-44 rounded bg-fg px-2 py-1 text-xs font-normal text-panel",
          !props["aria-expanded"] && "group-hover:visible group-focus-visible:visible",
        )}
      >
        {tip}
      </span>
    </button>
  );
}

export function SpeechControls({
  speech,
  inputDisabled = false,
}: {
  speech: Speech;
  inputDisabled?: boolean;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const settingsId = useId();
  const onCall = speech.call !== "idle";
  const listening = speech.listening || speech.call === "active";
  const soundOn = speech.sound && !speech.blocked;
  const closeSettings = (event: KeyboardEvent) => {
    if (!settingsOpen || event.key !== "Escape") return;
    event.preventDefault();
    setSettingsOpen(false);
    settingsButton.current?.focus();
  };
  if (!speech.canHear && !speech.canSpeak)
    return (
      <p data-speech-off className="text-xs text-quiet">
        {speech.why}
      </p>
    );
  return (
    <div data-speech className="space-y-1">
      <div className="relative flex items-center gap-1.5">
        <IconButton
          className={cx(listening && "text-red-700 dark:text-red-300")}
          disabled={inputDisabled || onCall || !speech.canHear || speech.checkingHearing}
          tip={
            speech.needsLocalCheck
              ? "Check whether speech recognition can run on this computer"
              : !speech.canHear
                ? speech.why
                : speech.listening
                  ? "Turn microphone off"
                  : "Turn microphone on"
          }
          label={
            speech.needsLocalCheck
              ? "Check on-device speech support"
              : `Mic: ${listening ? "on" : "off"}`
          }
          aria-pressed={listening}
          onClick={speech.toggleMic}
        >
          <MicIcon on={listening} />
        </IconButton>
        <IconButton
          className={cx(onCall && "border-accent text-accent")}
          disabled={
            !onCall &&
            (inputDisabled || !speech.canHear || !speech.canSpeak || speech.checkingHearing)
          }
          label={onCall ? "End call" : "Start call"}
          onClick={onCall ? speech.endCall : speech.startCall}
        >
          <PhoneIcon active={onCall} />
        </IconButton>
        <IconButton
          className={cx(speech.blocked && "animate-pulse border-accent")}
          disabled={!speech.canSpeak}
          label={soundOn ? "Turn Smith's voice off" : "Turn Smith's voice on"}
          onClick={() => speech.setSound(!soundOn)}
        >
          <SpeakerIcon on={soundOn} />
        </IconButton>
        {speech.canSpeak && (
          <fieldset
            className="m-0 min-w-0 border-0 p-0"
            aria-label="Voice preferences"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setSettingsOpen(false);
            }}
          >
            <IconButton
              ref={settingsButton}
              label="Voice settings"
              aria-expanded={settingsOpen}
              aria-controls={settingsId}
              onKeyDown={closeSettings}
              onClick={() => {
                setSettingsOpen(!settingsOpen);
                settingsButton.current?.focus();
              }}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4" />
              </svg>
            </IconButton>
            <div
              id={settingsId}
              hidden={!settingsOpen}
              className="absolute bottom-full left-0 z-20 mb-1.5 w-52 max-w-full space-y-2 rounded-md border border-line bg-panel p-2 shadow-lg"
            >
              <label className="flex items-center justify-between gap-2 text-xs">
                Voice
                <select
                  title={speech.where}
                  value={speech.voice}
                  onKeyDown={closeSettings}
                  onChange={(e) => speech.setVoice(e.target.value)}
                  className="h-8 min-w-0 rounded-md border border-line bg-panel text-xs"
                >
                  {speech.voices.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-2 text-xs">
                Speed
                <select
                  value={speech.rate}
                  onKeyDown={closeSettings}
                  onChange={(e) => speech.setRate(Number(e.target.value))}
                  className="h-8 rounded-md border border-line bg-panel text-xs"
                >
                  <option value={1}>1.0x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2.0x</option>
                </select>
              </label>
            </div>
          </fieldset>
        )}
        {speech.speaking && (
          <IconButton label="Stop speaking" onClick={speech.stopSpeaking}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </IconButton>
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
      {speech.callNote && (
        <p role="status" className="text-xs text-quiet">
          {speech.callNote}
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
function MicIcon({ on }: { on: boolean }) {
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
      <rect x="9" y="3" width="6" height="11" rx="3" fill={on ? "currentColor" : "none"} />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function PhoneIcon({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill={active ? "currentColor" : "none"}
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
