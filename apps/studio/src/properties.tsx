// A concept's properties (a field's kind, label and name; a page's texts and icon; a model's
// names), each control an operation. One component for both modes: Code mode's details and
// Builder's parts (docs/design/studio-v2.md §5).
import {
  ACCESS_OPERATIONS,
  type AccessOperation,
  humanize,
  identifier,
  modelAccess,
} from "@smithable/core";
import { useState } from "react";
import { FieldShapeForm, type Run } from "./builder/ChangeForms";
import type { Spec } from "./engine";
import { Button, cx, Input, Label, Select } from "./ui";

/** One visible text, saved with setText; empty restores the text Smithable derives. */
function TextSetting({
  label,
  path,
  current,
  fallback,
  run,
}: {
  label: string;
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
      <Label text={label}>
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
        className="border border-neutral-200"
        disabled={text.trim() === (current ?? "")}
      >
        Save
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
export function Properties({ concept, spec, run }: { concept: string; spec: Spec; run: Run }) {
  const ir = spec.ir;
  const [kind = "", rest = ""] = concept.split(":");
  const [name = "", fieldName] = rest.split(".");
  const [rename, setRename] = useState("");
  if (!ir) return null;
  const heading = <h3 className="text-xs font-semibold text-neutral-500">Properties</h3>;
  if (kind === "field" && fieldName) {
    const field = ir.models.find((m) => m.name === name)?.fields.find((f) => f.name === fieldName);
    if (!field) return null;
    const models = ir.models.map((m) => m.name);
    const to = identifier(rename);
    return (
      <div className="space-y-3 border-b border-neutral-200 p-3 text-sm">
        {heading}
        {field.formula || (field.type.kind === "relation" && field.type.many) ? (
          <p className="text-neutral-600">
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
        <TextSetting
          label="Label"
          path={["models", name, "fields", fieldName, "label"]}
          current={spec.content?.models[name]?.fields[fieldName]?.label}
          fallback={humanize(fieldName)}
          run={run}
        />
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (to) void run("renameField", { model: name, from: fieldName, to });
          }}
        >
          <Label
            text="Rename"
            hint={to ? `Will be named ${to}; the data is kept` : "The data is kept"}
          >
            <Input aria-label="Rename" value={rename} onChange={(e) => setRename(e.target.value)} />
          </Label>
          <Button
            type="submit"
            variant="ghost"
            className="border border-neutral-200"
            disabled={!to}
          >
            Rename
          </Button>
        </form>
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
  if (kind === "page") {
    const page = ir.pages.find((p) => p.id === name);
    if (!page) return null;
    const texts = spec.content?.pages[name];
    return (
      <div className="space-y-3 border-b border-neutral-200 p-3 text-sm">
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
      <div className="space-y-3 border-b border-neutral-200 p-3 text-sm">
        {heading}
        <TextSetting
          label="Name for one"
          path={["models", name, "label"]}
          current={texts?.label}
          fallback={humanize(name)}
          run={run}
        />
        <TextSetting
          label="Name for several"
          path={["models", name, "pluralLabel"]}
          current={texts?.pluralLabel}
          fallback={`${humanize(name)}s`}
          run={run}
        />
        <WhoCan model={name} spec={spec} run={run} />
      </div>
    );
  }
  return null;
}

const ACCESS_WORDS: Record<AccessOperation, string> = {
  read: "See",
  create: "Add",
  write: "Change",
  delete: "Delete",
};

/**
 * Who may do what with a model's records: a row per operation, the roles (and the record's
 * owner) as chips. A chip applies setAccess at once; Default returns a row to the auth file's
 * defaultAccess. Admins may always.
 */
function WhoCan({ model, spec, run }: { model: string; spec: Spec; run: Run }) {
  const found = spec.ir?.models.find((m) => m.name === model);
  const auth = spec.auth;
  if (!found || !auth || auth.signIn === "none") return null;
  const allowed = modelAccess(found, auth);
  const roles = [...auth.roles.map((r) => r.name).filter((r) => r !== "admin"), "owner"];
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-neutral-500">Who can</legend>
      {ACCESS_OPERATIONS.map((op) => {
        const listed = found.access?.[op];
        const now = [...allowed[op].roles, ...(allowed[op].owner ? ["owner"] : [])];
        // No role left means admins only (an empty list would mean the default).
        const set = (next: string[]) =>
          run("setAccess", {
            target: `model:${model}.${op}`,
            roles: next.length ? next : ["admin"],
          });
        const reset = () => run("setAccess", { target: `model:${model}.${op}`, roles: [] });
        return (
          <div key={op} className="flex flex-wrap items-center gap-1">
            <span className="w-14 text-xs text-neutral-600">{ACCESS_WORDS[op]}</span>
            {roles.map((role) => {
              const on = now.includes(role);
              return (
                <button
                  key={role}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${ACCESS_WORDS[op]}: ${role === "owner" ? "the owner" : role}`}
                  onClick={() =>
                    void set(
                      on
                        ? now.filter((r) => r !== role && r !== "admin")
                        : [...now.filter((r) => r !== "admin"), role],
                    )
                  }
                  className={cx(
                    "h-6 rounded-full border px-2 text-xs",
                    on
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-neutral-200 text-neutral-600",
                  )}
                >
                  {role === "owner" ? "the owner" : role}
                </button>
              );
            })}
            {listed && (
              <button
                type="button"
                className="text-xs text-neutral-500 hover:text-accent"
                onClick={() => void reset()}
              >
                Default
              </button>
            )}
          </div>
        );
      })}
      {allowed.read.public && (
        <p className="text-xs text-neutral-500">Visitors may see these too (smithable.auth.yml).</p>
      )}
    </fieldset>
  );
}
