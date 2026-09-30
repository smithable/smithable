// Smithable app kit: choosing a picture for a record. The browser scales it to at most 1600 px
// on the long side and encodes WebP, so a phone's 12 MB photo never travels; the server checks
// the file again (src/kit/uploads.ts). The form keeps the picture as JSON text, as its other
// values are text, and stores { file, alt, width, height } on the record.
import { ImagePlus, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Input, Label } from "#/components/ui/input";
import type { FieldControlProps } from "./model";

export interface PictureValue {
  file: string;
  alt: string;
  width: number;
  height: number;
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
      (blob) => (blob ? resolve(blob) : reject(new Error("The picture could not be read."))),
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
      if (!response.ok) throw new Error((await response.text()) || "The picture was refused.");
      const stored = (await response.json()) as Omit<PictureValue, "alt">;
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(webp));
      onChange(JSON.stringify({ ...stored, alt: parse(latest.current)?.alt ?? "" }));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "The picture could not be added.");
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
            <img
              src={src}
              alt={picture.alt}
              width={picture.width}
              height={picture.height}
              className="h-32 w-auto rounded-md border object-cover"
            />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
              {picture.width}×{picture.height}
            </div>
          )}
          <div className="grow space-y-2">
            <Label htmlFor={altId}>Description (for those who cannot see it)</Label>
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
                Replace
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => onChange("")}>
                <X aria-hidden className="size-4" /> Remove
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
          <ImagePlus aria-hidden className="size-4" /> {busy ? "Adding…" : "Choose a picture"}
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
