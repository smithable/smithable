// A concept's properties (a field's kind, label and name; a page's texts and icon; a model's
// names), each control an operation. One component for both modes: Code mode's details and
// Builder's parts (docs/design/studio-v2.md §5).
import { humanize, identifier } from "@smithable/core";
import { useState } from "react";
import { FieldShapeForm, type Run } from "./builder/ChangeForms";
import type { Spec } from "./engine";
import { Button, Input, Label, Select } from "./ui";

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

const PAGE_ICONS = [
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
            run={(type) => run("changeField", { model: name, field: fieldName, type })}
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
              ...PAGE_ICONS.map((i): [string, string] => [
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
      </div>
    );
  }
  return null;
}
