import { isScalar, LineCounter, type ParsedNode, parseDocument, visit } from "yaml";
import { advise } from "./advice.js";
import { checkKeys, mapEntries, type NameReference, ParseContext } from "./context.js";
import { type Diagnostic, hasErrors } from "./diagnostics.js";
import type { SpecIR } from "./ir.js";
import { applyPlugins, type SpecPlugin } from "./plugin.js";
import type { SpecSection } from "./section.js";
import { actionsSection } from "./sections/actions.js";
import { appSection } from "./sections/app.js";
import { incomingSection } from "./sections/incoming.js";
import { modelsSection } from "./sections/models.js";
import { navigationSection } from "./sections/navigation.js";
import { outgoingSection } from "./sections/outgoing.js";
import { pagesSection } from "./sections/pages.js";
import { queriesSection } from "./sections/queries.js";
import { timersSection } from "./sections/timers.js";
import { didYouMean } from "./suggest.js";

/** The spec format version this build of Smithable reads and writes. */
export const SPEC_VERSION = "0.1";

/** Built-in sections, in dependency order: a section may use the ones before it. */
export const SECTIONS: readonly SpecSection[] = [
  appSection,
  modelsSection,
  actionsSection,
  timersSection,
  outgoingSection,
  incomingSection,
  queriesSection,
  pagesSection,
  navigationSection,
];

export interface SpecFile {
  path: string;
  text: string;
}

export interface ValidateResult {
  /** Present only when there are no errors. */
  ir?: SpecIR;
  diagnostics: Diagnostic[];
  /** Where the spec names its models and pages, for a rename to follow (also with errors). */
  references: NameReference[];
}

export interface ValidateOptions {
  /** The roles defined in smithable.auth.yml. Without them, role names are not checked. */
  roles?: string[];
  /** Project plugins: the sections of smithable.yml Smithable itself does not know. */
  plugins?: SpecPlugin[];
}

/** Parses and validates smithable.yml. Pure: no file system or network access. */
export function validateSpec(file: SpecFile, options: ValidateOptions = {}): ValidateResult {
  const lines = new LineCounter();
  const doc = parseDocument(file.text, {
    lineCounter: lines,
    uniqueKeys: true,
    prettyErrors: false,
  });
  const ctx = new ParseContext(file.path, lines);
  const done = () => ({
    diagnostics: sortDiagnostics(ctx.diagnostics),
    references: ctx.nameReferences(),
  });

  for (const error of doc.errors) {
    const code = error.code === "DUPLICATE_KEY" ? "duplicate-key" : "yaml-syntax";
    ctx.errorAtOffset(error.pos[0], code, firstLine(error.message));
  }
  if (hasErrors(ctx.diagnostics)) return done();
  rejectYamlFeatures(ctx, doc);

  const root = doc.contents as ParsedNode | null;
  const entries = mapEntries(ctx, root, "smithable.yml");
  if (!entries) return done();
  const byKey = new Map(entries.map((e) => [e.key, e]));

  const version = byKey.get("smithable");
  if (!version) {
    ctx.error(
      root,
      "missing-version",
      `The spec must start with its format version: "smithable: ${SPEC_VERSION}".`,
    );
    return done();
  }
  const versionText = isScalar(version.value)
    ? (version.value.source ?? String(version.value.value))
    : "";
  if (versionText !== SPEC_VERSION) {
    reportVersion(ctx, version.value, versionText);
    return done();
  }

  const plugins = options.plugins ?? [];
  const allowed = ["smithable", ...SECTIONS.map((s) => s.key), ...plugins.map((p) => p.key)];
  for (const { key, keyNode } of entries) {
    if (allowed.includes(key) || key === "jobs") continue;
    // A section nobody handles is an error, never ignored: a plugin can be written for it.
    ctx.error(
      keyNode,
      "unknown-key",
      `Smithable doesn't know "${key}".`,
      didYouMean(key, allowed) ??
        (/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(key)
          ? `Teach it: "smithable teach ${key}" has AI write a project plugin for it once; after that it costs nothing.`
          : undefined),
    );
  }
  checkKeys(
    ctx,
    entries.filter((e) => allowed.includes(e.key) || e.key === "jobs"),
    "smithable.yml",
    { allowed, later: ["jobs"] },
  );
  const extensions = applyPlugins(ctx, doc, byKey, plugins);
  const parsed: Partial<SpecIR> = {};
  for (const section of SECTIONS) {
    const entry = byKey.get(section.key);
    if (!entry && section.required) {
      ctx.error(root, "missing-key", `The spec needs "${section.key}".`);
      continue;
    }
    // Each section returns the IR value for its own key.
    (parsed as Record<string, unknown>)[section.key] = section.parse(ctx, entry?.value, parsed);
  }
  unfilled(ctx, parsed);
  for (const role of options.roles ?? []) ctx.define("role", role);
  ctx.checkReferences(options.roles ? [] : ["role"]);

  if (hasErrors(ctx.diagnostics)) return done();
  const ir = { specVersion: SPEC_VERSION, ...parsed, extensions } as SpecIR;
  advise(ctx, ir);
  return { ir, diagnostics: sortDiagnostics(ctx.diagnostics), references: ctx.nameReferences() };
}

