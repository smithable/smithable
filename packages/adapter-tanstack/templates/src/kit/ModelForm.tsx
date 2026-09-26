// Smithable app kit: a create/edit form for any model, validated with the model's Zod schema.
// To customise a form, copy this file into src/custom/components/ and edit the copy.
import { useState } from "react";
import type { z } from "zod";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Label } from "#/components/ui/input";
import { FieldInput } from "./FieldInput";
import { formatValue, fromInput, toInput } from "./format";
import type { AppUi, FieldUi, ModelUi, Options } from "./model";

interface ModelFormProps<S extends z.ZodType> {
  ui: ModelUi;
  app: AppUi;
  schema: S;
  /** The stored record when editing; omit to create a new one. */
  initial?: Record<string, unknown>;
  /** Choices for reference fields, e.g. { customerId: [...] }. */
  options?: Options;
  submitLabel: string;
  onSubmit: (values: z.output<S>) => Promise<unknown>;
  onCancel?: () => void;
  onDelete?: () => Promise<unknown>;
}

export function ModelForm<S extends z.ZodType>(props: ModelFormProps<S>) {
  const { ui, app, schema, initial, options, submitLabel, onSubmit, onCancel, onDelete } = props;
  const [inputs, setInputs] = useState(() => initialInputs(ui, initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Computed fields follow what has been entered so far.
  // The record comes first so values that are not inputs (like related lines) are included.
  const computed = ui.compute?.({ ...initial, ...storedValues(ui, inputs) }) ?? {};
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const values = storedValues(ui, inputs);
    const result = schema.safeParse(values);
    if (!result.success) {
      const messages: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = ui.fields.find((f) => f.name === issue.path[0]);
        if (field && !messages[field.name])
          messages[field.name] = friendly(field, issue, values[field.name]);
      }
      setErrors(messages);
      return;
    }
    setErrors({});
    await run(() => onSubmit(result.data));
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setFailure(undefined);
    try {
      await action();
    } catch (error) {
      setFailure(failureMessage(ui, error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <form onSubmit={submit} noValidate className="space-y-5 p-6">
        {ui.fields.map((field) => {
          const id = `field-${field.name}`;
          const error = errors[field.name];
          const inline = field.kind === "bool";
          return (
            <div key={field.name} className={inline ? "flex items-center gap-3" : "space-y-2"}>
              {!inline && (
                <Label htmlFor={id}>
                  {field.label}
                  {field.required && <span className="text-destructive"> *</span>}
                </Label>
              )}
              {field.computed ? (
                <p id={id} className="rounded-md bg-muted px-3 py-2 text-sm tabular-nums">
                  {formatValue(field, computed[field.name], app)}
                </p>
              ) : (
                <FieldInput
                  field={field}
                  id={id}
                  value={inputs[field.name] ?? ""}
                  invalid={error !== undefined}
                  options={options}
                  onChange={(value) =>
                    setInputs((current) => ({ ...current, [field.name]: value }))
                  }
                />
              )}
              {inline && <Label htmlFor={id}>{field.label}</Label>}
              {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          );
        })}
        {failure && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{failure}</p>
        )}
        <div className="flex items-center gap-2 border-t pt-5">
          <Button type="submit" disabled={busy}>
            {submitLabel}
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          )}
          {onDelete && (
            <Button
              type="button"
              variant="outline"
              className="ml-auto text-destructive"
              disabled={busy}
              onClick={() =>
                window.confirm(`Delete this ${ui.label.toLowerCase()}?`) && run(onDelete)
              }
            >
              Delete
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

/** A message a non-developer understands, instead of Zod's technical text. */
function friendly(field: FieldUi, issue: z.core.$ZodIssue, value: unknown): string {
  if (value === null || value === undefined) return "Required";
  if (issue.code !== "invalid_type") return issue.message;
  switch (field.kind) {
    case "int":
      return "Enter a whole number";
    case "decimal":
    case "money":
      return "Enter a number";
    case "date":
      return "Enter a valid date";
    case "datetime":
      return "Enter a valid date and time";
    default:
      return issue.message;
  }
}

/** Explains server errors; a unique column shows which field is taken. */
function failureMessage(ui: ModelUi, error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const column = /UNIQUE constraint failed: \w+\.(\w+)/.exec(message)?.[1];
  const field = ui.fields.find(
    (f) => f.name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`) === column,
  );
  if (field)
    return `Another ${ui.label.toLowerCase()} already has this ${field.label.toLowerCase()}.`;
  if (message.includes("FOREIGN KEY constraint failed")) {
    return `This ${ui.label.toLowerCase()} is still used by other records. Change or delete those first.`;
  }
  return message || "Something went wrong. Please try again.";
}

/** Form inputs for a record being edited, or for a new one: defaults, including formula defaults. */
function initialInputs(
  ui: ModelUi,
  initial?: Record<string, unknown>,
): Record<string, string | boolean> {
  const inputs: Record<string, string | boolean> = {};
  const values: Record<string, unknown> = {};
  for (const field of ui.fields) {
    if (field.computed) continue;
    const suggested = ui.defaults?.[field.name];
    const value = initial ? initial[field.name] : suggested ? suggested(values) : field.default;
    values[field.name] = value;
    inputs[field.name] = toInput(field, value);
  }
  return inputs;
}

/** The values to validate and save: every entered field, never computed ones. */
function storedValues(
  ui: ModelUi,
  inputs: Record<string, string | boolean>,
): Record<string, unknown> {
  return Object.fromEntries(
    ui.fields.filter((f) => !f.computed).map((f) => [f.name, fromInput(f, inputs[f.name] ?? "")]),
  );
}
