// Smithable app kit: a create/edit form for any model, validated with the model's Zod schema.
// To customise a form, copy this file into src/custom/components/ and edit the copy.
import { Calculator, CircleAlert } from "lucide-react";
import { useRef, useState } from "react";
import type { z } from "zod";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Label } from "#/components/ui/input";
import { FieldInput } from "./FieldInput";
import { formatValue, fromInput, toInput } from "./format";
import {
  type AppUi,
  editorMarker,
  type FieldUi,
  type ModelUi,
  type Options,
  textMarker,
} from "./model";

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
  /** The cancel button's text, e.g. "Back" in a step of an onboarding. */
  cancelLabel?: string;
  onDelete?: () => Promise<unknown>;
  /** Shows the record without letting it be changed. */
  readOnly?: boolean;
  /** These fields first, in this order; the others follow. */
  fieldOrder?: string[];
}

export function ModelForm<S extends z.ZodType>(props: ModelFormProps<S>) {
  const {
    app,
    schema,
    initial,
    options,
    submitLabel,
    onSubmit,
    onCancel,
    cancelLabel,
    onDelete,
    readOnly,
  } = props;
  const ui = ordered(props.ui, props.fieldOrder);
  const [inputs, setInputs] = useState(() => initialInputs(ui, app, initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Computed fields follow what has been entered so far.
  // The record comes first so values that are not inputs (like related lines) are included.
  const computed = ui.compute?.({ ...initial, ...storedValues(ui, inputs, app) }) ?? {};
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const confirmDelete = useRef<HTMLDialogElement>(null);
  const recordName = initial?.[ui.titleField];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const values = storedValues(ui, inputs, app);
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
    <Card className="max-w-3xl">
      <form onSubmit={submit} noValidate className="space-y-6 p-card">
        {!readOnly && ui.fields.some((f) => f.required && !f.computed) && (
          <p className="text-sm text-muted-foreground">
            Fields marked <span className="text-destructive">*</span> are required.
          </p>
        )}
        <fieldset disabled={readOnly} className="space-y-6">
          {ui.fields.map((field) => {
            const id = `field-${field.name}`;
            const error = errors[field.name];
            const inline = field.kind === "bool";
            const described =
              [field.help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(" ") ||
              undefined;
            return (
              <div
                key={field.name}
                className={inline ? "flex items-center gap-3" : "space-y-2"}
                {...editorMarker(ui, field, "field")}
              >
                {!inline && (
                  <Label htmlFor={id}>
                    <span {...textMarker(`models.${ui.model}.fields.${field.name}.label`)}>
                      {field.label}
                    </span>
                    {field.required && <span className="text-destructive"> *</span>}
                  </Label>
                )}
                {field.computed ? (
                  <p
                    id={id}
                    className="flex min-h-control items-center gap-2 rounded-md bg-muted px-3 text-sm font-semibold tabular-nums"
                  >
                    <Calculator aria-hidden className="size-5 text-muted-foreground" />
                    {formatValue(field, computed[field.name], app)}
                    <span className="sr-only">(calculated)</span>
                  </p>
                ) : (
                  <FieldInput
                    field={field}
                    id={id}
                    value={inputs[field.name] ?? ""}
                    invalid={error !== undefined}
                    describedBy={described}
                    options={options}
                    onChange={(value) =>
                      setInputs((current) => ({ ...current, [field.name]: value }))
                    }
                  />
                )}
                {inline && <Label htmlFor={id}>{field.label}</Label>}
                {field.help && (
                  <p id={`${id}-help`} className="text-sm text-muted-foreground">
                    {field.help}
                  </p>
                )}
                {error && (
                  <p
                    id={`${id}-error`}
                    className="flex items-center gap-1.5 text-sm text-destructive"
                  >
                    <CircleAlert aria-hidden className="size-4 shrink-0" />
                    {error}
                  </p>
                )}
              </div>
            );
          })}
        </fieldset>
        {failure && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive p-3 text-sm text-destructive"
          >
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {failure}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t pt-6">
          {!readOnly && (
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : submitLabel}
            </Button>
          )}
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
              {cancelLabel ?? (readOnly ? "Back" : "Cancel")}
            </Button>
          )}
          {onDelete && (
            <Button
              type="button"
              variant="outline"
              className="ml-auto border-destructive text-destructive"
              disabled={busy}
              onClick={() => confirmDelete.current?.showModal()}
            >
              Delete
            </Button>
          )}
          {onDelete && (
            // Opening it focuses Cancel, the first button; Escape closes it.
            <dialog
              ref={confirmDelete}
              aria-labelledby="delete-title"
              className="m-auto w-[calc(100%-2.5rem)] max-w-md rounded-lg border bg-card p-card text-card-foreground backdrop:bg-black/50"
            >
              <h2 id="delete-title" className="text-lg font-semibold">
                Delete{" "}
                {typeof recordName === "string" && recordName
                  ? `“${recordName}”`
                  : `this ${ui.label.toLowerCase()}`}
                ?
              </h2>
              <p className="mt-2 text-muted-foreground">This cannot be undone.</p>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => confirmDelete.current?.close()}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    confirmDelete.current?.close();
                    run(onDelete);
                  }}
                >
                  Delete {ui.label.toLowerCase()}
                </Button>
              </div>
            </dialog>
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

/** Explains server errors (see refusal in access.ts): a unique field taken, a record in use. */
function failureMessage(ui: ModelUi, error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const column = /^taken:(\w+)$/.exec(message)?.[1];
  const field = ui.fields.find(
    (f) => f.name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`) === column,
  );
  if (field)
    return `Another ${ui.label.toLowerCase()} already has this ${field.label.toLowerCase()}.`;
  if (message === "in-use")
    return `This ${ui.label.toLowerCase()} is still used by other records. Change or delete those first.`;
  return message || "Something went wrong. Please try again.";
}

/** Form inputs for a record being edited, or for a new one: defaults, including formula defaults. */
function initialInputs(
  ui: ModelUi,
  app: AppUi,
  initial?: Record<string, unknown>,
): Record<string, string | boolean> {
  const inputs: Record<string, string | boolean> = {};
  const values: Record<string, unknown> = {};
  for (const field of ui.fields) {
    if (field.computed) continue;
    const suggested = ui.defaults?.[field.name];
    const value = initial ? initial[field.name] : suggested ? suggested(values) : field.default;
    values[field.name] = value;
    inputs[field.name] = toInput(field, value, app.timeZone);
  }
  return inputs;
}

/** The values to validate and save: every entered field, never computed ones. */
function storedValues(
  ui: ModelUi,
  inputs: Record<string, string | boolean>,
  app: AppUi,
): Record<string, unknown> {
  return Object.fromEntries(
    ui.fields
      .filter((f) => !f.computed)
      .map((f) => [f.name, fromInput(f, inputs[f.name] ?? "", app.timeZone)]),
  );
}

/** The model's fields with `order` first, in that order. */
function ordered(ui: ModelUi, order?: string[]): ModelUi {
  if (!order) return ui;
  const rank = (name: string) => {
    const i = order.indexOf(name);
    return i === -1 ? order.length : i;
  };
  return { ...ui, fields: [...ui.fields].sort((a, b) => rank(a.name) - rank(b.name)) };
}
