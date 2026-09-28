// The Builder's forms for the most common changes. Each one becomes an operation.
import {
  ACCESS_OPERATIONS,
  type FieldIR,
  FONTS,
  humanize,
  pageModel,
  THEME_PRESETS,
  typeKey,
} from "@smithable/core";
import { useState } from "react";
import type { Spec } from "../engine";
import { Button, Input, Label, Select } from "../ui";

export type Run = (name: string, args: Record<string, unknown>) => Promise<boolean>;

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

/**
 * A spec name from a friendly one: "Max credit" → maxCredit, "Förfallodatum" → forfallodatum.
 * A name that already is one (creditLimit) stays as it is.
 */
export function identifier(label: string): string {
  const words = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/æ/gi, "ae")
    .replace(/ø/gi, "o")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const name = words
    .map((w, i) => (i === 0 ? w[0]?.toLowerCase() + w.slice(1) : w[0]?.toUpperCase() + w.slice(1)))
    .join("");
  return /^[0-9]/.test(name) ? `field${name}` : name;
}

/** What a field form edits: the kind of value and its modifiers. */
interface FieldShape {
  kind: string;
  values: string;
  target: string;
  required: boolean;
  unique: boolean;
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
  return `${type}${shape.required ? "!" : ""}${shape.unique ? " unique" : ""}${kept}`;
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

/** A note under a form: the spec name or shorthand the form will write. */
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
] as const;

export function ChangeForms({ spec, run }: { spec: Spec; run: Run }) {
  const [change, setChange] = useState<(typeof CHANGES)[number][0]>("addField");
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
        {change === "addField" && <AddField spec={spec} run={run} />}
        {change === "changeField" && <ChangeField spec={spec} run={run} />}
        {change === "renameField" && <RenameField spec={spec} run={run} />}
        {change === "removeField" && <RemoveField spec={spec} run={run} />}
        {change === "addModel" && <AddModel run={run} />}
        {change === "addPage" && <AddPage spec={spec} run={run} />}
        {change === "setSearch" && <SetSearch spec={spec} run={run} />}
        {change === "setAccess" && <SetAccess spec={spec} run={run} />}
        {change === "setNavigation" && <SetNavigation spec={spec} run={run} />}
        {change === "setIcon" && <SetIcon spec={spec} run={run} />}
        {change === "setTone" && <SetTone spec={spec} run={run} />}
        {change === "setBelow" && <SetBelow spec={spec} run={run} />}
        {change === "addTile" && <AddTile spec={spec} run={run} />}
        {change === "removePage" && <RemovePage spec={spec} run={run} />}
      </div>
    </div>
  );
}

type FormProps = { spec: Spec; run: Run };

function useModelField(spec: Spec) {
  const models = spec.ir?.models ?? [];
  const [model, setModel] = useState(models[0]?.name ?? "");
  const fields = models.find((m) => m.name === model)?.fields ?? [];
  const [field, setField] = useState(fields[0]?.name ?? "");
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

function AddField({ spec, run }: FormProps) {
  const models = spec.ir?.models ?? [];
  const [model, setModel] = useState(models[0]?.name ?? "");
  const [label, setLabel] = useState("");
  const [shape, setShape] = useState<FieldShape>({
    kind: "string",
    values: "",
    target: models[0]?.name ?? "",
    required: false,
    unique: false,
  });
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
      <SpecNote label="In the spec:" text={name && type ? `${name}: ${type}` : ""} />
      <Submit label="Add field" disabled={!name} />
    </Form>
  );
}

function ChangeField({ spec, run }: FormProps) {
  const { model, field, pickers } = useModelField(spec);
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
            run={(type) => run("changeField", { model, field: field.name, type })}
          />
        ))}
    </div>
  );
}

export function FieldShapeForm({
  field,
  models,
  run,
}: {
  field: FieldIR;
  models: string[];
  run: (type: string) => Promise<boolean>;
}) {
  const [shape, setShape] = useState(() => shapeOf(field));
  const type = shorthand(shape, field);
  return (
    <Form onSubmit={() => run(type)}>
      <FieldShapeControls shape={shape} onChange={setShape} models={models} />
      <SpecNote label="In the spec:" text={`${field.name}: ${type}`} />
      <Submit label="Change field" disabled={type === shorthandOf(field)} />
    </Form>
  );
}

function RenameField({ spec, run }: FormProps) {
  const { model, field, pickers } = useModelField(spec);
  const [label, setLabel] = useState("");
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
      <SpecNote label="Will be named" text={to} />
      <Submit label="Rename field" disabled={!field || !to} />
    </Form>
  );
}

