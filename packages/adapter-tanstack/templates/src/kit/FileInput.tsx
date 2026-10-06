// Smithable app kit: choosing a document for a record (a contract, a CV, a receipt). The file
// travels as it is; the server reads its kind from its own first bytes and stores it
// (src/kit/uploads.ts). The form keeps it as JSON text, as its other values are text, and the
// record stores { file, name, type, size }.
import { ChevronDown, ChevronUp, FilePlus, FileText, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { fileSize } from "./format";
import type { FieldControlProps } from "./model";
import { w } from "./words";

export interface FileValue {
  file: string;
  name: string;
  type: string;
  size: number;
}

/** What the browser may offer: the kinds the server takes (it checks again). */
const ACCEPT = ".pdf,.docx,.xlsx,.pptx,.odt,.ods,.odp,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp";

/** Sends a document to the field's upload address; what the record keeps of it, or why not. */
async function send(model: string, field: string, file: File): Promise<FileValue> {
  const response = await fetch(`/files/${model}/${field}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: file,
  });
  if (!response.ok) throw new Error((await response.text()) || w.fileNotAdded);
  return (await response.json()) as FileValue;
}

/** A document's name and size, a link once the record holds it. */
function Shown({ value, href }: { value: FileValue; href?: string }) {
  const text = (
    <>
      <FileText aria-hidden className="size-4 shrink-0" />
      <span className="truncate">{value.name}</span>
      <span className="shrink-0 text-muted-foreground">{fileSize(value.size)}</span>
    </>
  );
  return href ? (
    <a href={href} className="flex min-w-0 items-center gap-2 underline-offset-4 hover:underline">
      {text}
    </a>
  ) : (
    <span className="flex min-w-0 items-center gap-2">{text}</span>
  );
}

/** The document input for one field of `model`, bound for the form's `input` hook. */
export function bindFile(model: string, field: string) {
  return (props: FieldControlProps) => <FileInput {...props} model={model} field={field} />;
}

export function FileInput({
  id,
  name,
  value,
  record,
  onChange,
  model,
  field,
  ...aria
}: FieldControlProps & { model: string; field: string }) {
  const current = parse(value);
  // The saved one is served from its record; one just chosen is not saved yet.
  const [saved] = useState(() => parse(value)?.file);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  async function choose(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setFailure(undefined);
    try {
      onChange(JSON.stringify(await send(model, field, file)));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : w.fileNotAdded);
    } finally {
      setBusy(false);
    }
  }
  const href =
    current && record !== undefined && current.file === saved
      ? `/files/${model}/${record}/${field}`
      : undefined;
  return (
    <div className="space-y-2" {...aria}>
      {current ? (
        <div className="flex flex-wrap items-center gap-3">
          <Shown value={current} href={href} />
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
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <FilePlus aria-hidden className="size-4" /> {busy ? w.adding : w.chooseFile}
        </Button>
      )}
      <input
        ref={fileInput}
        id={id}
        name={name}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
    </div>
  );
}

/** The documents input (several, in order) for one field of `model`. */
export function bindFiles(model: string, field: string, max: number) {
  return (props: FieldControlProps) => (
    <FilesInput {...props} model={model} field={field} max={max} />
  );
}

export function FilesInput({
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
  const files = parseList(value);
  // A saved document is served by its place in the saved record, which moving does not change
  // until the record is saved.
  const [stored] = useState(() => new Map(parseList(value).map((f, i) => [f.file, i])));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const set = (next: FileValue[]) => onChange(next.length ? JSON.stringify(next) : "");
  async function add(chosen: FileList | null) {
    if (!chosen?.length) return;
    setBusy(true);
    setFailure(undefined);
    let next = files;
    try {
      for (const file of [...chosen].slice(0, max - files.length)) {
        next = [...next, await send(model, field, file)];
        set(next);
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : w.fileNotAdded);
    } finally {
      setBusy(false);
    }
  }
  const move = (from: number, to: number) => {
    const next = [...files];
    const [taken] = next.splice(from, 1);
    if (taken) next.splice(to, 0, taken);
    set(next);
  };
  return (
    <div className="space-y-2" {...aria}>
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => {
            const at = stored.get(f.file);
            return (
              <li key={f.file} className="flex items-center gap-2">
                <Shown
                  value={f}
                  href={
                    at !== undefined && record !== undefined
                      ? `/files/${model}/${record}/${field}/${at}`
                      : undefined
                  }
                />
                <span className="ml-auto flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={w.moveEarlier(f.name)}
                    disabled={i === 0}
                    onClick={() => move(i, i - 1)}
                  >
                    <ChevronUp aria-hidden className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={w.moveLater(f.name)}
                    disabled={i === files.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    <ChevronDown aria-hidden className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={w.removeIt(f.name)}
                    onClick={() => set(files.filter((_, j) => j !== i))}
                  >
                    <X aria-hidden className="size-4" />
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {files.length < max && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <FilePlus aria-hidden className="size-4" /> {busy ? w.adding : w.addFiles}
        </Button>
      )}
      <input
        ref={fileInput}
        id={id}
        name={name}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = "";
        }}
      />
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
    </div>
  );
}

function parse(value: string): FileValue | undefined {
  try {
    const parsed = value ? (JSON.parse(value) as FileValue) : undefined;
    return parsed && typeof parsed.file === "string" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function parseList(value: string): FileValue[] {
  try {
    const parsed = value ? (JSON.parse(value) as FileValue[]) : [];
    return Array.isArray(parsed) ? parsed.filter((f) => typeof f?.file === "string") : [];
  } catch {
    return [];
  }
}
