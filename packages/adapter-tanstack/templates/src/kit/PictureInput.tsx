// Smithable app kit: choosing a picture for a record. The browser scales it to at most 1600 px
// on the long side and encodes WebP, so a phone's 12 MB photo never travels; the server checks
// the file again (src/kit/uploads.ts). The form keeps the picture as JSON text, as its other
// values are text, and stores { file, alt, width, height } on the record.
import { ChevronLeft, ChevronRight, ImagePlus, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Input, Label } from "#/components/ui/input";
import { AiMarked } from "./AiMark";
import type { FieldControlProps } from "./model";
import { w } from "./words";

export interface PictureValue {
  file: string;
  alt: string;
  width: number;
  height: number;
  /** Made by an AI (a sample record's picture from the image library): marked where shown. */
  generated?: true;
}

const MAX_SIDE = 1600;

/** A picture as WebP, scaled down to at most MAX_SIDE on the long side. */
async function toWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(w.pictureNotRead))),
      "image/webp",
      0.82,
    ),
  );
}

/** The picture input for one field of `model`, bound for the form's `input` hook. */
export function bindPicture(model: string, field: string) {
  return (props: FieldControlProps) => <PictureInput {...props} model={model} field={field} />;
}

export function PictureInput({
  id,
  name,
  value,
  record,
  onChange,
  model,
  field,
  ...aria
}: FieldControlProps & { model: string; field: string }) {
  const picture = parse(value);
  // The description may be edited while a picture uploads: the upload keeps the latest.
  const latest = useRef(value);
  latest.current = value;
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [preview, setPreview] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const altId = useId();

  async function choose(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setFailure(undefined);
    try {
      const webp = await toWebp(file);
      const response = await fetch(`/files/${model}/${field}`, {
        method: "POST",
        headers: { "Content-Type": "image/webp" },
        body: webp,
      });
      if (!response.ok) throw new Error((await response.text()) || w.pictureRefused);
      const stored = (await response.json()) as Omit<PictureValue, "alt">;
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(webp));
      onChange(JSON.stringify({ ...stored, alt: parse(latest.current)?.alt ?? "" }));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : w.pictureNotAdded);
    } finally {
      setBusy(false);
    }
  }

  // A stored picture shows from its record's address; a picture just chosen from the browser's copy.
  const src =
    preview ?? (picture && record !== undefined ? `/files/${model}/${record}/${field}` : undefined);
  return (
    <div className="space-y-3" {...aria}>
      {picture ? (
        <div className="flex flex-wrap items-start gap-4">
          {src ? (
            <AiMarked generated={picture.generated} className="shrink-0">
              <img
                src={src}
                alt={picture.alt}
                width={picture.width}
                height={picture.height}
                className="h-32 w-auto rounded-md border object-cover"
              />
            </AiMarked>
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
              {picture.width}×{picture.height}
            </div>
          )}
          <div className="grow space-y-2">
            <Label htmlFor={altId}>{w.pictureDescription}</Label>
            <Input
              id={altId}
              value={picture.alt}
              maxLength={200}
              onChange={(e) => onChange(JSON.stringify({ ...picture, alt: e.target.value }))}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                {w.replace}
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => onChange("")}>
                <X aria-hidden className="size-4" /> {w.remove}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus aria-hidden className="size-4" /> {busy ? w.adding : w.choosePicture}
        </Button>
      )}
      <input
        ref={fileInput}
        id={id}
        name={name}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => choose(e.target.files?.[0])}
      />
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
    </div>
  );
}

