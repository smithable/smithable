// Smithable app kit: the input control for one field, chosen by its kind.
import { Checkbox, Input, NativeSelect, Textarea } from "#/components/ui/input";
import { Combobox } from "./Combobox";
import type { FieldUi, Options } from "./model";

interface FieldInputProps {
  field: FieldUi;
  id: string;
  value: string | boolean;
  invalid: boolean;
  /** Ids of the field's help and error text. */
  describedBy?: string;
  /** Choices for reference fields. */
  options?: Options;
  /** The record being edited, when it exists (a picture shows from its address). */
  record?: number;
  onChange: (value: string | boolean) => void;
}

const inputTypes: Partial<Record<FieldUi["kind"], string>> = {
  email: "email",
  phone: "tel",
  url: "url",
  date: "date",
  datetime: "datetime-local",
};

export function FieldInput({
  field,
  id,
  value,
  invalid,
  describedBy,
  options,
  record,
  onChange,
}: FieldInputProps) {
  const common = {
    id,
    name: field.name,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
  };
  if (field.kind === "bool") {
    return (
      <Checkbox {...common} checked={value === true} onChange={(e) => onChange(e.target.checked)} />
    );
  }
  const text = typeof value === "string" ? value : "";
  if (field.input) {
    const Control = field.input;
    return <Control {...common} value={text} record={record} onChange={onChange} />;
  }
  if (field.kind === "text" || field.kind === "markdown") {
    return <Textarea {...common} value={text} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.kind === "relation" || field.kind === "user") {
    return (
      <Combobox
        id={id}
        value={text}
        options={options?.[field.name] ?? []}
        required={field.required}
        invalid={invalid}
        describedBy={describedBy}
        onChange={onChange}
      />
    );
  }
  if (field.kind === "choice") {
    return (
      <NativeSelect {...common} value={text} onChange={(e) => onChange(e.target.value)}>
        {!field.required && <option value="">—</option>}
        {field.choices?.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </NativeSelect>
    );
  }
  const numeric = field.kind === "int" || field.kind === "decimal" || field.kind === "money";
  return (
    <Input
      {...common}
      type={inputTypes[field.kind] ?? "text"}
      inputMode={numeric ? (field.kind === "int" ? "numeric" : "decimal") : undefined}
      value={text}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
