// Builder's Look tab (docs/design/studio-v2.md §3): smithable.ux.yml as controls. Each shows the
// value in the file and applies its operation at once, undoable like any change; nothing to
// submit and no form state to lose.
import {
  CONTROLS,
  controlUnfit,
  type FieldIR,
  FONTS,
  humanize,
  LANGUAGES,
  type PageUx,
  pageModel,
  SECTION_LOOKS,
} from "@smithable/core";
import { useState } from "react";
import type { Project } from "../api";
import type { Spec } from "../engine";
import { ICON_CHOICES } from "../properties";
import { cx, Select } from "../ui";
import type { Run } from "./ChangeForms";

/** Each language the kit has words in, by its own name. */
export const LANGUAGE_NAMES: Record<(typeof LANGUAGES)[number], string> = {
  en: "English",
  sv: "Svenska",
};

const TONE_CHOICES: [string, string][] = [
  ["neutral", "Gray (neutral)"],
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
    return <p className="p-3 text-sm text-quiet">The spec has errors; fix them in Code mode.</p>;
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
                      ? "border-accent ring-4 ring-accent/40"
                      : "border-line hover:border-line-strong",
                  )}
                >
                  <img
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(t.thumbnail)}`}
                    alt=""
                    width={320}
                    height={100}
                    className="block h-auto w-full"
                  />
                  <span className={cx("block px-2 py-1.5 text-xs", current && "bg-accent-soft")}>
                    <span className="font-medium">{humanize(t.name)}</span>
                    {/* The one in use says so in words, not only by its outline. */}
                    {current && <span className="ml-1.5 font-medium text-accent">· In use</span>}
                    <span className="block text-quiet">
                      {t.source === "project" ? `themes/${t.name}.yml · ` : ""}
                      {t.font}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <AddTheme run={run} />
      </Group>
      <Group title="Color">
        <ThemeColor
          which="primary"
          label="Brand color"
          value={theme.primary}
          fallback="#2563eb"
          run={run}
        />
        <ThemeColor
          which="background"
          label="Background"
          value={theme.background}
          fallback="#f8fafc"
          run={run}
        />
      </Group>
      <Group title="Font, density and motion">
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
        <Segmented
          label="Motion"
          value={theme.motion}
          options={[
            ["none", "None"],
            ["subtle", "Subtle"],
            ["lively", "Lively"],
          ]}
          onChange={(motion) => run("setTheme", { motion })}
        />
      </Group>
      <Group title="Logo">
        <Logo spec={spec} run={run} />
      </Group>
      <Group title="Language">
        <Select
          aria-label="The app's language"
          value={spec.content?.language ?? LANGUAGES[0]}
          onChange={(e) => void run("setLanguage", { language: e.target.value })}
          options={LANGUAGES.map((l) => [l, LANGUAGE_NAMES[l]])}
        />
        <p className="text-xs text-quiet">
          What the app says by itself (buttons, messages, mails) follows it; your own texts stay as
          you wrote them. In another language than English, give each kind of record its name for
          several, or the app makes it by an English rule.
        </p>
      </Group>
      <Group title="Pages">
        {ir.pages.map((page) => {
          const model = ir.models.find((m) => m.name === pageModel(page));
          return (
            <div key={page.id} className="space-y-2 border-b border-line pb-3 last:border-0">
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
              {model && (
                <ListAndForm
                  page={page.id}
                  fields={model.fields.filter((f) => !(f.type.kind === "relation" && f.type.many))}
                  lists={model.fields
                    .filter((f) => f.type.kind === "relation" && f.type.many)
                    .map((f) => f.name)}
                  ux={ux.pages[page.id] ?? {}}
                  run={run}
                />
              )}
              {page.pattern.kind !== "landing" && page.pattern.kind !== "onboarding" && (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span>Frame</span>
                  <Select
                    aria-label={`Frame of ${humanize(page.id)}`}
                    value={ux.pages[page.id]?.frame ?? "default"}
                    onChange={(e) => run("setFrame", { page: page.id, frame: e.target.value })}
                    options={FRAME_CHOICES}
                    className="w-44"
                  />
                </div>
              )}
              {page.pattern.kind !== "landing" && page.sections.length > 1 && (
                <SectionOrder page={page.id} sections={page.sections} run={run} />
              )}
              {page.pattern.kind === "landing" && (
                <LandingLook
                  page={page.id}
                  sections={page.pattern.sections}
                  ux={ux.pages[page.id] ?? {}}
                  themes={themes.map((t) => t.name)}
                  run={run}
                />
              )}
            </div>
          );
        })}
      </Group>
      {choices.length > 0 && (
        <Group title="Colors of choices">
          {choices.map((c) => (
            <fieldset key={`${c.model}.${c.field}`} className="space-y-1">
              <legend className="text-sm font-medium">
                {humanize(c.field)} of {c.model}
              </legend>
              {c.values.map((value) => (
                <div key={value} className="flex items-center justify-between gap-3 text-sm">
                  <span>{humanize(value)}</span>
                  <Select
                    aria-label={`Color of ${humanize(value)}`}
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

/** The app's mark (docs/design/app-logo.md §5): as it is, Replace with a file, Remove. */
function Logo({ spec, run }: { spec: Spec; run: Run }) {
  const logo = spec.content?.logo;
  // A file replaced under the same name is fetched again.
  const [version, setVersion] = useState(0);
  // What is wrong with the file chosen, said before anything is sent.
  const [refused, setRefused] = useState<string>();
  const replace = async (file: File | undefined) => {
    setRefused(undefined);
    if (!file) return;
    const ext = file.name.toLowerCase().match(/\.(webp|avif|jpe?g|png|svg)$/)?.[1];
    if (!ext) return setRefused("A logo is a webp, png, jpg, avif or svg file.");
    if (file.size > 2 * 1024 * 1024)
      return setRefused(`This file is ${(file.size / 1024 / 1024).toFixed(1)} MB; at most 2 MB.`);
    // Its proportions and size, from the picture itself (an SVG without its own size has none).
    const { width, height } = await measure(file);
    if (width && height) {
      if (Math.max(width, height) / Math.min(width, height) > 1.25)
        return setRefused(
          `This picture is ${width} × ${height} px: a logo is square or nearly so (a wide wordmark is not; the app's name stands beside the mark).`,
        );
      if (ext !== "svg" && Math.min(width, height) < 64)
        return setRefused(
          `This picture is ${width} × ${height} px: at least 64 px, about 512 px is best.`,
        );
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const data = String(reader.result).split(",")[1] ?? "";
      const src = `images/logo.${ext}`;
      if (await run("setLogo", { src }, false, { path: `public/${src}`, data }))
        setVersion((v) => v + 1);
    };
    reader.readAsDataURL(file);
  };
  return (
    <div data-look="logo" className="space-y-2">
      <div className="flex items-center gap-3">
        {logo ? (
          <img
            src={`/api/${logo.src}?v=${version}`}
            alt={logo.alt}
            className="size-12 shrink-0 rounded border border-line object-contain"
          />
        ) : (
          <span className="text-sm text-quiet">No logo: the app shows its name alone.</span>
        )}
        <label className="ml-auto cursor-pointer rounded-md border border-line px-3 py-1.5 text-sm hover:border-line-strong focus-within:ring-2 focus-within:ring-accent">
          {logo ? "Replace" : "Add a logo"}
          <input
            type="file"
            accept=".webp,.avif,.png,.jpg,.jpeg,.svg"
            className="sr-only"
            onChange={(e) => {
              void replace(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {logo && (
          <button
            type="button"
            onClick={() => run("setLogo", {})}
            className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-line-strong"
          >
            Remove
          </button>
        )}
      </div>
      {refused && (
        <p role="alert" className="text-xs text-red-700">
          {refused}
        </p>
      )}
      <p className="text-xs text-quiet">
        Your app's mark, before its name and in the browser's tab. Square, about 512 px: webp, png,
        jpg, avif or svg, at most 2 MB.
      </p>
    </div>
  );
}

/** A picture's own width and height in pixels; zero when the browser cannot tell. */
function measure(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const done = (width: number, height: number) => {
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    image.onload = () => done(image.naturalWidth, image.naturalHeight);
    image.onerror = () => done(0, 0);
    image.src = url;
  });
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-quiet">{title}</h3>
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
              : "border-line text-fg-soft hover:bg-surface",
          )}
        >
          {text}
        </button>
      ))}
    </fieldset>
  );
}

