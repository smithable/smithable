import {
  humanize,
  UX_CAPABILITIES,
  type UxCapability,
  type UxCapabilityId,
  type UxChoiceContext,
  uxChoiceProblem,
} from "@smithable/core";
import { useId } from "react";
import { Select } from "../ui";
import type { Run } from "./ChangeForms";

export function UxChoice({
  id,
  data,
  page,
  context = {},
  run,
  extra = {},
}: {
  id: UxCapabilityId;
  data: object;
  page?: string;
  context?: UxChoiceContext;
  run: Run;
  extra?: Record<string, unknown>;
}) {
  const controlId = useId();
  const cap: UxCapability = UX_CAPABILITIES[id];
  const current = cap.path.reduce<unknown>(
    (value, key) =>
      value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined,
    data,
  );
  const problems = cap.values
    .map((value) => uxChoiceProblem(id, value, context))
    .filter((problem): problem is string => !!problem);
  const options: [string, string][] = [
    [
      "__inherited",
      `Inherited (${cap.fallback === "theme" ? "theme's own" : humanize(cap.fallback)})`,
    ],
    ...cap.values
      .filter((value) => value !== cap.reset && !uxChoiceProblem(id, value, context))
      .map((value): [string, string] => [value, humanize(value)]),
  ];
  if (typeof current === "string" && !options.some(([value]) => value === current))
    options.push([current, `${humanize(current)} (current)`]);
  const set = (value: string) =>
    run(cap.operation, {
      ...cap.fixed,
      ...extra,
      ...(page ? { page } : {}),
      [cap.argument]: value === "__inherited" ? cap.reset : value,
    });
  return (
    <div className="space-y-1 text-sm">
      <label htmlFor={controlId} className="flex items-center justify-between gap-3">
        <span>{cap.label}</span>
        <Select
          id={controlId}
          aria-label={cap.label}
          value={typeof current === "string" ? current : "__inherited"}
          options={options}
          onChange={(e) => void set(e.target.value)}
          className="w-44"
        />
      </label>
      {!!problems.length && (
        <p className="text-xs text-quiet">{[...new Set(problems)].join(" ")}</p>
      )}
    </div>
  );
}
