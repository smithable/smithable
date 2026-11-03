import {
  type ModelIR,
  type PageIR,
  type PageUx,
  recordPicture,
  type SpecIR,
  UX_CAPABILITIES,
} from "@smithable/core";
import { useState } from "react";
import { Select } from "../ui";
import type { Run } from "./ChangeForms";
import { UxChoice } from "./UxChoice";

export function UxLists({
  ir,
  page,
  model,
  ux,
  run,
}: {
  ir: SpecIR;
  page: PageIR;
  model?: ModelIR;
  ux: PageUx;
  run: Run;
}) {
  const context = {
    kind: page.pattern.kind,
    hasPicture: !!model && !!recordPicture(model),
    hasFilters: !!page.filters?.length,
  };
  const colorBy = ux.calendar?.colorBy;
  const color =
    colorBy?.kind === "record"
      ? colorBy.reference
      : colorBy
        ? `${colorBy.reference ? `${colorBy.reference}.` : ""}${colorBy.field}`
        : "none";
  const colorFields =
    model?.fields.flatMap((field): [string, string][] => {
      if (field.type.kind === "choice") return [[field.name, field.name]];
      if (field.type.kind !== "relation" || field.type.many) return [];
      const reference = field.name;
      const target = ir.models.find((m) => m.name === (field.type as { model: string }).model);
      return [
        [reference, `${reference} (record colors)`],
        ...(target?.fields
          .filter((f) => f.type.kind === "choice")
          .map((f): [string, string] => [`${reference}.${f.name}`, `${reference}.${f.name}`]) ??
          []),
      ];
    }) ?? [];
  const calendar = page.pattern.kind === "calendar" ? page.pattern : undefined;
  const startField = calendar && model?.fields.find((f) => f.name === calendar.starts);
  const time = startField?.type.kind === "scalar" && startField.type.name === "datetime";
  const filtered = ux.calendar?.filters?.includes("timeOfDay") ?? false;
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">Lists and calendar</legend>
      {page.pattern.kind === "crud" && (
        <>
          <UxChoice id="mark" data={ux} page={page.id} context={context} run={run} />
          <UxChoice id="rowActions" data={ux} page={page.id} context={context} run={run} />
        </>
      )}
      {!!page.filters?.length && (
        <UxChoice id="filtersLook" data={ux} page={page.id} context={context} run={run} />
      )}
      {calendar && (
        <>
          <UxChoice id="calendarView" data={ux} page={page.id} context={context} run={run} />
          <label
            htmlFor="look-calendar-color"
            className="flex items-center justify-between gap-3 text-sm"
          >
            Calendar colors
            <Select
              id="look-calendar-color"
              aria-label="Calendar colors"
              value={color}
              options={[["none", "One color"], ...colorFields]}
              onChange={(e) =>
                void run("setCalendarColor", { page: page.id, field: e.target.value })
              }
              className="w-44"
            />
          </label>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={filtered}
              disabled={!time && !filtered}
              onChange={(e) =>
                void run("setCalendarFilters", {
                  page: page.id,
                  filters: e.target.checked ? ["timeOfDay"] : [],
                })
              }
            />
            Time-of-day filters
          </label>
          {!time && (
            <p className="text-xs text-quiet">Time-of-day filters need a date-time start field.</p>
          )}
          {model && (
            <Capacity
              key={`${page.id}:${JSON.stringify(ux.calendar?.capacity)}`}
              page={page.id}
              model={model}
              ux={ux}
              run={run}
            />
          )}
        </>
      )}
    </fieldset>
  );
}
function Capacity({
  page,
  model,
  ux,
  run,
}: {
  page: string;
  model: ModelIR;
  ux: PageUx;
  run: Run;
}) {
  const fields = model.fields.filter(
    (f) => f.type.kind === "scalar" && ["int", "decimal"].includes(f.type.name),
  );
  const [left, setLeft] = useState(ux.calendar?.capacity?.left ?? "");
  const [of, setOf] = useState(ux.calendar?.capacity?.of ?? "");
  const [look, setLook] = useState<string>(ux.calendar?.capacity?.look ?? "number");
  if (fields.length < 2 && !ux.calendar?.capacity)
    return (
      <p className="text-xs text-quiet">
        Capacity needs number fields for places left and total places.
      </p>
    );
  const options: [string, string][] = [
    ["", "Choose a field"],
    ...fields.map((f): [string, string] => [f.name, f.name]),
  ];
  return (
    <fieldset className="space-y-2 rounded border border-line p-2">
      <legend className="text-sm">Capacity</legend>
      <label htmlFor="capacity-left" className="flex justify-between gap-2 text-sm">
        Places left
        <Select
          id="capacity-left"
          aria-label="Places left"
          value={left}
          options={options}
          onChange={(e) => setLeft(e.target.value)}
        />
      </label>
      <label htmlFor="capacity-total" className="flex justify-between gap-2 text-sm">
        Total places
        <Select
          id="capacity-total"
          aria-label="Total places"
          value={of}
          options={options}
          onChange={(e) => setOf(e.target.value)}
        />
      </label>
      <label htmlFor="capacity-look" className="flex justify-between gap-2 text-sm">
        Presentation
        <Select
          id="capacity-look"
          aria-label="Capacity presentation"
          value={look}
          options={[...UX_CAPABILITIES.capacityLook.values]}
          onChange={(e) => setLook(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={!left || !of}
        onClick={() => void run("setCalendarCapacity", { page, left, of, look })}
      >
        Use capacity fields
      </button>
      {ux.calendar?.capacity && (
        <button
          type="button"
          onClick={() => void run("setCalendarCapacity", { page, left: "none" })}
        >
          Reset capacity
        </button>
      )}
    </fieldset>
  );
}
