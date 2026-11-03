import {
  humanize,
  type ModelIR,
  type PageIR,
  type PageUx,
  recordPicture,
  recordSummary,
  type SummaryPart,
  summaryEligible,
  type UxIR,
} from "@smithable/core";
import { useId } from "react";
import { Select } from "../ui";
import type { Run } from "./ChangeForms";
import { UxChoice } from "./UxChoice";

export function UxRecords({
  page,
  model,
  ux,
  tones,
  run,
}: {
  page: PageIR;
  model?: ModelIR;
  ux: PageUx;
  tones: UxIR["tones"];
  run: Run;
}) {
  if (page.pattern.kind !== "crud" || !model) return null;
  const automatic = recordSummary(model, tones);
  const summary = recordSummary(model, tones, ux.summaryFields);
  const context = {
    kind: page.pattern.kind,
    hasPicture: !!recordPicture(model),
    hasThread: Object.values(ux.lists ?? {}).includes("thread"),
    hasSummary: !!(automatic.status || automatic.amount || automatic.dates.length),
  };
  const fields = [
    summary.status?.name,
    summary.amount?.name,
    ...summary.dates.map((f) => f.name),
  ].filter(Boolean);
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">Records</legend>
      <UxChoice id="recordHeader" data={ux} page={page.id} context={context} run={run} />
      <UxChoice id="formAside" data={ux} page={page.id} context={context} run={run} />
      <p className="text-xs text-quiet">
        {fields.length
          ? `${ux.summaryFields ? "Selected" : "Automatic"} summary: ${fields.join(", ")}.`
          : ux.summaryFields
            ? "No summary fields are selected."
            : "No fields are eligible for an automatic summary."}
      </p>
      <Emphasis model={model} ux={ux} page={page.id} automatic={automatic} run={run} />
      <UxChoice id="recordPictures" data={ux} page={page.id} context={context} run={run} />
      <UxChoice id="recordFirst" data={ux} page={page.id} context={context} run={run} />
    </fieldset>
  );
}

function Emphasis({
  model,
  ux,
  page,
  automatic,
  run,
}: {
  model: ModelIR;
  ux: PageUx;
  page: string;
  automatic: ReturnType<typeof recordSummary>;
  run: Run;
}) {
  const id = useId();
  const set = (part: SummaryPart, fields?: string[]) =>
    run("setRecordEmphasis", { page, part, ...(fields !== undefined ? { fields } : {}) });
  const dates = ux.summaryFields?.dates ?? automatic.dates.map((field) => field.name);
  return (
    <fieldset className="space-y-2 rounded border border-line p-2">
      <legend className="text-sm">Summary fields</legend>
      {(["status", "amount"] as const).map((part) => {
        const selected = ux.summaryFields?.[part];
        return (
          <label
            key={part}
            htmlFor={`${id}-${part}`}
            className="flex items-center justify-between gap-2 text-sm"
          >
            {humanize(part)}
            <Select
              id={`${id}-${part}`}
              aria-label={`Summary ${part}`}
              className="w-44"
              value={selected === undefined ? "__auto" : (selected[0] ?? "__none")}
              options={[
                ["__auto", `Automatic (${automatic[part]?.name ?? "none"})`],
                ["__none", "None"],
                ...model.fields
                  .filter((field) => summaryEligible(field, part))
                  .map((field): [string, string] => [field.name, humanize(field.name)]),
              ]}
              onChange={(event) =>
                void set(
                  part,
                  event.target.value === "__auto"
                    ? undefined
                    : event.target.value === "__none"
                      ? []
                      : [event.target.value],
                )
              }
            />
          </label>
        );
      })}
      <fieldset className="space-y-1">
        <legend className="text-sm">Summary dates (up to two)</legend>
        {model.fields
          .filter((field) => summaryEligible(field, "dates"))
          .map((field) => (
            <label key={field.name} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={dates.includes(field.name)}
                disabled={!dates.includes(field.name) && dates.length >= 2}
                onChange={(event) =>
                  void set(
                    "dates",
                    event.target.checked
                      ? [...dates, field.name]
                      : dates.filter((name) => name !== field.name),
                  )
                }
              />
              {humanize(field.name)}
            </label>
          ))}
        <div className="flex flex-wrap gap-2 text-xs">
          <button type="button" onClick={() => void set("dates")}>
            Use automatic dates
          </button>
          <button type="button" onClick={() => void set("dates", [])}>
            No summary dates
          </button>
        </div>
        <p className="text-xs text-quiet">
          {ux.summaryFields?.dates === undefined ? "Automatic dates" : "Selected dates"}:{" "}
          {dates.length ? dates.map(humanize).join(", ") : "none"}.
        </p>
      </fieldset>
    </fieldset>
  );
}
