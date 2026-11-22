// The release review's pictures (docs/design/picture-kinds.md §6): the hero's, and those of
// sections whose pictures are the owner's work, that an image model made. Published as they are
// they would present work nobody did, so each offers the owner's own file, Keep, or Remove. Each
// is one operation (setSectionPicture, keepPicture) that undo takes back; none stops publishing.
import { useState } from "react";
import { api, type ReleaseReview } from "./api";
import { fileRefusal, PICTURE_TYPES, pictureName } from "./builder/SectionPicture";

type Picture = NonNullable<ReleaseReview["pictures"]>[number];

export const pictureWhere = (p: Picture) =>
  `${p.section === "hero" ? "The hero" : `The ${p.section} section`}${p.item === undefined ? "" : `, picture ${p.item + 1}`} on ${p.page}`;

export function ReviewPictures({
  pictures,
  reload,
}: {
  pictures: Picture[];
  reload: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string>();
  const run = async (
    picture: Picture,
    args: { src?: string; keep?: true },
    file?: { path: string; data: string },
  ) => {
    setBusy(true);
    setRefused(undefined);
    const { page, section, item, alt } = picture;
    const result = await api
      .operation(
        args.keep ? "keepPicture" : "setSectionPicture",
        {
          page,
          section,
          ...(item === undefined ? {} : { item }),
          ...(args.src ? { src: args.src, alt } : {}),
          was: picture.src,
        },
        false,
        file,
      )
      .catch((e: Error) => ({ ok: false, output: e.message }));
    if (!result.ok) setRefused(result.output);
    await reload();
    setBusy(false);
  };
  const replace = (picture: Picture, file: File | undefined) => {
    setRefused(undefined);
    if (!file) return;
    const why = fileRefusal(file);
    if (why) return setRefused(why);
    const reader = new FileReader();
    setBusy(true);
    reader.onerror = () => {
      setBusy(false);
      setRefused("This file could not be read.");
    };
    reader.onload = () => {
      const data = String(reader.result).split(",")[1] ?? "";
      const name = `${picture.section}${picture.item === undefined ? "" : `-${picture.item + 1}`}`;
      const src = pictureName(picture.page, name, PICTURE_TYPES[file.type] as string, Date.now());
      void run(picture, { src }, { path: `public/${src}`, data });
    };
    reader.readAsDataURL(file);
  };
  return (
    <>
      <p>
        An image model made these pictures. Where they show your work or your business, people may
        take them for real jobs: replace them with your own photos, keep them, or remove them.
        Publishing is not held up by them.
      </p>
      <ul className="space-y-2" data-review-pictures>
        {pictures.map((p) => (
          <li
            key={`${p.page}:${p.section}:${p.item ?? ""}`}
            className="flex items-center gap-2"
            data-review-picture
          >
            <img
              src={`/api/${p.src}`}
              alt=""
              className="h-12 w-16 shrink-0 rounded border border-line object-cover"
            />
            <span className="min-w-0 flex-1">
              {pictureWhere(p)}
              <span className="block truncate text-muted">{p.alt}</span>
            </span>
            <label className="cursor-pointer rounded border border-line px-2 py-1 hover:bg-subtle focus-within:ring-2 focus-within:ring-accent has-[:disabled]:opacity-60">
              Replace
              <input
                type="file"
                accept=".webp,.avif,.png,.jpg,.jpeg"
                className="sr-only"
                disabled={busy}
                aria-label={`Replace: ${pictureWhere(p)}`}
                onChange={(event) => {
                  replace(p, event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              aria-label={`Keep: ${pictureWhere(p)}`}
              className="rounded border border-line px-2 py-1 hover:bg-subtle disabled:opacity-60"
              onClick={() => void run(p, { keep: true })}
            >
              Keep
            </button>
            <button
              type="button"
              disabled={busy}
              aria-label={`Remove: ${pictureWhere(p)}`}
              className="rounded border border-line px-2 py-1 hover:bg-subtle disabled:opacity-60"
              onClick={() => void run(p, {})}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {refused && <p role="alert">{refused}</p>}
    </>
  );
}
