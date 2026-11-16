import {
  cronProblem,
  cronText,
  humanize,
  type ModelIR,
  type SpecIR,
  TIMER_EVERY,
  type TimerIR,
} from "@smithable/core";
import { useId, useState } from "react";
import { Button, Input, Select } from "../ui";
import { conditionOf, WhenRows, whenRowsOf } from "./action-rows";
import type { Run } from "./ChangeForms";
import { DateExpression } from "./DateExpression";
import { dateDraftReady, dateText } from "./date-expression";
import { usePendingEdit } from "./pending-edit";
import { ReferencePicker } from "./ReferencePicker";
import { referenceOptions } from "./reference-options";

/** Stored dates, including one step through a single reference, as the timer validator allows. */
export function timerDates(model: ModelIR | undefined, models: ModelIR[]): string[] {
  const dates = (m: ModelIR | undefined) =>
    (m?.fields ?? []).filter(
      (f) => !f.formula && f.type.kind === "scalar" && ["date", "datetime"].includes(f.type.name),
    );
  return (model?.fields ?? []).flatMap((f) => {
    if (dates(model).includes(f)) return [f.name];
    if (f.type.kind !== "relation" || f.type.many) return [];
    const target = models.find((m) => f.type.kind === "relation" && m.name === f.type.model);
    return dates(target).map((date) => `${f.name}.${date.name}`);
  });
}

const initial = (timer?: TimerIR) => {
  const schedule = timer?.schedule;
  return {
    name: timer?.name ?? "",
    mode: schedule?.kind ?? "",
    on: timer?.on ?? "",
    every: schedule?.kind === "every" ? schedule.every : "day",
    time: schedule?.kind === "every" ? schedule.at : "",
    cron: schedule?.kind === "cron" ? schedule.cron.split(/\s+/) : ["", "", "", "", ""],
    field: schedule?.kind === "record" ? schedule.path.join(".") : "",
    offset: Boolean(schedule?.kind === "record" && schedule.offset),
    amount: String(schedule?.kind === "record" ? (schedule.offset?.amount ?? 1) : 1),
    unit: schedule?.kind === "record" ? (schedule.offset?.unit ?? "day") : "day",
    direction: schedule?.kind === "record" ? (schedule.offset?.direction ?? "before") : "before",
    where: whenRowsOf(timer?.where),
    run: timer?.run ?? "",
  };
};

