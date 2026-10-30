// A standard action's condition and values as forms (backlog A 203, Johan 2026-10-30): rows of a
// field and a control by the field's type, in place of "field: value" lines. Nothing changes in
// core: the rows read the action's IR and give back setAction's and addAction's arguments.
import type { ActionValueIR, Condition, ModelIR } from "@smithable/core";
import { humanize } from "@smithable/core";
import { useState } from "react";
import { Button, Input, Select } from "../ui";

type Field = ModelIR["fields"][number];
const USER = "User";

/** The fields a condition may name: choices, yes/no, single references, computed text or yes/no. */
export const whenable = (model: ModelIR | undefined): Field[] =>
  (model?.fields ?? []).filter((f) =>
    f.formula
      ? f.type.kind === "scalar" && (f.type.name === "string" || f.type.name === "bool")
      : f.type.kind === "choice" ||
        (f.type.kind === "scalar" && f.type.name === "bool") ||
        (f.type.kind === "relation" && !f.type.many),
  );

/** The fields an action may set: stored, one value each. */
export const settable = (model: ModelIR | undefined): Field[] =>
  (model?.fields ?? []).filter((f) => !f.formula && !(f.type.kind === "relation" && f.type.many));

/** A row of the condition: a field and what it wants (a choice's values, yes or no, a text). */
export interface WhenRow {
  field: string;
  value: string | boolean | string[];
}

export const whenRowsOf = (when: Condition | undefined): WhenRow[] =>
  Object.entries(when ?? {}).map(([field, value]) => ({ field, value }));

/** The rows as a condition: a choice with one value is that value, none picked leaves the row out. */
export const conditionOf = (rows: WhenRow[]): Condition =>
  Object.fromEntries(
    rows
      .filter((r) => r.field && !(Array.isArray(r.value) && r.value.length === 0) && r.value !== "")
      .map((r) => [
        r.field,
        Array.isArray(r.value) && r.value.length === 1 ? (r.value[0] as string) : r.value,
      ]),
  );

/** A row of what the action sets: a field, how it gets its value, and the value or formula. */
export interface SetRow {
  field: string;
  how: "value" | "formula" | "ask" | "me";
  value: string;
}

export const setRowsOf = (set: ActionValueIR[] | undefined): SetRow[] =>
  (set ?? []).map((v) =>
    "value" in v
      ? { field: v.field, how: "value", value: String(v.value) }
      : "text" in v
        ? { field: v.field, how: "formula", value: v.text }
        : "me" in v
          ? { field: v.field, how: "me", value: "" }
          : { field: v.field, how: "ask", value: "" },
  );

/** The rows as setAction's values: a literal, a formula, nothing (asked), or ME(). */
export const valuesOf = (rows: SetRow[]): Record<string, string> =>
  Object.fromEntries(
    rows
      .filter((r) => r.field)
      .map((r) => [r.field, r.how === "ask" ? "" : r.how === "me" ? "ME()" : r.value.trim()]),
  );

/** How a field may get its value in a row: a value, a formula, asked, or the person (User). */
export const waysFor = (field: Field | undefined): SetRow["how"][] =>
  !field
    ? ["value"]
    : field.type.kind === "relation"
      ? field.type.model === USER
        ? ["me", "ask"]
        : ["ask"]
      : ["value", "formula", "ask"];

const WAYS: Record<SetRow["how"], string> = {
  value: "a value",
  formula: "a formula",
  ask: "ask when pressed",
  me: "the person who presses it",
};

