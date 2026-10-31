// A merge's rules, a split's lists and fields, and a copy's values and lists as controls in
// Behavior's action entry (backlog A 206, after A 203's rows): each written as the spec has it,
// through editSpec on the action's own keys, only what changed.
import type { ActionValueIR, MergeInto, MergeRule, ModelIR } from "@smithable/core";
import { humanize } from "@smithable/core";
import { useState } from "react";
import { Button, Select } from "../ui";
import { type SetRow, SetRows, setRowsOf, unfinished, valuesOf } from "./action-rows";

type Field = ModelIR["fields"][number];
type Write = (key: string, value: unknown) => Promise<boolean>;

const list = (f: Field) => f.type.kind === "relation" && f.type.many;
const scalar = (f: Field, ...names: string[]) =>
  f.type.kind === "scalar" && names.includes(f.type.name);

/** The fields a merge rule applies to: stored values, not references (they move) or the app's. */
export const mergeable = (model: ModelIR | undefined): Field[] =>
  (model?.fields ?? []).filter(
    (f) => !f.formula && !f.sequence && !f.byApp && f.type.kind !== "relation",
  );

/** The rules a field may take: the sum for numbers and amounts, the texts joined for texts. */
export const rulesFor = (f: Field): MergeRule[] => [
  "ask",
  "keep",
  "other",
  ...(scalar(f, "int", "decimal", "money") ? (["add"] as const) : []),
  ...(scalar(f, "text", "markdown") ? (["append"] as const) : []),
];

const RULES: Record<MergeRule, string> = {
  ask: "ask when they differ",
  keep: "the kept record's",
  other: "another's",
  add: "the sum",
  append: "the texts joined",
};

/** A merge's rules (`fields`, ask unsaid) and what it makes (`into`), with Change for each. */
export function MergePicker({
  model,
  into,
  fields,
  write,
}: {
  model: ModelIR | undefined;
  into: MergeInto;
  fields: Record<string, MergeRule>;
  write: Write;
}) {
  const [rules, setRules] = useState(fields);
  // Ask is what an unnamed field does: left out of the map.
  const named = Object.fromEntries(Object.entries(rules).filter(([, r]) => r !== "ask"));
  const changed = JSON.stringify(named) !== JSON.stringify(fields);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-xs text-muted">It makes</span>
        <Select
          aria-label="It makes"
          value={into}
          onChange={(e) => {
            const next = e.target.value as MergeInto;
            void write("into", next === "chosen" ? undefined : next);
          }}
          options={[
            ["chosen", "one record of the picked, the others to the trash"],
            ["new", "a new record from the picked, which stay"],
          ]}
        />
      </div>
      <fieldset aria-label="Each field" className="space-y-1.5">
        {mergeable(model).map((f) => (
          <div key={f.name} data-merge-field={f.name} className="flex items-center gap-2 text-sm">
            <span className="w-32 shrink-0 truncate">{humanize(f.name)}</span>
            <Select
              aria-label={`${humanize(f.name)} takes`}
              className="flex-1"
              value={rules[f.name] ?? "ask"}
              onChange={(e) => setRules({ ...rules, [f.name]: e.target.value as MergeRule })}
              options={rulesFor(f).map((r) => [r, RULES[r]] as [string, string])}
            />
          </div>
        ))}
      </fieldset>
      {changed && (
        <Button
          className="h-7 text-xs"
          onClick={() => void write("fields", Object.keys(named).length ? named : undefined)}
        >
          Change the rules
        </Button>
      )}
    </div>
  );
}

/** The fields a split's new record may take from the old: stored, not unique, not the app's. */
export const copyable = (model: ModelIR | undefined): Field[] =>
  (model?.fields ?? []).filter(
    (f) =>
      !f.formula &&
      !f.sequence &&
      !f.byApp &&
      !f.unique &&
      !list(f) &&
      !scalar(f, "picture", "pictures", "file", "files"),
  );

/** A split's list that moves and the fields the new record takes (every one it can, unsaid). */
export function SplitPicker({
  model,
  move,
  copy,
  write,
}: {
  model: ModelIR | undefined;
  move: string;
  copy: string[] | undefined;
  write: Write;
}) {
  const lists = (model?.fields ?? []).filter(list);
  const fields = copyable(model);
  const [taken, setTaken] = useState<string[] | undefined>(copy);
  const changed = JSON.stringify(taken ?? null) !== JSON.stringify(copy ?? null);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-xs text-muted">Moves</span>
        <Select
          aria-label="Moves"
          value={move}
          onChange={(e) => void write("move", e.target.value)}
          options={lists.map((f) => [f.name, humanize(f.name)] as [string, string])}
        />
      </div>
      <fieldset aria-label="The new record takes" className="space-y-1 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={taken === undefined} onChange={() => setTaken(undefined)} />
          every field it can
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={taken !== undefined}
            onChange={() => setTaken(copy ?? fields.map((f) => f.name))}
          />
          these fields
        </label>
        {taken !== undefined && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 pl-5">
            {fields.map((f) => (
              <label key={f.name} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={taken.includes(f.name)}
                  onChange={(e) =>
                    setTaken(
                      e.target.checked ? [...taken, f.name] : taken.filter((n) => n !== f.name),
                    )
                  }
                />
                {humanize(f.name)}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      {changed && (
        <div className="flex items-center gap-2">
          <Button
            className="h-7 text-xs"
            disabled={taken?.length === 0}
            // In the model's order; none at all cannot be sent.
            onClick={() =>
              void write(
                "copy",
                taken && fields.map((f) => f.name).filter((n) => taken.includes(n)),
              )
            }
          >
            Change what it takes
          </Button>
          {taken?.length === 0 && (
            <span className="text-xs text-quiet">Pick one at least, or every field it can.</span>
          )}
        </div>
      )}
    </div>
  );
}

/** A copy's values that differ (as a standard action's set) and the lists it takes along. */
export function CopyPicker({
  model,
  copy,
  lists,
  write,
  help,
}: {
  model: ModelIR | undefined;
  copy: ActionValueIR[];
  lists: string[];
  write: Write;
  help?: React.ReactNode;
}) {
  const [rows, setRows] = useState<SetRow[]>(() => setRowsOf(copy));
  const changed = JSON.stringify(valuesOf(rows)) !== JSON.stringify(valuesOf(setRowsOf(copy)));
  const all = (model?.fields ?? []).filter(list);
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">The copy differs in</p>
      <SetRows model={model} rows={rows} onChange={setRows} help={help} />
      {changed && (
        <Button
          className="h-7 text-xs"
          disabled={unfinished(rows)}
          onClick={() => void write("copy", valuesOf(rows))}
        >
          Change what differs
        </Button>
      )}
      {all.length > 0 && (
        <fieldset aria-label="It takes along" className="space-y-1 text-sm">
          <legend className="text-xs text-muted">It takes along</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {all.map((f) => (
              <label key={f.name} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={lists.includes(f.name)}
                  onChange={(e) => {
                    // In the model's order, straight from the spec's list.
                    const next = all
                      .map((l) => l.name)
                      .filter((n) => (n === f.name ? e.target.checked : lists.includes(n)));
                    void write("with", next.length ? next : undefined);
                  }}
                />
                {humanize(f.name)}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
