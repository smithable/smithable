// Smithable app kit: a row of actions that stays short. Up to three show; more fold into a
// "More" menu, so a record or a selection with many actions does not crowd its page. In a
// list's row (`inRow`) two show; with three or more the first shows and the rest open beside
// a "…" button, in the row's own height, so a table's scrolling box does not cut them off.
import { ChevronDown, Ellipsis } from "lucide-react";
import { Children } from "react";
import { buttonVariants } from "#/components/ui/button";
import { w } from "./words";

export function Overflow({
  children,
  max = 3,
  inRow = false,
  all = false,
}: {
  children: React.ReactNode;
  max?: number;
  inRow?: boolean;
  /** Every action behind the "…" button, however few (a list's actions: menu, look-gap §4). */
  all?: boolean;
}) {
  // Actions the viewer may not run render nothing and do not count.
  const items = Children.toArray(children);
  const shown = all ? 0 : inRow ? 2 : max;
  if (items.length <= shown) return <>{items}</>;
  const keep = all ? 0 : inRow ? 1 : max;
  return (
    <>
      {items.slice(0, keep)}
      <details data-part="more-actions" className="relative">
        <summary
          aria-label={inRow ? w.more : undefined}
          className={`${buttonVariants({ variant: "outline", ...(inRow ? { size: "icon" } : {}) })} cursor-pointer list-none`}
        >
          {inRow ? <Ellipsis aria-hidden /> : w.more}
          {!inRow && <ChevronDown aria-hidden />}
        </summary>
        {/* Stays open while a choice in it asks for something (its dialog lives inside). */}
        <div
          className={
            inRow
              ? "absolute right-full top-1/2 z-30 mr-1 flex -translate-y-1/2 gap-1 whitespace-nowrap rounded-md border bg-card p-1 text-card-foreground shadow-md"
              : "absolute right-0 top-full z-30 mt-1 flex min-w-48 flex-col items-stretch gap-1 rounded-md border bg-card p-1 text-card-foreground shadow-md"
          }
        >
          {items.slice(keep)}
        </div>
      </details>
    </>
  );
}