/** The whole timing choice stays a draft until its required parts can be written together. */
export function TimerForm({ ir, run, timer }: { ir: SpecIR; run: Run; timer?: TimerIR }) {
  const id = useId();
  const [draft, setDraft] = useState(() => initial(timer));
  const [busy, setBusy] = useState(false);
  const [savedDraft, setSavedDraft] = useState(() => JSON.stringify(initial(timer)));
  usePendingEdit(busy || JSON.stringify(draft) !== savedDraft);
  const change = (patch: Partial<typeof draft>) => setDraft((value) => ({ ...value, ...patch }));
  const model = ir.models.find((m) => m.name === draft.on);
  const dates = timerDates(model, ir.models);
  const actions = ir.actions.filter((action) =>
    action.custom
      ? !draft.on
      : action.on === draft.on &&
        !action.merge &&
        !action.split &&
        !Object.values(action.when ?? {}).some((w) => w === "ME()" || w === "not ME()"),
  );
  const cron = draft.cron.join(" ");
  const cronError = cronProblem(cron);
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time);
  const dateOptions = dates.map((value) => ({
    value,
    label: value.split(".").map(humanize).join(" → "),
  }));
  const validRecord = model && dateDraftReady(draft, dateOptions, "both");
  const validWhen =
    draft.mode === "every"
      ? validTime
      : draft.mode === "cron"
        ? !cronError
        : draft.mode === "record" && validRecord;
  const validName =
    /^[a-z][A-Za-z0-9]*$/.test(draft.name) &&
    (timer || !ir.timers.some((t) => t.name === draft.name));
  const valid = validName && validWhen && (!draft.run || actions.some((a) => a.name === draft.run));
  const save = async () => {
    if (!valid || busy) return;
    const when =
      draft.mode === "every"
        ? { every: draft.every, at: draft.time }
        : draft.mode === "cron"
          ? { cron }
          : {
              at: dateText(draft),
            };
    const where = conditionOf(draft.where);
    const values = {
      ...when,
      ...(draft.on ? { on: draft.on } : {}),
      ...(draft.run ? { run: draft.run } : {}),
      ...(draft.on && Object.keys(where).length ? { where } : {}),
    };
    setBusy(true);
    try {
      const ok = await run(timer ? "setTimer" : "addTimer", {
        name: draft.name,
        ...(timer ? { on: "none", run: "none", where: {} } : {}),
        ...values,
      });
      if (ok) {
        setSavedDraft(JSON.stringify(timer ? draft : initial()));
        if (!timer) setDraft(initial());
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      aria-label={timer ? `When ${timer.name} runs` : "Add timer"}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <fieldset disabled={busy} className="space-y-3">
        {!timer && (
          <label className="block space-y-1 text-sm" htmlFor={`${id}-name`}>
            Name
            <Input
              id={`${id}-name`}
              aria-label="Timer name"
              required
              pattern="[a-z][A-Za-z0-9]*"
              value={draft.name}
              onChange={(event) => change({ name: event.target.value })}
            />
          </label>
        )}
        <label className="block space-y-1 text-sm" htmlFor={`${id}-mode`}>
          When
          <Select
            id={`${id}-mode`}
            aria-label="When the timer runs"
            value={draft.mode}
            onChange={(event) => change({ mode: event.target.value })}
            options={[
              ["", "Choose when"],
              ["every", "At a time of day"],
              ["cron", "On a schedule"],
              ["record", "Relative to a record's date"],
            ]}
          />
        </label>
        {draft.mode === "every" && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1 text-sm" htmlFor={`${id}-every`}>
              Every
              <Select
                id={`${id}-every`}
                value={draft.every}
                onChange={(event) => change({ every: event.target.value as typeof draft.every })}
                options={TIMER_EVERY.map((value) => [value, humanize(value)])}
              />
            </label>
            <label className="space-y-1 text-sm" htmlFor={`${id}-time`}>
              Time of day
              <Input
                id={`${id}-time`}
                type="time"
                required
                value={draft.time}
                onChange={(event) => change({ time: event.target.value })}
              />
            </label>
            <p className="text-xs text-muted">{ir.app.timezone ?? "UTC"}</p>
          </div>
        )}
        {draft.mode === "cron" && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {["Minute", "Hour", "Day of month", "Month", "Weekday"].map((label, index) => (
                <label key={label} htmlFor={`${id}-cron-${index}`} className="space-y-1 text-sm">
                  {label}
                  <Input
                    id={`${id}-cron-${index}`}
                    aria-label={`Schedule ${label.toLowerCase()}`}
                    required
                    value={draft.cron[index]}
                    onChange={(event) =>
                      change({
                        cron: draft.cron.map((v, i) => (i === index ? event.target.value : v)),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-muted">{ir.app.timezone ?? "UTC"}</p>
            {!cronError && <p className="text-sm">{cronText(cron)}</p>}
            {cronError && draft.cron.some(Boolean) && (
              <p role="alert" className="text-sm text-red-700">
                {cronError}
              </p>
            )}
          </div>
        )}
        {draft.mode && (
          <ReferencePicker
            label={draft.mode === "record" ? "Kind of record" : "For each record of"}
            options={referenceOptions({ kind: "model" }, ir)}
            value={draft.on || undefined}
            unset={draft.mode === "record" ? undefined : "No records (once)"}
            onChange={async (value) => {
              change({ on: String(value ?? ""), field: "", where: [], run: "" });
              return true;
            }}
          />
        )}
        {draft.mode === "record" && (
          <DateExpression draft={draft} change={change} options={dateOptions} offsets="both" />
        )}
        {model && (
          <WhenRows
            computed={false}
            references={false}
            model={model}
            rows={draft.where}
            onChange={(where) => change({ where })}
          />
        )}
        {draft.mode && (
          <ReferencePicker
            label="Runs"
            options={actions.map((action) => ({
              value: action.name,
              label: humanize(action.name),
            }))}
            value={draft.run || undefined}
            unset="Just raise the event"
            onChange={async (value) => {
              change({ run: String(value ?? "") });
              return true;
            }}
          />
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={!valid || busy}>
            {timer ? "Save timer" : "Add timer"}
          </Button>
          {timer && (
            <Button type="button" variant="ghost" onClick={() => setDraft(initial(timer))}>
              Reset
            </Button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
