// The Builder's forms for the most common changes. Each one becomes an operation.
import {
  type ArgRef,
  type FieldIR,
  FONTS,
  findOperation,
  humanize,
  identifier,
  type JsonSchema,
  pageModel,
  THEME_PRESETS,
  typeKey,
} from "@smithable/core";
import { describeChange } from "@smithable/index";
import { useState } from "react";
import { ArgumentField, type ArgValues, argumentsOf } from "../arguments";
import type { Spec } from "../engine";
import { Button, Input, Label, Select } from "../ui";

/** Applies an operation; `confirm` accepts a loss of data the user has already seen. */
export type Run = (
  name: string,
  args: Record<string, unknown>,
  confirm?: boolean,
) => Promise<boolean>;

const KINDS: [string, string][] = [
  ["string", "Text"],
  ["text", "Long text"],
  ["int", "Whole number"],
  ["decimal", "Number"],
  ["money", "Amount"],
  ["bool", "Yes or no"],
  ["date", "Date"],
  ["datetime", "Date and time"],
  ["email", "Email address"],
  ["phone", "Phone number"],
  ["url", "Web address"],
  ["choice", "One of a list…"],
  ["relation", "A link to…"],
];

/** A field as written in the spec's shorthand, e.g. "email! unique" or "a | b". */
export function shorthandOf(field: FieldIR): string {
  const type = field.type.kind === "choice" ? field.type.values.join(" | ") : typeKey(field.type);
  const required = field.required && field.type.kind !== "choice" ? "!" : "";
  return `${type}${required}${field.unique ? " unique" : ""}${field.default !== undefined && field.type.kind !== "choice" ? ` = ${field.default}` : ""}`;
}

/** What a field form edits: the kind of value and its modifiers. */
interface FieldShape {
  kind: string;
  values: string;
  target: string;
  required: boolean;
  unique: boolean;
  /** The rest of a shorthand the form does not edit, e.g. " = 0". */
  rest?: string;
}

function shapeOf(field: FieldIR): FieldShape {
  const t = field.type;
  return {
    kind: t.kind === "scalar" ? t.name : t.kind,
    values: t.kind === "choice" ? t.values.join(", ") : "",
    target: t.kind === "relation" ? t.model : "",
    required: field.required,
    unique: field.unique,
  };
}

/** A shape from the spec's shorthand, e.g. a proposed field's type. */
function parseShape(type: string, models: string[]): FieldShape {
  if (type.includes("|"))
    return {
      kind: "choice",
      values: type
        .split("|")
        .map((v) => v.trim().replace(/!$/, ""))
        .join(", "),
      target: "",
      required: false,
      unique: false,
    };
  const [, base = "string", bang, unique, rest] = /^\s*(\w+)(!?)(\s+unique)?(.*)$/.exec(type) ?? [];
  const relation = models.includes(base) || base === "User";
  return {
    kind: relation ? "relation" : KINDS.some(([k]) => k === base) ? base : "string",
    values: "",
    target: relation ? base : (models[0] ?? ""),
    required: bang === "!",
    unique: Boolean(unique),
    rest: rest?.trim() ? rest : undefined,
  };
}

/** The spec's shorthand for a shape, e.g. "email! unique" or "draft | sent". */
function shorthand(shape: FieldShape, keepDefault?: FieldIR): string {
  if (shape.kind === "choice")
    return shape.values
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .join(" | ");
  const type = shape.kind === "relation" ? shape.target : shape.kind;
  const kept =
    keepDefault?.default !== undefined && shapeOf(keepDefault).kind === shape.kind
      ? ` = ${keepDefault.default}`
      : "";
  return `${type}${shape.required ? "!" : ""}${shape.unique ? " unique" : ""}${shape.rest ?? kept}`;
}

