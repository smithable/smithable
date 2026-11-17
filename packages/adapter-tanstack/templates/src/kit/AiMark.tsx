// Smithable app kit: the mark on a picture an AI made that could pass for a photograph (the
// image library's, and the sample records' pictures from it), as the EU's AI Act asks. In the
// picture's bottom right corner, away from menus and buttons; "AI-generated" on a picture across
// the page, "AI" on a small one. A picture styled where it is used (under the hero's wash or
// veil) is not marked; a maker's own pictures are marked only when they say so. The owner can
// switch every mark off (aiBadge: false in the app's presentation settings): the theme hides them.
import type { ReactNode } from "react";
import { cn } from "#/lib/utils";
import { w } from "./words";

/**
 * The picture, marked when an AI made it; `full` for one across the page, `tiny` for a thumbnail
 * or an avatar of a few rem, where the mark sits in the very corner.
 */
export function AiMarked({
  generated,
  full,
  tiny,
  className,
  children,
}: {
  generated?: boolean | undefined;
  full?: boolean;
  tiny?: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (!generated) return children;
  return (
    <span className={cn("relative block", className)}>
      {children}
      <span
        data-part="ai-mark"
        className={
          tiny
            ? "pointer-events-none absolute right-0 bottom-0 rounded-sm bg-black/70 px-0.5 text-[0.5625rem] leading-tight font-medium text-white"
            : "pointer-events-none absolute right-2 bottom-2 rounded-sm bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white"
        }
      >
        {full ? w.aiGenerated : w.ai}
      </span>
    </span>
  );
}
