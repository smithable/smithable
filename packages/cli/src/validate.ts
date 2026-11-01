import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  ASK_FILE,
  type AskIR,
  type AuthIR,
  actionAccess,
  type ContentIR,
  type Diagnostic,
  DUE_WITHIN,
  formatDiagnostic,
  hasErrors,
  LANGUAGES,
  PEOPLE_FILE,
  type PersonIR,
  pageModel,
  parseTheme,
  recordPicture,
  recordSummary,
  type SamplesIR,
  type SpecIR,
  type SpecPlugin,
  stagePage,
  type ThemeIR,
  threadBindings,
  titleField,
  translationPath,
  type UniqueScope,
  type UxIR,
  uniqueScope,
  validateAsk,
  validateAuth,
  validateContent,
  validateContext,
  validatePeople,
  validateSamples,
  validateSpec,
  validateUx,
  weekBy,
  writeExplicit,
} from "@smithable/core";
import { hostedLevel, levelWarnings } from "./hosted-level.js";
import type { Io } from "./io.js";
import { loadPlugins } from "./plugins.js";

/**
 * Reads and validates the spec with its companions: smithable.auth.yml (required) and,
 * when present, smithable.content.yml. Prints diagnostics; returns the IR only when
 * everything is valid.
 */
export function loadSpec(
  target: string,
  io: Io,
  /** Plugins to load besides the declared ones, e.g. one being written. */
  extraPlugins: string[] = [],
  /** When given, every finding is collected here as well (`validate --json`). */
  found?: Diagnostic[],
): {
  ir?: SpecIR;
  auth?: AuthIR;
  content?: ContentIR;
  ux?: UxIR;
  /** The project's own themes (themes/<name>.yml). */
  themes?: ThemeIR[];
  /** The project's sample records (samples/<Model>.yml). */
  samples?: SamplesIR;
  /** The project's sample users (samples/people.yml). */
  people?: PersonIR[];
  /** The Ask check's questions, samples/ask.yml, when the project has them. */
  asks?: AskIR[];
  plugins?: SpecPlugin[];
  path: string;
} {
  const path = isDirectory(target) ? join(target, "smithable.yml") : target;
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    io.err(`No spec found at ${path}.\n`);
    return { path };
  }
  // Problems only: a note (advice the app is fine without, docs/design/advice.md) is printed by
  // `smithable validate` alone, from `found`, never by every command that loads the spec.
  const print = (diagnostics: Diagnostic[]) => {
    found?.push(...diagnostics);
    for (const d of diagnostics) if (d.severity !== "note") io.err(`${formatDiagnostic(d)}\n`);
  };
  const failed = (file: string, diagnostics: Diagnostic[]) => {
    const errors = diagnostics.filter((d) => d.severity === "error").length;
    io.err(`\n${errors} ${errors === 1 ? "error" : "errors"} in ${file}.\n`);
    return { path };
  };

  const authPath = join(dirname(path), "smithable.auth.yml");
  if (!existsSync(authPath)) {
    io.err(
      `${authPath} is missing. Every project has one; for an app without sign-in it contains:\n\n  smithableAuth: 0.1\n  signIn: none\n`,
    );
    return { path };
  }
  const authFile = { path: authPath, text: readFileSync(authPath, "utf8") };
  // The roles are needed to check smithable.yml; the full check of the auth file needs its IR.
  const roles = validateAuth(authFile).auth?.roles.map((r) => r.name);
  let plugins: SpecPlugin[];
  try {
    plugins = loadPlugins(dirname(path), extraPlugins);
  } catch (error) {
    io.err(`${error instanceof Error ? error.message : String(error)}\n`);
    return { path };
  }
  const { ir, diagnostics } = validateSpec(
    { path, text },
    { ...(roles ? { roles } : {}), plugins },
  );
  print(diagnostics);
  if (!ir || hasErrors(diagnostics)) return failed(path, diagnostics);
  const authResult = validateAuth(authFile, ir);
  print(authResult.diagnostics);
  if (!authResult.auth) return failed(authPath, authResult.diagnostics);
  const auth = authResult.auth;
  // On the hosted service at Strict: a sign-in provider the level does not allow.
  print(levelWarnings(hostedLevel(), auth, authFile));

  // The optional companions: visible text and presentation.
  let content: ContentIR | undefined;
  const contentPath = join(dirname(path), "smithable.content.yml");
  if (existsSync(contentPath)) {
    const result = validateContent(
      { path: contentPath, text: readFileSync(contentPath, "utf8") },
      ir,
      undefined,
      auth,
    );
    print(result.diagnostics);
    if (!result.content) return failed(contentPath, result.diagnostics);
    content = result.content;
    // Each other language's texts (docs/design/languages.md §2), against the content file.
    for (const language of content.languages ?? []) {
      const file = join(dirname(path), translationPath(language));
      if (!existsSync(file)) {
        io.err(
          `${file} is missing: the app is in ${language} ("languages"), and its texts show in the app's own language. smithable op addLanguage ${language} writes it.\n`,
        );
        continue;
      }
      const read = validateContent(
        { path: file, text: readFileSync(file, "utf8") },
        ir,
        { of: content, language },
        auth,
      );
      print(read.diagnostics);
      if (!read.content) return failed(file, read.diagnostics);
      content.translations = { ...content.translations, [language]: read.content };
    }
  }
  // The project's own themes, which the ux file's preset may name.
  const themes: ThemeIR[] = [];
  for (const file of projectThemeFiles(dirname(path))) {
    const result = parseTheme({ path: file, text: readFileSync(file, "utf8") });
    print(result.diagnostics);
    if (!result.theme) return failed(file, result.diagnostics);
    themes.push(result.theme);
  }
  let ux: UxIR | undefined;
  const uxPath = join(dirname(path), "smithable.ux.yml");
  if (existsSync(uxPath)) {
    const result = validateUx(
      { path: uxPath, text: readFileSync(uxPath, "utf8") },
      ir,
      themes,
      auth,
    );
    print(result.diagnostics);
    if (!result.ux) return failed(uxPath, result.diagnostics);
    ux = result.ux;
  }
  // The project's sample records, seeded instead of generated ones.
  const sampleFiles = projectFiles(dirname(path), "samples");
  let samples: SamplesIR | undefined;
  if (sampleFiles.length) {
    const result = validateSamples(
      sampleFiles.map((file) => ({ path: file, text: readFileSync(file, "utf8") })),
      ir,
      content,
    );
    print(result.diagnostics);
    const bad = result.diagnostics.find((d) => d.severity === "error");
    if (bad) return failed(join(dirname(path), "samples"), result.diagnostics);
    samples = result.samples;
  }
  // The sample users, people of the sample data who act in a development build.
  let people: PersonIR[] | undefined;
  const peopleFile = sampleFiles.find(
    (file) => file.replace(/^.*[\\/]/, "").replace(/\.ya?ml$/, "") === PEOPLE_FILE,
  );
  if (peopleFile) {
    const result = validatePeople(
      { path: peopleFile, text: readFileSync(peopleFile, "utf8") },
      auth,
    );
    print(result.diagnostics);
    if (result.diagnostics.some((d) => d.severity === "error"))
      return failed(peopleFile, result.diagnostics);
    people = result.people;
  }
  // The Ask check's questions (docs/design/ask-words.md §4): stale names are warnings, said here.
  let asks: AskIR[] | undefined;
  const askFile = sampleFiles.find(
    (file) => file.replace(/^.*[\\/]/, "").replace(/\.ya?ml$/, "") === ASK_FILE,
  );
  if (askFile) {
    const result = validateAsk({ path: askFile, text: readFileSync(askFile, "utf8") }, ir, auth);
    print(result.diagnostics);
    if (result.diagnostics.some((d) => d.severity === "error"))
      return failed(askFile, result.diagnostics);
    asks = result.asks;
  }
  const contextPath = join(dirname(path), "smithable.context.yml");
  if (existsSync(contextPath)) {
    const problems = validateContext({
      path: contextPath,
      text: readFileSync(contextPath, "utf8"),
    });
    print(problems);
    if (problems.length) return failed(contextPath, problems);
  }
  return {
    ir,
    auth,
    path,
    plugins,
    ...(content ? { content } : {}),
    ...(ux ? { ux } : {}),
    ...(themes.length ? { themes } : {}),
    ...(samples ? { samples } : {}),
    ...(people ? { people } : {}),
    ...(asks ? { asks } : {}),
  };
}