/**
 * A theme color of the owner's (the brand color, or the background): picked, applied when the
 * picker closes; or back to the theme's own.
 */
function ThemeColor({
  which,
  label,
  value,
  fallback,
  run,
}: {
  which: "primary" | "background";
  label: string;
  value?: string;
  fallback: string;
  run: Run;
}) {
  const [picked, setPicked] = useState<string>();
  const shown = picked ?? value ?? fallback;
  const apply = () => {
    if (picked && picked !== value) void run("setTheme", { [which]: picked });
    setPicked(undefined);
  };
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <input
        type="color"
        aria-label={label}
        value={shown}
        onChange={(e) => setPicked(e.target.value)}
        onBlur={apply}
        className="h-9 w-14 cursor-pointer rounded border border-line p-1"
      />
      <span className="text-xs text-muted">{label}</span>
      <span className="font-mono text-xs">{value ?? "the theme's own"}</span>
      {picked && picked !== value && (
        <button type="button" className="text-xs font-medium text-accent" onClick={apply}>
          Use this color
        </button>
      )}
      {value && (
        <button
          type="button"
          className="text-xs text-muted hover:text-accent"
          onClick={() => run("setTheme", { [which]: "none" })}
        >
          Use the theme's own
        </button>
      )}
    </div>
  );
}