function parse(value: string): PictureValue | undefined {
  try {
    const parsed = value ? (JSON.parse(value) as PictureValue) : undefined;
    return parsed && typeof parsed.file === "string" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** The pictures input (several pictures, the first the cover) for one field of `model`. */
export function bindPictures(model: string, field: string, max: number) {
  return (props: FieldControlProps) => (
    <PicturesInput {...props} model={model} field={field} max={max} />
  );
}

/**
 * Several pictures as a strip: add (several at once), describe, move, remove; the first is the
 * cover. The form keeps them as JSON text, a list of { file, alt, width, height }.
 */
export function PicturesInput({
  id,
  name,
  value,
  record,
  onChange,
  model,
  field,
  max,
  ...aria
}: FieldControlProps & { model: string; field: string; max: number }) {
  const pictures = parseList(value);
  // A stored picture is served by its place in the saved record, which moving does not change
  // until the record is saved; a new one shows from the browser's copy.
  const [stored] = useState(() => new Map(parseList(value).map((p, i) => [p.file, i])));
  const [previews] = useState(() => new Map<string, string>());
  const latest = useRef(pictures);
  latest.current = pictures;
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [dragged, setDragged] = useState<number>();
  const fileInput = useRef<HTMLInputElement>(null);
  const set = (next: PictureValue[]) => onChange(next.length ? JSON.stringify(next) : "");
  const move = (from: number, to: number) => {
    const next = [...pictures];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    set(next);
  };

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setFailure(undefined);
    try {
      for (const file of [...files].slice(0, max - latest.current.length)) {
        const webp = await toWebp(file);
        const response = await fetch(`/files/${model}/${field}`, {
          method: "POST",
          headers: { "Content-Type": "image/webp" },
          body: webp,
        });
        if (!response.ok) throw new Error((await response.text()) || w.pictureRefused);
        const saved = (await response.json()) as Omit<PictureValue, "alt">;
        previews.set(saved.file, URL.createObjectURL(webp));
        latest.current = [...latest.current, { ...saved, alt: "" }];
        set(latest.current);
      }
      if (files.length > max - pictures.length) setFailure(w.atMostPictures(max));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : w.pictureNotAdded);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const src = (p: PictureValue) =>
    previews.get(p.file) ??
    (record !== undefined && stored.has(p.file)
      ? `/files/${model}/${record}/${field}/${stored.get(p.file)}`
      : undefined);
  return (
    <div className="space-y-3" {...aria}>
      {pictures.length > 0 && (
        <ol className="grid gap-4 sm:grid-cols-2">
          {pictures.map((p, i) => (
            <li
              key={p.file}
              data-part="picture"
              draggable
              onDragStart={() => setDragged(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragged !== undefined && dragged !== i) move(dragged, i);
                setDragged(undefined);
              }}
              className="space-y-2 rounded-md border p-3"
            >
              <div className="relative">
                {src(p) ? (
                  // Opens large: a link, so it works where the form is read only.
                  <a href={src(p)} target="_blank" rel="noreferrer">
                    <AiMarked generated={p.generated}>
                      <img
                        src={src(p)}
                        alt={p.alt}
                        width={p.width}
                        height={p.height}
                        className="aspect-[3/2] w-full rounded-md object-cover"
                      />
                    </AiMarked>
                  </a>
                ) : (
                  <div className="flex aspect-[3/2] items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
                    {p.width}×{p.height}
                  </div>
                )}
                {i === 0 && (
                  <span className="absolute top-2 left-2 rounded-md bg-background px-2 py-0.5 text-xs font-semibold">
                    {w.cover}
                  </span>
                )}
              </div>
              <Label htmlFor={`${id}-alt-${i}`}>{w.pictureDescriptionN(i + 1)}</Label>
              <Input
                id={`${id}-alt-${i}`}
                value={p.alt}
                maxLength={200}
                onChange={(e) =>
                  set(pictures.map((q, j) => (j === i ? { ...q, alt: e.target.value } : q)))
                }
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || i === 0}
                  aria-label={w.movePictureEarlier(i + 1)}
                  onClick={() => move(i, i - 1)}
                >
                  <ChevronLeft aria-hidden className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || i === pictures.length - 1}
                  aria-label={w.movePictureLater(i + 1)}
                  onClick={() => move(i, i + 1)}
                >
                  <ChevronRight aria-hidden className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  aria-label={w.removePicture(i + 1)}
                  onClick={() => set(pictures.filter((_, j) => j !== i))}
                >
                  <X aria-hidden className="size-4" /> {w.remove}
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {pictures.length < max && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus aria-hidden className="size-4" />{" "}
          {busy ? w.adding : pictures.length ? w.addPictures : w.choosePictures}
        </Button>
      )}
      <input
        ref={fileInput}
        id={id}
        name={name}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => add(e.target.files)}
      />
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
    </div>
  );
}

function parseList(value: string): PictureValue[] {
  try {
    const parsed = value ? (JSON.parse(value) as PictureValue[]) : [];
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p?.file === "string") : [];
  } catch {
    return [];
  }
}
