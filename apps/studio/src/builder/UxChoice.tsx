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
import { useUxSource } from "./UxSource";

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
  const authored = useUxSource([...(page ? ["pages", page] : []), ...cap.rawPath], cap.fallback);
  const current = cap.path.reduce<unknown>(
    (value, key) =>
      value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined,
    data,
  );
  const problems = cap.values
    .map((value) => uxChoiceProblem(id, value, context))
    .filter((problem): problem is string => !!problem);
  const options: [string, string][] = [
    ["__inherited", authored.inherited],
    ...cap.values
      .filter((value) => !uxChoiceProblem(id, value, context))
      .map((value): [string, string] => [value, humanize(value)]),
  ];
  const selected = authored.available
    ? authored.present
      ? String(authored.value)
      : "__inherited"
    : typeof current === "string"
      ? current
      : "__inherited";
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
          value={selected}
          options={options}
          onChange={(e) => void set(e.target.value)}
          className="w-44"
        />
      </label>
      {authored.reason && <p className="text-xs text-quiet">{authored.reason}</p>}
      {!!problems.length && (
        <p className="text-xs text-quiet">{[...new Set(problems)].join(" ")}</p>
      )}
    </div>
  );
}