/**
 * A list page's columns: shown ones in order, each with an optional second line under its
 * value (another field, e.g. the phone under the email), and the rest grayed below to add back.
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
      <p className="text-xs text-quiet">
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
            className="px-1 text-xs text-quiet disabled:opacity-30"
          >
            Hide
          </button>
        </li>
      ))}
      {hidden.map((c) => (
        <li key={c} className="flex items-center gap-2 text-faint">
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

/** A list page's view and order, and its form's columns, controls and sections (look.md §1.1–1.3). */
function ListAndForm({
  page,
  fields,
  lists,
  ux,
  run,
}: {
  page: string;
  fields: FieldIR[];
  /** The record's lists of related records: each a table or a conversation on its page. */
  lists: string[];
  ux: PageUx;
  run: Run;
}) {
  const title = humanize(page);
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label={`View of ${title}`}
          value={ux.view ?? "table"}
          options={[
            ["table", "Table"],
            ["cards", "Cards"],
          ]}
          onChange={(view) => run("setView", { page, view })}
        />
        <Select
          aria-label={`Order of ${title}`}
          value={ux.sort ?? "none"}
          onChange={(e) => run("setSort", { page, field: e.target.value })}
          options={[
            ["none", "Newest first"],
            ...fields.flatMap((f): [string, string][] => [
              [f.name, `By ${humanize(f.name)}`],
              [`-${f.name}`, `By ${humanize(f.name)}, largest or latest first`],
            ]),
          ]}
          className="h-8 w-52 text-xs"
        />
      </div>
      {lists.map((field) => (
        <div key={field} className="flex items-center gap-2">
          <span className="text-xs text-muted">{humanize(field)} on a record</span>
          <Segmented
            label={`${humanize(field)} on a record of ${title}`}
            value={ux.lists?.[field] ?? "table"}
            options={[
              ["table", "Table"],
              ["thread", "Conversation"],
            ]}
            onChange={(look) => run("setRecordList", { page, field, look })}
          />
        </div>
      ))}
      <details>
        <summary className="cursor-pointer text-xs font-medium text-muted">Form of {title}</summary>
        <FormLook page={page} fields={fields} ux={ux} run={run} />
      </details>
    </div>
  );
}

