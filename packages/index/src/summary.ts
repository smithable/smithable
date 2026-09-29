import {
  type AuthIR,
  type ContentIR,
  emptyContent,
  type FieldIR,
  humanize,
  type ModelIR,
  type PageIR,
  type PatternKind,
  type PatternOf,
  pageModel,
  plural,
  type SpecIR,
  type SpecPlugin,
  USER_MODEL,
} from "@smithable/core";
import { formulaInWords } from "./formula-words.js";

/** One part of the plain-language summary, e.g. a model or the pages. */
export interface SummarySection {
  /** The concept it describes, e.g. "model:Customer", for linking to it. */
  concept: string;
  title: string;
  sentences: string[];
  /** A model's list of fields, item by item ("a phone (a phone number)"), and their fields. */
  fields?: { field: string; label: string; text: string }[];
}

/** What a field holds, where its name does not say it; plain text needs no note. */
export const KINDS: Record<string, string> = {
  int: "a whole number",
  decimal: "a number",
  money: "an amount",
  bool: "yes or no",
  date: "a date",
  datetime: "a date and time",
  email: "an email address",
  phone: "a phone number",
  url: "a web address",
};

const VERBS = { read: "see", create: "add", write: "change", delete: "delete" };

/**
 * The spec in plain language for the Builder (ARCHITECTURE §10.1): what the app stores, who
 * may do what, its pages and sign-in. Deterministic and free: no AI involved.
 */
export function summarize(
  ir: SpecIR,
  auth?: AuthIR,
  content: ContentIR = emptyContent(),
  plugins: readonly SpecPlugin[] = [],
): SummarySection[] {
  const { label, pluralLabel, fieldLabel, modelNamed, words, item } = wordsFor(ir, content);

  const sections: SummarySection[] = [];
  if (ir.app.description) {
    sections.push({ concept: "app", title: ir.app.name, sentences: [ir.app.description] });
  }

  for (const model of ir.models) {
    const isOwnValue = (f: FieldIR) =>
      !f.formula && !(f.type.kind === "relation" && (f.type.many || f.type.model === USER_MODEL));
    const own = model.fields.filter(isOwnValue);
    const parts = own.map((f) => item(model, f));
    const one = label(model).toLowerCase();
    // The fields as a list, one per line, which is also how they are edited.
    const sentences = parts.length
      ? [`${pluralLabel(model)} have:`, ...parts.map((p) => `- ${p}`)]
      : [];
    for (const f of model.fields) {
      if (f.type.kind === "relation" && f.type.model === USER_MODEL) {
        sentences.push(`Each ${one} can have ${article(fieldLabel(model, f))} (a user).`);
      } else if (f.type.kind === "relation" && f.type.many) {
        const target = modelNamed(f.type.model);
        if (target) sentences.push(`Each ${one} lists its ${pluralLabel(target).toLowerCase()}.`);
      } else if (f.formula) {
        sentences.push(`The ${fieldLabel(model, f)} is calculated as ${words(model, f.formula)}.`);
      }
    }
    const owner = model.fields.find((f) => f.name === model.ownedBy);
    if (owner) sentences.push(`The ${fieldLabel(model, owner)} owns the ${one}.`);
    for (const [op, roles] of Object.entries(model.access ?? {})) {
      const verb = VERBS[op as keyof typeof VERBS];
      sentences.push(`Only ${who(roles)} can ${verb} ${pluralLabel(model).toLowerCase()}.`);
    }
    for (const rule of model.rules ?? []) sentences.push(`Rule: ${rule.text}`);
    sections.push({
      concept: `model:${model.name}`,
      title: pluralLabel(model),
      sentences,
      fields: own.map((f, i) => ({
        field: f.name,
        label: fieldLabel(model, f),
        text: parts[i] as string,
      })),
    });
  }

  if (ir.pages.length) {
    const pages = ir.pages.map((p) => {
      const crud = pageModel(p);
      const model = crud === undefined ? undefined : modelNamed(crud);
      const title = content.pages[p.id]?.title ?? humanize(p.id);
      const searched = (p.search ?? []).map((name) => {
        const field = model?.fields.find((f) => f.name === name);
        return model && field ? fieldLabel(model, field) : name;
      });
      const notes = [
        model ? `lists ${pluralLabel(model).toLowerCase()}` : "",
        (PATTERN_WORDS[p.pattern.kind] as (p: PageIR["pattern"]) => string)(p.pattern),
        searched.length ? `search by ${list(searched, "or")}` : "",
        ...(p.actions ?? []).map((a) => `“${humanize(a)}”`),
        p.access ? `only for ${who(p.access)}` : "",
      ].filter(Boolean);
      return `${title} (${notes.join("; ")})`;
    });
    sections.push({ concept: "pages", title: "Pages", sentences: pages.map((p) => `- ${p}`) });
  }

  for (const action of ir.actions) {
    sections.push({
      concept: `action:${action.name}`,
      title: humanize(action.name),
      sentences: [
        action.intent ?? action.description ?? "Custom code.",
        ...(action.allow ? [`Only ${who(action.allow)} can use it.`] : []),
        ...(action.rules ?? []).map((r) => `Rule: ${r.text}`),
      ],
    });
  }

  for (const query of ir.queries) {
    const model = modelNamed(query.returns);
    sections.push({
      concept: `query:${query.name}`,
      title: humanize(query.name),
      sentences: [
        `${query.intent ?? query.description ?? "Chosen by custom code."} (${model ? pluralLabel(model).toLowerCase() : query.returns})`,
        ...(query.rules ?? []).map((r) => `Rule: ${r.text}`),
      ],
    });
  }

  // A plugin's section, in its own words.
  for (const plugin of plugins) {
    const value = ir.extensions?.[plugin.key];
    const sentences = value === undefined ? [] : (plugin.summarize?.(value) ?? []);
    if (sentences.length)
      sections.push({ concept: `plugin:${plugin.key}`, title: humanize(plugin.key), sentences });
  }

  if (auth)
    sections.push({ concept: "auth", title: "Sign-in and access", sentences: access(auth) });
  return sections;
}

