import { useState } from "react";
import { Input, Select } from "../ui";
import {
  type DateControl,
  type DateDraft,
  type DateOffsets,
  dateDraft,
  dateText,
  windowDraft,
  windowText,
} from "./date-expression";
import { ReferencePicker } from "./ReferencePicker";
import type { ReferenceOption } from "./reference-options";

/** Shared parts; the caller supplies the exact fields and offset directions its validator accepts. */
export function DateExpression({
  draft,
  change,
  options,
  offsets,
  label = "Record date",
  optional = false,
}: {
  draft: DateDraft;
  change: (patch: Partial<DateDraft>) => void;
  options: readonly ReferenceOption[];
  offsets: DateOffsets;
  label?: string;
  optional?: boolean;
}) {
  return (
    <div className="space-y-2">
      <ReferencePicker
        label={label}
        options={options}
        value={draft.field || undefined}
        unset={optional ? "Not set" : undefined}
        onChange={async (value) => {
          change({ field: String(value ?? "") });
          return true;
        }}
      />
      {offsets !== "none" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.offset}
            onChange={(event) => change({ offset: event.target.checked })}
          />
          {offsets === "both" ? "Before or after this date" : "Before this date"}
        </label>
      )}
      {offsets !== "none" && draft.offset && (
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label="Offset amount"
            type="number"
            min={1}
            step={1}
            required
            className="w-20"
            value={draft.amount}
            onChange={(event) => change({ amount: event.target.value })}
          />
          <Select
            aria-label="Offset unit"
            value={draft.unit}
            onChange={(event) => change({ unit: event.target.value as DateDraft["unit"] })}
            options={[
              ["minute", "Minutes"],
              ["hour", "Hours"],
              ["day", "Days"],
            ]}
          />
          {offsets === "both" ? (
            <Select
              aria-label="Before or after"
              value={draft.direction}
              onChange={(event) =>
                change({ direction: event.target.value as DateDraft["direction"] })
              }
              options={[
                ["before", "Before"],
                ["after", "After"],
              ]}
            />
          ) : (
            <span className="self-center text-sm">Before</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Used only inside the existing atomic Writer draft: incomplete text never reaches the backend. */
export function DateSetting({
  value,
  control,
  write,
}: {
  value: unknown;
  control: DateControl;
  write: (next: unknown) => Promise<boolean>;
}) {
  const [seen, setSeen] = useState(value);
  const [draft, setDraft] = useState(() => dateDraft(value));
  const [window, setWindow] = useState(() => windowDraft(value));
  if (seen !== value) {
    setSeen(value);
    setDraft(dateDraft(value));
    setWindow(windowDraft(value));
  }
  const emit = (next: unknown) => {
    setSeen(next);
    void write(next);
  };
  if (control.kind === "window")
    return (
      <div className="space-y-2">
        <Select
          aria-label="List date window"
          value={window.mode}
          onChange={(event) => {
            const next = { ...window, mode: event.target.value };
            setWindow(next);
            emit(windowText(next));
          }}
          options={[
            ["", "Not set: 7 days"],
            ["today", "Today"],
            ["tomorrow", "Tomorrow"],
            ["span", "A number of days or weeks"],
          ]}
        />
        {window.mode === "span" && (
          <div className="flex gap-2">
            <Input
              aria-label="Window amount"
              type="number"
              min={1}
              step={1}
              required
              value={window.amount}
              onChange={(event) => {
                const next = { ...window, amount: event.target.value };
                setWindow(next);
                emit(windowText(next));
              }}
            />
            <Select
              aria-label="Window unit"
              value={window.unit}
              options={[
                ["day", "Days"],
                ["week", "Weeks"],
              ]}
              onChange={(event) => {
                const next = { ...window, unit: event.target.value };
                setWindow(next);
                emit(windowText(next));
              }}
            />
          </div>
        )}
        {!control.hasDate && value !== undefined && (
          <p role="alert" className="text-xs text-quiet">
            Choose a list date first.
          </p>
        )}
      </div>
    );
  const enabled = value !== undefined;
  return (
    <div className="space-y-2">
      {control.offsets !== "none" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => emit(event.target.checked ? dateText(draft) : undefined)}
          />
          Set a deadline
        </label>
      )}
      {(enabled || control.offsets === "none") && (
        <DateExpression
          draft={draft}
          options={control.options}
          offsets={control.offsets}
          label={control.offsets === "none" ? "List date" : "Deadline date"}
          optional={control.offsets === "none"}
          change={(patch) => {
            const next = { ...draft, ...patch };
            setDraft(next);
            emit(next.field || control.offsets !== "none" ? dateText(next) : undefined);
          }}
        />
      )}
    </div>
  );
}
