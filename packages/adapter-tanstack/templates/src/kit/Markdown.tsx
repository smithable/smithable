// Smithable app kit: Markdown fields. An editor with Write and Preview, and the formatted text.
// The formatter loads only where Markdown is shown, so other pages do not pay for it.
import { lazy, Suspense, useState } from "react";
import { Textarea } from "#/components/ui/input";
import type { FieldControlProps } from "./model";

const Formatted = lazy(() => import("./MarkdownFormatted"));

/** Markdown as formatted text; raw HTML in it is shown as text, never run. */
export function MarkdownText({ text }: { text: string }) {
  return (
    <Suspense fallback={<p className="whitespace-pre-wrap">{text}</p>}>
      <Formatted text={text} />
    </Suspense>
  );
}

export function MarkdownEditor({ value, onChange, record: _, ...control }: FieldControlProps) {
  const [preview, setPreview] = useState(false);
  const tab = (on: boolean) =>
    on
      ? "rounded-md bg-muted px-3 py-1 text-sm font-medium"
      : "rounded-md px-3 py-1 text-sm text-muted-foreground hover:text-foreground";
  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button
          type="button"
          className={tab(!preview)}
          aria-pressed={!preview}
          onClick={() => setPreview(false)}
        >
          Write
        </button>
        <button
          type="button"
          className={tab(preview)}
          aria-pressed={preview}
          onClick={() => setPreview(true)}
        >
          Preview
        </button>
      </div>
      {preview ? (
        <div className="min-h-24 rounded-md border px-3 py-2">
          {value.trim() ? (
            <MarkdownText text={value} />
          ) : (
            <p className="text-muted-foreground">Nothing to preview.</p>
          )}
        </div>
      ) : (
        <Textarea {...control} rows={10} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      <p className="text-xs text-muted-foreground">
        Markdown: **bold**, *italic*, ## a heading, - a list, [a link](https://…)
      </p>
    </div>
  );
}