/** The summary's words for models and fields, with the labels from the content file. */
export function wordsFor(ir: SpecIR, content: ContentIR = emptyContent()) {
  const label = (m: ModelIR) => content.models[m.name]?.label ?? humanize(m.name);
  const pluralLabel = (m: ModelIR) => {
    const own = content.models[m.name];
    return own?.pluralLabel ?? (own?.label ? plural(own.label) : humanize(plural(m.name)));
  };
  const fieldLabel = (m: ModelIR, f: FieldIR) =>
    lower(content.models[m.name]?.fields[f.name]?.label ?? humanize(f.name));
  const choice = (m: ModelIR, f: FieldIR, value: string) =>
    (content.models[m.name]?.fields[f.name]?.values?.[value] ?? humanize(value)).toLowerCase();
  const modelNamed = (name: string) => ir.models.find((m) => m.name === name);
  // A formula's field in words: this model's own, or one of a related model's.
  const words = (model: ModelIR, expr: Parameters<typeof formulaInWords>[0]) =>
    formulaInWords(expr, (name) => {
      const own = model.fields.find((f) => f.name === name);
      if (own) return fieldLabel(model, own);
      for (const m of ir.models) {
        const f = m.fields.find((x) => x.name === name);
        if (f) return fieldLabel(m, f);
      }
      return humanize(name).toLowerCase();
    });
  /** A field as one line of its model's list, e.g. "a phone (a phone number, required)". */
  const item = (model: ModelIR, f: FieldIR) => {
    const name = fieldLabel(model, f);
    const notes: string[] = [];
    if (f.type.kind === "choice") {
      notes.push(
        list(
          f.type.values.map((v) => choice(model, f, v)),
          "or",
        ),
      );
      if (f.default !== undefined) notes.push(`${choice(model, f, String(f.default))} by default`);
    } else if (f.type.kind === "relation") {
      const target = modelNamed(f.type.model);
      if (target) notes.push(article(label(target).toLowerCase()));
    } else if (KINDS[f.type.name] && !name.includes(f.type.name)) {
      notes.push(KINDS[f.type.name] as string);
    }
    if (f.required && f.type.kind !== "choice") notes.push("required");
    if (f.unique) notes.push("unique");
    if (f.default !== undefined && f.type.kind !== "choice") notes.push(`${f.default} by default`);
    if (f.defaultFormula) notes.push(`${words(model, f.defaultFormula)} by default`);
    // "notes" and "issued on" read better without "a".
    const named = /s$| (on|at)$/.test(name) ? name : article(name);
    return notes.length ? `${named} (${notes.join(", ")})` : named;
  };
  return { label, pluralLabel, fieldLabel, modelNamed, words, item };
}

