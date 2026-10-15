// What was selected in the preview, and the changes that apply to it.
import { humanize, type SpecIR } from "@smithable/core";
import { wordsFor } from "@smithable/index";
import { useState } from "react";
import type { Spec } from "../engine";
import type { Selection } from "../preview";
import { Button, Check, Input, Panel } from "../ui";
import { listOf, type Run, shorthandOf } from "./ChangeForms";

/** The field a selection is, when this panel can show it (not a model, nor a field since removed). */
export function selectedField(selection: Selection, spec: Spec) {
  const [modelName, fieldName] = selection.concept.replace(/^field:/, "").split(".");
  const model = spec.ir?.models.find((m) => m.name === modelName);
  const field = model?.fields.find((f) => f.name === fieldName);
  return model && field ? { model, field } : undefined;
}

export function Selected({
  selection,
  spec,
  run,
  onClose,
}: {
  selection: Selection;
  spec: Spec;
  run: Run;
  onClose: () => void;
}) {
  const [to, setTo] = useState("");
  const picked = selectedField(selection, spec);
  if (!picked) return null;
  const { model, field } = picked;
  const canBeRequired = !field.formula && field.type.kind !== "choice";
  const list = listOf(spec, model.name);
  return (
    <Panel
      title="Selected"
      actions={
        <Button variant="ghost" className="h-7" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-3 p-3 text-sm">
        <div>
          <p className="font-medium">
            {humanize(field.name)} <span className="text-quiet">of {humanize(model.name)}</span>
          </p>
          {/* As "Your app" lists it. */}
          <p className="text-xs text-quiet">
            {wordsFor(spec.ir as SpecIR, spec.content).item(model, field)}
          </p>
        </div>
        {canBeRequired && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={field.required}
              onChange={() =>
                run("changeField", {
                  model: model.name,
                  field: field.name,
                  type: shorthandOf({ ...field, required: !field.required }),
                })
              }
            />
            Required
          </label>
        )}
        {list && (
          <Check
            text="Show it in listings"
            tip="Adds this field as a column on the list page of these records."
            checked={list.columns.includes(field.name)}
            onChange={() =>
              run("setColumns", {
                page: list.page,
                columns: list.columns.includes(field.name)
                  ? list.columns.filter((c) => c !== field.name)
                  : [...list.columns, field.name],
              })
            }
          />
        )}
        {selection.part === "column" && selection.page && selection.columns && (
          <Button
            variant="ghost"
            className="w-full border border-line"
            onClick={() =>
              run("setColumns", {
                page: selection.page,
                columns: selection.columns?.filter((c) => c !== field.name),
              }).then((ok) => ok && onClose())
            }
          >
            Hide from the table
          </Button>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run("renameField", { model: model.name, from: field.name, to }).then(
              (ok) => ok && onClose(),
            );
          }}
        >
          <Input
            aria-label="New name"
            placeholder="Name in the spec (used in code)"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <Button type="submit" variant="ghost" className="border border-line" disabled={!to}>
            Rename
          </Button>
        </form>
        <Button
          variant="ghost"
          className="w-full border border-line text-red-700"
          onClick={() =>
            run("removeField", { model: model.name, field: field.name }).then(
              (ok) => ok && onClose(),
            )
          }
        >
          Remove field
        </Button>
        <p className="text-xs text-quiet">Drag a column's header in the preview to move it.</p>
      </div>
    </Panel>
  );
}