/** The controls for a field's kind of value, its choices or link, and its modifiers. */
function FieldShapeControls({
  shape,
  onChange,
  models,
}: {
  shape: FieldShape;
  onChange: (shape: FieldShape) => void;
  models: string[];
}) {
  const set = (change: Partial<FieldShape>) => onChange({ ...shape, ...change });
  return (
    <>
      <Label text="Holds">
        <Select
          aria-label="Holds"
          value={shape.kind}
          onChange={(e) => set({ kind: e.target.value, target: shape.target || (models[0] ?? "") })}
          options={KINDS}
        />
      </Label>
      {shape.kind === "choice" && (
        <Label text="Values" hint="Separated by commas; the first is the default">
          <Input
            aria-label="Values"
            value={shape.values}
            onChange={(e) => set({ values: e.target.value })}
            placeholder="draft, sent, paid"
          />
        </Label>
      )}
      {shape.kind === "relation" && (
        <Label text="Links to">
          <Select
            aria-label="Links to"
            value={shape.target}
            onChange={(e) => set({ target: e.target.value })}
            options={[...models, "User"]}
          />
        </Label>
      )}
      {shape.kind !== "choice" && (
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={shape.required}
              onChange={(e) => set({ required: e.target.checked })}
            />{" "}
            Required
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={shape.unique}
              onChange={(e) => set({ unique: e.target.checked })}
            />{" "}
            Unique
          </label>
        </div>
      )}
    </>
  );
}

/** The change a form will make, in the words of "Your app". */
function changeText(spec: Spec, op: string, args: Record<string, unknown>) {
  return spec.ir ? (describeChange(op, args, spec.ir, spec.content) ?? "") : "";
}

/** A note under a form: the change it will make, or (in Studio) what it writes in the spec. */
function SpecNote({ label, text }: { label: string; text: string }) {
  return text ? (
    <p className="text-xs text-neutral-500">
      {label} <code className="rounded bg-neutral-100 px-1">{text}</code>
    </p>
  ) : null;
}

const CHANGES = [
  ["setTheme", "Look and feel"],
  ["addField", "Add a field"],
  ["changeField", "Change a field"],
  ["renameField", "Rename a field"],
  ["removeField", "Remove a field"],
  ["addModel", "Add a kind of record"],
  ["addPage", "Add a page"],
  ["setSearch", "Search on a page"],
  ["setAccess", "Who can do what"],
  ["setNavigation", "Menu order"],
  ["setIcon", "A page's icon"],
  ["setTone", "Colours of a choice"],
  ["setBelow", "A second line in a list"],
  ["addTile", "A dashboard tile"],
  ["removePage", "Remove a page"],
  ["addSection", "A section on a landing page"],
  ["removeSection", "Remove a section"],
  ["addAction", "An action"],
] as const;

/** Operations whose form can hold everything a proposal gives them (the change box → the Change tab). */
export const PREFILLED = ["addField", "changeField", "renameField", "removeField", "addPage"];

export type Prefill = { op: string; args: Record<string, unknown> };

export function ChangeForms({ spec, run, prefill }: { spec: Spec; run: Run; prefill?: Prefill }) {
  const [change, setChange] = useState<(typeof CHANGES)[number][0]>(
    () => CHANGES.find(([op]) => op === prefill?.op)?.[0] ?? "addField",
  );
  // A proposal's values, for its own form only.
  const initial = change === prefill?.op ? prefill.args : undefined;
  if (!spec.ir)
    return (
      <p className="p-3 text-sm text-neutral-500">The spec has errors; fix them in Studio mode.</p>
    );
  return (
    <div className="space-y-4 p-3">
      <Label text="What do you want to change?">
        <Select
          aria-label="What do you want to change?"
          value={change}
          onChange={(e) => setChange(e.target.value as typeof change)}
          options={CHANGES.map(([value, label]) => [value, label])}
        />
      </Label>
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
        {change === "setTheme" && <SetTheme run={run} />}
        {change === "addField" && <AddField spec={spec} run={run} initial={initial} />}
        {change === "changeField" && <ChangeField spec={spec} run={run} initial={initial} />}
        {change === "renameField" && <RenameField spec={spec} run={run} initial={initial} />}
        {change === "removeField" && (
          <FromSchema
            op="removeField"
            spec={spec}
            run={run}
            initial={initial}
            submit="Remove field"
          />
        )}
        {change === "addModel" && <AddModel run={run} />}
        {change === "addPage" && <AddPage spec={spec} run={run} initial={initial} />}
        {change === "setSearch" && <SetSearch spec={spec} run={run} />}
        {change === "setAccess" && <SetAccess spec={spec} run={run} />}
        {change === "setNavigation" && <SetNavigation spec={spec} run={run} />}
        {change === "setIcon" && <SetIcon spec={spec} run={run} />}
        {change === "setTone" && <SetTone spec={spec} run={run} />}
        {change === "setBelow" && <SetBelow spec={spec} run={run} />}
        {change === "addTile" && <AddTile spec={spec} run={run} />}
        {change === "removePage" && (
          <FromSchema
            op="removePage"
            spec={spec}
            run={run}
            submit="Remove page"
            hint="Its records and their data stay; Undo brings the page back."
            disabled={(spec.ir?.pages.length ?? 0) < 2}
          />
        )}
        {change === "addSection" && <AddSection spec={spec} run={run} />}
        {change === "addAction" && <AddAction spec={spec} run={run} initial={initial} />}
        {change === "removeSection" && (
          <FromSchema
            op="removeSection"
            spec={spec}
            run={run}
            submit="Remove section"
            hint="Its texts go too; Undo brings it back."
          />
        )}
      </div>
    </div>
  );
}

