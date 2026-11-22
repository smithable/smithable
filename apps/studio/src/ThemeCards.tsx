import { humanize } from "@smithable/core";
import type { Project } from "./api";
import { cx } from "./ui";

/** The same ordered theme cards in Look settings and the first-look picker. */
export function ThemeCards({
  themes,
  preset,
  inUse = preset,
  onChoose,
  onCustomize,
}: {
  themes: Project["themes"];
  /** The card shown pressed: the app's theme, or one only tried on in the preview. */
  preset: string;
  /** The app's own theme, when another is only tried on. */
  inUse?: string;
  onChoose: (preset: string) => void;
  onCustomize?: (preset: string) => void;
}) {
  return (
    <ul aria-label="Themes" className="grid grid-cols-2 gap-2">
      {themes.map((t) => {
        const current = t.name === preset;
        const said = t.name === inUse ? "In use" : current ? "Trying on" : undefined;
        return (
          <li key={t.name}>
            <button
              type="button"
              aria-label={`Use ${humanize(t.name)} theme`}
              aria-pressed={current}
              onClick={() => !current && onChoose(t.name)}
              className={cx(
                "w-full overflow-hidden rounded-md border text-left",
                current
                  ? "border-accent ring-4 ring-accent/40"
                  : "border-line hover:border-line-strong",
              )}
            >
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(t.thumbnail)}`}
                alt=""
                width={320}
                height={100}
                className="block h-auto w-full"
              />
              <span className={cx("block px-2 py-1.5 text-xs", current && "bg-accent-soft")}>
                <span className="font-medium">{humanize(t.name)}</span>
                {/* The one in use (or only tried on) says so in words, not only by its outline. */}
                {said && <span className="ml-1.5 font-medium text-accent">· {said}</span>}
                <span className="block text-quiet">
                  {t.source === "project" ? `themes/${t.name}.yml · ` : ""}
                  {t.font}
                </span>
              </span>
            </button>
            {onCustomize && (
              <button
                type="button"
                className="mt-1 rounded border border-line px-2 py-1 text-xs"
                aria-label={`Customize ${humanize(t.name)}`}
                onClick={() => onCustomize(t.name)}
              >
                Customize this
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
