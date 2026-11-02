import {
  type ModelIR,
  type PageIR,
  type PageUx,
  recordPicture,
  recordSummary,
  type UxIR,
} from "@smithable/core";
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
  const summary = recordSummary(model, tones);
  const context = {
    kind: page.pattern.kind,
    hasPicture: !!recordPicture(model),
    hasThread: Object.values(ux.lists ?? {}).includes("thread"),
    hasSummary: !!(summary.status || summary.amount || summary.dates.length),
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
          ? `Automatic summary: ${fields.join(", ")}.`
          : "No fields are eligible for an automatic summary."}
      </p>
      <UxChoice id="recordPictures" data={ux} page={page.id} context={context} run={run} />
      <UxChoice id="recordFirst" data={ux} page={page.id} context={context} run={run} />
    </fieldset>
  );
}