type FormProps = { spec: Spec; run: Run; initial?: Record<string, unknown> };

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

function useModelField(spec: Spec, initial?: { model?: string; field?: string }) {
  const models = spec.ir?.models ?? [];
  const [model, setModel] = useState(initial?.model ?? models[0]?.name ?? "");
  const fields = models.find((m) => m.name === model)?.fields ?? [];
  const [field, setField] = useState(initial?.field ?? fields[0]?.name ?? "");
  const current = fields.find((f) => f.name === field) ?? fields[0];
  const pickers = (
    <>
      <Label text="Kind of record">
        <Select
          aria-label="Kind of record"
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            setField(models.find((m) => m.name === e.target.value)?.fields[0]?.name ?? "");
          }}
          options={models.map((m) => m.name)}
        />
      </Label>
      <Label text="Field">
        <Select
          aria-label="Field"
          value={current?.name ?? ""}
          onChange={(e) => setField(e.target.value)}
          options={fields.map((f) => [f.name, humanize(f.name)])}
        />
      </Label>
    </>
  );
  return { model, field: current, pickers };
}

function Submit({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <Button type="submit" disabled={disabled} className="w-full">
      {label}
    </Button>
  );
}

function Form({
  onSubmit,
  children,
}: {
  onSubmit: () => Promise<unknown>;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSubmit();
        setBusy(false);
      }}
    >
      <fieldset disabled={busy} className="space-y-3">
        {children}
      </fieldset>
    </form>
  );
}

function AddField({ spec, run, initial }: FormProps) {
  const models = spec.ir?.models ?? [];
  const [model, setModel] = useState(str(initial?.model) ?? models[0]?.name ?? "");
  const [label, setLabel] = useState(str(initial?.field) ?? "");
  const [shape, setShape] = useState(() =>
    parseShape(
      str(initial?.type) ?? "string",
      models.map((m) => m.name),
    ),
  );
  const name = identifier(label);
  const type = shorthand(shape);
  return (
    <Form onSubmit={() => run("addField", { model, field: name, type })}>
      <Label text="Kind of record">
        <Select
          aria-label="Kind of record"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          options={models.map((m) => m.name)}
        />
      </Label>
      <Label text="Name">
        <Input
          aria-label="Name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Website"
        />
      </Label>
      <FieldShapeControls shape={shape} onChange={setShape} models={models.map((m) => m.name)} />
      <SpecNote
        label="Will read:"
        text={name && type ? changeText(spec, "addField", { model, field: name, type }) : ""}
      />
      <Submit label="Add field" disabled={!name} />
    </Form>
  );
}

function ChangeField({ spec, run, initial }: FormProps) {
  const { model, field, pickers } = useModelField(spec, {
    model: str(initial?.model),
    field: str(initial?.field),
  });
  const models = (spec.ir?.models ?? []).map((m) => m.name);
  return (
    <div className="space-y-3">
      {pickers}
      {field &&
        (field.formula || (field.type.kind === "relation" && field.type.many) ? (
          <p className="text-sm text-neutral-600">
            {field.formula ? "This field is calculated" : "This field lists related records"}:
            change it in Studio mode.
          </p>
        ) : (
          // A new form for each field, starting from its current definition.
          <FieldShapeForm
            key={`${model}.${field.name}`}
            field={field}
            models={models}
            type={field.name === initial?.field ? str(initial?.type) : undefined}
            describe={(type) => changeText(spec, "changeField", { model, field: field.name, type })}
            run={(type) => run("changeField", { model, field: field.name, type })}
          />
        ))}
    </div>
  );
}

