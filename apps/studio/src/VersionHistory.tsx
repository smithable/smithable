import type { TraceEntry } from "./api";
import { entryText, versionTime, type Words } from "./history";
import { Button } from "./ui";

export function VersionHistory({
  entries,
  words,
  onSee,
}: {
  entries: TraceEntry[];
  words: Words;
  onSee?: (entry: TraceEntry) => void;
}) {
  if (!entries.length) return <p className="px-4 py-3 text-sm text-quiet">No changes yet.</p>;

  return (
    <ol aria-label="Version history" className="divide-y divide-line">
      {entries.map((entry, index) => {
        const current = index === 0;
        const description = entryText(entry, words);
        const when = versionTime(entry.at);
        return (
          <li
            key={entry.id}
            aria-current={current ? "true" : undefined}
            className="flex items-start gap-3 px-4 py-3"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium break-words">{description}</p>
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted">
                <time dateTime={entry.at}>{when}</time>
                {current && <span className="font-medium text-accent">Current version</span>}
                {!current && entry.undone && <span>Alternate version</span>}
                {entry.milestone && <span className="break-all">{entry.milestone}</span>}
                {!current && !onSee && <span>Preview unavailable here</span>}
              </p>
            </div>
            {!current && onSee && (
              <Button
                variant="ghost"
                className="h-7 shrink-0 px-2 text-xs"
                aria-label={`Preview ${description}, ${when}`}
                onClick={() => onSee(entry)}
              >
                Preview
              </Button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
