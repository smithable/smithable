// Smithable app kit: the EU's common icon for AI-generated content on a picture an AI made that
// could pass for a photograph. The icon is the EU's basic one, black and unaltered, drawn here so
// no app loads it from anywhere. It sits in the picture's bottom right corner, away from menus and
// buttons, with nothing over it: alone on a small picture, with "AI-generated" (in the app's
// language) on one across the page. A picture styled where it is used (under the hero's wash or
// veil) is not marked; a maker's own pictures are marked only when they say so. The owner can
// switch every mark off (aiBadge: false in the app's presentation settings): the theme hides them.
import type { ReactNode } from "react";
import { cn } from "#/lib/utils";
import { w } from "./words";

/** The EU's basic icon, its own paths; the view box is the disc's square. */
function AiIcon({ className, label }: { className: string; label?: string }) {
  return (
    <svg
      viewBox="89.28 100.72 365.49 365.49"
      className={cn("shrink-0", className)}
      role="img"
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path
        fillRule="evenodd"
        d="M272.03,100.72c100.92,0,182.74,81.82,182.74,182.75s-81.82,182.74-182.74,182.74-182.75-81.82-182.75-182.74,81.82-182.75,182.75-182.75"
      />
      <path
        fill="#fff"
        d="M170.79,353.74c-1.08,0-2.05-.43-2.92-1.31-.88-.87-1.31-1.84-1.31-2.92,0-.67.07-1.27.2-1.81l47.34-129.32c.4-1.48,1.24-2.79,2.52-3.93,1.27-1.14,3.05-1.71,5.34-1.71h29.81c2.28,0,4.06.57,5.34,1.71,1.27,1.14,2.11,2.45,2.52,3.93l47.14,129.32c.27.54.4,1.14.4,1.81,0,1.08-.44,2.05-1.31,2.92s-1.91,1.31-3.12,1.31h-24.78c-2.01,0-3.52-.5-4.53-1.51-1.01-1.01-1.65-1.91-1.91-2.72l-7.86-20.55h-53.78l-7.65,20.55c-.27.81-.88,1.71-1.81,2.72-.94,1.01-2.55,1.51-4.83,1.51h-24.78ZM218.13,299.96h37.47l-18.93-53.18-18.53,53.18Z"
      />
      <path
        fill="#fff"
        d="M328.11,353.74c-1.48,0-2.69-.47-3.63-1.41-.94-.94-1.41-2.15-1.41-3.63v-130.93c0-1.48.47-2.68,1.41-3.63s2.15-1.41,3.63-1.41h26.99c1.48,0,2.68.47,3.63,1.41.94.94,1.41,2.15,1.41,3.63v130.93c0,1.48-.47,2.69-1.41,3.63-.94.94-2.15,1.41-3.63,1.41h-26.99Z"
      />
    </svg>
  );
}

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
      {full ? (
        <span
          data-part="ai-mark"
          className="pointer-events-none absolute right-2 bottom-2 z-10 flex items-center gap-1"
        >
          <AiIcon className="size-7" />
          <span className="rounded-sm bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
            {w.aiGenerated}
          </span>
        </span>
      ) : (
        <span
          data-part="ai-mark"
          className={cn(
            "pointer-events-none absolute z-10 flex",
            tiny ? "right-0.5 bottom-0.5" : "right-2 bottom-2",
          )}
        >
          <AiIcon className={tiny ? "size-4" : "size-6"} label={w.aiGenerated} />
        </span>
      )}
    </span>
  );
}
