// Smithable app kit: a row of actions that stays short. Up to three show; more fold into a
// "More" menu, so a record or a selection with many actions does not crowd its page.
import { ChevronDown } from "lucide-react";
import { Children } from "react";
import { buttonVariants } from "#/components/ui/button";
import { w } from "./words";

export function Overflow({ children, max = 3 }: { children: React.ReactNode; max?: number }) {
  // Actions the viewer may not run render nothing and do not count.
  const items = Children.toArray(children);
  if (items.length <= max) return <>{items}</>;
  return (
    <>
      {items.slice(0, max)}
      <details data-part="more-actions" className="relative">
        <summary className={`${buttonVariants({ variant: "outline" })} cursor-pointer list-none`}>
          {w.more}
          <ChevronDown aria-hidden />
        </summary>
        {/* Stays open while a choice in it asks for something (its dialog lives inside). */}
        <div className="absolute right-0 top-full z-30 mt-1 flex min-w-48 flex-col items-stretch gap-1 rounded-md border bg-card p-1 text-card-foreground shadow-md">
          {items.slice(max)}
        </div>
      </details>
    </>
  );
}
