// Builder's Look tab (docs/design/studio-v2.md §3): smithable.ux.yml as controls. Each shows the
// value in the file and applies its operation at once, undoable like any change; nothing to
// submit and no form state to lose.
import { FONTS, humanize, pageModel } from "@smithable/core";
import { useState } from "react";
import type { Project } from "../api";
import type { Spec } from "../engine";
import { ICON_CHOICES } from "../properties";
import { cx, Select } from "../ui";
import type { Run } from "./ChangeForms";

const TONE_CHOICES: [string, string][] = [
  ["neutral", "Grey (neutral)"],
  ["success", "Green (good)"],
  ["warning", "Amber (needs attention)"],
  ["danger", "Red (a problem)"],
];

export function Look({
  spec,
  run,
  themes,
}: {
  spec: Spec;
  run: Run;
  /** Every theme the ux file may name, with its picture (the project's from themes/). */
  themes: Project["themes"];
}) {
  const { ir, ux } = spec;
  if (!ir || !ux)
    return (
      <p className="p-3 text-sm text-neutral-500">The spec has errors; fix them in Code mode.</p>
    );
  const theme = ux.theme;
  const choices = ir.models.flatMap((m) =>
    m.fields.flatMap((f) =>
      f.type.kind === "choice" ? [{ model: m.name, field: f.name, values: f.type.values }] : [],
    ),
  );
  return (
    <div className="space-y-6 p-3">
      <Group title="Theme">
        {/* A card per theme, built in or the project's, with its picture (docs/design/look.md §3). */}
        <ul aria-label="Themes" className="grid grid-cols-2 gap-2">
          {themes.map((t) => {
            const current = t.name === theme.preset;
            return (
              <li key={t.name}>
                <button
                  type="button"
                  aria-pressed={current}
                  onClick={() => !current && run("setTheme", { preset: t.name })}
                  className={cx(
                    "w-full overflow-hidden rounded-md border text-left",
                    current
                      ? "border-accent ring-2 ring-accent/30"
                      : "border-neutral-200 hover:border-neutral-400",
                  )}
                >
                  <img
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(t.thumbnail)}`}
                    alt=""
                    width={320}
                    height={100}
                    className="block h-auto w-full"
                  />
                  <span className="block px-2 py-1.5 text-xs">
                    <span className="font-medium">{humanize(t.name)}</span>
                    <span className="block text-neutral-500">
                      {t.source === "project" ? `themes/${t.name}.yml · ` : ""}
                      {t.font}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Group>
      <Group title="Colour">
        <BrandColour primary={theme.primary} run={run} />
      </Group>
      <Group title="Font and density">
        <Segmented
          label="Font"
          value={theme.font ?? "none"}
          options={[["none", "The theme's"], ...FONTS.map((f) => [f, f] as [string, string])]}
          onChange={(font) => run("setTheme", { font })}
        />
        <Segmented
          label="Density"
          value={theme.density}
          options={[
            ["comfortable", "Comfortable"],
            ["compact", "Compact"],
          ]}
          onChange={(density) => run("setTheme", { density })}
        />
      </Group>
      <Group title="Pages">
        {ir.pages.map((page) => {
          const model = ir.models.find((m) => m.name === pageModel(page));
          return (
            <div key={page.id} className="space-y-2 border-b border-neutral-100 pb-3 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{humanize(page.id)}</span>
                <Select
                  aria-label={`Icon of ${humanize(page.id)}`}
                  value={ux.pages[page.id]?.icon ?? "auto"}
                  onChange={(e) => run("setIcon", { page: page.id, icon: e.target.value })}
                  options={ICON_CHOICES.map((i) => [
                    i,
                    i === "auto" ? "Automatic icon" : humanize(i),
                  ])}
                  className="w-44"
                />
              </div>
              {model && (
                <Columns
                  page={page.id}
                  fields={model.fields
                    .filter((f) => !(f.type.kind === "relation" && f.type.many))
                    .map((f) => f.name)}
                  columns={ux.pages[page.id]?.columns}
                  below={ux.pages[page.id]?.below ?? {}}
                  run={run}
                />
              )}
            </div>
          );
        })}
      </Group>
      {choices.length > 0 && (
        <Group title="Colours of choices">
          {choices.map((c) => (
            <fieldset key={`${c.model}.${c.field}`} className="space-y-1">
              <legend className="text-sm font-medium">
                {humanize(c.field)} of {c.model}
              </legend>
              {c.values.map((value) => (
                <div key={value} className="flex items-center justify-between gap-3 text-sm">
                  <span>{humanize(value)}</span>
                  <Select
                    aria-label={`Colour of ${humanize(value)}`}
                    value={ux.tones[`${c.model}.${c.field}`]?.[value] ?? "neutral"}
                    onChange={(e) =>
                      run("setTone", {
                        model: c.model,
                        field: c.field,
                        value,
                        tone: e.target.value,
                      })
                    }
                    options={TONE_CHOICES}
                    className="w-52"
                  />
                </div>
              ))}
            </fieldset>
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
      {children}
    </section>
  );
}

/** Choices side by side, the current one marked; a click applies another. */
function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="flex flex-wrap gap-1">
      <legend className="sr-only">{label}</legend>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => v !== value && onChange(v)}
          className={cx(
            "h-8 rounded-md border px-3 text-xs font-medium",
            v === value
              ? "border-accent bg-accent-soft text-accent"
              : "border-neutral-200 text-neutral-700 hover:bg-neutral-50",
          )}
        >
          {text}
        </button>
      ))}
    </fieldset>
  );
}

/** The brand colour: picked, applied when the picker closes; or back to the theme's own. */
function BrandColour({ primary, run }: { primary?: string; run: Run }) {
  const [picked, setPicked] = useState<string>();
  const shown = picked ?? primary ?? "#2563eb";
  const apply = () => {
    if (picked && picked !== primary) void run("setTheme", { primary: picked });
    setPicked(undefined);
  };
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <input
        type="color"
        aria-label="Brand colour"
        value={shown}
        onChange={(e) => setPicked(e.target.value)}
        onBlur={apply}
        className="h-9 w-14 cursor-pointer rounded border border-neutral-200 p-1"
      />
      <span className="font-mono text-xs">{primary ?? "the theme's own"}</span>
      {picked && picked !== primary && (
        <button type="button" className="text-xs font-medium text-accent" onClick={apply}>
          Use this colour
        </button>
      )}
      {primary && (
        <button
          type="button"
          className="text-xs text-neutral-600 hover:text-accent"
          onClick={() => run("setTheme", { primary: "none" })}
        >
          Use the theme's own
        </button>
      )}
    </div>
  );
}

/**
 * A list page's columns: shown ones in order, each with an optional second line under its
 * value (another field, e.g. the phone under the email), and the rest greyed below to add back.
 */
function Columns({
  page,
  fields,
  columns,
  below,
  run,
}: {
  page: string;
  fields: string[];
  columns?: string[];
  below: Record<string, string>;
  run: Run;
}) {
  if (!columns)
    return (
      <p className="text-xs text-neutral-500">
        Columns chosen automatically.{" "}
        <button
          type="button"
          className="font-medium text-accent"
          onClick={() => run("setColumns", { page, columns: fields.slice(0, 5) })}
        >
          Choose them
        </button>
      </p>
    );
  const hidden = fields.filter((f) => !columns.includes(f));
  const set = (next: string[]) => run("setColumns", { page, columns: next });
  const move = (i: number, by: number) => {
    const next = [...columns];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item as string);
    void set(next);
  };
  return (
    <ul aria-label={`Columns of ${humanize(page)}`} className="space-y-1 text-sm">
      {columns.map((c, i) => (
        <li key={c} className="flex items-center gap-2">
          <span className="flex-1">{humanize(c)}</span>
          <Select
            aria-label={`Second line under ${humanize(c)}`}
            value={below[c] ?? "none"}
            onChange={(e) => run("setBelow", { page, column: c, field: e.target.value })}
            options={[
              ["none", "No second line"],
              ...fields.filter((f) => f !== c).map((f): [string, string] => [f, humanize(f)]),
            ]}
            className="h-7 w-36 text-xs"
          />
          <button
            type="button"
            aria-label={`Move ${humanize(c)} up`}
            disabled={i === 0}
            onClick={() => move(i, -1)}
            className="px-1 disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={`Move ${humanize(c)} down`}
            disabled={i === columns.length - 1}
            onClick={() => move(i, 1)}
            className="px-1 disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            aria-label={`Hide ${humanize(c)}`}
            disabled={columns.length === 1}
            onClick={() => set(columns.filter((x) => x !== c))}
            className="px-1 text-xs text-neutral-500 disabled:opacity-30"
          >
            Hide
          </button>
        </li>
      ))}
      {hidden.map((c) => (
        <li key={c} className="flex items-center gap-2 text-neutral-400">
          <span className="flex-1">{humanize(c)}</span>
          <button
            type="button"
            aria-label={`Show ${humanize(c)}`}
            onClick={() => set([...columns, c])}
            className="px-1 text-xs text-accent"
          >
            Show
          </button>
        </li>
      ))}
    </ul>
  );
}
