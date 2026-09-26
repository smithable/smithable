// Smithable app kit: the input control for one field, chosen by its kind.
import { Checkbox, Input, NativeSelect, Textarea } from "#/components/ui/input";
import type { FieldUi } from "./model";

interface FieldInputProps {
  field: FieldUi;
  id: string;
  value: string | boolean;
  invalid: boolean;
  onChange: (value: string | boolean) => void;
}

const inputTypes: Partial<Record<FieldUi["kind"], string>> = {
  email: "email",
  phone: "tel",
  url: "url",
  date: "date",
  datetime: "datetime-local",
};

export function FieldInput({ field, id, value, invalid, onChange }: FieldInputProps) {
  const common = { id, name: field.name, "aria-invalid": invalid || undefined };
  if (field.kind === "bool") {
    return (
      <Checkbox {...common} checked={value === true} onChange={(e) => onChange(e.target.checked)} />
    );
  }
  const text = typeof value === "string" ? value : "";
  if (field.kind === "text") {
    return <Textarea {...common} value={text} onChange={(e) => onChange(e.target.value)} />;
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
      inputMode={numeric ? "decimal" : undefined}
      value={text}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
