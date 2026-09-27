import type * as React from "react";
import { cn } from "#/lib/utils";

export function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}