/** The project's language files' texts, by language (smithable.content.<language>.yml). */
export function projectTranslations(dir: string): Record<string, string> {
  return Object.fromEntries(
    LANGUAGES.flatMap((language) => {
      const file = join(dir, translationPath(language));
      return existsSync(file) ? [[language, readFileSync(file, "utf8")]] : [];
    }),
  );
}

/** The project's themes that parse, for operations; problems are reported by `loadSpec`. */
export function projectThemes(dir: string): ThemeIR[] {
  return projectThemeFiles(dir).flatMap((file) => {
    const theme = parseTheme({ path: file, text: readFileSync(file, "utf8") }).theme;
    return theme ? [theme] : [];
  });
}

/** The theme files of a project: themes/<name>.yml, in name order. */
export function projectThemeFiles(dir: string): string[] {
  return projectFiles(dir, "themes");
}

/** The YAML files in a project folder (themes/, samples/), in name order. */
function projectFiles(dir: string, name: string): string[] {
  const folder = join(dir, name);
  if (!existsSync(folder) || !statSync(folder).isDirectory()) return [];
  return readdirSync(folder)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .map((f) => join(folder, f));
}

/** `smithable validate [path]`: a directory containing smithable.yml, or the file itself. */
export function validate(
  target: string,
  io: Io,
  extraPlugins: string[] = [],
  json = false,
  explain = false,
  write = false,
): number {
  if (json) {
    // For a program: every finding with its code, file and place, and whether the project is
    // valid. Nothing else is printed, so the output is one JSON document.
    const found: Diagnostic[] = [];
    const { ir } = loadSpec(target, { ...io, err: () => {} }, extraPlugins, found);
    io.out(`${JSON.stringify({ valid: Boolean(ir), diagnostics: found }, null, 2)}\n`);
    return ir ? 0 : 1;
  }
  const found: Diagnostic[] = [];
  const { ir, path, auth, ux } = loadSpec(target, io, extraPlugins, found);
  if (!ir) return 1;
  io.out(
    `${path} is valid: ${count(ir.models.length, "model")}, ${count(ir.pages.length, "page")}.\n`,
  );
  // --write: what the rules settled, written into the spec, so it says it all and no later
  // change of its shape moves anything (docs/design/inference.md §4); then --explain reads the spec as written..
  let shown = { ir, auth, ux };
  if (write) {
    const specPath = isDirectory(target) ? join(target, "smithable.yml") : target;
    const result = writeExplicit(readFileSync(specPath, "utf8"), ir, auth, ux);
    if (result.written.length) {
      writeFileSync(specPath, result.text);
      io.out(`\nWritten into ${specPath}:\n${result.written.map((w) => `  ${w}\n`).join("")}`);
      const again = loadSpec(target, { ...io, err: () => {} }, extraPlugins);
      if (again.ir) shown = { ir: again.ir, auth: again.auth, ux: again.ux };
    } else io.out("\nNothing was left to the rules; the spec says it all.\n");
  }
  if (explain && shown.auth) io.out(`\n${explainSpec(shown.ir, shown.auth, shown.ux)}`);
  // Advice, after the verdict: what the app would gain, each with the operation that does it.
  const notes = found.filter((d) => d.severity === "note");
  if (notes.length) {
    io.out(`\n${count(notes.length, "note")}, advice the app is fine without:\n`);
    for (const d of notes) io.out(`${formatDiagnostic(d)}\n`);
  }
  return 0;
}

