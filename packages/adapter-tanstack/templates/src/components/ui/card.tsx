import type * as React from "react";
import { cn } from "#/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-lg border bg-card text-card-foreground shadow-card", className)}
      {...props}
    />
  );
}
