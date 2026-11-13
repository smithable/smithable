// The app as it was at an earlier change (docs/design/old-version-preview.md §4): a copy with its
// own data, open in a tab of its own (its host name is not the preview's, and a framed page on
// another site keeps no sign-in cookie), with Studio's bar in the preview's place. Nothing done in
// it is kept.
import type { TraceEntry } from "./api";
import { Button } from "./ui";

export interface OpenOld {
  url: string;
  entry: TraceEntry;
  data: "then" | "samples";
  pictures: "today" | "none";
}

/** The tab's name: opening it again reuses the same tab. */
export const OLD_TAB = "smithable-old-version";

/**
 * A tab for the old version, opened at the person's click (a tab opened later, after the copy is
 * ready, is a pop-up the browser blocks), with no way back to Studio's page from it.
 */
export function openOldTab(): Window | null {
  const tab = window.open("", OLD_TAB);
  if (tab) {
    tab.opener = null;
    tab.document.title = "Preparing the old version…";
    tab.document.body.textContent = "Preparing the old version…";
  }
  return tab;
}

export function OldVersion({
  open,
  onBack,
  onOpenAgain,
}: {
  open: OpenOld;
  onBack: () => void;
  onOpenAgain: () => void;
}) {
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
          . Nothing you do there is kept.
        </p>
        <Button className="h-7" onClick={onBack}>
          Back to now
        </Button>
      </div>
      <div className="m-auto max-w-md space-y-3 p-6 text-center text-sm">
        <p>
          The old version is open in a tab of its own, where you can sign in and click through it.
          Back to now removes the copy; close its tab when you are done there.
        </p>
        <Button variant="ghost" onClick={onOpenAgain}>
          Show its tab
        </Button>
      </div>
    </section>
  );
}
