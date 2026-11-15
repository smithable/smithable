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
  const validRecord =
    model &&
    dates.includes(draft.field) &&
    (!draft.offset ||
      (/^\d+$/.test(draft.amount) &&
        Number(draft.amount) >= 1 &&
        Number.isSafeInteger(Number(draft.amount))));
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
              at: `${draft.offset ? `${draft.amount} ${draft.unit}${Number(draft.amount) === 1 ? "" : "s"} ${draft.direction} ` : ""}${draft.field}`,
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
      if (ok && !timer) setDraft(initial());
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
          <label className="block space-y-1 text-sm" htmlFor={`${id}-records`}>
            {draft.mode === "record" ? "Kind of record" : "For each record of"}
            <Select
              id={`${id}-records`}
              value={draft.on}
              onChange={(event) =>
                change({ on: event.target.value, field: "", where: [], run: "" })
              }
              options={[
                ["", draft.mode === "record" ? "Choose records" : "No records (once)"],
                ...ir.models.map((m) => [m.name, humanize(m.name)] as [string, string]),
              ]}
            />
          </label>
        )}
        {draft.mode === "record" && (
          <div className="space-y-2">
            <label className="block space-y-1 text-sm" htmlFor={`${id}-date`}>
              Date
              <Select
                id={`${id}-date`}
                aria-label="Record date"
                value={draft.field}
                onChange={(event) => change({ field: event.target.value })}
                options={[
                  ["", "Choose a stored date"],
                  ...dates.map(
                    (path) => [path, path.split(".").map(humanize).join(" → ")] as [string, string],
                  ),
                ]}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.offset}
                onChange={(event) => change({ offset: event.target.checked })}
              />
              Before or after this date
            </label>
            {draft.offset && (
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
                  onChange={(event) => change({ unit: event.target.value as typeof draft.unit })}
                  options={[
                    ["minute", "Minutes"],
                    ["hour", "Hours"],
                    ["day", "Days"],
                  ]}
                />
                <Select
                  aria-label="Before or after"
                  value={draft.direction}
                  onChange={(event) =>
                    change({ direction: event.target.value as typeof draft.direction })
                  }
                  options={[
                    ["before", "Before"],
                    ["after", "After"],
                  ]}
                />
              </div>
            )}
          </div>
        )}
        {model && (
          <WhenRows model={model} rows={draft.where} onChange={(where) => change({ where })} />
        )}
        {draft.mode && (
          <label className="block space-y-1 text-sm" htmlFor={`${id}-action`}>
            Runs
            <Select
              id={`${id}-action`}
              value={draft.run}
              onChange={(event) => change({ run: event.target.value })}
              options={[
                ["", "Just raise the event"],
                ...actions.map((a) => [a.name, humanize(a.name)] as [string, string]),
              ]}
            />
          </label>
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
