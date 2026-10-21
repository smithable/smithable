// Smithable app kit: the input control for one field, chosen by its kind.
import { Button } from "#/components/ui/button";
import { Checkbox, Input, NativeSelect, Textarea } from "#/components/ui/input";
import { Combobox } from "./Combobox";
import type { FieldUi, Options } from "./model";
import { w } from "./words";

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
  /** The app's currency (EUR), shown beside an amount of money. */
  currency?: string;
  /** The form's inputs, and setting another field, for a control that depends on them. */
  values?: Record<string, string | boolean>;
  set?: (name: string, value: string) => void;
  timeZone?: string;
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
  currency,
  values,
  set,
  timeZone,
  onChange,
}: FieldInputProps) {
  const common = {
    id,
    name: field.name,
    "data-part": "input",
    "data-field": field.name,
    "aria-invalid": invalid || undefined,
    "aria-describedby":
      [describedBy, field.kind === "money" && currency && `${id}-currency`]
        .filter(Boolean)
        .join(" ") || undefined,
  };
  if (field.kind === "bool" && field.control === "radio") {
    return (
      <Radios
        {...common}
        value={value === true ? "yes" : value === false ? "no" : ""}
        choices={[
          { value: "yes", label: w.yes },
          { value: "no", label: w.no },
        ]}
        onChange={(v) => onChange(v === "yes")}
      />
    );
  }
  if (field.kind === "bool") {
    return (
      <Checkbox
        {...common}
        role={field.control === "switch" ? "switch" : undefined}
        checked={value === true}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }
  const text = typeof value === "string" ? value : "";
  if (field.input) {
    const Control = field.input;
    return (
      <Control
        {...common}
        value={text}
        record={record}
        values={values}
        set={set}
        timeZone={timeZone}
        onChange={onChange}
      />
    );
  }
  if (field.kind === "text" || field.kind === "markdown" || field.control === "textarea") {
    return <Textarea {...common} value={text} onChange={(e) => onChange(e.target.value)} />;
  }
  // A number as a slider (the value shown beside it) or a stepper.
  if (field.control === "slider" && field.min !== undefined && field.max !== undefined) {
    const step = field.kind === "int" ? 1 : Math.max((field.max - field.min) / 100, 0.01);
    return (
      <div className="flex items-center gap-3" data-part="slider">
        <input
          {...common}
          type="range"
          min={field.min}
          max={field.max}
          step={step}
          value={text === "" ? field.min : Number(text)}
          onChange={(e) => onChange(e.target.value)}
          className="h-2 grow accent-primary"
        />
        <output htmlFor={id} className="min-w-12 text-right text-sm tabular-nums">
          {text === "" ? "—" : text}
        </output>
      </div>
    );
  }
  if (field.control === "stepper") {
    const n = text === "" ? undefined : Number(text);
    const step = (by: number) => {
      const next = (n ?? field.min ?? 0) + by;
      if (field.min !== undefined && next < field.min) return;
      if (field.max !== undefined && next > field.max) return;
      onChange(String(next));
    };
    return (
      <div className="flex items-center gap-2" data-part="stepper">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={w.less}
          onClick={() => step(-1)}
        >
          −
        </Button>
        <Input
          {...common}
          type="number"
          inputMode="numeric"
          min={field.min}
          max={field.max}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 text-center"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={w.more}
          onClick={() => step(1)}
        >
          +
        </Button>
      </div>
    );
  }
  if (field.control === "radio" && field.choices) {
    return (
      <Radios
        {...common}
        value={text}
        choices={field.choices}
        required={field.required}
        onChange={onChange}
      />
    );
  }
  if ((field.kind === "relation" || field.kind === "user") && field.control === "select") {
    return (
      <NativeSelect {...common} value={text} onChange={(e) => onChange(e.target.value)}>
        {!field.required && <option value="">—</option>}
        {(options?.[field.name] ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    );
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
  const input = (
    <Input
      {...common}
      type={inputTypes[field.kind] ?? "text"}
      inputMode={numeric ? (field.kind === "int" ? "numeric" : "decimal") : undefined}
      value={text}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  // An amount says its currency, as lists and dashboards do; the app has one (app.currency).
  if (field.kind !== "money" || !currency) return input;
  return (
    <div data-part="amount" className="flex items-center gap-2">
      {input}
      <span id={`${id}-currency`} className="shrink-0 text-sm text-muted-foreground">
        {currency}
      </span>
    </div>
  );
}

/** A choice as radio buttons: a small choice reads at a glance. */
function Radios({
  id,
  name,
  value,
  choices,
  required,
  onChange,
  ...aria
}: {
  id: string;
  name: string;
  value: string;
  choices: { value: string; label: string }[];
  required?: boolean;
  onChange: (value: string) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <div
      role="radiogroup"
      id={id}
      {...aria}
      className="flex flex-wrap gap-x-5 gap-y-2"
      data-part="radios"
    >
      {choices.map((choice) => (
        <label key={choice.value} className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={name}
            value={choice.value}
            checked={value === choice.value}
            required={required}
            onChange={() => onChange(choice.value)}
            className="size-4 accent-primary"
          />
          {choice.label}
        </label>
      ))}
    </div>
  );
}
