// A concept's properties (a field's kind, label and name; a page's texts and icon; a model's
// names), each control an operation. One component for both modes: Code mode's details and
// Builder's parts (docs/design/studio-v2.md §5).
import {
  ACCESS_OPERATIONS,
  type AccessOperation,
  type FieldIR,
  humanize,
  identifier,
  isUpload,
  type ModelIR,
  modelAccess,
  plural,
} from "@smithable/core";
import { useState } from "react";
import { FieldShapeForm, listOf, type Run } from "./builder/ChangeForms";
import type { Spec } from "./engine";
import { Button, cx, Input, Label, Select } from "./ui";

/** One visible text, saved with setText; empty restores the text Smithable derives. */
function TextSetting({
  label,
  shown = label,
  path,
  current,
  fallback,
  run,
}: {
  label: string;
  /** The words above the box, when they say more than its name. */
  shown?: string;
  path: string[];
  current?: string;
  fallback: string;
  run: Run;
}) {
  const [text, setText] = useState(current ?? "");
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void run("setText", { path, text: text.trim() });
      }}
    >
      <Label text={shown}>
        <Input
          aria-label={label}
          value={text}
          placeholder={fallback}
          onChange={(e) => setText(e.target.value)}
        />
      </Label>
      <Button
        type="submit"
        variant="ghost"
        aria-label={`Save ${label.toLowerCase()}`}
        className="border border-line"
        disabled={text.trim() === (current ?? "")}
      >
        Save
      </Button>
    </form>
  );
}

/**
 * What a kind of record is called, for one and for several, saved as one change that also
 * retitles its list page where it had the old name.
 */
function RecordNames({
  model,
  one,
  several,
  run,
}: {
  model: string;
  one: string;
  several: string;
  run: Run;
}) {
  const [single, setSingle] = useState(one);
  const [many, setMany] = useState(several);
  // The plural follows the name for one until it is typed.
  const [own, setOwn] = useState(false);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void run("nameRecords", { model, one: single.trim(), several: many.trim() });
      }}
    >
      <Label text="Called, for one">
        <Input
          aria-label="Called, for one"
          value={single}
          onChange={(e) => {
            setSingle(e.target.value);
            if (!own) setMany(e.target.value.trim() ? plural(e.target.value.trim()) : "");
          }}
        />
      </Label>
      <Label text="For several">
        <Input
          aria-label="Called, for several"
          value={many}
          onChange={(e) => {
            setMany(e.target.value);
            setOwn(true);
          }}
        />
      </Label>
      <Button
        type="submit"
        variant="ghost"
        className="border border-line"
        disabled={!single.trim() || (single.trim() === one && many.trim() === several)}
      >
        Rename everywhere
      </Button>
    </form>
  );
}