function reportVersion(ctx: ParseContext, at: ParsedNode | null, found: string): void {
  if (!/^\d+\.\d+$/.test(found)) {
    ctx.error(at, "invalid-version", `The spec version must look like ${SPEC_VERSION}.`);
  } else if (compareVersions(found, SPEC_VERSION) < 0) {
    ctx.error(
      at,
      "old-version",
      `This spec uses format version ${found}; this Smithable reads ${SPEC_VERSION}.`,
      "Run `smithable upgrade` to migrate the spec.",
    );
  } else {
    ctx.error(
      at,
      "new-version",
      `This spec uses format version ${found}, which is newer than this Smithable supports (${SPEC_VERSION}).`,
      "Update Smithable.",
    );
  }
}

export function compareVersions(a: string, b: string): number {
  const [aMajor = 0, aMinor = 0] = a.split(".").map(Number);
  const [bMajor = 0, bMinor = 0] = b.split(".").map(Number);
  return aMajor - bMajor || aMinor - bMinor;
}

/** Anchors, aliases and tags make specs hard to read and unsafe to edit with operations. */
export function rejectYamlFeatures(ctx: ParseContext, doc: ReturnType<typeof parseDocument>): void {
  visit(doc, {
    Alias(_, node) {
      ctx.error(
        node as ParsedNode,
        "yaml-alias",
        "YAML aliases (*name) are not supported in Smithable specs.",
      );
    },
    Node(_, node) {
      const n = node as ParsedNode;
      if (n.anchor)
        ctx.error(n, "yaml-anchor", "YAML anchors (&name) are not supported in Smithable specs.");
      if (n.tag)
        ctx.error(n, "yaml-tag", `YAML tags like "${n.tag}" are not supported in Smithable specs.`);
    },
  });
}

function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((a, b) => a.line - b.line || a.column - b.column);
}

function firstLine(message: string): string {
  return message.split("\n")[0] ?? message;
}

/**
 * A required field the app fills (record-rules.md §1) with nothing to fill it: no default, no
 * action's set and no incoming entry's set naming it. A form that creates a record without it is
 * refused, so it is said here, where it is written; code of one's own may still fill it.
 */
function unfilled(ctx: ParseContext, parsed: Partial<SpecIR>): void {
  const given = new Set<string>();
  for (const action of parsed.actions ?? []) {
    if (action.custom) continue;
    for (const v of [...action.set, ...(action.copy ?? [])]) given.add(`${action.on}.${v.field}`);
    for (const add of action.add ?? [])
      for (const v of add.values) given.add(`${add.model}.${v.field}`);
  }
  for (const entry of parsed.incoming ?? []) {
    if (!entry.create) continue;
    for (const v of entry.set) given.add(`${entry.create}.${v.field}`);
    for (const field of Object.values(entry.mail ?? {})) given.add(`${entry.create}.${field}`);
  }
  for (const model of parsed.models ?? [])
    for (const f of model.fields) {
      if (
        !f.byApp ||
        f.sequence ||
        !f.required ||
        f.defaultMe ||
        f.defaultFormula ||
        f.default !== undefined
      )
        continue;
      if (given.has(`${model.name}.${f.name}`)) continue;
      ctx.warning(
        ctx.at(`by:field "${model.name}.${f.name}"`),
        "app-field-unfilled",
        `${model.name}.${f.name} is required and filled by the app, but no default, action or incoming entry gives it a value: a record cannot be created without it.`,
        "Give it a default (a value, or ME() for a person), set it in an action or an incoming entry, or fill it in your own code.",
      );
    }
}