export function FieldShapeForm({
  field,
  models,
  type: proposed,
  describe,
  run,
}: {
  field: FieldIR;
  models: string[];
  /** A proposed type to start from instead of the field's own. */
  type?: string;
  /** The change in plain words (Builder); without it, the spec's shorthand (Studio). */
  describe?: (type: string) => string;
  run: (type: string) => Promise<boolean>;
}) {
  const [shape, setShape] = useState(() =>
    proposed ? parseShape(proposed, models) : shapeOf(field),
  );
  const type = shorthand(shape, field);
  return (
    <Form onSubmit={() => run(type)}>
      <FieldShapeControls shape={shape} onChange={setShape} models={models} />
      {describe ? (
        <SpecNote label="Will read:" text={type === shorthandOf(field) ? "" : describe(type)} />
      ) : (
        <SpecNote label="In the spec:" text={`${field.name}: ${type}`} />
      )}
      <Submit label="Change field" disabled={type === shorthandOf(field)} />
    </Form>
  );
}

function RenameField({ spec, run, initial }: FormProps) {
  const { model, field, pickers } = useModelField(spec, {
    model: str(initial?.model),
    field: str(initial?.from),
  });
  const [label, setLabel] = useState(str(initial?.to) ?? "");
  const to = identifier(label);
  return (
    <Form onSubmit={() => run("renameField", { model, from: field?.name, to })}>
      {pickers}
      <Label text="New name" hint="The data is kept">
        <Input
          aria-label="New name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Max credit"
        />
      </Label>
      <SpecNote
        label="Will read:"
        text={field && to ? changeText(spec, "renameField", { model, from: field.name, to }) : ""}
      />
      <Submit label="Rename field" disabled={!field || !to} />
    </Form>
  );
}

function AddModel({ run }: { run: Run }) {
  const [name, setName] = useState("");
  const [field, setField] = useState("name");
  return (
    <Form onSubmit={() => run("addModel", { model: name, fields: { [field]: "string!" } })}>
      <Label text="Name" hint="In PascalCase, singular, e.g. Product">
        <Input aria-label="Model name" value={name} onChange={(e) => setName(e.target.value)} />
      </Label>
      <Label text="First field (required text)">
        <Input aria-label="First field" value={field} onChange={(e) => setField(e.target.value)} />
      </Label>
      <Submit label="Add" disabled={!name || !field} />
    </Form>
  );
}

/** "name: type" lines as field shorthand, e.g. "keep: Customer!". */
const fieldLines = (text: string): Record<string, string> =>
  Object.fromEntries(
    text
      .split("\n")
      .map((line) => line.split(":").map((part) => part.trim()))
      .filter(([name, type]) => name && type),
  );

function AddAction({ spec, run, initial }: FormProps) {
  const roles = spec.auth?.roles.map((r) => r.name) ?? [];
  const [action, setAction] = useState(str(initial?.action) ?? "");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [allow, setAllow] = useState<string[]>([]);
  const [intent, setIntent] = useState(str(initial?.intent) ?? "");
  const box =
    "block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 font-mono text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";
  return (
    <Form
      onSubmit={() =>
        run("addAction", {
          action,
          input: fieldLines(input),
          output: fieldLines(output),
          allow,
          intent,
        })
      }
    >
      <Label text="Name" hint="In camelCase, e.g. mergeCustomers">
        <Input
          aria-label="Action name"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
      </Label>
      <Label text="What it is for">
        <Input
          aria-label="What it is for"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
        />
      </Label>
      <Label text="What it needs" hint='One per line, e.g. "keep: Customer!"'>
        <textarea
          aria-label="What it needs"
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={box}
        />
      </Label>
      <Label text="What it returns (optional)">
        <textarea
          aria-label="What it returns"
          rows={2}
          value={output}
          onChange={(e) => setOutput(e.target.value)}
          className={box}
        />
      </Label>
      {roles.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="text-xs font-medium text-neutral-600">
            Who may run it (none: the default access)
          </legend>
          {roles.map((role) => (
            <label key={role} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allow.includes(role)}
                onChange={(e) =>
                  setAllow(e.target.checked ? [...allow, role] : allow.filter((r) => r !== role))
                }
              />
              {role}
            </label>
          ))}
        </fieldset>
      )}
      <p className="text-xs text-neutral-500">
        What it does is code: it starts as a stub in src/custom/actions/, for a developer or an
        agent to write.
      </p>
      <Submit label="Add action" disabled={!action} />
    </Form>
  );
}