function access(auth: AuthIR): string[] {
  const sentences: string[] = [];
  if (auth.signIn === "none") {
    sentences.push("Nobody signs in: only public pages can be used.");
  } else {
    const domains = auth.signIn.allowedDomains;
    sentences.push(
      `People sign in with ${list(auth.signIn.providers.map(humanize), "or")}${domains ? `, only with ${list(domains, "or")} accounts` : ""}.`,
    );
    sentences.push(
      auth.defaultAccess === "shared"
        ? "Everyone who signs in sees all records, and changes and deletes the ones they own."
        : "Everyone sees and changes only their own records.",
    );
    sentences.push("Roles:");
    for (const r of auth.roles)
      sentences.push(
        `- ${r.description ? `${r.name} (${r.description.replace(/\.$/, "")})` : r.name}`,
      );
    sentences.push(`New users get the ${auth.defaultRole} role.`);
  }
  const open = [
    ...auth.public.pages.map((p) => `the ${humanize(p).toLowerCase()} page`),
    ...auth.public.read.map((m) => `reading ${humanize(plural(m)).toLowerCase()}`),
    ...auth.public.create.map((m) => `adding ${humanize(plural(m)).toLowerCase()}`),
  ];
  if (open.length) sentences.push(`Open to anyone without signing in: ${list(open)}.`);
  return sentences;
}

/** Common abbreviations stay in capitals when a label is lowercased: "a VAT number". */
const ACRONYMS = new Set([
  "vat",
  "iban",
  "bic",
  "id",
  "url",
  "sku",
  "ean",
  "pin",
  "api",
  "faq",
  "pdf",
  "gps",
]);

/** A label inside a sentence: lowercase, except abbreviations. */
function lower(label: string): string {
  return label
    .split(" ")
    .map((w) =>
      ACRONYMS.has(w.toLowerCase()) || /^[A-Z0-9]{2,}$/.test(w) ? w.toUpperCase() : w.toLowerCase(),
    )
    .join(" ");
}

/** Who a list of roles means; admins can always do everything, so they come last. */
export function who(roles: string[]): string {
  const others = roles
    .filter((r) => r !== "admin")
    .map((r) => (r === "owner" ? "the owner" : `${r} users`));
  return list([...others, "admins"]);
}

function list(items: string[], last = "and"): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${last} ${items.at(-1)}`;
}

function article(word: string): string {
  // "a unit price", "a user": a "u" that sounds like "you" takes "a".
  return `${/^[aeiou]/i.test(word) && !/^u(ni|s[eu])/i.test(word) ? "an" : "a"} ${word}`;
}

/** What each page pattern is, in the summary's words (a crud page says what it lists instead). */
const PATTERN_WORDS: { [K in PatternKind]: (pattern: PatternOf<K>) => string } = {
  crud: () => "",
  landing: (p) => `a landing page: ${list(p.sections.map((s) => humanize(s.name).toLowerCase()))}`,
  dashboard: (p) => `a dashboard: ${list(p.items.map((i) => humanize(i.name).toLowerCase()))}`,
  settings: (p) => `settings: edits your ${humanize(p.model).toLowerCase()}`,
  onboarding: (p) =>
    `a first-time setup of your ${humanize(p.model).toLowerCase()} in ${p.steps.length} steps`,
  users: () => "who has access: invite people, change roles, remove users",
};
