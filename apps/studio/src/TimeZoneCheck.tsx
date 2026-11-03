// The guide's one question about time (A 220): the app's zone beside the browser's, asked once per
// project in this browser and remembered, since a zone written at `new` is only a guess.
import { useState } from "react";
import { zoneAskedKey } from "./guide";

/** The app's time zone as its spec says it. */
export function zoneOf(spec: string | undefined): string | undefined {
  return /^app:\n(?:[ \t]+.*\n)*?[ \t]+timezone:[ \t]*["']?([\w/+-]+)/m.exec(spec ?? "")?.[1];
}

const asked = (app: string) => {
  try {
    return localStorage.getItem(zoneAskedKey(app)) === "1";
  } catch {
    return true;
  }
};

export function TimeZoneCheck({
  app,
  spec,
  onUse,
  onChange,
}: {
  app: string;
  spec: string | undefined;
  /** Writes the zone to the app. */
  onUse: (zone: string) => void;
  /** Opens where the app's settings are changed. */
  onChange: () => void;
}) {
  const [done, setDone] = useState(() => asked(app));
  if (done) return null;
  const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zone = zoneOf(spec);
  const answered = () => {
    try {
      localStorage.setItem(zoneAskedKey(app), "1");
    } catch {
      // Private browsing: it may ask again another day.
    }
    setDone(true);
  };
  const button = "rounded border border-line px-2 py-0.5 text-xs font-medium hover:bg-hover";
  return (
    <div
      data-part="time-zone-check"
      role="status"
      className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-3 py-1.5 text-xs"
    >
      <span>
        {!zone
          ? `This app has no time zone yet, so its times run on UTC. Yours looks like ${browser}.`
          : zone === browser
            ? `Times in this app are in ${zone}, the zone your browser gave.`
            : `Times in this app are in ${zone}. Your browser says ${browser}.`}
      </span>
      {zone !== browser && (
        <button
          type="button"
          className={button}
          onClick={() => {
            onUse(browser);
            answered();
          }}
        >
          Use {browser}
        </button>
      )}
      <button type="button" className={button} onClick={answered}>
        {zone ? `Keep ${zone}` : "Not now"}
      </button>
      <button
        type="button"
        className={button}
        onClick={() => {
          onChange();
          answered();
        }}
      >
        Choose another
      </button>
    </div>
  );
}
