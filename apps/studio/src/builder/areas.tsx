// The sections of a No code tab as Behavior draws its areas (A 167): an icon in the line style,
// a short title, folded in a box. Behavior's areas and Who can's sections are both drawn so (T907).
import type { ReactNode } from "react";

export function AreaIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" aria-hidden="true">
      <path
        d={d}
        className="fill-none stroke-current"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A section with its icon, open unless said otherwise. */
export function AreaSection({
  icon,
  title,
  open = true,
  children,
}: {
  icon: string;
  title: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="rounded-md border border-line" open={open}>
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium">
        <AreaIcon d={icon} />
        <h3 className="text-sm font-medium">{title}</h3>
      </summary>
      <section aria-label={title} className="space-y-2 border-t border-line p-3">
        {children}
      </section>
    </details>
  );
}
