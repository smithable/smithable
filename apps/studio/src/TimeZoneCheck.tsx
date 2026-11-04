// The guide's one question about time (A 220): the app's zone beside the browser's, asked once per
// project in this browser and remembered, since a zone written at `new` is only a guess.
import { useEffect, useState } from "react";
import { zoneAskedKey } from "./guide";

/** The app's time zone as its spec says it. */
export function zoneOf(spec: string | undefined): string | undefined {
  const lines = (spec ?? "").split(/\r?\n/);
  const start = lines.findIndex((l) => /^app:\s*(#.*)?$/.test(l));
  if (start < 0) return undefined;
  let indent: number | undefined;
  for (const line of lines.slice(start + 1)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const own = line.length - line.trimStart().length;
    if (own === 0) return undefined;
    indent ??= own;
    const zone = /^\s*timezone:\s*["']?([\w/+-]+)/.exec(line)?.[1];
    if (own === indent && zone) return zone;
  }
  return undefined;
}

/** A zone's canonical name, so Asia/Calcutta and Asia/Kolkata are one. */
const canonical = (zone: string) => {
  try {
    return new Intl.DateTimeFormat("en", { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    return zone;
  }
};

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
  onAnswered,
}: {
  app: string;
  spec: string | undefined;
  /** Writes the zone to the app; whether it was written. */
  onUse: (zone: string) => Promise<boolean>;
  /** Opens where the app's settings are changed. */
  onChange: () => void;
  /** Once the question is answered, now or before: what comes after it may ask. */
  onAnswered: () => void;
}) {
  const [done, setDone] = useState(() => asked(app));
  useEffect(() => {
    if (done) onAnswered();
  }, [done, onAnswered]);
  if (done) return null;
  const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zone = zoneOf(spec);
  const same = zone !== undefined && canonical(zone) === canonical(browser);
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
      // A card at the window's foot, clear of the menus above and Smith's panel at the side.
      className="fixed bottom-4 left-1/2 z-[60] flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-xs shadow-2xl"
    >
      <span>
        {!zone
          ? `This app has no time zone yet, so its times run on UTC. Yours looks like ${browser}.`
          : same
            ? `Times in this app are in ${zone}, the zone your browser gave.`
            : `Times in this app are in ${zone}. Your browser says ${browser}.`}
      </span>
      {!same && (
        <button
          type="button"
          className={button}
          onClick={() => {
            void onUse(browser).then((written) => written && answered());
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