function AddPage({ spec, run, initial }: FormProps) {
  const models = spec.ir?.models ?? [];
  const [page, setPage] = useState(str(initial?.page) ?? "");
  const [model, setModel] = useState(str(initial?.model) ?? models[0]?.name ?? "");
  const [kind, setKind] = useState("list");
  return (
    <Form
      onSubmit={() =>
        kind === "landing" ? run("addLandingPage", { page }) : run("addPage", { page, model })
      }
    >
      <Label text="Page name" hint="Lowercase, e.g. products">
        <Input aria-label="Page name" value={page} onChange={(e) => setPage(e.target.value)} />
      </Label>
      <Label text="Kind of page">
        <Select
          aria-label="Kind of page"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={[
            ["list", "A list of records"],
            ["landing", "A landing page for visitors"],
          ]}
        />
      </Label>
      {kind === "landing" ? (
        <p className="text-xs text-neutral-500">
          It starts with a heading and a footer, opens without sign-in, and gets more sections from
          “A section on a landing page”.
        </p>
      ) : (
        <Label text="Lists">
          <Select
            aria-label="Lists"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            options={models.map((m) => m.name)}
          />
        </Label>
      )}
      <Submit label="Add page" disabled={!page} />
    </Form>
  );
}

function SetSearch({ spec, run }: FormProps) {
  const pages = (spec.ir?.pages ?? []).filter((p) => pageModel(p) !== undefined);
  const [page, setPage] = useState(pages[0]?.id ?? "");
  const current = pages.find((p) => p.id === page);
  const model = spec.ir?.models.find((m) => current && m.name === pageModel(current));
  const searchable = (model?.fields ?? []).filter(
    (f) =>
      !f.formula &&
      (f.type.kind === "choice" ||
        (f.type.kind === "relation" && !f.type.many) ||
        (f.type.kind === "scalar" &&
          ["string", "text", "email", "phone", "url"].includes(f.type.name))),
  );
  const [chosen, setChosen] = useState<string[] | undefined>();
  const fields = chosen ?? current?.search ?? [];
  return (
    <Form onSubmit={() => run("setSearch", { page, fields }).then(() => setChosen(undefined))}>
      <Label text="Page">
        <Select
          aria-label="Page"
          value={page}
          onChange={(e) => {
            setPage(e.target.value);
            setChosen(undefined);
          }}
          options={pages.map((p) => [p.id, humanize(p.id)])}
        />
      </Label>
      <fieldset className="space-y-1">
        <legend className="text-xs font-medium text-neutral-600">Search by</legend>
        {searchable.map((f) => (
          <label key={f.name} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={fields.includes(f.name)}
              onChange={(e) =>
                setChosen(
                  e.target.checked ? [...fields, f.name] : fields.filter((x) => x !== f.name),
                )
              }
            />
            {humanize(f.name)}
          </label>
        ))}
      </fieldset>
      <Submit label={fields.length ? "Set search" : "Remove search"} disabled={!page} />
    </Form>
  );
}

function SetAccess({ spec, run }: FormProps) {
  return (
    <FromSchema
      op="setAccess"
      spec={spec}
      run={run}
      submit="Set access"
      hints={{ roles: "None: back to the default." }}
    />
  );
}