/** The condition's rows: a field picker and a control by type each, and a way to add one. */
export function WhenRows({
  model,
  rows,
  onChange,
}: {
  model: ModelIR | undefined;
  rows: WhenRow[];
  onChange: (rows: WhenRow[]) => void;
}) {
  const fields = whenable(model);
  const put = (i: number, row: WhenRow) => onChange(rows.map((r, j) => (j === i ? row : r)));
  return (
    <fieldset className="space-y-2" aria-label="For records with">
      {rows.length === 0 && <p className="text-xs text-quiet">Every record.</p>}
      {rows.map((row, i) => {
        const field = fields.find((f) => f.name === row.field);
        return (
          <div
            key={row.field}
            data-when-row={row.field}
            className="space-y-1.5 rounded-md border border-line p-2"
          >
            <div className="flex items-center gap-2">
              <Select
                aria-label="Field"
                className="flex-1"
                value={row.field}
                onChange={(e) =>
                  put(i, { field: e.target.value, value: startOf(fields, e.target.value) })
                }
                options={fields
                  .filter((f) => f.name === row.field || !rows.some((r) => r.field === f.name))
                  .map((f) => [f.name, humanize(f.name)] as [string, string])}
              />
              <Button
                variant="ghost"
                className="h-7"
                aria-label={`Remove ${humanize(row.field)}`}
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              >
                ✕
              </Button>
            </div>
            <WhenControl
              field={field}
              value={row.value}
              onChange={(value) => put(i, { ...row, value })}
            />
          </div>
        );
      })}
      {fields.length > rows.length && (
        <Button
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => {
            const free = fields.find((f) => !rows.some((r) => r.field === f.name));
            if (free) onChange([...rows, { field: free.name, value: startOf(fields, free.name) }]);
          }}
        >
          Add a condition
        </Button>
      )}
    </fieldset>
  );
}

/** What a new condition row starts with: the first value, yes, any, or nothing typed. */
function startOf(fields: Field[], name: string): WhenRow["value"] {
  const f = fields.find((x) => x.name === name);
  if (!f) return "";
  if (f.type.kind === "choice") return [f.type.values[0] as string];
  if (f.type.kind === "relation") return "any";
  if (f.type.kind === "scalar" && f.type.name === "bool") return true;
  return "";
}

/** What a condition wants of one field, by its type. */
function WhenControl({
  field,
  value,
  onChange,
}: {
  field: Field | undefined;
  value: WhenRow["value"];
  onChange: (value: WhenRow["value"]) => void;
}) {
  if (!field) return null;
  const label = `${humanize(field.name)} is`;
  if (field.type.kind === "choice") {
    const picked = Array.isArray(value) ? value : [String(value)];
    return (
      <fieldset aria-label={label} className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {field.type.values.map((v) => (
          <label key={v} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={picked.includes(v)}
              onChange={(e) =>
                onChange(e.target.checked ? [...picked, v] : picked.filter((p) => p !== v))
              }
            />
            {humanize(v)}
          </label>
        ))}
      </fieldset>
    );
  }
  if (field.type.kind === "scalar" && field.type.name === "bool")
    return (
      <Select
        aria-label={label}
        value={String(value === true || value === "true")}
        onChange={(e) => onChange(e.target.value === "true")}
        options={[
          ["true", "yes"],
          ["false", "no"],
        ]}
      />
    );
  if (field.type.kind === "relation")
    return (
      <Select
        aria-label={label}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        options={[
          ["none", "empty"],
          ["any", "set"],
          ...(field.type.model === USER
            ? ([
                ["ME()", "the person signed in"],
                ["not ME()", "not the person signed in"],
              ] as [string, string][])
            : []),
        ]}
      />
    );
  return (
    <Input aria-label={label} value={String(value)} onChange={(e) => onChange(e.target.value)} />
  );
}