function FormLook({
  page,
  fields,
  ux,
  run,
}: {
  page: string;
  fields: FieldIR[];
  ux: PageUx;
  run: Run;
}) {
  const [added, setAdded] = useState<string[]>([]);
  const [name, setName] = useState("");
  const groups = ux.sections ?? [];
  const names = [
    ...groups.map((g) => g.name),
    ...added.filter((a) => !groups.some((g) => g.name === a)),
  ];
  // A field moves to another section (or none); sections left empty go.
  const move = (field: string, to: string) => {
    const next = names
      .map((n) => ({
        name: n,
        fields: [
          ...(groups.find((g) => g.name === n)?.fields ?? []),
          ...(n === to ? [field] : []),
        ].filter((f) => f !== field || n === to),
      }))
      .filter((g) => g.fields.length);
    void run("setFormSections", {
      page,
      sections: next.map((g) => `${g.name}:${g.fields.join(",")}`),
    });
  };
  return (
    <div className="mt-2 space-y-2">
      <Segmented
        label={`Columns of the ${humanize(page)} form`}
        value={String(ux.formColumns ?? 1)}
        options={[
          ["1", "One column"],
          ["2", "Two columns"],
        ]}
        onChange={(columns) => run("setFormColumns", { page, columns: Number(columns) })}
      />
      <ul aria-label={`Fields of the ${humanize(page)} form`} className="space-y-1">
        {fields.map((f) => {
          const fits = CONTROLS.filter((c) => !controlUnfit(f, c));
          const section = groups.find((g) => g.fields.includes(f.name))?.name ?? "";
          return (
            <li key={f.name} className="flex items-center gap-2">
              <span className="flex-1">{humanize(f.name)}</span>
              {fits.length > 1 && (
                <Select
                  aria-label={`How ${humanize(f.name)} is entered`}
                  value={ux.control?.[f.name] ?? "input"}
                  onChange={(e) =>
                    run("setControl", { page, field: f.name, control: e.target.value })
                  }
                  options={fits.map((c): [string, string] => [
                    c,
                    c === "input" ? "Usual control" : humanize(c),
                  ])}
                  className="h-7 w-32 text-xs"
                />
              )}
              {names.length > 0 && (
                <Select
                  aria-label={`Section of ${humanize(f.name)}`}
                  value={section}
                  onChange={(e) => move(f.name, e.target.value)}
                  options={[
                    ["", "No section"],
                    ...names.map((n): [string, string] => [n, humanize(n)]),
                  ]}
                  className="h-7 w-32 text-xs"
                />
              )}
            </li>
          );
        })}
      </ul>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (/^[a-z][A-Za-z0-9-]*$/.test(name) && !names.includes(name))
            setAdded([...added, name]);
          setName("");
        }}
      >
        <input
          aria-label={`New section of the ${humanize(page)} form`}
          placeholder="newSection"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-7 flex-1 rounded border border-line px-2 text-xs"
        />
        <button type="submit" className="text-xs font-medium text-accent">
          Add a section
        </button>
        {groups.length > 0 && (
          <button
            type="button"
            className="text-xs text-muted hover:text-accent"
            onClick={() => run("setFormSections", { page })}
          >
            One form
          </button>
        )}
      </form>
    </div>
  );
}