/** Icons a page may have in the menu; "auto" picks one from its records. */
export const ICON_CHOICES = [
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

/** The selected concept's properties, changed with operations (the Photoshop-like panel). */
export function Properties({
  concept,
  spec,
  run,
  onLook,
}: {
  concept: string;
  spec: Spec;
  run: Run;
  /** Opens the Look tab (Builder only), where a list's columns and a form's fields are set. */
  onLook?: () => void;
}) {
  const ir = spec.ir;
  const [kind = "", rest = ""] = concept.split(":");
  const [name = "", fieldName] = rest.split(".");
  const [rename, setRename] = useState("");
  if (!ir) return null;
  const heading = <h3 className="text-xs font-semibold text-quiet">Properties</h3>;
  if (kind === "field" && fieldName) {
    const field = ir.models.find((m) => m.name === name)?.fields.find((f) => f.name === fieldName);
    if (!field) return null;
    const models = ir.models.map((m) => m.name);
    const to = identifier(rename);
    return (
      <div className="space-y-3 border-b border-line p-3 text-sm">
        {heading}
        {field.formula || (field.type.kind === "relation" && field.type.many) ? (
          <p className="text-muted">
            {field.formula ? "Calculated" : "Lists related records"}: change it in smithable.yml.
          </p>
        ) : (
          <FieldShapeForm
            field={field}
            models={models}
            run={(type, renames) =>
              run("changeField", {
                model: name,
                field: fieldName,
                type,
                ...(renames.length ? { renames } : {}),
              })
            }
          />
        )}
        <ListToggle spec={spec} run={run} model={name} field={fieldName} />
        {!field.formula && !(field.type.kind === "relation" && field.type.many) && (
          <FieldRules
            model={ir.models.find((m) => m.name === name) as ModelIR}
            field={field}
            run={run}
          />
        )}
        {isUpload(field) && <ReviewChip spec={spec} run={run} model={name} field={fieldName} />}
        <TextSetting
          label="Label"
          shown="Label (what people see)"
          path={["models", name, "fields", fieldName, "label"]}
          current={spec.content?.models[name]?.fields[fieldName]?.label}
          fallback={humanize(fieldName)}
          run={run}
        />
        {/* The name in the spec is not what people see (the label is): folded, second. */}
        <details>
          <summary className="cursor-pointer text-xs font-medium text-muted">
            Name in the spec (used in code)
          </summary>
          <form
            className="mt-2 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (to) void run("renameField", { model: name, from: fieldName, to });
            }}
          >
            <Label
              text={`Rename ${fieldName}`}
              hint={to ? `Will be named ${to}; the data is kept` : "The data is kept"}
            >
              <Input
                aria-label="Rename"
                value={rename}
                onChange={(e) => setRename(e.target.value)}
              />
            </Label>
            <Button type="submit" variant="ghost" className="border border-line" disabled={!to}>
              Rename
            </Button>
          </form>
        </details>
        <Button
          variant="ghost"
          className="border border-red-200 text-red-700"
          onClick={() => void run("removeField", { model: name, field: fieldName })}
        >
          Remove field
        </Button>
      </div>
    );
  }
  if (kind === "action") {
    const action = ir.actions.find((x) => x.name === name);
    if (!action) return null;
    const texts = spec.content?.actions[name];
    return (
      <div className="space-y-3 border-b border-line p-3 text-sm">
        {heading}
        <TextSetting
          label="Button"
          path={["actions", name, "label"]}
          current={texts?.label}
          fallback={humanize(name)}
          run={run}
        />
        <TextSetting
          label="Help"
          shown="Help: the button's tooltip"
          path={["actions", name, "help"]}
          current={texts?.help}
          fallback="None"
          run={run}
        />
        {/* The intent is for the maker and the model, never shown in the app: it becomes the
            help only when the maker says so. */}
        {action.intent && action.intent !== texts?.help && (
          <div className="space-y-1">
            <p className="text-muted">Its intent: “{action.intent}”</p>
            <Button
              variant="ghost"
              onClick={() =>
                void run("setText", { path: ["actions", name, "help"], text: action.intent })
              }
            >
              Use as the help text
            </Button>
          </div>
        )}
      </div>
    );
  }
  if (kind === "page") {
    const page = ir.pages.find((p) => p.id === name);
    if (!page) return null;
    const texts = spec.content?.pages[name];
    return (
      <div className="space-y-3 border-b border-line p-3 text-sm">
        {heading}
        <TextSetting
          label="Title"
          path={["pages", name, "title"]}
          current={texts?.title}
          fallback={humanize(name)}
          run={run}
        />
        <TextSetting
          label="Subtitle"
          path={["pages", name, "subtitle"]}
          current={texts?.subtitle}
          fallback="None"
          run={run}
        />
        {page.pattern.kind === "crud" && (
          <p className="text-muted">
            The columns its list shows and the order of its form are part of the look:
            {onLook ? (
              <>
                {" "}
                <button type="button" className="text-accent hover:underline" onClick={onLook}>
                  set them in Look
                </button>
                .
              </>
            ) : (
              ` pages.${name}.table.columns in smithable.ux.yml.`
            )}
          </p>
        )}
        <Label text="Icon in the menu">
          <Select
            aria-label="Icon in the menu"
            value=""
            onChange={(e) =>
              e.target.value && void run("setIcon", { page: name, icon: e.target.value })
            }
            options={[
              ["", "Choose…"],
              ...ICON_CHOICES.map((i): [string, string] => [
                i,
                i === "auto" ? "Automatic" : humanize(i),
              ]),
            ]}
          />
        </Label>
        <Button
          variant="ghost"
          className="border border-red-200 text-red-700"
          disabled={ir.pages.length < 2}
          onClick={() => void run("removePage", { page: name })}
        >
          Remove page
        </Button>
      </div>
    );
  }
  if (kind === "model") {
    const texts = spec.content?.models[name];
    return (
      <div className="space-y-3 border-b border-line p-3 text-sm">
        {heading}
        <RecordNames
          key={`${texts?.label}/${texts?.pluralLabel}`}
          model={name}
          one={texts?.label ?? humanize(name)}
          several={
            texts?.pluralLabel ?? (texts?.label ? plural(texts.label) : humanize(plural(name)))
          }
          run={run}
        />
        <WhoCan model={name} spec={spec} run={run} />
      </div>
    );
  }
  return null;
}

