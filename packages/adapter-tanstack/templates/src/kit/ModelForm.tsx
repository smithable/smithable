// Smithable app kit: a create/edit form for any model, validated with the model's Zod schema.
// To customise a form, copy this file into src/custom/components/ and edit the copy.
import { useState } from "react";
import type { z } from "zod";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Label } from "#/components/ui/input";
import { FieldInput } from "./FieldInput";
import { fromInput, toInput } from "./format";
import type { ModelUi } from "./model";

interface ModelFormProps<S extends z.ZodType> {
  ui: ModelUi;
  schema: S;
  /** The stored record when editing; omit to create a new one. */
  initial?: Record<string, unknown>;
  submitLabel: string;
  onSubmit: (values: z.output<S>) => Promise<unknown>;
  onCancel?: () => void;
  onDelete?: () => Promise<unknown>;
}

export function ModelForm<S extends z.ZodType>(props: ModelFormProps<S>) {
  const { ui, schema, initial, submitLabel, onSubmit, onCancel, onDelete } = props;
  const [inputs, setInputs] = useState(() =>
    Object.fromEntries(
      ui.fields.map((f) => [f.name, toInput(f, initial ? initial[f.name] : f.default)]),
    ),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const values = Object.fromEntries(
      ui.fields.map((f) => [f.name, fromInput(f, inputs[f.name] ?? "")]),
    );
    const result = schema.safeParse(values);
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message])));
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
      setFailure(
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
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
              <FieldInput
                field={field}
                id={id}
                value={inputs[field.name] ?? ""}
                invalid={error !== undefined}
                onChange={(value) => setInputs((current) => ({ ...current, [field.name]: value }))}
              />
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
