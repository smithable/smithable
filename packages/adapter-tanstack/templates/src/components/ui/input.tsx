import type * as React from "react";
import { cn } from "#/lib/utils";

export const fieldClassName =
  "w-full min-w-0 rounded-md border border-input bg-card px-3 py-1.5 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(fieldClassName, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClassName, "min-h-24 py-2", className)} {...props} />;
}

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(fieldClassName, "h-9 pr-8", className)} {...props} />;
}

export function Checkbox({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input type="checkbox" className={cn("size-4 rounded accent-primary", className)} {...props} />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  // biome-ignore lint/a11y/noLabelWithoutControl: a generic wrapper; callers pass htmlFor.
  return <label className={cn("text-sm font-medium leading-none", className)} {...props} />;
}
