import {
  conceptsWithRules,
  type FieldIR,
  formatFormula,
  kebab,
  type PageIR,
  type PatternKind,
  type PatternOf,
  pageModels,
  patternInfo,
  ruleId,
  type SemanticText,
  type SpecIR,
  typeKey,
} from "@smithable/core";

/** Where the adapter generated a concept's code (see implementationIndex in the adapter). */
export interface GeneratedEntry {
  files: { path: string; symbols: string[] }[];
  routes: string[];
  tables: string[];
  tests: { file: string; name: string }[];
}

export interface SourceFile {
  path: string;
  text: string;
}

export interface IndexInput {
  ir: SpecIR;
  generated: Record<string, GeneratedEntry>;
  /** The files under src/custom. */
  custom: SourceFile[];
  /** Rule id → hash of the rule's text when it got its id (see hashRule). */
  ruleBaseline?: Record<string, string>;
  /** The last test run: test titles and whether they passed. */
  testResults?: { title: string; passed: boolean }[];
}

/** How a file relates to a concept. */
export type FileRole = "generated" | "implements" | "uses" | "tests";

export interface FileRef {
  path: string;
  role: FileRole;
  symbols: string[];
}

export type RuleStatus =
  | "not-implemented"
  | "untested"
  | "not-run"
  | "failing"
  | "tested"
  | "changed";

export interface RuleInfo {
  /** Qualified, e.g. "mergeCustomers.move-orders". */
  id?: string;
  text: string;
  status: RuleStatus;
  implementedIn: string[];
  testedIn: string[];
}

export interface ConceptInfo {
  /** e.g. "model:Order", "field:Order.shippingCost", "action:mergeCustomers", "page:orders". */
  concept: string;
  /** What it is, in one line, e.g. "money, computed: quantity * unitPrice". */
  summary: string;
  description?: string;
  intent?: string;
  rules: RuleInfo[];
  /** Where it is written in smithable.yml. */
  specPath: string[];
  /** Concepts it belongs to or works with. */
  related: string[];
  files: FileRef[];
  routes: string[];
  tables: string[];
  tests: { file: string; name: string }[];
}

export interface ProjectIndex {
  concepts: ConceptInfo[];
  /** The menus and their pages, in order: every change to a menu needs the whole list. */
  menus: { name: string; pages: string[] }[];
}

