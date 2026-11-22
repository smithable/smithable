// A hero's film in its selection form, under its picture (docs/design/section-film.md §1): the
// owner's own MP4, tried on like the picture (Cancel undoes it), Remove. Studio's server reads the
// file's bytes against the rules and names the one it breaks; the form checks only type and size.
import type { ContentImage } from "@smithable/core";
import { useState } from "react";
import { pictureName } from "./SectionPicture";

export const FILM_MAX_BYTES = 5_000_000;

/** Why a chosen file is not sent, or undefined: by its type and size, before anything is read. */
export function filmFileRefusal(file: { type: string; size: number }): string | undefined {
  if (file.type !== "video/mp4") return "A film is an MP4 file.";
  if (file.size > FILM_MAX_BYTES)
    return `This file is ${(file.size / 1_000_000).toFixed(1)} MB; a film is at most 5 MB.`;
  return undefined;
}

export function SectionFilm({
  page,
  section,
  film,
  change,
  busy,
}: {
  page: string;
  section: string;
  film: ContentImage["film"];
  change: (src?: string, file?: { path: string; data: string }) => void;
  busy: boolean;
}) {
  const [refused, setRefused] = useState<string>();
  const [reading, setReading] = useState(false);
  const held = busy || reading;
  const replace = (file: File | undefined) => {
    setRefused(undefined);
    if (!file) return;
    const why = filmFileRefusal(file);
    if (why) return setRefused(why);
    const reader = new FileReader();
    setReading(true);
    reader.onerror = () => {
      setReading(false);
      setRefused("This file could not be read.");
    };
    reader.onload = () => {
      setReading(false);
      const data = String(reader.result).split(",")[1] ?? "";
      const src = pictureName(page, section, "mp4", Date.now());
      change(src, { path: `public/${src}`, data });
    };
    reader.readAsDataURL(file);
  };
  return (
    <fieldset className="space-y-2" data-section-film>
      <legend className="text-xs text-muted">Film</legend>
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate text-sm text-quiet">
          {film ? film.src.slice("images/".length) : "No film: the picture stands still."}
        </span>
        <label className="ml-auto shrink-0 cursor-pointer rounded border border-line px-2 py-1 text-sm hover:bg-subtle focus-within:ring-2 focus-within:ring-accent has-[:disabled]:opacity-60">
          {film ? "Replace" : "Add a film"}
          <input
            type="file"
            accept=".mp4,video/mp4"
            className="sr-only"
            disabled={held}
            onChange={(event) => {
              replace(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {film && (
          <button
            type="button"
            disabled={held}
            className="shrink-0 rounded border border-line px-2 py-1 text-sm hover:bg-subtle disabled:opacity-60"
            onClick={() => change()}
          >
            Remove
          </button>
        )}
      </div>
      {refused && (
        <p role="alert" className="text-xs text-red-700">
          {refused}
        </p>
      )}
      <p className="text-xs text-quiet">
        A short silent loop over the picture: MP4 (H.264), 3 to 12 seconds, at most 1920 by 1080 and
        5 MB. It must not flash more than three times a second. Visitors who ask for less motion see
        the picture.
      </p>
    </fieldset>
  );
}