/** What the action sets: rows of a field, how it gets its value, and the value. */
export function SetRows({
  model,
  rows,
  onChange,
  help,
}: {
  model: ModelIR | undefined;
  rows: SetRow[];
  onChange: (rows: SetRow[]) => void;
  /** The help beside a formula (A 204). */
  help?: React.ReactNode;
}) {
  const fields = settable(model);
  const put = (i: number, row: SetRow) => onChange(rows.map((r, j) => (j === i ? row : r)));
  const fresh = (name: string): SetRow => {
    const how = waysFor(fields.find((f) => f.name === name))[0] ?? "value";
    return { field: name, how, value: firstValue(fields.find((f) => f.name === name)) };
  };
  return (
    <fieldset className="space-y-2" aria-label="It sets">
      {rows.map((row, i) => {
        const field = fields.find((f) => f.name === row.field);
        const ways = waysFor(field);
        return (
          <div
            key={row.field}
            data-set-row={row.field}
            className="space-y-1.5 rounded-md border border-line p-2"
          >
            <div className="flex items-center gap-2">
              <Select
                aria-label="Field"
                className="flex-1"
                value={row.field}
                onChange={(e) => put(i, fresh(e.target.value))}
                options={fields
                  .filter((f) => f.name === row.field || !rows.some((r) => r.field === f.name))
                  .map((f) => [f.name, humanize(f.name)] as [string, string])}
              />
              <Button
                variant="ghost"
                className="h-7"
                aria-label={`Remove ${humanize(row.field)}`}
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              >
                ✕
              </Button>
            </div>
            {ways.length > 1 && (
              <fieldset
                aria-label={`How ${humanize(row.field)} is set`}
                className="flex flex-wrap gap-x-3 text-sm"
              >
                {ways.map((w) => (
                  <label key={w} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={row.how === w}
                      onChange={() =>
                        put(i, { ...row, how: w, value: w === "value" ? firstValue(field) : "" })
                      }
                    />
                    {WAYS[w]}
                  </label>
                ))}
              </fieldset>
            )}
            {row.how === "value" && (
              <SetControl
                field={field}
                value={row.value}
                onChange={(value) => put(i, { ...row, value })}
              />
            )}
            {row.how === "formula" && (
              <div className="flex items-center gap-1.5">
                <Input
                  aria-label={`${humanize(row.field)} formula`}
                  placeholder="e.g. TODAY()"
                  className="flex-1 font-mono text-xs"
                  value={row.value}
                  onChange={(e) => put(i, { ...row, value: e.target.value })}
                />
                {help}
              </div>
            )}
          </div>
        );
      })}
      {fields.length > rows.length && (
        <Button
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => {
            const free = fields.find((f) => !rows.some((r) => r.field === f.name));
            if (free) onChange([...rows, fresh(free.name)]);
          }}
        >
          Add a value
        </Button>
      )}
    </fieldset>
  );
}

/** A new value row's start: a choice's first value, yes, or nothing typed. */
export function firstValue(field: Field | undefined): string {
  if (field?.type.kind === "choice") return field.type.values[0] ?? "";
  if (field?.type.kind === "scalar" && field.type.name === "bool") return "true";
  return "";
}

/** The field's own control for a literal: a pick list, yes or no, a date, a number, a text. */
function SetControl({
  field,
  value,
  onChange,
}: {
  field: Field | undefined;
  value: string;
  onChange: (value: string) => void;
}) {
  if (!field) return null;
  const label = `${humanize(field.name)} becomes`;
  if (field.type.kind === "choice")
    return (
      <Select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={field.type.values.map((v) => [v, humanize(v)] as [string, string])}
      />
    );
  if (field.type.kind === "scalar" && field.type.name === "bool")
    return (
      <Select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={[
          ["true", "yes"],
          ["false", "no"],
        ]}
      />
    );
  const kind =
    field.type.kind === "scalar"
      ? ["int", "decimal", "money"].includes(field.type.name)
        ? "number"
        : field.type.name === "date"
          ? "date"
          : field.type.name === "datetime"
            ? "datetime-local"
            : "text"
      : "text";
  return (
    <Input
      aria-label={label}
      type={kind}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/**
 * An action's condition or values in Behavior's entry (A 203): its rows, and Change, which sends
 * only that part through setAction; unchanged rows send nothing.
 */
export function ActionRowsEditor({
  part,
  model,
  when,
  set,
  onSave,
  help,
}: {
  part: "when" | "set";
  model: ModelIR | undefined;
  when?: Condition;
  set?: ActionValueIR[];
  onSave: (value: Condition | Record<string, string>) => Promise<boolean>;
  /** The help beside the rows and a formula (A 204). */
  help?: (topic: "condition" | "formula") => React.ReactNode;
}) {
  const [whenRows, setWhenRows] = useState(() => whenRowsOf(when));
  const [setRows, setSetRows] = useState(() => setRowsOf(set));
  const value = part === "when" ? conditionOf(whenRows) : valuesOf(setRows);
  const was = part === "when" ? conditionOf(whenRowsOf(when)) : valuesOf(setRowsOf(set));
  const changed = JSON.stringify(value) !== JSON.stringify(was);
  return (
    <div className="space-y-2">
      {part === "when" ? (
        <>
          {help && <div className="flex justify-end">{help("condition")}</div>}
          <WhenRows model={model} rows={whenRows} onChange={setWhenRows} />
        </>
      ) : (
        <SetRows model={model} rows={setRows} onChange={setSetRows} help={help?.("formula")} />
      )}
      {changed && (
        <Button className="h-7 text-xs" onClick={() => void onSave(value)}>
          {part === "when" ? "Change the condition" : "Change the values"}
        </Button>
      )}
    </div>
  );
}