/** A short, stable hash of a rule's text, to notice when it changes. */
export function hashRule(text: string): string {
  // FNV-1a over the trimmed text, twice with different seeds for 64 bits.
  const fnv = (seed: number) => {
    let h = seed;
    for (const c of text.trim()) {
      h ^= c.codePointAt(0) ?? 0;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return fnv(0x811c9dc5) + fnv(0x01000193);
}

/**
 * Builds the implementation index (ARCHITECTURE §7): each concept of the spec with its
 * meaning, rules and their status, and the generated and custom code that implements it.
 * Pure: the host reads the files.
 */
export function buildIndex(input: IndexInput): ProjectIndex {
  const { ir } = input;
  const custom = analyseCustom(input.custom);
  const concepts: ConceptInfo[] = conceptsWithRules(ir).map(({ concept, owner, path, rules }) => {
    const generated = input.generated[concept] ?? { files: [], routes: [], tables: [], tests: [] };
    const text = semanticText(ir, concept);
    return {
      concept,
      summary: summary(ir, concept),
      ...(text.description ? { description: text.description } : {}),
      ...(text.intent ? { intent: text.intent } : {}),
      rules: rules.map((rule) => {
        const id = ruleId({ concept, owner, path, rules }, rule);
        return ruleInfo(id, rule.text, custom, input);
      }),
      specPath: path,
      related: related(ir, concept),
      files: generated.files.map((f) => ({ path: f.path, role: "generated", symbols: f.symbols })),
      routes: generated.routes,
      tables: generated.tables,
      tests: [...generated.tests],
    };
  });

  // Custom code: by convention (src/custom/actions/<action>.ts), by rule markers, and by
  // what it imports from generated files.
  const byPath = new Map<string, { concept: string; symbols: string[] }[]>();
  for (const c of concepts) {
    for (const f of c.files) {
      byPath.set(f.path, [
        ...(byPath.get(f.path) ?? []),
        { concept: c.concept, symbols: f.symbols },
      ]);
    }
  }
  for (const file of custom) {
    // A file gets one role per concept: the first found, strongest first.
    const add = (concept: string, role: FileRole) => {
      const target = concepts.find((c) => c.concept === concept);
      if (!target || target.files.some((f) => f.path === file.path)) return;
      target.files.push({ path: file.path, role, symbols: file.exports });
    };
    const page = /^src\/custom\/pages\/([\w-]+)\.tsx$/.exec(file.path)?.[1];
    if (page && ir.pages.some((p) => p.id === page)) add(`page:${page}`, "implements");
    const action = /^src\/custom\/actions\/([\w-]+)\.ts$/.exec(file.path)?.[1];
    if (action) {
      const match = ir.actions.find((a) => kebab(a.name) === action);
      if (match) add(`action:${match.name}`, "implements");
    }
    const query = /^src\/custom\/queries\/([\w-]+)\.ts$/.exec(file.path)?.[1];
    if (query) {
      const match = ir.queries.find((q) => kebab(q.name) === query);
      if (match) add(`query:${match.name}`, "implements");
    }
    for (const id of file.implements) add(conceptOfRule(concepts, id), "implements");
    for (const id of file.testsRules) add(conceptOfRule(concepts, id), "tests");
    for (const { path, names } of file.imports) {
      for (const owner of byPath.get(path) ?? []) {
        // A field's symbol is "table.column": the file must import the table and name the column.
        const used =
          owner.symbols.length === 0 ||
          owner.symbols.some((s) => {
            const [symbol, member] = s.split(".") as [string, string | undefined];
            return (
              names.includes(symbol) && (!member || new RegExp(`\\b${member}\\b`).test(file.text))
            );
          });
        if (used) add(owner.concept, file.isTest ? "tests" : "uses");
      }
    }
    if (file.isTest) {
      for (const c of concepts) {
        if (c.files.some((f) => f.path === file.path)) {
          for (const name of file.testNames) {
            if (!c.tests.some((t) => t.file === file.path && t.name === name))
              c.tests.push({ file: file.path, name });
          }
        }
      }
    }
  }
  return { concepts, menus: ir.navigation.map((m) => ({ name: m.name, pages: m.pages })) };
}

/** A concept by name. */
export function inspect(index: ProjectIndex, concept: string): ConceptInfo | undefined {
  return index.concepts.find((c) => c.concept === concept);
}

/** The files that implement a concept: generated code and custom code. */
export function findImplementation(index: ProjectIndex, concept: string): FileRef[] {
  return inspect(index, concept)?.files.filter((f) => f.role !== "tests") ?? [];
}

export function findTests(index: ProjectIndex, concept: string): { file: string; name: string }[] {
  return inspect(index, concept)?.tests ?? [];
}

/** The concepts a file belongs to, e.g. to explain what a file is for. */
export function conceptsAt(index: ProjectIndex, path: string): string[] {
  return index.concepts.filter((c) => c.files.some((f) => f.path === path)).map((c) => c.concept);
}

// ── Custom code ──────────────────────────────────────────────────────────────

interface CustomFile {
  path: string;
  isTest: boolean;
  text: string;
  exports: string[];
  imports: { path: string; names: string[] }[];
  /** Rule ids from `// implements rule <id>`. */
  implements: string[];
  /** Rule ids from `test("rule <id>: …")`. */
  testsRules: string[];
  testNames: string[];
}

/** Light static analysis: exported symbols, imports, rule markers and test names. */
function analyseCustom(files: SourceFile[]): CustomFile[] {
  return files.map(({ path, text }) => {
    const isTest = /\.test\.tsx?$/.test(path);
    const all = (pattern: RegExp) => [...text.matchAll(pattern)].map((m) => m[1] as string);
    return {
      path,
      text,
      isTest,
      exports: all(/export\s+(?:async\s+)?(?:function|const|let|class|type|interface)\s+(\w+)/g),
      imports: [
        // Up to the brace without a choice to back over ("import" or "import type", then "{"),
        // so a long run of spaces costs one pass; what is between is checked after.
        ...text.matchAll(/\bimport\b([^{;"']*)\{([^}]*)\}\s*from\s*["']([^"']+)["']/g),
      ]
        .filter((m) => ["", "type"].includes((m[1] as string).trim()))
        .map((m) => ({
          path: resolveImport(path, m[3] as string),
          names: (m[2] as string)
            .split(",")
            .map(
              (n) =>
                n
                  .trim()
                  .replace(/\s+/g, " ")
                  .replace(/^type /, "")
                  .split(" as ")[0] as string,
            )
            .filter(Boolean),
        })),
      implements: isTest ? [] : all(/implements rule ([\w.-]+)/g),
      testsRules: isTest ? all(/\b(?:test|it)\(\s*["'`]rule ([\w.-]+):/g) : [],
      testNames: isTest
        ? [...text.matchAll(/\b(?:test|it)\(\s*(["'`])((?:(?!\1).)+)\1/g)].map(
            (m) => m[2] as string,
          )
        : [],
    };
  });
}

/** "#/generated/order" from src/custom/x.ts → "src/generated/order.ts". */
function resolveImport(from: string, specifier: string): string {
  let path: string;
  if (specifier.startsWith("#/")) path = `src/${specifier.slice(2)}`;
  else if (specifier.startsWith(".")) {
    const parts = from.split("/").slice(0, -1);
    for (const part of specifier.split("/")) {
      if (part === "..") parts.pop();
      else if (part !== ".") parts.push(part);
    }
    path = parts.join("/");
  } else return specifier;
  return /\.tsx?$/.test(path) ? path : `${path}.ts`;
}

function conceptOfRule(concepts: ConceptInfo[], id: string): string {
  return concepts.find((c) => c.rules.some((r) => r.id === id))?.concept ?? "";
}

function ruleInfo(
  id: string | undefined,
  text: string,
  custom: CustomFile[],
  input: IndexInput,
): RuleInfo {
  const implementedIn = id
    ? custom.filter((f) => f.implements.includes(id)).map((f) => f.path)
    : [];
  const testedIn = id ? custom.filter((f) => f.testsRules.includes(id)).map((f) => f.path) : [];
  const status: RuleStatus = (() => {
    if (!id || implementedIn.length === 0) return "not-implemented";
    const baseline = input.ruleBaseline?.[id];
    if (baseline && baseline !== hashRule(text)) return "changed";
    if (testedIn.length === 0) return "untested";
    const outcomes = (input.testResults ?? []).filter((r) => r.title.startsWith(`rule ${id}:`));
    if (outcomes.length === 0) return "not-run";
    return outcomes.every((r) => r.passed) ? "tested" : "failing";
  })();
  return { ...(id ? { id } : {}), text, status, implementedIn, testedIn };
}

// ── Semantics ────────────────────────────────────────────────────────────────

function semanticText(ir: SpecIR, concept: string): SemanticText {
  const [kind, name = ""] = concept.split(":");
  const [model, field] = name.split(".");
  switch (kind) {
    case "app":
      return ir.app;
    case "model":
      return ir.models.find((m) => m.name === name) ?? {};
    case "field":
      return ir.models.find((m) => m.name === model)?.fields.find((f) => f.name === field) ?? {};
    case "action":
      return ir.actions.find((a) => a.name === name) ?? {};
    case "query":
      return ir.queries.find((q) => q.name === name) ?? {};
    case "page":
      return ir.pages.find((p) => p.id === name) ?? {};
    default:
      return {};
  }
}

/** A field as written in the spec's shorthand, plus what makes it special. */
function fieldSummary(field: FieldIR): string {
  const type = field.type.kind === "choice" ? field.type.values.join(" | ") : typeKey(field.type);
  const parts = [`${type}${field.required && field.type.kind !== "choice" ? "!" : ""}`];
  if (field.unique) parts.push("unique");
  if (field.default !== undefined) parts.push(`= ${field.default}`);
  if (field.defaultFormula) parts.push(`= ${formatFormula(field.defaultFormula)}`);
  if (field.formula) parts.push(`computed: ${formatFormula(field.formula)}`);
  return parts.join(" ");
}

function summary(ir: SpecIR, concept: string): string {
  const [kind, name = ""] = concept.split(":");
  const [modelName, fieldName] = name.split(".");
  switch (kind) {
    case "app":
      return `App ${ir.app.name}: ${ir.models.length} models, ${ir.pages.length} pages, ${ir.actions.length} actions`;
    case "model": {
      const model = ir.models.find((m) => m.name === name);
      if (!model) return "";
      const extra = [model.ownedBy ? `owned by ${model.ownedBy}` : ""].filter(Boolean);
      return `Model ${name} { ${model.fields.map((f) => `${f.name}: ${fieldSummary(f)}`).join(", ")} }${extra.length ? `; ${extra.join("; ")}` : ""}`;
    }
    case "field": {
      const field = ir.models
        .find((m) => m.name === modelName)
        ?.fields.find((f) => f.name === fieldName);
      return field ? `Field ${name}: ${fieldSummary(field)}` : "";
    }
    case "action": {
      const action = ir.actions.find((a) => a.name === name);
      if (!action) return "";
      const list = (fields: FieldIR[]) =>
        fields.map((f) => `${f.name}: ${fieldSummary(f)}`).join(", ");
      return `Custom action ${name}(${list(action.input)})${action.output ? ` → { ${list(action.output)} }` : ""}`;
    }
    case "query": {
      const query = ir.queries.find((q) => q.name === name);
      return query
        ? `Custom query ${name}: returns ${query.returns} records, chosen and ordered by code`
        : "";
    }
    case "page": {
      const page = ir.pages.find((p) => p.id === name);
      if (!page) return "";
      const pattern = (PAGE_WORDS[page.pattern.kind] as (p: PageIR["pattern"]) => string)(
        page.pattern,
      );
      return `Page ${name} at ${page.route}: ${pattern}${page.actions ? `; actions ${page.actions.join(", ")}` : ""}`;
    }
    default:
      return "";
  }
}

function related(ir: SpecIR, concept: string): string[] {
  const [kind, name = ""] = concept.split(":");
  switch (kind) {
    case "model": {
      const model = ir.models.find((m) => m.name === name);
      const refs = (model?.fields ?? []).flatMap((f) =>
        f.type.kind === "relation" && f.type.model !== "User" ? [`model:${f.type.model}`] : [],
      );
      const pages = ir.pages.filter((p) => pageModels(p).includes(name)).map((p) => `page:${p.id}`);
      return [...new Set([...refs, ...pages])];
    }
    case "field":
      return [`model:${name.split(".")[0]}`];
    case "action": {
      const action = ir.actions.find((a) => a.name === name);
      const models = (action?.input ?? []).flatMap((f) =>
        f.type.kind === "relation" && f.type.model !== "User" ? [`model:${f.type.model}`] : [],
      );
      const pages = ir.pages.filter((p) => p.actions?.includes(name)).map((p) => `page:${p.id}`);
      return [...new Set([...models, ...pages])];
    }
    case "query": {
      const query = ir.queries.find((q) => q.name === name);
      const pages = ir.pages
        .filter((p) => patternInfo(p).queries().includes(name))
        .map((p) => `page:${p.id}`);
      return [...(query ? [`model:${query.returns}`] : []), ...pages];
    }
    case "page": {
      const page = ir.pages.find((p) => p.id === name);
      return page
        ? [
            ...pageModels(page).map((m) => `model:${m}`),
            ...(page.actions ?? []).map((a) => `action:${a}`),
          ]
        : [];
    }
    default:
      return [];
  }
}

/** Each page pattern in the index's words. */
const PAGE_WORDS: { [K in PatternKind]: (pattern: PatternOf<K>) => string } = {
  custom: (p) => `custom page: the project's own component ${p.component} in src/custom/pages/`,
  legal: () =>
    "privacy page written from the app: operator, stored personal data, cookies, mail, logs, rights",
  crud: (p) => `list, view, create, edit and delete ${p.model}`,
  landing: (p) => `landing page with ${p.sections.map((s) => s.name).join(", ")}`,
  dashboard: (p) => `dashboard with ${p.items.map((i) => i.name).join(", ")}`,
  settings: (p) => `settings: the viewer's ${p.model} record`,
  onboarding: (p) =>
    `onboarding: fills the viewer's ${p.model} record in steps ${p.steps.map((s) => s.name).join(", ")}`,
  users: () => "users: invite people by email with a role, change roles, remove users",
  calendar: (p) =>
    `calendar of ${p.model} placed by ${p.starts}${p.ends ? ` to ${p.ends}` : p.duration ? ` for ${p.duration} minutes` : ""}`,
  order: (p) =>
    `order page: visitors choose ${p.from} (price ${p.price}) and send one ${p.into} numbered by ${p.number}, its ${p.lines} of ${p.line}; asks ${p.ask.join(", ") || "nothing"}`,
  articles: (p) =>
    `articles of ${p.model}: ${p.title} and ${p.body}${p.picture ? `, ${p.picture}` : ""}${p.date ? `, by ${p.date}` : ""}${p.address ? `, at ${p.address}` : ""}`,
  data: (p) =>
    `data: ${p.all ? "every model" : p.models.join(", ")}, their records to find, open, change and delete`,
  review: (p) =>
    `review: the waiting pictures and files of ${p.all ? "every reviewed model" : p.models.join(", ")}, to approve or reject`,
  calculator: (p) =>
    `calculator: ${p.calculator.fields
      .filter((f) => !f.formula)
      .map((f) => f.name)
      .join(", ")} give ${p.calculator.fields
      .filter((f) => f.formula)
      .map((f) => f.name)
      .join(", ")}`,
};
