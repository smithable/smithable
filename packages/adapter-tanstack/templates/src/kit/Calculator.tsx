// Smithable app kit: a calculator (docs/design/calculator.md). A form of inputs whose results
// are computed as you type and stored nowhere: the same fields, inputs and formulas as a
// record's form, without a record. To change it, copy this file into src/custom/components/
// and edit the copy.
import { Calculator as CalculatorIcon } from "lucide-react";
import { useState } from "react";
import { Card } from "#/components/ui/card";
import { Label } from "#/components/ui/input";
import { cn } from "#/lib/utils";
import { FieldInput } from "./FieldInput";
import { formatValue, fromInput, toInput } from "./format";
import type { AppUi, ModelUi } from "./model";
import { w } from "./words";

export function Calculator({
  ui,
  app,
  resultsTitle = w.results,
  layout = "beside",
}: {
  ui: ModelUi;
  app: AppUi;
  resultsTitle?: string;
  /** Where the results go on a wide screen (smithable.ux.yml); a phone shows them below. */
  layout?: "beside" | "below";
}) {
  const inputs = ui.fields.filter((f) => !f.computed);
  const results = ui.fields.filter((f) => f.computed);
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(inputs.map((f) => [f.name, toInput(f, f.default ?? null, app.timeZone)])),
  );
  const entered = Object.fromEntries(
    inputs.map((f) => [f.name, fromInput(f, values[f.name] ?? "", app.timeZone)]),
  );
  const computed = ui.compute?.(entered) ?? {};
  return (
    <div
      data-kit="calculator"
      className={cn(
        "grid gap-6",
        layout === "beside" && "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
      )}
    >
      <Card className="space-y-6 p-card">
        {inputs.map((field) => {
          const id = `calc-${field.name}`;
          const inline = field.kind === "bool";
          return (
            <div key={field.name} className={inline ? "flex items-center gap-3" : "space-y-2"}>
              {!inline && <Label htmlFor={id}>{field.label}</Label>}
              <FieldInput
                field={field}
                id={id}
                value={values[field.name] ?? ""}
                invalid={false}
                currency={app.currency}
                describedBy={field.help ? `${id}-help` : undefined}
                onChange={(value) => setValues((v) => ({ ...v, [field.name]: value }))}
              />
              {inline && <Label htmlFor={id}>{field.label}</Label>}
              {field.help && (
                <p id={`${id}-help`} className="text-sm text-muted-foreground">
                  {field.help}
                </p>
              )}
            </div>
          );
        })}
      </Card>
      <Card data-part="results" className="space-y-4 p-card lg:self-start" aria-live="polite">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalculatorIcon aria-hidden className="size-5 text-muted-foreground" />
          {resultsTitle}
        </h2>
        <dl className="space-y-3">
          {results.map((field) => (
            <div key={field.name} className="flex items-baseline justify-between gap-4">
              <dt className="text-[14px] text-muted-foreground">{field.label}</dt>
              <dd className="text-xl font-semibold tabular-nums">
                {formatValue(field, computed[field.name], app)}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
