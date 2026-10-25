import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  type AuthIR,
  actionAccess,
  type ContentIR,
  type Diagnostic,
  formatDiagnostic,
  hasErrors,
  LANGUAGES,
  pageModel,
  parseTheme,
  type SamplesIR,
  type SpecIR,
  type SpecPlugin,
  type ThemeIR,
  threadBindings,
  titleField,
  translationPath,
  type UniqueScope,
  type UxIR,
  uniqueScope,
  validateAuth,
  validateContent,
  validateContext,
  validateSamples,
  validateSpec,
  validateUx,
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
      const read = validateContent({ path: file, text: readFileSync(file, "utf8") }, ir, {
        of: content,
        language,
      });
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
    const result = validateUx({ path: uxPath, text: readFileSync(uxPath, "utf8") }, ir, themes);
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
    const other = page.pattern.sections.find((s) => s.button)?.button;
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
  return `${lines.join("\n")}\n`;
}
