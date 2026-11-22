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
  themeNamed,
  UX_CAPABILITIES,
} from "@smithable/core";
import { useId, useState } from "react";
import type { Project } from "../api";
import type { Spec } from "../engine";
import { ICON_CHOICES } from "../properties";
import { ThemeCards } from "../ThemeCards";
import { cx, Select } from "../ui";
import type { Run } from "./ChangeForms";
import { PendingInput, usePendingEdit } from "./pending-edit";
import { UxLists } from "./UxLists";
import { UxRecords } from "./UxRecords";
import { AppShell, PageShell } from "./UxShell";
import { useUxSource } from "./UxSource";

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

/** Live theme selection; app-wide overrides stay independent of the selected page. */
export function ThemeSettings({
  spec,
  run,
  themes,
  ownThemes,
  target,
  onTarget,
  onCustomize,
}: {
  spec: Spec;
  run: Run;
  themes: Project["themes"];
  ownThemes: Project["ownThemes"];
  target: string | null;
  onTarget: (page: string | null) => void;
  onCustomize: (theme: string) => void;
}) {
  const { ir, ux } = spec;
  const scope = useId();
  const source = useUxSource(
    [...(target ? ["pages", target] : []), "theme", "preset"],
    target ? "app" : "theme",
  );
  if (!ir || !ux)
    return <p className="p-3 text-sm text-quiet">The spec has errors; fix them in Code mode.</p>;
  const theme = ux.theme;
  const preset = (target ? ux.pages[target]?.theme?.preset : undefined) ?? theme.preset;
  const selectedTheme = themeNamed(preset, ownThemes);
  return (
    <div className="space-y-6 p-3">
      <label htmlFor={`${scope}-theme-target`} className="flex items-center gap-3 text-sm">
        Theme selection target
        <Select
          id={`${scope}-theme-target`}
          aria-label="Theme selection target"
          value={target ?? ""}
          onChange={(e) => onTarget(e.target.value || null)}
          options={[
            ["", "Whole app"],
            ...ir.pages
              .filter((p) => p.pattern.kind === "landing")
              .map((p) => [p.id, humanize(p.id)] as [string, string]),
          ]}
        />
      </label>
      <p className="text-xs text-muted">
        {target
          ? "Choose the live theme for this landing page. App-wide settings below keep their scope."
          : "Choose the live theme for the whole app."}
      </p>
      <p className="text-xs text-muted">
        {source.present
          ? "Theme selection: overridden here."
          : target
            ? "Theme selection: inherited from the app."
            : "Theme selection: inherited from the default."}
      </p>
      {target && source.present && (
        <button
          type="button"
          className="rounded border border-line px-3 py-1 text-sm"
          onClick={() => run("resetThemeOverride", { key: "preset", page: target })}
        >
          Use the app's theme
        </button>
      )}
      <p className="text-xs text-muted">
        Available modes:{" "}
        {selectedTheme?.modes === "both"
          ? "Light and Dark"
          : selectedTheme?.modes === "dark"
            ? "Dark"
            : "Light"}
        .
      </p>
      <Group title="Theme">
        {/* A card per theme, built in or the project's, with its picture (docs/design/look.md §3). */}
        <ThemeCards
          themes={themes}
          preset={preset}
          onChoose={(preset) => {
            void run("setTheme", { preset, ...(target ? { page: target } : {}) });
          }}
          onCustomize={onCustomize}
        />
        <AddTheme run={run} />
      </Group>
      <Group title="App-wide color">
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
      <Group title="App-wide font, density and motion">
        <ThemeSetting
          which="font"
          label="Font"
          options={FONTS.map((f) => [f, f] as [string, string])}
          run={run}
        />
        <ThemeSetting
          which="density"
          label="Density"
          options={[
            ["comfortable", "Comfortable"],
            ["standard", "Standard"],
            ["compact", "Compact"],
          ]}
          run={run}
        />
        <ThemeSetting
          which="motion"
          label="Motion"
          options={[
            ["none", "None"],
            ["subtle", "Subtle"],
            ["lively", "Lively"],
          ]}
          run={run}
        />
      </Group>
      <Group title="App-wide menu">
        <AppShell ux={ux} run={run} />
      </Group>
    </div>
  );
}

export function ContentIdentity({ spec, run }: { spec: Spec; run: Run }) {
  return (
    <div className="p-3" data-path={JSON.stringify(["logo"])}>
      {" "}
      <Group title="App identity">
        <Logo spec={spec} run={run} />
      </Group>
    </div>
  );
}
export function AppLanguage({ spec, run }: { spec: Spec; run: Run }) {
  return (
    <div data-path={JSON.stringify(["language"])}>
      {" "}
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
    </div>
  );
}

