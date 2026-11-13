// The app as it was at an earlier change (docs/design/old-version-preview.md §4): a copy with its
// own data, shown in the preview's place under Studio's bar. Nothing done in it is kept.
import type { TraceEntry } from "./api";
import { Button } from "./ui";

export interface OpenOld {
  url: string;
  entry: TraceEntry;
  data: "then" | "samples";
  pictures: "today" | "none";
}

export function OldVersion({ open, onBack }: { open: OpenOld; onBack: () => void }) {
  const when = new Date(open.entry.at).toLocaleString([], {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <section aria-label="An old version" className="flex h-full flex-col">
      <div
        role="status"
        className="flex items-center gap-3 border-b border-line bg-subtle px-3 py-1.5 text-sm"
      >
        <p className="flex-1">
          <strong>The app as it was on {when}</strong> · after "{open.entry.description}" ·{" "}
          {open.data === "then" ? "a copy with the data from then" : "with sample data"}
          {open.pictures === "today"
            ? ", today's pictures"
            : open.pictures === "none"
              ? ", without pictures"
              : ""}
          . Nothing you do here is kept.
        </p>
        <Button className="h-7" onClick={onBack}>
          Back to now
        </Button>
      </div>
      <iframe
        title="An old version of the app"
        src={open.url}
        className="min-h-0 flex-1 border-0"
      />
    </section>
  );
}
