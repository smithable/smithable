// Smithable app kit: the mark on a picture an AI made that could pass for a photograph (the
// image library's, and the sample records' pictures from it), as the EU's AI Act asks. In the
// picture's bottom right corner, away from menus and buttons; "AI-generated" on a picture across
// the page, "AI" on a small one. A picture styled where it is used (under the hero's wash or
// veil) is not marked; a maker's own pictures are marked only when they say so. The owner can
// switch every mark off (aiBadge: false in the app's presentation settings): the theme hides them.
import type { ReactNode } from "react";
import { cn } from "#/lib/utils";
import { w } from "./words";

/** The picture, marked when an AI made it; `full` for one across the page. */
export function AiMarked({
  generated,
  full,
  className,
  children,
}: {
  generated?: boolean;
  full?: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (!generated) return children;
  return (
    <span className={cn("relative block", className)}>
      {children}
      <span
        data-part="ai-mark"
        className="pointer-events-none absolute right-2 bottom-2 rounded-sm bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white"
      >
        {full ? w.aiGenerated : w.ai}
      </span>
    </span>
  );
}