function SetNavigation({ spec, run }: FormProps) {
  const initial = spec.ir?.navigation.find((m) => m.name === "main")?.pages ?? [];
  const [pages, setPages] = useState(initial);
  const move = (i: number, by: number) => {
    const next = [...pages];
    const [page] = next.splice(i, 1);
    next.splice(i + by, 0, page as string);
    setPages(next);
  };
  return (
    <Form onSubmit={() => run("setNavigation", { menu: "main", pages })}>
      <ol className="space-y-1">
        {pages.map((p, i) => (
          <li
            key={p}
            className="flex items-center justify-between rounded-md bg-white px-2 py-1 text-sm shadow-xs"
          >
            {humanize(p)}
            <span className="flex gap-1">
              <Button
                variant="ghost"
                aria-label={`Move ${humanize(p)} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                aria-label={`Move ${humanize(p)} down`}
                disabled={i === pages.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </Button>
            </span>
          </li>
        ))}
      </ol>
      <Submit label="Save menu order" />
    </Form>
  );
}

function SetTheme({ run }: { run: Run }) {
  const [preset, setPreset] = useState<string>(THEME_PRESETS[0]);
  const [useBrand, setUseBrand] = useState(false);
  const [primary, setPrimary] = useState("#2563eb");
  const [font, setFont] = useState("none");
  const [density, setDensity] = useState("comfortable");
  return (
    <Form
      onSubmit={() =>
        run("setTheme", { preset, primary: useBrand ? primary : "none", font, density })
      }
    >
      <Label text="Theme">
        <Select
          aria-label="Theme"
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          options={THEME_PRESETS.map((p) => [p, humanize(p)])}
        />
      </Label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={useBrand} onChange={(e) => setUseBrand(e.target.checked)} />{" "}
        Use my brand colour
      </label>
      {useBrand && (
        <Label text="Brand colour" hint="Adjusted where needed so text stays readable">
          <Input
            type="color"
            aria-label="Brand colour"
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            className="h-10 p-1"
          />
        </Label>
      )}
      <Label text="Font">
        <Select
          aria-label="Font"
          value={font}
          onChange={(e) => setFont(e.target.value)}
          options={[["none", "The theme's font"], ...FONTS.map((f) => [f, f] as [string, string])]}
        />
      </Label>
      <Label text="Density">
        <Select
          aria-label="Density"
          value={density}
          onChange={(e) => setDensity(e.target.value)}
          options={[
            ["comfortable", "Comfortable"],
            ["compact", "Compact: more on screen"],
          ]}
        />
      </Label>
      <Submit label="Apply" />
    </Form>
  );
}

const ICON_CHOICES = [
  "auto",
  "users",
  "user",
  "file",
  "receipt",
  "cart",
  "package",
  "calendar",
  "layers",
  "book",
  "briefcase",
  "building",
  "chart",
  "clipboard",
  "home",
  "mail",
  "settings",
  "star",
  "tag",
  "truck",
  "list",
];

function SetIcon({ spec, run }: FormProps) {
  return (
    <FromSchema
      op="setIcon"
      spec={spec}
      run={run}
      initial={{ icon: "auto" }}
      submit="Set icon"
      controls={{
        icon: (icon, set) => (
          <Label text="Icon in the menu" hint='"Automatic" picks one from the page’s records'>
            <Select
              aria-label="Icon"
              value={icon || "auto"}
              onChange={(e) => set(e.target.value)}
              options={ICON_CHOICES.map((i) => [i, i === "auto" ? "Automatic" : humanize(i)])}
            />
          </Label>
        ),
      }}
    />
  );
}

const TONE_CHOICES: [string, string][] = [
  ["neutral", "Grey (neutral)"],
  ["success", "Green (good)"],
  ["warning", "Amber (needs attention)"],
  ["danger", "Red (a problem)"],
];

function SetTone({ spec, run }: FormProps) {
  const choices = (spec.ir?.models ?? []).flatMap((m) =>
    m.fields.flatMap((f) =>
      f.type.kind === "choice" ? [{ model: m.name, field: f.name, values: f.type.values }] : [],
    ),
  );
  const [key, setKey] = useState(choices[0] ? `${choices[0].model}.${choices[0].field}` : "");
  const current = choices.find((c) => `${c.model}.${c.field}` === key);
  const [value, setValue] = useState("");
  const [tone, setTone] = useState("success");
  const shown = current?.values.includes(value) ? value : (current?.values[0] ?? "");
  if (!choices.length) return <p className="text-sm text-neutral-600">No field is a choice yet.</p>;
  return (
    <Form
      onSubmit={() =>
        run("setTone", { model: current?.model, field: current?.field, value: shown, tone })
      }
    >
      <Label text="Choice field">
        <Select
          aria-label="Choice field"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          options={choices.map((c) => [
            `${c.model}.${c.field}`,
            `${humanize(c.field)} of ${c.model}`,
          ])}
        />
      </Label>
      <Label text="Value">
        <Select
          aria-label="Value"
          value={shown}
          onChange={(e) => setValue(e.target.value)}
          options={(current?.values ?? []).map((v) => [v, humanize(v)])}
        />
      </Label>
      <Label text="Colour">
        <Select
          aria-label="Colour"
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          options={TONE_CHOICES}
        />
      </Label>
      <Submit label="Set colour" disabled={!current} />
    </Form>
  );
}

function SetBelow({ spec, run }: FormProps) {
  const pages = (spec.ir?.pages ?? []).filter((p) => pageModel(p) !== undefined);
  const [page, setPage] = useState(pages[0]?.id ?? "");
  const shown = pages.find((p) => p.id === page) ?? pages[0];
  const model = shown && spec.ir?.models.find((m) => m.name === pageModel(shown));
  const fields = (model?.fields ?? []).filter((f) => !(f.type.kind === "relation" && f.type.many));
  const [column, setColumn] = useState("");
  const [field, setField] = useState("none");
  const shownColumn = fields.some((f) => f.name === column) ? column : (fields[0]?.name ?? "");
  return (
    <Form onSubmit={() => run("setBelow", { page, column: shownColumn, field })}>
      <Label text="Page">
        <Select
          aria-label="Page"
          value={page}
          onChange={(e) => setPage(e.target.value)}
          options={pages.map((p) => [p.id, humanize(p.id)])}
        />
      </Label>
      <Label text="Under the column">
        <Select
          aria-label="Under the column"
          value={shownColumn}
          onChange={(e) => setColumn(e.target.value)}
          options={fields.map((f) => [f.name, humanize(f.name)])}
        />
      </Label>
      <Label text="Show" hint="e.g. the phone number under the email">
        <Select
          aria-label="Show"
          value={field}
          onChange={(e) => setField(e.target.value)}
          options={[
            ["none", "Nothing"],
            ...fields
              .filter((f) => f.name !== shownColumn)
              .map((f): [string, string] => [f.name, humanize(f.name)]),
          ]}
        />
      </Label>
      <Submit label="Set second line" disabled={!page || !shownColumn} />
    </Form>
  );
}

const MEASURES: [string, string][] = [
  ["count", "How many records"],
  ["sum", "The total of a number"],
  ["average", "The average of a number"],
  ["list", "The latest records"],
  ["query", "A custom query's records"],
];

function AddTile({ spec, run }: FormProps) {
  const ir = spec.ir;
  const dashboards = (ir?.pages ?? [])
    .filter((p) => p.pattern.kind === "dashboard")
    .map((p) => p.id);
  const [page, setPage] = useState(dashboards[0] ?? "overview");
  const [label, setLabel] = useState("");
  const [measure, setMeasure] = useState("count");
  const models = (ir?.models ?? []).map((m) => m.name);
  const numbers = (ir?.models ?? []).flatMap((m) =>
    m.fields.flatMap((f) =>
      f.type.kind === "scalar" && ["int", "decimal", "money"].includes(f.type.name)
        ? [`${m.name}.${f.name}`]
        : [],
    ),
  );
  const queries = (ir?.queries ?? []).map((q) => q.name);
  const options =
    measure === "sum" || measure === "average" ? numbers : measure === "query" ? queries : models;
  const [of, setOf] = useState("");
  const shownOf = options.includes(of) ? of : (options[0] ?? "");
  const tile = identifier(label);
  return (
    <Form
      onSubmit={() =>
        run("addTile", {
          page,
          tile,
          measure,
          of: shownOf,
          ...(measure === "list" || measure === "query" ? { limit: 5 } : {}),
        })
      }
    >
      <Label text="Dashboard page" hint="A new name makes a new dashboard in the menu">
        <Input
          aria-label="Dashboard page"
          value={page}
          onChange={(e) => setPage(e.target.value)}
          list="dashboards"
        />
      </Label>
      <datalist id="dashboards">
        {dashboards.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
      <Label text="Tile name">
        <Input
          aria-label="Tile name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Open orders"
        />
      </Label>
      <Label text="Shows">
        <Select
          aria-label="Shows"
          value={measure}
          onChange={(e) => setMeasure(e.target.value)}
          options={MEASURES}
        />
      </Label>
      <Label text="Of">
        <Select
          aria-label="Of"
          value={shownOf}
          onChange={(e) => setOf(e.target.value)}
          options={options.map((o) => [o, o])}
        />
      </Label>
      <Submit label="Add tile" disabled={!page || !tile || !shownOf} />
    </Form>
  );
}

/** The kinds of landing section, as the form offers them. */
const SECTIONS: [string, string][] = [
  ["hero", "Hero: a heading, a text and a button"],
  ["features", "Features"],
  ["pricing", "Pricing"],
  ["testimonials", "Testimonials"],
  ["faq", "Questions and answers"],
  ["callToAction", "Call to action"],
  ["contact", "Contact details and a form"],
  ["gallery", "Pictures (a gallery)"],
  ["footer", "Footer"],
  ["records", "Records as cards"],
];

function AddSection({ spec, run }: FormProps) {
  const landings = (spec.ir?.pages ?? []).filter((p) => p.pattern.kind === "landing");
  const models = spec.ir?.models ?? [];
  const [page, setPage] = useState(landings[0]?.id ?? "");
  const [kind, setKind] = useState("contact");
  const [label, setLabel] = useState("");
  const [model, setModel] = useState(models[0]?.name ?? "");
  const [form, setForm] = useState("");
  const records = kind === "records";
  const section = records ? identifier(label) : kind;
  if (!landings.length)
    return <p className="text-sm text-neutral-600">The app has no landing page yet.</p>;
  return (
    <Form
      onSubmit={() =>
        run("addSection", {
          page,
          section,
          ...(records ? { records: model } : {}),
          ...(kind === "contact" && form ? { form } : {}),
        })
      }
    >
      <Label text="Landing page">
        <Select
          aria-label="Landing page"
          value={page}
          onChange={(e) => setPage(e.target.value)}
          options={landings.map((p) => [p.id, humanize(p.id)])}
        />
      </Label>
      <Label text="Section" hint="Its texts are changed in place in the preview">
        <Select
          aria-label="Section"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={SECTIONS}
        />
      </Label>
      {records && (
        <>
          <Label text="Name">
            <Input
              aria-label="Section name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Our classes"
            />
          </Label>
          <Label text="Shows">
            <Select
              aria-label="Shows"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              options={models.map((m) => m.name)}
            />
          </Label>
        </>
      )}
      {kind === "contact" && (
        <Label text="Form" hint="Visitors send it without an account: a record of this kind">
          <Select
            aria-label="Form"
            value={form}
            onChange={(e) => setForm(e.target.value)}
            options={[
              ["", "No form, only the details"],
              ...models.map((m): [string, string] => [m.name, humanize(m.name)]),
            ]}
          />
        </Label>
      )}
      {kind === "gallery" && (
        <p className="text-xs text-neutral-500">
          Its pictures are listed in smithable.content.yml for now (Studio mode).
        </p>
      )}
      <Submit label="Add section" disabled={!page || !section} />
    </Form>
  );
}

/**
 * A change whose form is its operation's schema (C8): each argument that names something in the
 * spec is chosen from the names there are, asked for in the annotation's words.
 */
function FromSchema({
  op,
  spec,
  run,
  initial,
  submit,
  hint,
  disabled,
  controls,
  hints,
}: FormProps & {
  op: string;
  submit: string;
  hint?: string;
  disabled?: boolean;
  /** An argument whose control the change words its own way (an icon, a tone). */
  controls?: Record<string, (value: string, set: (value: string) => void) => React.ReactNode>;
  /** A word under an argument's control. */
  hints?: Record<string, string>;
}) {
  const operation = findOperation(op, spec.plugins);
  const [values, setValues] = useState<ArgValues>(
    () =>
      Object.fromEntries(
        Object.entries(initial ?? {}).filter(([, v]) => typeof v === "string" || Array.isArray(v)),
      ) as ArgValues,
  );
  if (!operation) return null;
  const properties = (operation.schema.properties ?? {}) as Record<string, JsonSchema>;
  const required = (operation.schema.required as string[] | undefined) ?? [];
  const effective = argumentsOf(operation.schema, values, spec);
  return (
    <Form onSubmit={() => run(op, effective)}>
      {Object.entries(properties).map(([key, schema]) =>
        controls?.[key] ? (
          <div key={key}>
            {controls[key](String(effective[key] ?? ""), (v) => setValues({ ...values, [key]: v }))}
          </div>
        ) : (
          <ArgumentField
            key={key}
            name={key}
            schema={schema}
            required={required.includes(key)}
            values={values}
            effective={effective}
            setValue={(v) => setValues({ ...values, [key]: v })}
            spec={spec}
            label={(schema["x-smithable"] as ArgRef | undefined)?.label ?? humanize(key)}
            {...(hints?.[key] ? { hint: hints[key] } : {})}
          />
        ),
      )}
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      <Submit
        label={submit}
        disabled={disabled || required.some((k) => effective[k] === undefined)}
      />
    </Form>
  );
}