export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/**
 * What the spec leaves to the rules, said in words (`validate --explain`): each model's title
 * field, where its unique values are unique, what a conversation reads from it, and who may run
 * each action. The same functions the generated app is built from, so this is what it does.
 */
export function explainSpec(ir: SpecIR, auth: AuthIR, ux?: UxIR): string {
  const lines: string[] = [];
  const scope = (s: UniqueScope | undefined) => (s === "owner" ? "per owner" : "in the whole app");
  for (const model of ir.models) {
    lines.push(
      model.nameParts?.length
        ? `${model.name}: named by ${model.nameParts.map((p) => (p.through ? `${p.through}.${p.field}` : p.field)).join(" · ")} (namedBy)`
        : `${model.name}: named by ${titleField(model)} (by rule: the first short text, else the first long text, else the number)`,
    );
    const uniques = [
      ...model.fields
        .filter((f) => f.unique || f.sequence)
        .map(
          (f) =>
            `${f.name} (${scope(uniqueScope(f.unique || Boolean(f.sequence), model, auth))}${f.sequence ? ", counting up" : ""})`,
        ),
      ...(model.unique ?? []).map(
        (u) => `${u.fields.join(" and ")} together (${scope(uniqueScope(u.scope, model, auth))})`,
      ),
    ];
    if (uniques.length) lines.push(`  unique: ${uniques.join("; ")}`);
    const shownAsThread = ir.pages.some((p) =>
      Object.entries(ux?.pages[p.id]?.lists ?? {}).some(
        ([name, look]) =>
          look === "thread" &&
          ir.models
            .find((m) => m.name === pageModel(p))
            ?.fields.some(
              (f) =>
                f.name === name &&
                f.type.kind === "relation" &&
                f.type.many &&
                f.type.model === model.name,
            ),
      ),
    );
    if (shownAsThread) {
      const b = threadBindings(model);
      lines.push(
        `  as a conversation: the message is ${b.body?.name ?? "?"}${b.author ? `, written by ${b.author.name}` : ", nobody named"}${b.side ? `, ${b.side.field.name} says the side (${b.side.ours} is ours)` : ""}${b.ambiguous.length ? ` (by rule for ${b.ambiguous.join(", ")}: say it with thread)` : model.thread ? " (as thread says)" : " (by rule)"}`,
      );
    }
  }
  for (const action of ir.actions) {
    const a = actionAccess(action, auth, ir.models);
    const who = [...a.roles, ...(a.owner ? ["the record's owner"] : [])];
    lines.push(
      `${action.name}${action.custom ? "" : ` (on ${action.on})`}: run by ${who.length ? who.join(", ") : "nobody"}`,
    );
  }
  // A landing page's hero: the page its button opens when the spec names none, and its second.
  for (const page of ir.pages) {
    if (page.pattern.kind !== "landing") continue;
    const hero = page.pattern.sections.find((s) => s.kind === "hero");
    if (!hero) continue;
    const other = page.pattern.sections.find((s) => s !== hero && s.button)?.button;
    const first = ir.navigation
      .flatMap((m) => m.pages)
      .find((id) => ir.pages.find((p) => p.id === id)?.pattern.kind !== "landing");
    const opens = hero.button
      ? `opens ${hero.button}`
      : `opens ${other ?? first ?? "nothing"} (by rule: ${other ? "the page's other section's button" : "the app's first page"}; say it with button)`;
    lines.push(
      `${page.id} hero: button ${opens}; ${hero.secondButton ? `second button opens ${hero.secondButton}` : "no second button (secondButton)"}`,
    );
  }
  // How a list page's filter on a reference is picked (A 208): the ux file's word, else the count.
  for (const page of ir.pages) {
    const model = ir.models.find((m) => m.name === pageModel(page));
    for (const name of page.filters ?? []) {
      const field = model?.fields.find((x) => x.name === name);
      if (field?.type.kind !== "relation" || field.type.many || field.type.model === "User")
        continue;
      const to = field.type.model;
      const target = ir.models.find((m) => m.name === to);
      if (target && titleField(target) === "id") {
        lines.push(
          `${page.id} filter ${name}: pick list (${target.name} has no name to search by)`,
        );
        continue;
      }
      const said = ux?.pages[page.id]?.filterPick?.[name];
      lines.push(
        `${page.id} filter ${name}: pick ${said ?? "by count (search from 200 readable records)"}${said ? " (filters.pick)" : ""}`,
      );
    }
  }
  // A dashboard's lists of what is due: how far ahead each reaches, said or unsaid (7 days).
  for (const page of ir.pages)
    if (page.pattern.kind === "dashboard")
      for (const item of page.pattern.items)
        if (item.when) {
          const within = item.within ?? DUE_WITHIN;
          const span = `${within.amount} ${within.unit}${within.amount === 1 ? "" : "s"}`;
          lines.push(
            `${page.id} tile ${item.name}: due by ${item.when}, within ${span}${item.within ? " (within)" : " (unsaid)"}`,
          );
        }
  // A stage hero's list page (look-breadth §3): the one named, else the navigation's first.
  for (const page of ir.pages)
    for (const [name, look] of Object.entries(ux?.pages[page.id]?.looks ?? {}))
      if (look.layout === "stage") {
        const shown = stagePage(ir, look.stage);
        lines.push(
          `${page.id} ${name} stage: ${shown?.id ?? "no list page"}${look.stage ? " (stage)" : " (the first list page in the navigation)"}`,
        );
      }
<<<<<<< HEAD
  // A record's pictures large on its view (A 215): which field, by type.
  for (const page of ir.pages) {
    const look = ux?.pages[page.id]?.recordPictures;
    const model = ir.models.find((m) => m.name === pageModel(page));
    if (!look || !model) continue;
    lines.push(
      `${page.id} pictures (${look}): ${recordPicture(model)?.name ?? "none"} (the first picture field), on the read-only view`,
    );
  }
=======
  // A records section as a week (A 215): the date each record is placed by, said or unsaid.
  for (const page of ir.pages)
    for (const section of page.sections) {
      const look = ux?.pages[page.id]?.looks?.[section.name];
      const model = ir.models.find((m) => m.name === section.model);
      if (section.kind !== "records" || look?.layout !== "week" || !model) continue;
      const by = weekBy(model, look.by);
      lines.push(
        `${page.id} ${section.name} by ${by?.name ?? "no date"}${look.by ? " (by)" : " (unsaid, the first date)"}`,
      );
    }
>>>>>>> origin/main
  // A calendar's view and its time of day (A 215), with the kit's boundaries.
  for (const page of ir.pages) {
    if (page.pattern.kind !== "calendar") continue;
    const calendar = ux?.pages[page.id]?.calendar;
    lines.push(
      `${page.id} calendar view: ${calendar?.view ?? "week"}${calendar?.view ? " (view)" : " (unsaid)"}`,
    );
    if (calendar?.filters?.includes("timeOfDay"))
      lines.push(
        `${page.id} time of day: morning before 12:00, afternoon 12:00 to 17:00, evening from 17:00 (the kit's)`,
      );
  }
  // A record's summary (A 215): what its title row or its side panel shows, by type.
  for (const page of ir.pages) {
    const look = ux?.pages[page.id];
    const model =
      page.pattern.kind === "crud" ? ir.models.find((m) => m.name === pageModel(page)) : undefined;
    if (!model || !look || (!look.recordHeader && !look.formAside)) continue;
    const { status, amount, dates } = recordSummary(model, ux?.tones ?? {});
    const where = [look.recordHeader && "header", look.formAside && "aside"]
      .filter(Boolean)
      .join(" and ");
    lines.push(
      `${page.id} summary (${where}): status ${status?.name ?? "none"}, amount ${amount?.name ?? "none"}, dates ${dates.map((d) => d.name).join(", ") || "none"} (the first choice with tones, money, dates)`,
    );
  }
  // Where the menu sits and its surface (look-gap §4): the ux file's word, else the default.
  lines.push(ux?.navigation ? `menu: ${ux.navigation} (navigation)` : "menu: sidebar (unsaid)");
  lines.push(
    ux?.chrome ? `menu surface: ${ux.chrome} (chrome)` : "menu surface: the theme's (unsaid)",
  );
  return `${lines.join("\n")}\n`;
}
