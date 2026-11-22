// A landing section's own picture in its selection form (a hero's, a media-and-text section's):
// what it shows, Replace with the owner's file, Remove. Each is one setSectionPicture, tried on in
// the form like a layout (Cancel undoes it); an uploaded file goes in with the change and leaves
// with its undo.
import type { ContentImage } from "@smithable/core";
import { useId, useState } from "react";

const TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/avif": "avif",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/**
 * A new file's name under images/, never one that is there: the section's, and the moment, so a
 * replaced picture's smaller copies and the library's record of the old one are never written over.
 */
export const pictureName = (page: string, section: string, ext: string, now: number) =>
  `images/${`${page}-${section}`.toLowerCase().replace(/[^\w-]+/g, "-")}-${now.toString(36)}.${ext}`;

/** Why a chosen file is not sent, or undefined: by its type and size, before anything is read. */
export function fileRefusal(file: { type: string; size: number }): string | undefined {
  if (!TYPES[file.type]) return "A picture is a webp, jpg, png or avif file.";
  if (file.size > 2 * 1024 * 1024)
    return `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB; at most 2 MB.`;
  return undefined;
}

export function SectionPicture({
  page,
  section,
  image,
  change,
  busy,
}: {
  page: string;
  section: string;
  image: ContentImage | undefined;
  change: (args: { src?: string; alt?: string }, file?: { path: string; data: string }) => void;
  busy: boolean;
}) {
  const [alt, setAlt] = useState(image?.alt ?? "");
  const [refused, setRefused] = useState<string>();
  // A file being read: nothing else is sent meanwhile.
  const [reading, setReading] = useState(false);
  const held = busy || reading;
  const altId = useId();
  const replace = (file: File | undefined) => {
    setRefused(undefined);
    if (!file) return;
    const why = fileRefusal(file);
    if (why) return setRefused(why);
    if (!alt.trim()) return setRefused("Say first what the picture shows.");
    const reader = new FileReader();
    setReading(true);
    reader.onerror = () => {
      setReading(false);
      setRefused("This file could not be read.");
    };
    reader.onload = () => {
      setReading(false);
      const data = String(reader.result).split(",")[1] ?? "";
      const src = pictureName(page, section, TYPES[file.type] as string, Date.now());
      change({ src, alt: alt.trim() }, { path: `public/${src}`, data });
    };
    reader.readAsDataURL(file);
  };
  return (
    <fieldset className="space-y-2" data-section-picture>
      <legend className="text-xs text-muted">Picture</legend>
      <div className="flex items-center gap-2">
        {image ? (
          <img
            src={`/api/${image.src}`}
            alt=""
            className="h-12 w-16 shrink-0 rounded border border-line object-cover"
          />
        ) : (
          <span className="text-sm text-quiet">No picture: the section shows its text alone.</span>
        )}
        <label className="ml-auto cursor-pointer rounded border border-line px-2 py-1 text-sm hover:bg-subtle focus-within:ring-2 focus-within:ring-accent has-[:disabled]:opacity-60">
          {image ? "Replace" : "Add a picture"}
          <input
            type="file"
            accept=".webp,.avif,.png,.jpg,.jpeg"
            className="sr-only"
            disabled={held}
            onChange={(event) => {
              replace(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {image && (
          <button
            type="button"
            disabled={held}
            className="rounded border border-line px-2 py-1 text-sm hover:bg-subtle disabled:opacity-60"
            onClick={() => change({})}
          >
            Remove
          </button>
        )}
      </div>
      <label htmlFor={altId} className="block text-xs text-muted">
        What it shows
      </label>
      <div className="flex gap-1">
        <input
          id={altId}
          value={alt}
          className="min-w-0 flex-1 rounded border border-line bg-panel px-2 py-1 text-sm"
          disabled={held}
          onChange={(event) => setAlt(event.target.value)}
        />
        {image && alt.trim() && alt.trim() !== image.alt && (
          <button
            type="button"
            disabled={held}
            className="rounded border border-line px-2 py-1 text-sm hover:bg-subtle disabled:opacity-60"
            onClick={() => change({ src: image.src, alt: alt.trim() })}
          >
            Save
          </button>
        )}
      </div>
      {refused && (
        <p role="alert" className="text-xs text-red-700">
          {refused}
        </p>
      )}
      <p className="text-xs text-quiet">
        Your own file replaces it: webp, jpg, png or avif, at most 2 MB.
      </p>
    </fieldset>
  );
}