/**
 * A picture or file field held for review before others see it (docs/design/file-review.md):
 * one chip that adds the field to its model's review, or takes it out (setReview).
 */
function ReviewChip({
  spec,
  run,
  model,
  field,
}: {
  spec: Spec;
  run: Run;
  model: string;
  field: string;
}) {
  const reviewed = spec.ir?.models.find((m) => m.name === model)?.review ?? [];
  const on = reviewed.includes(field);
  const next = on ? reviewed.filter((f) => f !== field) : [...reviewed, field];
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => void run("setReview", { model, fields: next.length ? next : ["none"] })}
      className={cx(
        "h-6 rounded-full border px-2 text-xs",
        on ? "border-accent bg-accent-soft text-accent" : "border-line text-muted",
      )}
    >
      Reviewed before others see it
    </button>
  );
}

const ACCESS_WORDS: Record<AccessOperation, string> = {
  read: "See",
  create: "Add",
  write: "Change",
  delete: "Delete",
};

/**
 * Who may do what with a model's records: a row per operation, a chip per role. A chip grants
 * the role the operation on this kind of record (or takes it back) in smithable.auth.yml; the
 * record rule (everyone changes and deletes their own; shared: everyone reads all) and admins
 * stay as they are.
 */
function WhoCan({ model, spec, run }: { model: string; spec: Spec; run: Run }) {
  const found = spec.ir?.models.find((m) => m.name === model);
  const auth = spec.auth;
  if (!found || !auth || auth.signIn === "none") return null;
  const allowed = modelAccess(found, auth);
  const roles = auth.roles.filter((r) => r.name !== "admin");
  const kinds = spec.ir?.models.map((m) => m.name) ?? [];
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-quiet">Who can</legend>
      <p className="text-xs text-quiet">
        {auth.defaultAccess === "shared"
          ? "Everyone sees all records and changes and deletes their own; a role ticked here may for everyone's. Admins always may."
          : "Everyone sees, changes and deletes their own records; a role ticked here may for everyone's. Admins always may."}
      </p>
      {ACCESS_OPERATIONS.map((op) => {
        const shared = op === "read" && auth.defaultAccess === "shared";
        return (
          <div key={op} className="flex flex-wrap items-center gap-1">
            <span className="w-14 text-xs text-muted">{ACCESS_WORDS[op]}</span>
            {roles.map((role) => {
              const on = allowed[op].roles.includes(role.name);
              const grants = role.grants === "all" ? undefined : role.grants[op];
              // The names the role keeps when this one is ticked or unticked.
              const names = grants === "all" || role.grants === "all" ? kinds : [...(grants ?? [])];
              const next = on ? names.filter((n) => n !== model) : [...names, model];
              return (
                <button
                  key={role.name}
                  type="button"
                  aria-pressed={on}
                  disabled={shared}
                  aria-label={`${ACCESS_WORDS[op]}: ${role.name}`}
                  onClick={() =>
                    void run("grant", {
                      role: role.name,
                      what: op,
                      names: next.length === kinds.length ? ["all"] : next,
                    })
                  }
                  className={cx(
                    "h-6 rounded-full border px-2 text-xs",
                    on ? "border-accent bg-accent-soft text-accent" : "border-line text-muted",
                    shared && "opacity-60",
                  )}
                >
                  {role.name}
                </button>
              );
            })}
            {allowed[op].owner && (
              <span className="text-xs text-quiet">and each one their own</span>
            )}
          </div>
        );
      })}
      {allowed.read.public && (
        <p className="text-xs text-quiet">Visitors may see these too (smithable.auth.yml).</p>
      )}
    </fieldset>
  );
}

