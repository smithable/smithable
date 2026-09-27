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
  const [name, setName] = useState("");
  const [kind, setKind] = useState("string");
  const [values, setValues] = useState("");
  const [target, setTarget] = useState(models[0]?.name ?? "");
  const [required, setRequired] = useState(false);
  const type =
    kind === "choice"
      ? values
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
          .join(" | ")
      : `${kind === "relation" ? target : kind}${required ? "!" : ""}`;
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
      <Label text="Name" hint="In camelCase, e.g. phone or creditLimit">
        <Input
          aria-label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="website"
        />
      </Label>
      <Label text="Holds">
        <Select
          aria-label="Holds"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={KINDS}
        />
      </Label>
      {kind === "choice" && (
        <Label text="Values" hint="Separated by commas; the first is the default">
          <Input
            aria-label="Values"
            value={values}
            onChange={(e) => setValues(e.target.value)}
            placeholder="draft, sent, paid"
          />
        </Label>
      )}
      {kind === "relation" && (
        <Label text="Links to">
          <Select
            aria-label="Links to"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            options={[...models.map((m) => m.name), "User"]}
          />
        </Label>
      )}
      {kind !== "choice" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
          />{" "}
          Required
        </label>
      )}
      <Submit label="Add field" disabled={!name} />
    </Form>
  );
}

function ChangeField({ spec, run }: FormProps) {
  const { model, field, pickers } = useModelField(spec);
  const [type, setType] = useState("");
  const shown = type || (field ? shorthandOf(field) : "");
  return (
    <Form
      onSubmit={() =>
        run("changeField", { model, field: field?.name, type: shown }).then(() => setType(""))
      }
    >
      {pickers}
      <Label text="Type" hint='"!" makes it required, "unique" allows each value once'>
        <Input aria-label="Type" value={shown} onChange={(e) => setType(e.target.value)} />
      </Label>
      <Submit label="Change field" disabled={!field} />
    </Form>
  );
}

function RenameField({ spec, run }: FormProps) {
  const { model, field, pickers } = useModelField(spec);
  const [to, setTo] = useState("");
  return (
    <Form onSubmit={() => run("renameField", { model, from: field?.name, to })}>
      {pickers}
      <Label text="New name" hint="The data is kept">
        <Input aria-label="New name" value={to} onChange={(e) => setTo(e.target.value)} />
      </Label>
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
