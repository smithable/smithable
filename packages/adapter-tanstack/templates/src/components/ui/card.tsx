import type * as React from "react";
import { cn } from "#/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-lg border-(length:--card-border) border-(--card-border-color) bg-card text-card-foreground shadow-card",
        className,
      )}
      {...props}
    />
  );
}
