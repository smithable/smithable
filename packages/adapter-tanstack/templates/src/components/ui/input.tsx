import type * as React from "react";
import { cn } from "#/lib/utils";

// 16 px text on phones, so browsers do not zoom into a field being edited.
export const fieldClassName =
  "w-full min-w-0 rounded-md border border-input bg-card px-3 text-[16px] text-foreground outline-none transition-[color,box-shadow] placeholder:text-muted-foreground hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:border-2 md:text-[14px]";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(fieldClassName, "h-control", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClassName, "min-h-24 py-2", className)} {...props} />;
}

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(fieldClassName, "h-control pr-8", className)} {...props} />;
}

export function Checkbox({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-5 rounded accent-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  htmlFor,
  children,
  ...props
}: React.ComponentProps<"label"> & { htmlFor: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("text-[14px] font-semibold leading-5", className)}
      {...props}
    >
      {children}
    </label>
  );
}
