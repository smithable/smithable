// An operation's arguments as form controls, from its JSON Schema (C8): an argument that names
// something in the spec (its `x-smithable` annotation) is chosen from the names there are.
import { type ArgRef, type JsonSchema, namesFor } from "@smithable/core";
import type { Spec } from "./engine";
import { Input, Label, Select } from "./ui";

export type ArgValues = Record<string, string | string[]>;

/** The names an annotated argument can take in this spec, as [value, label]. */
export function choicesFor(ref: ArgRef, values: ArgValues, spec: Spec): [string, string][] {
  return spec.ir ? namesFor(ref, values, spec.ir, spec.auth?.roles.map((r) => r.name) ?? []) : [];
}

/**
 * The values as the operation takes them. A required single choice defaults to the first name
 * there is, and one that no longer fits (its model changed) to the first that does.
 */
export function argumentsOf(schema: JsonSchema, values: ArgValues, spec: Spec): ArgValues {
  const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
  const required = (schema.required ?? []) as string[];
  const out: ArgValues = {};
  // In order, so a field sees the model chosen before it.
  for (const [key, property] of Object.entries(properties)) {
    const ref = property["x-smithable"] as ArgRef | undefined;
    const value = values[key];
    const choices = ref ? choicesFor(ref, out, spec).map(([v]) => v) : undefined;
    if (choices && property.type !== "array" && choices.length) {
      const chosen = typeof value === "string" && choices.includes(value) ? value : undefined;
      const pick = chosen ?? (required.includes(key) ? choices[0] : undefined);
      if (pick) out[key] = pick;
    } else if (Array.isArray(value) ? value.length : value?.trim()) out[key] = value as never;
    else if (Array.isArray(property.enum) && required.includes(key))
      out[key] = String(property.enum[0]);
  }
  return out;
}

/** One argument's control: a choice, a set of checkboxes, or text. */
export function ArgumentField({
  name,
  schema,
  required,
  values,
  effective,
  setValue,
  spec,
  label,
  hint,
}: {
  name: string;
  schema: JsonSchema;
  required: boolean;
  values: ArgValues;
  /** The values as they will be applied (defaults filled in). */
  effective: ArgValues;
  setValue: (value: string | string[]) => void;
  spec: Spec;
  label: string;
  hint?: string;
}) {
  const ref = schema["x-smithable"] as ArgRef | undefined;
  const choices = ref ? choicesFor(ref, effective, spec) : [];
  const text = `${label}${required ? " *" : ""}`;
  if (ref && choices.length && schema.type === "array") {
    const chosen = (values[name] as string[] | undefined) ?? [];
    return (
      <fieldset className="space-y-1">
        <legend className="text-xs font-medium text-neutral-600">{text}</legend>
        {choices.map(([value, shown]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={chosen.includes(value)}
              onChange={(e) =>
                setValue(e.target.checked ? [...chosen, value] : chosen.filter((c) => c !== value))
              }
            />
            {shown}
          </label>
        ))}
        {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      </fieldset>
    );
  }
  // A fixed set of values (a tone, an icon) is a choice too.
  if (!ref && Array.isArray(schema.enum))
    return (
      <Label text={text} hint={hint}>
        <Select
          aria-label={label}
          value={(values[name] as string | undefined) ?? (required ? String(schema.enum[0]) : "")}
          onChange={(e) => setValue(e.target.value)}
          options={[
            ...(required ? [] : [["", "—"] as [string, string]]),
            ...schema.enum.map((v) => String(v)),
          ]}
        />
      </Label>
    );
  if (ref && choices.length)
    return (
      <Label text={text} hint={hint}>
        <Select
          aria-label={label}
          value={(effective[name] as string | undefined) ?? ""}
          onChange={(e) => setValue(e.target.value)}
          options={required ? choices : [["", "—"], ...choices]}
        />
      </Label>
    );
  return (
    <Label text={text} hint={hint}>
      <Input
        aria-label={label}
        value={(values[name] as string | undefined) ?? ""}
        onChange={(e) => setValue(e.target.value)}
      />
    </Label>
  );
}
