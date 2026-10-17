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
            const file = e.target.files?.[0];
            if (!file) return;
            const csv = await file.text();
            setText(csv);
            const result = await api.operation("importRecords", {
              model,
              text: csv,
              dryRun: true,
            });
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
export function OwnCode({ page, own }: { page: string; own: boolean }) {
  const [said, setSaid] = useState<{ ok: boolean; text: string }>();
  if (own)
    return (
      <p className="text-xs text-quiet">
        This page's code is your own: src/custom/pages/{page}.tsx, opened in your own editor.
      </p>
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
      {said && (
        <p role="status" className={said.ok ? "text-xs text-muted" : "text-xs text-red-700"}>
          {said.text}
        </p>
      )}
    </div>
  );
}
