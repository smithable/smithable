// What an entry of Behavior can do beyond its settings (docs/design/studio-v3.md §5): a kind of
// record's records from a file, a page's code made the person's own.
import { useState } from "react";
import { api } from "../api";
import { CUSTOM_CODE_DOCS } from "../docs";
import { Button } from "../ui";
import type { Run } from "./ChangeForms";

/**
 * Records from a spreadsheet for one kind of record: the file is read here and sent as text; a
 * dry run shows the first rows as they would land and every problem, then Import adds them all
 * (undo takes them back).
 */
export function ImportRecords({ model, run }: { model: string; run: Run }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string>();
  const [preview, setPreview] = useState<{ ok: boolean; output: string }>();
  if (!open)
    return (
      <button
        type="button"
        className="h-6 rounded-md border border-line px-2 text-xs"
        onClick={() => setOpen(true)}
      >
        Import records from a file…
      </button>
    );
  return (
    <div className="w-full space-y-2 rounded-md border border-line p-2">
      <label className="block space-y-1 text-xs">
        <span>A CSV file with a header row; its columns are matched to the fields by name.</span>
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          className="block text-sm"
          onChange={async (e) => {
            const input = e.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            const csv = await file.text();
            // Read: the same file can be picked again (after fixing it).
            input.value = "";
            setText(csv);
            const result = await api
              .operation("importRecords", { model, text: csv, dryRun: true })
              .catch((error: Error) => ({ ok: false, output: error.message }));
            setPreview({ ok: result.ok, output: result.output.trim() });
          }}
        />
      </label>
      {preview && (
        <pre
          role="status"
          aria-label="Import preview"
          className={`max-h-64 overflow-auto rounded border p-2 text-xs whitespace-pre-wrap ${preview.ok ? "border-line bg-panel" : "border-red-200 bg-red-50 text-red-800"}`}
        >
          {preview.output}
        </pre>
      )}
      <div className="flex gap-2">
        <Button
          disabled={!text || !preview?.ok}
          onClick={async () => {
            if (text && (await run("importRecords", { model, text }))) {
              setText(undefined);
              setPreview(undefined);
              setOpen(false);
            }
          }}
        >
          Import
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * A page's code made the person's own (what-it-does.md §3): its component in src/custom/pages,
 * which Smithable then never overwrites, opened in the person's own editor.
 */
export function OwnCode({
  page,
  own,
  files = [],
  dir,
}: {
  page: string;
  own: boolean;
  /** Its files under src/custom/pages, once it is the person's own. */
  files?: string[];
  dir?: string;
}) {
  const [said, setSaid] = useState<{ ok: boolean; text: string }>();
  // What the customize said stays in view once the page is the person's own: the files' refresh
  // may say so before the call has answered.
  const status = said && (
    <p role="status" className={said.ok ? "text-xs text-muted" : "text-xs text-red-700"}>
      {said.text}
    </p>
  );
  if (own)
    return (
      <div className="space-y-1">
        {status}
        <CodeFiles files={files.length ? files : [`src/custom/pages/${page}.tsx`]} dir={dir} />
      </div>
    );
  return (
    <div className="space-y-1">
      <button
        type="button"
        className="h-6 rounded-md border border-line px-2 text-xs"
        title="Its component is copied to src/custom/pages, which Smithable never overwrites: from then on the page's code is yours to keep working."
        onClick={async () => {
          const result = await api
            .customize(page)
            .catch((e: Error) => ({ ok: false, output: e.message }));
          const lines = result.output.split("\n").filter((l) => l.trim());
          setSaid({ ok: result.ok, text: result.ok ? (lines.at(-1) ?? "") : result.output });
        }}
      >
        Make this page's code your own
      </button>
      <p className="text-xs text-muted">
        Smithable then never changes it again, so later changes to the page are yours to make in the
        code.{" "}
        <a
          href={CUSTOM_CODE_DOCS}
          target="_blank"
          rel="noreferrer"
          className="text-accent underline"
        >
          About custom code
        </a>
      </p>
      {status}
    </div>
  );
}

/** A file of the project opened in the person's editor: VS Code's link, where the folder is known. */
export const editorLink = (dir: string, path: string) => {
  const full = `${dir.replace(/[\\/]$/, "")}/${path}`;
  // A path from the root (/home/…) follows the scheme as it is; a drive (C:/…) after one slash.
  return `vscode://file${full.startsWith("/") ? "" : "/"}${encodeURI(full)}`;
};

/**
 * Custom code where it stands (what-it-does.md §3, step 4): this part is code the app's maker
 * writes and the app's tests run, a link to the docs, and each of its files with "Open in your
 * editor" on the person's own machine (the path to copy everywhere).
 */
export function CodeFiles({ files, dir }: { files: string[]; dir?: string }) {
  const [copied, setCopied] = useState<string>();
  return (
    <div data-part="code-files" className="space-y-1 rounded-md border border-line p-2">
      <p className="text-xs text-muted">
        This is code: the app's maker writes it, and the app's tests run it.{" "}
        <a
          href={CUSTOM_CODE_DOCS}
          target="_blank"
          rel="noreferrer"
          className="text-accent underline"
        >
          About custom code
        </a>
      </p>
      {files.length ? (
        <ul className="space-y-1">
          {files.map((path) => (
            <li key={path} className="flex flex-wrap items-center gap-2 text-xs">
              <code className="rounded bg-panel px-1">{path}</code>
              {dir && (
                <a href={editorLink(dir, path)} className="text-accent underline">
                  Open in your editor
                </a>
              )}
              <button
                type="button"
                className="h-6 rounded-md border border-line px-2"
                onClick={async () => {
                  await navigator.clipboard?.writeText(path).catch(() => undefined);
                  setCopied(path);
                }}
              >
                {copied === path ? "Copied" : "Copy the path"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-quiet">
          Its file is made with the app's next build, in src/custom/, which Smithable never
          overwrites.
        </p>
      )}
    </div>
  );
}