/** A page's sections in the order written: each moves past its neighbour (page-sections.md §2). */
function SectionOrder({
  page,
  sections,
  run,
}: {
  page: string;
  sections: { name: string }[];
  run: Run;
}) {
  const title = humanize(page);
  return (
    <ul aria-label={`Sections of ${title}`} className="space-y-1 text-sm">
      {sections.map((section, i) => {
        const name = humanize(section.name);
        const move = (other: string | undefined, where: "before" | "after") => {
          if (other) void run("moveSection", { page, section: section.name, [where]: other });
        };
        return (
          <li key={section.name} className="flex items-center gap-2">
            <span className="flex-1">{name}</span>
            <button
              type="button"
              aria-label={`Move ${name} up`}
              disabled={i === 0}
              onClick={() => move(sections[i - 1]?.name, "before")}
              className="px-1 disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Move ${name} down`}
              disabled={i === sections.length - 1}
              onClick={() => move(sections[i + 1]?.name, "after")}
              className="px-1 disabled:opacity-30"
            >
              ↓
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** A page's frame (page-sections.md §4): as its kind has it, or the one chosen. */
const FRAME_CHOICES: [string, string][] = [
  ["default", "As its kind"],
  ["site", "The site's, with a top menu"],
  ["app", "The workspace's, with the side menu"],
  ["none", "None: no menu"],
];

/** A landing page's own theme and each section's look (look.md §1.4–1.5). */
function LandingLook({
  page,
  sections,
  ux,
  themes,
  run,
}: {
  page: string;
  sections: { name: string; kind: string }[];
  ux: PageUx;
  themes: string[];
  run: Run;
}) {
  const title = humanize(page);
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span>Theme</span>
        <Select
          aria-label={`Theme of ${title}`}
          value={ux.theme?.preset ?? "none"}
          onChange={(e) => run("setTheme", { page, preset: e.target.value })}
          options={[
            ["none", "The app's"],
            ...themes.map((t): [string, string] => [t, humanize(t)]),
          ]}
          className="w-44"
        />
      </div>
      <SectionOrder page={page} sections={sections} run={run} />
      {sections.map((section) =>
        Object.entries(SECTION_LOOKS[section.kind] ?? {}).map(([key, values]) => {
          const label = `${humanize(key)} of ${humanize(section.name)}`;
          const current = ux.looks?.[section.name]?.[key as "layout"];
          const set = (value: string) =>
            run("setSectionLook", { page, section: section.name, key, value });
          return values === "text" ? (
            <label key={`${section.name}.${key}`} className="flex items-center gap-2">
              <span className="flex-1">{label}</span>
              <input
                aria-label={label}
                defaultValue={current ?? ""}
                placeholder="A plan's name"
                onBlur={(e) => {
                  const value = e.target.value.trim() || "default";
                  if (value !== (current ?? "default")) void set(value);
                }}
                className="h-8 w-44 rounded border border-line px-2 text-xs"
              />
            </label>
          ) : (
            <div key={`${section.name}.${key}`} className="flex items-center justify-between gap-2">
              <span>{label}</span>
              <Segmented
                label={label}
                value={String(current ?? values[0])}
                options={values.map((v): [string, string] => [String(v), humanize(String(v))])}
                onChange={(v) => set(v === String(values[0]) ? "default" : v)}
              />
            </div>
          );
        }),
      )}
    </div>
  );
}

/**
 * "Add a theme" (look.md §3): a theme file dropped, chosen or pasted, added with addTheme and
 * used at once; a refusal (the file's problems, a taken name) comes back as the change's message.
 */
function AddTheme({ run }: { run: Run }) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const read = async (file: File | undefined) => {
    if (!file) return;
    setText(await file.text());
    setName(file.name.replace(/\.ya?ml$/i, ""));
  };
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-xs font-medium text-muted">Add a theme</summary>
      <form
        className="mt-2 space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const named = name.trim() || /^name:\s*(\S+)/m.exec(text)?.[1] || "";
          if (await run("addTheme", { name: named, text, use: true })) {
            setName("");
            setText("");
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void read(e.dataTransfer.files[0]);
        }}
      >
        <input
          type="file"
          accept=".yml,.yaml"
          aria-label="Theme file"
          onChange={(e) => void read(e.target.files?.[0])}
          className="block w-full text-xs"
        />
        <textarea
          aria-label="Theme"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={
            'smithableTheme: 0.1\nname: forest\nfont: Inter\nlight: { primary: "#2f6f4e", … }'
          }
          className="w-full rounded border border-line p-2 font-mono text-xs"
        />
        <div className="flex items-center gap-2">
          <input
            aria-label="Theme name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="forest"
            className="h-8 flex-1 rounded border border-line px-2 text-xs"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="h-8 rounded-md bg-accent px-3 text-xs font-medium text-white disabled:opacity-50"
          >
            Add and use
          </button>
        </div>
        <p className="text-xs text-quiet">
          A theme is a file of colors and a font (see the spec, Themes); it is checked before it is
          added, and saved as themes/&lt;name&gt;.yml.
        </p>
      </form>
    </details>
  );
}