/** Presentation for one page, sharing its context with Behavior and preview following. */
export function PageLayout({
  spec,
  run,
  page,
  onPage,
  onBehavior,
  onContent,
}: {
  spec: Spec;
  run: Run;
  page: string;
  onPage: (page: string) => void;
  onBehavior: (page: string) => void;
  onContent: (page: string) => void;
}) {
  const { ir, ux } = spec;
  if (!ir || !ux)
    return <p className="p-3 text-sm text-quiet">The spec has errors; fix them in Code mode.</p>;
  const activePage = ir.pages.find((p) => p.id === page) ?? ir.pages[0];
  const setSelectedPage = onPage;
  return (
    <div className="space-y-6 p-3">
      <div className="flex gap-3 text-sm">
        <button
          type="button"
          disabled={!activePage}
          onClick={() => activePage && onBehavior(activePage.id)}
        >
          Page behavior
        </button>
        <button
          type="button"
          disabled={!activePage}
          onClick={() => activePage && onContent(activePage.id)}
        >
          Page content
        </button>
      </div>
      {!activePage && <p className="text-sm text-muted">No pages yet. Add a page in Behavior.</p>}
      <Group title="Pages">
        <label
          htmlFor="look-page-selector"
          className="flex items-center justify-between gap-3 text-sm"
        >
          Page to style
          <Select
            id="look-page-selector"
            aria-label="Page to style"
            value={activePage?.id ?? ""}
            options={ir.pages.map((p) => [p.id, humanize(p.id)])}
            onChange={(e) => setSelectedPage(e.target.value)}
          />
        </label>
        <PageShell ux={ux} page={activePage} run={run} />
        {ir.pages
          .filter((p) => p.id === activePage?.id)
          .map((page) => {
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
                {page.pattern.kind === "crud" && model && (
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
                {page.pattern.kind === "crud" && model && (
                  <ListAndForm
                    page={page.id}
                    fields={model.fields.filter(
                      (f) => !(f.type.kind === "relation" && f.type.many),
                    )}
                    lists={model.fields
                      .filter((f) => f.type.kind === "relation" && f.type.many)
                      .map((f) => f.name)}
                    ux={ux.pages[page.id] ?? {}}
                    run={run}
                  />
                )}
                {(page.pattern.kind === "crud" || page.pattern.kind === "calendar") && (
                  <UxLists
                    key={page.id}
                    ir={ir}
                    page={page}
                    model={model}
                    ux={ux.pages[page.id] ?? {}}
                    run={run}
                  />
                )}
                <UxRecords
                  page={page}
                  model={model}
                  ux={ux.pages[page.id] ?? {}}
                  tones={ux.tones}
                  run={run}
                />
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
                  <>
                    <SectionOrder page={page.id} sections={page.sections} run={run} />
                    <SectionAppearance
                      page={page.id}
                      sections={page.sections}
                      ux={ux.pages[page.id] ?? {}}
                      run={run}
                    />
                  </>
                )}
                {page.pattern.kind === "landing" && (
                  <LandingLook
                    page={page.id}
                    sections={page.pattern.sections}
                    ux={ux.pages[page.id] ?? {}}
                    run={run}
                  />
                )}
              </div>
            );
          })}
      </Group>
    </div>
  );
}

export function ChoiceTones({
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
  const { ir, ux } = spec;
  if (!ir || !ux) return null;
  const selected = ir.models
    .find((item) => item.name === model)
    ?.fields.find((item) => item.name === field);
  const choices =
    selected?.type.kind === "choice" ? [{ model, field, values: selected.type.values }] : [];
  if (!choices.length) return null;
  return (
    <div className="basis-full">
      {" "}
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
function ThemeSetting({
  which,
  label,
  options,
  run,
}: {
  which: "font" | "density" | "motion";
  label: string;
  options: [string, string][];
  run: Run;
}) {
  const source = useUxSource(
    ["theme", ...(which === "font" ? ["brand", which] : [which])],
    "theme",
  );
  return (
    <div className="space-y-1">
      <Segmented
        label={label}
        value={source.present ? String(source.value) : "__inherited"}
        options={[["__inherited", "Use the theme's own"], ...options]}
        onChange={(value) =>
          value === "__inherited"
            ? run("resetThemeOverride", { key: which })
            : run("setTheme", { [which]: value })
        }
      />
      <p data-override-origin className="text-xs text-muted">
        {source.present ? `App-wide override: ${humanize(String(source.value))}` : source.inherited}
      </p>
    </div>
  );
}

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
  const source = useUxSource(["theme", "brand", which], "theme");
  usePendingEdit(picked !== undefined && picked !== value);
  const shown = picked ?? value ?? fallback;
  const apply = async () => {
    const submitted = picked;
    if (!submitted || submitted === value || (await run("setTheme", { [which]: submitted })))
      setPicked((current) => (current === submitted ? undefined : current));
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
      <span data-override-origin className="text-xs">
        {source.present ? `App-wide override: ${String(source.value)}` : source.inherited}
      </span>
      {picked && picked !== value && (
        <button type="button" className="text-xs font-medium text-accent" onClick={apply}>
          Use this color
        </button>
      )}
      {source.present && (
        <button
          type="button"
          className="text-xs text-muted hover:text-accent"
          aria-label={`Use the theme's own ${label.toLowerCase()}`}
          onClick={async () => {
            const submitted = picked;
            if (await run("resetThemeOverride", { key: which }))
              setPicked((current) => (current === submitted ? undefined : current));
          }}
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
            options={UX_CAPABILITIES.recordList.values.map((value) => [
              value,
              value === "thread" ? "Conversation" : humanize(value),
            ])}
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
  usePendingEdit(Boolean(name) || added.some((a) => !groups.some((g) => g.name === a)));
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
  run,
}: {
  page: string;
  sections: { name: string; kind: string }[];
  ux: PageUx;
  run: Run;
}) {
  return (
    <div className="space-y-2 text-sm">
      <SectionOrder page={page} sections={sections} run={run} />
      <SectionAppearance page={page} sections={sections} ux={ux} run={run} />
    </div>
  );
}

function SectionAppearance({
  page,
  sections,
  ux,
  run,
}: {
  page: string;
  sections: { name: string; kind: string }[];
  ux: PageUx;
  run: Run;
}) {
  const scope = useId();
  return (
    <div className="space-y-2 text-sm">
      {sections.map((section) =>
        Object.entries(SECTION_LOOKS[section.kind] ?? {}).map(([key, values]) => {
          if (section.kind === "footer" || key === "mark") return null;