/** Whether a field is a column of its list, and a switch to show or hide it there. */
/**
 * A field's rules on the record (record-rules.md): filled by the app, when it can be changed and
 * when it is required, each a setFieldRules. A condition is one choice or yes/no field's value.
 */
function FieldRules({ model, field, run }: { model: ModelIR; field: FieldIR; run: Run }) {
  const set = (args: Record<string, unknown>) =>
    void run("setFieldRules", { model: model.name, field: field.name, ...args });
  const fields = model.fields.filter(
    (f) =>
      f.name !== field.name &&
      !f.formula &&
      (f.type.kind === "choice" || (f.type.kind === "scalar" && f.type.name === "bool")),
  );
  const lock = field.locked === true ? "once" : field.locked ? "when" : "always";
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-quiet">Rules</legend>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(field.byApp)}
          onChange={(e) => set({ by: e.target.checked ? "app" : "" })}
        />
        Filled by the app, not in the form
      </label>
      <Label text="Can be changed">
        <Select
          aria-label="Can be changed"
          value={lock}
          onChange={(e) => {
            if (e.target.value === "always") set({ locked: {}, once: false });
            if (e.target.value === "once") set({ once: true });
          }}
          options={[
            ["always", "Always"],
            ["once", "Never, once it is made"],
            ...(lock === "when"
              ? [["when", "Not while a condition holds"] as [string, string]]
              : []),
          ]}
        />
      </Label>
      {fields.length > 0 && (
        <ConditionPicker
          label="Not while"
          fields={fields}
          current={field.locked === true ? undefined : field.locked}
          onPick={(condition) => set({ locked: condition })}
        />
      )}
      {fields.length > 0 && !field.required && (
        <ConditionPicker
          label="Required while"
          fields={fields}
          current={field.requiredWhen}
          onPick={(condition) => set({ required: condition })}
        />
      )}
    </fieldset>
  );
}

/** A condition as one field and its value, picked and applied; Clear removes it. */
function ConditionPicker({
  label,
  fields,
  current,
  onPick,
}: {
  label: string;
  fields: FieldIR[];
  current?: Record<string, string | boolean | string[]>;
  onPick: (condition: Record<string, string>) => void;
}) {
  const [name, setName] = useState(Object.keys(current ?? {})[0] ?? fields[0]?.name ?? "");
  const chosen = fields.find((f) => f.name === name);
  const values =
    chosen?.type.kind === "choice" ? chosen.type.values : chosen ? ["true", "false"] : [];
  const [value, setValue] = useState(
    String([Object.values(current ?? {})[0]].flat()[0] ?? values[0] ?? ""),
  );
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Label text={label}>
        <Select
          aria-label={`${label}: field`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          options={fields.map((f) => [f.name, humanize(f.name)])}
        />
      </Label>
      <Select
        aria-label={`${label}: value`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        options={values.map((v) => [v, v === "true" ? "Yes" : v === "false" ? "No" : humanize(v)])}
      />
      <Button
        variant="ghost"
        className="border border-line"
        onClick={() => onPick({ [name]: value })}
      >
        Set
      </Button>
      {current && (
        <Button variant="ghost" onClick={() => onPick({})}>
          Clear
        </Button>
      )}
    </div>
  );
}

function ListToggle({
  spec,
  run,
  model,
  field,
}: {
  spec: Spec;
  run: Run;
  model: string;
  field: string;
}) {
  const list = listOf(spec, model);
  if (!list) return null;
  const shown = list.columns.includes(field);
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={shown}
        onChange={() =>
          run("setColumns", {
            page: list.page,
            columns: shown ? list.columns.filter((c) => c !== field) : [...list.columns, field],
          })
        }
      />
      Show in the list
    </label>
  );
}