function RemoveField({ spec, run }: FormProps) {
  const { model, field, pickers } = useModelField(spec);
  return (
    <Form onSubmit={() => run("removeField", { model, field: field?.name })}>
      {pickers}
      <Submit label="Remove field" disabled={!field} />
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

function AddPage({ spec, run }: FormProps) {
  const models = spec.ir?.models ?? [];
  const [page, setPage] = useState("");
  const [model, setModel] = useState(models[0]?.name ?? "");
  return (
    <Form onSubmit={() => run("addPage", { page, model })}>
      <Label text="Page name" hint="Lowercase, e.g. products">
        <Input aria-label="Page name" value={page} onChange={(e) => setPage(e.target.value)} />
      </Label>
      <Label text="Lists">
        <Select
          aria-label="Lists"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          options={models.map((m) => m.name)}
        />
      </Label>
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
      <div className="space-y-1">
        <span className="text-xs font-medium text-neutral-600">Search by</span>
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
      </div>
      <Submit label={fields.length ? "Set search" : "Remove search"} disabled={!page} />
    </Form>
  );
}

function SetAccess({ spec, run }: FormProps) {
  const targets: [string, string][] = [
    ...(spec.ir?.models ?? []).flatMap((m) =>
      ACCESS_OPERATIONS.map(
        (op) =>
          [
            `model:${m.name}.${op}`,
            `${humanize(op)} ${humanize(m.name).toLowerCase()} records`,
          ] as [string, string],
      ),
    ),
    ...(spec.ir?.pages ?? []).map(
      (p) => [`page:${p.id}`, `Open the ${humanize(p.id).toLowerCase()} page`] as [string, string],
    ),
    ...(spec.ir?.actions ?? []).map(
      (a) => [`action:${a.name}`, humanize(a.name)] as [string, string],
    ),
  ];
  const [target, setTarget] = useState(targets[0]?.[0] ?? "");
  const roles = [
    ...(spec.auth?.roles.map((r) => r.name) ?? []),
    ...(target.startsWith("model:") && !target.endsWith(".create") ? ["owner"] : []),
  ];
  const [chosen, setChosen] = useState<string[]>([]);
  return (
    <Form onSubmit={() => run("setAccess", { target, roles: chosen })}>
      <Label text="Who can…">
        <Select
          aria-label="Who can"
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
            setChosen([]);
          }}
          options={targets}
        />
      </Label>
      <div className="space-y-1">
        <span className="text-xs font-medium text-neutral-600">
          Only (none: back to the default)
        </span>
        {roles.map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={chosen.includes(r)}
              onChange={(e) =>
                setChosen(e.target.checked ? [...chosen, r] : chosen.filter((x) => x !== r))
              }
            />
            {r === "owner" ? "the record's owner" : r}
          </label>
        ))}
      </div>
      <Submit label="Set access" disabled={!target} />
    </Form>
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
  const pages = spec.ir?.pages ?? [];
  const [page, setPage] = useState(pages[0]?.id ?? "");
  const [icon, setIcon] = useState("auto");
  return (
    <Form onSubmit={() => run("setIcon", { page, icon })}>
      <Label text="Page">
        <Select
          aria-label="Page"
          value={page}
          onChange={(e) => setPage(e.target.value)}
          options={pages.map((p) => [p.id, humanize(p.id)])}
        />
      </Label>
      <Label text="Icon in the menu" hint='"Automatic" picks one from the page’s records'>
        <Select
          aria-label="Icon"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          options={ICON_CHOICES.map((i) => [i, i === "auto" ? "Automatic" : humanize(i)])}
        />
      </Label>
      <Submit label="Set icon" disabled={!page} />
    </Form>
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
  const model = spec.ir?.models.find(
    (m) => m.name === pageModel(pages.find((p) => p.id === page) ?? pages[0]!),
  );
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

function RemovePage({ spec, run }: FormProps) {
  const pages = spec.ir?.pages ?? [];
  const [page, setPage] = useState(pages[0]?.id ?? "");
  return (
    <Form onSubmit={() => run("removePage", { page })}>
      <Label text="Page" hint="Its records and their data stay; Undo brings the page back">
        <Select
          aria-label="Page"
          value={page}
          onChange={(e) => setPage(e.target.value)}
          options={pages.map((p) => [p.id, humanize(p.id)])}
        />
      </Label>
      <Submit label="Remove page" disabled={!page || pages.length < 2} />
    </Form>
  );
}
