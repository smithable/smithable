// Tier 0 of the AI routing (ARCHITECTURE §9.2): requests worded like the everyday changes
// ("Customers should have a phone number", "Only admins may delete customers", "Show orders
// first in the menu") become operations without a model, in milliseconds and offline. The
// grammar is deliberately narrow: it answers only when every name in the request resolves
// to exactly one concept, and returns undefined for anything else, which a model then reads.
// Like every proposal, what it returns is dry-run and confirmed before it applies.
import {
  type AuthIR,
  type FieldIR,
  filterable,
  identifier,
  isUpload,
  kebab,
  type ModelIR,
  type PageIR,
  pageModel,
  patternInfo,
  type RoleGrants,
  type SpecIR,
  sortableBy,
  USER_MODEL,
} from "@smithable/core";
import { KINDS } from "./summary.js";

export interface PhraseOperation {
  op: string;
  args: Record<string, unknown>;
}

export interface PhraseMatch {
  operations: PhraseOperation[];
  /** Which wording matched, for the change trace and for tests. */
  rule: string;
}

/**
 * A request the rules read fully and cannot make as asked (the field is there already, no field
 * has that name): why, said to the person instead of sent to a model that would meet the same.
 */
export interface PhraseRefusal {
  refusal: string;
  rule: string;
}

/**
 * The operations a request means when it is worded like one of the common changes, or
 * undefined when it is not, or when a name in it does not resolve to exactly one concept.
 * `roles` are the roles of smithable.auth.yml (needed for access requests).
 */
export function matchRequest(
  ir: SpecIR,
  request: string,
  roles: string[] = [],
  auth?: AuthIR,
): PhraseMatch | undefined {
  const read = readRequest(ir, request, roles, auth);
  return read && "operations" in read ? read : undefined;
}

/** Why a request the rules read cannot be made as asked, when that is so. */
export function refusalOf(
  ir: SpecIR,
  request: string,
  roles: string[] = [],
  auth?: AuthIR,
): PhraseRefusal | undefined {
  const read = readRequest(ir, request, roles, auth);
  return read && "refusal" in read ? read : undefined;
}

function readRequest(
  ir: SpecIR,
  request: string,
  roles: string[],
  auth?: AuthIR,
): PhraseMatch | PhraseRefusal | undefined {
  const text = normalize(request);
  if (!text) return undefined;
  for (const rule of RULES) {
    const result = rule.match(text, { ir, roles, auth });
    if (Array.isArray(result)) return { operations: result, rule: rule.name };
    // Read, and it cannot be done as asked: the reason, in words the person can act on.
    if (result) return { refusal: result.refusal, rule: rule.name };
    // The wording was this rule's, but a name in it did not resolve: a model should read it,
    // not a looser rule below.
    if (result === null) return undefined;
  }
  return undefined;
}

interface Scope {
  ir: SpecIR;
  roles: string[];
  /** smithable.auth.yml, when the caller has it (sign-up requests need it). */
  auth?: AuthIR;
}

interface Rule {
  name: string;
  /**
   * Operations; undefined when the wording is not this rule's; null when it is, but a name in it
   * does not resolve (a model reads it); a refusal when it was read and cannot be done as asked.
   */
  match(text: string, scope: Scope): PhraseOperation[] | { refusal: string } | undefined | null;
}

/** Lowercase, one space between words, no final punctuation, and the polite openers gone. */
export function normalize(request: string): string {
  let text = request.trim().toLowerCase();
  // The final punctuation, however much of it (not a regex: `[.!?]+$` backtracks per character).
  let end = text.length;
  while (end > 0 && ".!?".includes(text[end - 1] as string)) end -= 1;
  text = text.slice(0, end).replace(/\s+/g, " ");
  for (;;) {
    const shorter = text.replace(OPENERS, "").trim();
    if (shorter === text) break;
    text = shorter;
  }
  return text.replace(/^(?:please|also|and) /, "").trim();
}

const OPENERS =
  /^(?:please|let me|let us|allow me to|help me|i need to|i need|we would like to|we'd like to|can you|could you|would you|i want to|i want|i would like to|i'd like to|we want to|we need to|we want|we need|let's|lets|make it possible to|it should be possible to|make sure that|make sure) /;

/** A name as words ("placedAt" → "placed at"), and a text as a sentence starts. */
const words = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
const sentence = (text: string) => (text[0]?.toUpperCase() ?? "") + text.slice(1);

const ARTICLE = /^(?:a|an|the|each|every|all|our|its|their|any) /;
export const dropArticles = (s: string) => {
  let out = s.trim();
  for (;;) {
    const next = out.replace(ARTICLE, "");
    if (next === out) return out;
    out = next;
  }
};

const singular = (w: string) =>
  w.endsWith("ies") && w.length > 4
    ? `${w.slice(0, -3)}y`
    : /(?:ses|xes|ches|shes)$/.test(w)
      ? w.slice(0, -2)
      : w.endsWith("s") && !w.endsWith("ss")
        ? w.slice(0, -1)
        : w;

const plural = (w: string) =>
  /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : /(?:s|x|ch|sh)$/.test(w) ? `${w}es` : `${w}s`;

/** British spellings people type, in the US spelling names are written in. */
const american = (w: string) =>
  w
    .replace(/^catalogue$/, "catalog")
    .replace(/^colour/, "color")
    .replace(/^favourite/, "favorite");

/** The words of a name or phrase, lowercased, singular and US-spelled: "ClassTypes" → "class type". */
const key = (s: string) =>
  kebab(dropArticles(s)).split("-").filter(Boolean).map(singular).map(american).join(" ");

/** "in progress" → "inProgress", for a value or a name said in words, as said (no singular). */
const camel = (s: string) => identifier(dropArticles(s).trim());

/**
 * The model an app's own verb makes a record of: "book" a class is adding a Booking, "order" an
 * Order, "register" a Registration, "apply" an Application ("who can book a class?", the stranger
 * walk). The verb's stems against the models' names; undefined when none fits.
 */
export function modelByVerb(ir: SpecIR, verb: string): ModelIR | undefined {
  const v = verb.toLowerCase().replace(/ing$|ed$|s$/, "");
  const stems = [v, `${v}e`, v.replace(/e$/, ""), v.replace(/y$/, "i")];
  return ir.models.find((m) => {
    const k = key(m.name).replace(/ /g, "");
    return stems.some(
      (s) =>
        s.length >= 3 &&
        (k === s ||
          k.startsWith(`${s}ing`) ||
          k.startsWith(`${s}ation`) ||
          k.startsWith(`${s}ment`) ||
          k === `${s}er` ||
          k === `${s}r`),
    );
  });
}

/** The one model a phrase names ("customers", "each class type"), or undefined. */
export function modelFor(ir: SpecIR, phrase: string): ModelIR | undefined {
  const wanted = key(phrase.replace(/\b(?:record|records|entry|entries|model)$/, ""));
  if (!wanted) return undefined;
  const found = ir.models.filter((m) => key(m.name) === wanted);
  return found.length === 1 ? found[0] : undefined;
}

/** A field of `model` by name or by the words of its label: "phone number" finds `phone`. */
export function fieldFor(model: ModelIR, phrase: string): FieldIR | undefined {
  const wanted = key(phrase.replace(/ field$/, ""));
  if (!wanted) return undefined;
  const exact = model.fields.filter((f) => key(f.name) === wanted);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return undefined;
  // "phone number" is the phone field, "email address" the email; only when that is unique.
  const trimmed = wanted.replace(/ (?:number|address|field)$/, "");
  const loose = model.fields.filter(
    (f) =>
      key(f.name) === trimmed ||
      (f.type.kind === "scalar" && key(KINDS[f.type.name] ?? "") === wanted),
  );
  return loose.length === 1 ? loose[0] : undefined;
}

/** A field named without its model: the one field of that name across all models. */
export function fieldAnywhere(
  ir: SpecIR,
  phrase: string,
): { model: ModelIR; field: FieldIR } | undefined {
  const found = ir.models.flatMap((model) => {
    const field = fieldFor(model, phrase);
    return field ? [{ model, field }] : [];
  });
  return found.length === 1 ? found[0] : undefined;
}

/** A page by its name ("customers", "the class types page") or as the list of a model. */
export function pageFor(ir: SpecIR, phrase: string): PageIR | undefined {
  const wanted = key(phrase.replace(/ (?:page|list|screen)$/, ""));
  if (!wanted) return undefined;
  const byName = ir.pages.filter((p) => key(p.id) === wanted);
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) return undefined;
  const model = modelFor(ir, phrase.replace(/ (?:page|list|screen)$/, ""));
  const byModel = model
    ? ir.pages.filter((p) => p.pattern.kind === "crud" && p.pattern.model === model.name)
    : [];
  if (byModel.length <= 1) return byModel[0];
  // Several lists of the model (a catalog, my items, saved ones): the one at "/", else the
  // one named after the model, else the only one that is not the viewer's own or saved records.
  // key() is singular: "items" and "item" both name the Item model's page.
  const named = key(model?.name ?? "");
  const everyone = byModel.filter((p) => !p.mine && p.favorites !== "only");
  return (
    byModel.find((p) => p.route === "/") ??
    byModel.find((p) => key(p.id) === named) ??
    (everyone.length === 1 ? everyone[0] : undefined)
  );
}

/** The field's type as the spec writes it, or undefined for a field shorthand cannot express. */
function shorthand(
  field: FieldIR,
  changes: Partial<Pick<FieldIR, "required" | "unique">> = {},
): string | undefined {
  if (field.formula || field.defaultFormula) return undefined;
  const required = changes.required ?? field.required;
  const unique = changes.unique ?? field.unique;
  let type: string;
  // A choice is required by its default and a list of records is never required: a model
  // should read what "required" means for them.
  if (field.type.kind === "scalar") type = field.type.name;
  else if (field.type.kind === "relation" && !field.type.many) type = field.type.model;
  else return undefined;
  const value = field.default;
  const suffix =
    value === undefined
      ? ""
      : typeof value === "string" && !/^[\w-]+$/.test(value)
        ? undefined
        : ` = ${String(value)}`;
  if (suffix === undefined) return undefined;
  return `${type}${required ? "!" : ""}${unique ? " unique" : ""}${suffix}`;
}

interface NewField {
  name: string;
  type: string;
}

/** What "a phone number", "a delivery date" or "a total amount" means as a new field. */
function newField(phrase: string, scope: Scope, requiredByDefault = false): NewField | undefined {
  let text = dropArticles(phrase.replace(/\((.*?)\)/g, " $1 ").replace(/\s+/g, " "));
  let required = requiredByDefault;
  const flag = (re: RegExp, value: boolean) => {
    if (re.test(text)) {
      text = text.replace(re, " ").replace(/\s+/g, " ").trim();
      required = value;
    }
  };
  flag(/\b(?:required|mandatory|which must be filled in|that must be filled in)\b/, true);
  flag(/\b(?:optional|not required)\b/, false);
  // "a VAT number field", "a status column": the word names what it is, not the field.
  text = dropArticles(text)
    .replace(/^(?:new )?(?:field|column) (?:called|named) /, "")
    .replace(/(\S)\s+(?:field|column)$/, "$1");
  if (!text) return undefined;
  // "belongs to a customer", "linked to a customer", "for a customer": a reference.
  const reference = /^(?:belongs to|linked to|refers to|references|assigned to|for|of) (.+)$/.exec(
    text,
  );
  if (reference?.[1]) {
    const target = modelFor(scope.ir, reference[1]);
    if (!target) return undefined;
    const name = identifier(key(reference[1]));
    return { name, type: `${target.name}${required ? "!" : ""}` };
  }
  const list = /^(?:a list of|many|several|its) (.+)$/.exec(text);
  if (list?.[1]) {
    const target = modelFor(scope.ir, list[1]);
    if (!target) return undefined;
    return { name: identifier(plural(key(list[1]))), type: `${target.name}[]` };
  }
  const kind = inferKind(text);
  if (!kind) return undefined;
  const name = identifier(kind.name);
  if (!name) return undefined;
  return { name, type: `${kind.type}${required ? "!" : ""}` };
}

/** The scalar type a phrase implies and the words that name the field. */
function inferKind(text: string): { type: string; name: string } | undefined {
  const exact = Object.entries(KINDS).find(
    ([type, phrase]) => type !== "decimal" && key(phrase) === key(text),
  );
  if (exact) {
    const [type] = exact;
    return { type, name: KIND_NAMES[type] ?? type };
  }
  const rules: [RegExp, string, (m: RegExpExecArray) => string][] = [
    [/^(.*?)\s*\b(?:e-?mail(?: address)?)$/, "email", (m) => (m[1] ? `${m[1]} email` : "email")],
    [
      /^(.*?)\s*\b(?:phone(?: number)?|telephone(?: number)?|mobile(?: number)?)$/,
      "phone",
      // "A mobile number" beside a phone is its own field, named as it was asked for.
      (m) => {
        const what = /mobile/.test(m[0]) ? "mobile" : "phone";
        return m[1] ? `${m[1]} ${what}` : what;
      },
    ],
    [
      /^(.*?)\s*\b(?:website|web address|url|homepage|home page|link)$/,
      "url",
      (m) => (m[1] ? `${m[1]} url` : "website"),
    ],
    [/^(.*?)\s*\b(?:date|day|deadline|birthday)$/, "date", (m) => m[0]],
    [
      /^(.*?)\s*\b(?:time|timestamp|date and time)$/,
      "datetime",
      (m) => m[0].replace("date and time", "at"),
    ],
    [
      /^(.*?)\s*\b(?:amount|price|cost|total|fee|salary|budget|balance|sum)$/,
      "money",
      (m) => (m[1] ? m[1] : m[0]),
    ],
    [/^(?:number of|count of|how many) (.+)$/, "int", (m) => `${m[1]} count`],
    // "number" alone ("an order number", "a VAT number") is an identifier, so a string below.
    [/^(.*?)\s*\b(?:count|quantity|age|capacity|year)$/, "int", (m) => m[0]],
    [
      /^(.*?)\s*\b(?:percentage|percent|rate|weight|height|length|width|score|rating)$/,
      "decimal",
      (m) => m[0],
    ],
    [
      /^(.*?)\s*\b(?:notes?|description|comments?|remarks?|summary|bio|details|text)$/,
      "text",
      (m) => m[0],
    ],
    // A grade with its usual steps; a status needs its own values (below).
    [/^(.*?)\s*\b(?:severity)$/, "low | medium | high", (m) => m[0]],
    [/^(.*?)\s*\b(?:priority)$/, "low | normal | high", (m) => m[0]],
    [/^(?:whether|if) (.+)$/, "bool", (m) => m[1] ?? m[0]],
    [/^(?:is|has) (.+)$/, "bool", (m) => m[0]],
    [/^(.*?)\s*\b(?:flag|yes or no)$/, "bool", (m) => m[1] || m[0] || ""],
  ];
  for (const [re, type, name] of rules) {
    const m = re.exec(text);
    if (m) {
      const n = name(m).trim();
      // "a total amount" is the money field `total`; "an amount" alone is `amount`.
      return { type, name: n || text };
    }
  }
  // A plain noun phrase is a short text: "a nickname", "a reference".
  return /^[a-z][a-z' -]*$/.test(text) && text.split(" ").length <= 3
    ? { type: "string", name: text }
    : undefined;
}

const KIND_NAMES: Record<string, string> = {
  int: "number",
  decimal: "value",
  money: "amount",
  bool: "flag",
  date: "date",
  datetime: "dateTime",
  email: "email",
  phone: "phone",
  url: "website",
};

const ROLE_VERBS: Record<string, "read" | "create" | "write" | "delete"> = {
  delete: "delete",
  remove: "delete",
  change: "write",
  edit: "write",
  update: "write",
  modify: "write",
  add: "create",
  create: "create",
  see: "read",
  view: "read",
  read: "read",
};

/** "delete", "deleting" and "deletion" are the same access operation. */
export function verbOf(word: string): "read" | "create" | "write" | "delete" | undefined {
  for (const form of [
    word,
    word.replace(/ing$/, ""),
    word.replace(/ing$/, "e"),
    word.replace(/ion$/, "e"),
  ]) {
    const verb = ROLE_VERBS[form];
    if (verb) return verb;
  }
  return undefined;
}

/** "admins", "admins and sales", "the owner" → role names, or undefined if one is unknown. */
/**
 * The grants that give `roles` the key on `name` and, with `only`, take it from every other
 * role: one operation per role whose list changes. A role's "all" is spelled out as the names
 * it keeps. Nothing when every list is as asked already.
 */
function grantsFor(
  scope: Scope,
  key: "pages" | "read" | "create" | "write" | "delete",
  name: string,
  roles: string[],
  only: boolean,
): PhraseOperation[] {
  const auth = scope.auth as AuthIR;
  const every =
    key === "pages"
      ? scope.ir.pages.filter((p) => !patternInfo(p).access).map((p) => p.id)
      : scope.ir.models.map((m) => m.name);
  const ops: PhraseOperation[] = [];
  for (const role of auth.roles) {
    if (role.name === "admin") continue;
    const wanted = roles.includes(role.name);
    if (!wanted && !only) continue;
    const whole = role.grants === "all" || role.grants[key] === "all";
    const now = whole ? every : [...((role.grants as RoleGrants)[key] ?? [])];
    const has = now.includes(name);
    if (has === wanted) continue;
    const next = wanted ? [...now, name] : now.filter((n) => n !== name);
    const names =
      next.length === every.length && every.every((n) => next.includes(n)) ? ["all"] : next;
    ops.push({ op: "grant", args: { role: role.name, what: key, names } });
  }
  return ops;
}

function rolesFor(phrase: string, scope: Scope): string[] | undefined {
  const names = dropArticles(phrase)
    .split(/,| and | or /)
    .map((r) =>
      dropArticles(r)
        .replace(/ users?$| roles?$/, "")
        .trim(),
    )
    .filter(Boolean);
  if (names.length === 0) return undefined;
  const out: string[] = [];
  for (const n of names) {
    if (n === "owner" || n === "owners" || n === "record owner") {
      out.push("owner");
      continue;
    }
    const role = scope.roles.find((r) => r.toLowerCase() === n || r.toLowerCase() === singular(n));
    if (!role) return undefined;
    out.push(role);
  }
  return out;
}

const list = (s: string) =>
  s
    .split(/,| and /)
    .map((x) => dropArticles(x))
    .filter(Boolean);

const menuFor = (scope: Scope, name?: string) => {
  const menus = scope.ir.navigation;
  if (name) return menus.find((m) => m.name === key(name).replace(/ /g, ""));
  return menus.length === 1 ? menus[0] : menus.find((m) => m.name === "main");
};

/** "9", "9:30", "17.00" as minutes after midnight; undefined if not a time of day. */
function clockOf(text: string): number | undefined {
  const m = /^(\d{1,2})(?:[:.]([0-5]\d))?$/.exec(text);
  if (!m) return undefined;
  const minutes = Number(m[1]) * 60 + Number(m[2] ?? 0);
  return minutes <= 24 * 60 ? minutes : undefined;
}

const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const clockText = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** "weekdays", "every day", "weekends", "saturdays", "monday to friday" as weekdays. */
function daysOf(text: string): string[] | undefined {
  if (/^(?:weekdays|every weekday|monday to friday|mondays to fridays)$/.test(text))
    return WEEK.slice(0, 5);
  if (/^(?:every day|all week|all days|daily)$/.test(text)) return WEEK;
  if (/^(?:weekends|the weekend)$/.test(text)) return WEEK.slice(5);
  // A day by its short or full name, once or plural ("mon", "monday", "mondays"); not "monthly".
  const one = WEEK.findIndex(
    (d, i) =>
      text === d || text === `${d}s` || text === DAY_NAMES[i] || text === `${DAY_NAMES[i]}s`,
  );
  return one >= 0 ? [WEEK[one] as string] : undefined;
}

/** A week's hours as the spec writes them: runs of days with the same spans as one key (mon-fri). */
function hoursValue(hours: Record<string, [number, number][]>): Record<string, string | string[]> {
  const said = (d: string) => (hours[d] ?? []).map(([a, b]) => `${clockText(a)}-${clockText(b)}`);
  const out: Record<string, string | string[]> = {};
  for (let at = 0; at < WEEK.length; ) {
    const text = said(WEEK[at] as string);
    let end = at;
    while (end + 1 < WEEK.length && said(WEEK[end + 1] as string).join() === text.join()) end++;
    if (text.length)
      out[end > at ? `${WEEK[at]}-${WEEK[end]}` : (WEEK[at] as string)] =
        text.length === 1 ? (text[0] as string) : text;
    at = end + 1;
  }
  return out;
}

const RULES: Rule[] = [
  {
    // "barbers have opening hours 9 to 17 on weekdays", "rooms are open 10-14 on saturdays":
    // the model's records are booked by their time (appointments.md §2); other days are kept.
    name: "schedule hours",
    match(text, scope) {
      const m =
        /^(?:the )?(?<model>.+?) (?:have|has|keep|work) (?:opening |working )?hours (?:from )?(?<from>[\d:.]+)(?: (?:to|until) | ?[-–] ?)(?<to>[\d:.]+) (?:on |at )?(?<days>.+)$/.exec(
          text,
        ) ??
        /^(?:the )?(?<model>.+?) (?:are|is) open (?:from )?(?<from>[\d:.]+)(?: (?:to|until) | ?[-–] ?)(?<to>[\d:.]+) (?:on |at )?(?<days>.+)$/.exec(
          text,
        );
      if (!m?.groups) return undefined;
      const model = modelFor(scope.ir, m.groups.model ?? "");
      const from = clockOf(m.groups.from ?? "");
      const to = clockOf(m.groups.to ?? "");
      const days = daysOf(m.groups.days ?? "");
      if (!model || model.name === USER_MODEL || from === undefined || to === undefined || !days)
        return null;
      if (to <= from)
        return {
          refusal: `The hours end before they start: ${clockText(from)} to ${clockText(to)}.`,
        };
      const hours: Record<string, [number, number][]> = { ...(model.schedule?.hours ?? {}) };
      for (const d of days) hours[d] = [[from, to]];
      const kept = model.schedule;
      return [
        {
          op: "setSchedule",
          args: {
            model: model.name,
            hours: hoursValue(hours),
            ...(kept?.breaks.length
              ? { breaks: kept.breaks.map(([a, b]) => `${clockText(a)}-${clockText(b)}`) }
              : {}),
            ...(kept?.gap ? { gap: kept.gap } : {}),
            // The time away as the IR has it, so a long form (its own resource or dates) stays.
            ...(kept?.away ? { away: kept.away } : {}),
          },
        },
      ];
    },
  },
  {
    // "an appointment takes its barber's time": the reference names whose; the start and the
    // length are found by shape (its one date-and-time field; one whole-number field on it or a
    // record it refers to), or a model reads the request.
    name: "occupies",
    match(text, scope) {
      const m =
        /^(?:an? |each |every |the )?(?<model>.+?) (?:takes|uses|books|occupies) (?:its|their|the) (?<resource>.+?)(?:'s|s'|') time$/.exec(
          text,
        );
      if (!m?.groups) return undefined;
      const model = modelFor(scope.ir, m.groups.model ?? "");
      const ref = model && fieldFor(model, m.groups.resource ?? "");
      if (!model || ref?.type.kind !== "relation" || ref.type.many || !ref.required) return null;
      const target = scope.ir.models.find((x) => x.name === (ref.type as { model: string }).model);
      if (!target?.schedule) return null;
      const dates = model.fields.filter(
        (f) => f.type.kind === "scalar" && f.type.name === "datetime" && !f.formula,
      );
      const isInt = (f: FieldIR) => f.type.kind === "scalar" && f.type.name === "int" && !f.formula;
      const lengths = [
        ...model.fields.filter(isInt).map((f) => f.name),
        ...model.fields.flatMap((f) =>
          f.type.kind === "relation" && !f.type.many && f.required && f !== ref
            ? (scope.ir.models
                .find((x) => x.name === (f.type as { model: string }).model)
                ?.fields.filter(isInt)
                .map((x) => `${f.name}.${x.name}`) ?? [])
            : [],
        ),
      ];
      if (dates.length !== 1 || lengths.length !== 1) return null;
      return [
        {
          op: "setOccupies",
          args: {
            model: model.name,
            resource: ref.name,
            starts: (dates[0] as FieldIR).name,
            duration: lengths[0] as string,
          },
        },
      ];
    },
  },
  {
    // "the customer email should be required", "make email unique", "phone is optional"
    name: "field flag",
    match(text, scope) {
      const flags: Record<string, Partial<Pick<FieldIR, "required" | "unique">>> = {
        required: { required: true },
        mandatory: { required: true },
        "always filled in": { required: true },
        optional: { required: false },
        "not required": { required: false },
        unique: { unique: true },
        "not unique": { unique: false },
      };
      const flagRe =
        "(required|mandatory|always filled in|optional|not required|unique|not unique)";
      const m =
        new RegExp(`^(?:make |set )(?:the )?(?<subject>.+?) (?:be )?${flagRe}$`).exec(text) ??
        // "make email required for customers": the field, then whose.
        new RegExp(
          `^(?:make |set )(?:the )?(?<field>.+?) (?:be )?${flagRe} (?:for|on|in) (?<model>.+)$`,
        ).exec(text) ??
        new RegExp(
          `^(?:the )?(?<subject>.+?) (?:should be|must be|has to be|needs to be|is|becomes|should become|should always be|must always be) ${flagRe}$`,
        ).exec(text);
      if (!m?.groups) return undefined;
      const flag = Object.keys(flags).find((f) => new RegExp(`\\b${f}\\b`).test(text));
      const change = flags[m[2] ?? ""] ?? (flag ? flags[flag] : undefined);
      if (!change) return null;
      const found = subjectField(
        m.groups.subject ?? `${m.groups.field ?? ""} of ${m.groups.model ?? ""}`,
        scope,
      );
      if (!found) return null;
      const type = shorthand(found.field, change);
      if (!type) return null;
      return [
        { op: "changeField", args: { model: found.model.name, field: found.field.name, type } },
      ];
    },
  },
  {
    // "rename the customer's phone to mobile", "rename phone to mobile on customers"
    name: "rename field",
    match(text, scope) {
      const m =
        /^rename (?:the )?(?<subject>.+?) (?:to|as|into) (?<to>[a-z][a-z0-9 ]*)$/.exec(text) ??
        /^call (?:the )?(?<subject>.+?) (?<to>[a-z][a-z0-9 ]*) (?:instead|from now on)$/.exec(text);
      if (!m?.groups) return undefined;
      // "Rename orders to jobs" names the kind of record, not a field: the operation that
      // calls its records by other names, which follows them into its pages' titles and the
      // fields that refer to it, all as texts (the names in the spec stay, so nothing else moves).
      const bare = dropArticles(m.groups.subject ?? "").replace(/ (?:page|list|records?)$/, "");
      const kind = / (?:of|on|in|for|from) |'s? /.test(bare) ? undefined : modelFor(scope.ir, bare);
      if (kind && kind.name !== USER_MODEL) {
        const many = sentence(plural(singular(dropArticles(m.groups.to ?? ""))));
        const one = sentence(singular(dropArticles(m.groups.to ?? "")));
        return [{ op: "nameRecords", args: { model: kind.name, one, several: many } }];
      }
      const found = subjectField(m.groups.subject ?? "", scope);
      if (!found) return null;
      const to = identifier(dropArticles(m.groups.to ?? ""));
      if (!to || found.model.fields.some((f) => f.name === to)) return null;
      return [{ op: "renameField", args: { model: found.model.name, from: found.field.name, to } }];
    },
  },
  {
    // "remove the phone from customers", "customers no longer need a fax number"
    name: "remove field",
    match(text, scope) {
      const m =
        /^(?:remove|delete|drop) (?:the )?(?<subject>.+?)(?: field)?$/.exec(text) ??
        /^(?:the )?(?<model>.+?) (?:no longer|don't|do not|doesn't|does not) (?:need|have|want)(?: a| an| the)? (?<field>.+)$/.exec(
          text,
        );
      if (!m?.groups) return undefined;
      // "delete Customer", "remove bookings": a kind of record (or its records), not the field that
      // points to it; a model reads it. "remove the customer field" is the field.
      const subject = m.groups.subject;
      if (subject && !/ field$/.test(subject) && modelFor(scope.ir, dropArticles(subject)))
        return null;
      const found = subject
        ? subjectField(subject, scope)
        : (() => {
            const model = modelFor(scope.ir, m.groups?.model ?? "");
            const field = model && fieldFor(model, m.groups?.field ?? "");
            return model && field ? { model, field } : undefined;
          })();
      if (!found) return null;
      return [{ op: "removeField", args: { model: found.model.name, field: found.field.name } }];
    },
  },
  {
    // "only invited people may sign in", "anyone can sign up"
    name: "sign-up",
    match(text, scope) {
      const invited =
        /^only invited (?:people|users|members|persons|colleagues|addresses) (?:may|can|should be able to|are allowed to) (?:sign in|sign up|log in|use (?:the app|it)|get in)$/.test(
          text,
        );
      const anyone =
        /^(?:let |allow )?(?:anyone|anybody|everyone) (?:with an account )?(?:may |can |should be able to |to )?(?:sign up|sign in|log in|create an account)$/.test(
          text,
        );
      if (!invited && !anyone) return undefined;
      const signIn = scope.auth?.signIn;
      if (!signIn || signIn === "none") return null;
      if (signIn.selfSignUp === anyone) return null;
      return [{ op: "setSignUp", args: { who: invited ? "invited" : "anyone" } }];
    },
  },
  {
    // "add a users page", "add a page to invite people"
    name: "users page",
    match(text, scope) {
      const m =
        /^add (?:a |an )?(?:users?|team|members?|people|staff|colleagues) page$/.test(text) ||
        /^add (?:a |an )?page (?:to|for|where (?:i|we|admins?) (?:can|may)) (?:invite|inviting|manage|managing) (?:people|users|colleagues|team members|members|staff|the team)$/.test(
          text,
        );
      if (!m) return undefined;
      if (scope.ir.pages.some((p) => p.pattern.kind === "users")) return null;
      return [{ op: "addUsersPage", args: {} }];
    },
  },
  {
    // "add a calendar for sessions", "show sessions in a calendar"
    name: "calendar page",
    match(text, scope) {
      const phrase =
        /^add (?:a |an )?calendar (?:for|of|with) (?<model>.+)$/.exec(text)?.groups?.model ??
        /^show (?<model>.+) (?:in|on) (?:a |the )?calendar$/.exec(text)?.groups?.model;
      if (!phrase) return undefined;
      const model = modelFor(scope.ir, phrase);
      if (!model) return null;
      const page = scope.ir.pages.some((p) => p.id === "calendar")
        ? `${kebab(plural(model.name))}-calendar`
        : "calendar";
      return [{ op: "addCalendarPage", args: { page, model: model.name } }];
    },
  },
  {
    // "add a blog for posts", "add a news page for articles", "show posts as articles"
    name: "articles page",
    match(text, scope) {
      const blog =
        /^add (?:a |an )?(?<kind>blog|news|news page|knowledge base) (?:for|of|with) (?<model>.+)$/.exec(
          text,
        )?.groups;
      const shown = /^show (?<model>.+) as (?:a blog|articles|news)$/.exec(text)?.groups?.model;
      const phrase = blog?.model ?? shown;
      if (!phrase) return undefined;
      const model = modelFor(scope.ir, phrase);
      if (!model) return null;
      const name =
        blog?.kind === "knowledge base"
          ? "knowledge-base"
          : blog?.kind?.startsWith("news")
            ? "news"
            : "blog";
      const page = scope.ir.pages.some((p) => p.id === name)
        ? `${kebab(plural(model.name))}-${name}`
        : name;
      return [{ op: "addArticlesPage", args: { page, model: model.name } }];
    },
  },
  {
    // "add an action to merge customers": the name and what it is for; its input, output and
    // who may run it are the form's (or a model's) to fill in.
    name: "custom action",
    match(text, scope) {
      const what =
        /^add (?:a |an )?(?:new |custom )*action (?:to|that|which) (?<what>[a-z][a-z ]*)$/.exec(
          text,
        )?.groups?.what;
      if (!what) return undefined;
      const action = identifier(what);
      if (scope.ir.actions.some((a) => a.name === action)) return null;
      return [
        { op: "addAction", args: { action, intent: `${what[0]?.toUpperCase()}${what.slice(1)}.` } },
      ];
    },
  },
  {
    // "add an admin page", "add a page to manage all data", "add a data page for orders and customers"
    name: "data page",
    match(text, scope) {
      const every =
        /^add (?:a |an )?(?:admin|administration|data|database) page$/.test(text) ||
        /^add (?:a |an )?page (?:to|for|where (?:i|we|admins?) (?:can|may)) (?:manage|see|edit|browse|correct) (?:all )?(?:the |our )?(?:data|records)$/.test(
          text,
        );
      const some = /^add (?:a |an )?(?:admin|data) page for (?<list>.+)$/.exec(text)?.groups?.list;
      if (!every && !some) return undefined;
      if (scope.auth?.signIn === "none") return null;
      if (every) {
        if (scope.ir.pages.some((p) => p.pattern.kind === "data" && p.pattern.all)) return null;
        return [{ op: "addDataPage", args: {} }];
      }
      // Each named model must be one: anything else is for a model to read.
      const names = (some ?? "").split(/,\s*|\s+and\s+/).filter(Boolean);
      const models = names.map((n) => modelFor(scope.ir, n)?.name);
      if (!models.length || models.some((m) => !m)) return undefined;
      return [{ op: "addDataPage", args: { models } }];
    },
  },
  {
    // "review photos before they are shown", "moderate listing photos before others see them",
    // "check the contracts of tenants before anyone sees them": the field joins its model's
    // review, and a review page comes with it when none lists the model yet.
    name: "review files",
    match(text, scope) {
      const what =
        /^(?:review|moderate|check|approve) (?<what>.+?) before (?:they are|they're|it is|it's|others see (?:them|it)|anyone sees (?:them|it)|people see (?:them|it))(?: (?:shown|published|visible|seen))?(?: (?:to|by) (?:others|anyone|everyone))?$/.exec(
          text,
        )?.groups?.what;
      if (!what) return undefined;
      const of = /^(?<field>.+?) (?:of|on|in) (?<model>.+)$/.exec(what)?.groups;
      const lead = /^(?<model>\S+) (?<field>.+)$/.exec(what)?.groups;
      const within = (m?: string, f?: string) => {
        const model = m ? modelFor(scope.ir, m) : undefined;
        const field = model && f ? fieldFor(model, f) : undefined;
        return model && field ? { model, field } : undefined;
      };
      const found =
        (of && within(of.model, of.field)) ??
        (lead && within(lead.model, lead.field)) ??
        fieldAnywhere(scope.ir, what);
      if (!found || !isUpload(found.field)) return undefined;
      const { model, field } = found;
      const reviewed = model.review ?? [];
      if (reviewed.includes(field.name)) return null;
      const ops: PhraseOperation[] = [
        { op: "setReview", args: { model: model.name, fields: [...reviewed, field.name] } },
      ];
      const listed = scope.ir.pages.some(
        (p) =>
          p.pattern.kind === "review" && (p.pattern.all || p.pattern.models.includes(model.name)),
      );
      if (!listed && scope.auth?.signIn !== "none")
        ops.push({
          op: "addReviewPage",
          args: scope.ir.pages.some((p) => p.id === "review") ? { page: "file-review" } : {},
        });
      return ops;
    },
  },
  {
    // "only admins may open the settings page"
    name: "page access",
    match(text, scope) {
      const m =
        /^only (?<roles>.+?) (?:may|can|should be able to|are allowed to) (?:open|see|view|use|access) (?<page>.+)$/.exec(
          text,
        );
      if (!m?.groups) return undefined;
      const roles = rolesFor(m.groups.roles ?? "", scope);
      const page = pageFor(scope.ir, m.groups.page ?? "");
      if (!page) return undefined;
      if (!roles || roles.includes("owner") || !scope.auth) return null;
      const ops = grantsFor(scope, "pages", page.id, roles, true);
      return ops.length
        ? ops
        : {
            refusal: `Only ${roles.map(plural).join(" and ")} can open ${words(page.id)} already.`,
          };
    },
  },
  {
    // "only admins may delete customers", "deleting customers is only for admins"
    name: "access",
    match(text, scope) {
      const m =
        /^only (?<roles>.+?) (?:may|can|should|should be able to|are allowed to|is allowed to|are able to) (?<verb>[a-z]+) (?<target>.+)$/.exec(
          text,
        ) ??
        /^(?<verb>[a-z]+) (?:of )?(?<target>.+?) (?:is|should be) (?:only for|restricted to|limited to|reserved for) (?<roles>.+)$/.exec(
          text,
        ) ??
        /^(?<roles>.+?) (?:only|alone) (?:may|can|should) (?<verb>[a-z]+) (?<target>.+)$/.exec(
          text,
        );
      // "members should be able to add items", "let members add items": those roles too, beside
      // whoever may already (the stranger walk, 2026-10-07); "only" above restricts instead.
      const grant =
        m ??
        /^(?<roles>.+?) (?:should|must) (?:also )?be able to (?<verb>[a-z]+) (?<target>.+)$/.exec(
          text,
        ) ??
        /^(?:let|allow) (?<roles>.+?) (?:to )?(?<verb>[a-z]+) (?<target>.+)$/.exec(text);
      if (!grant?.groups) return undefined;
      const roles = rolesFor(grant.groups.roles ?? "", scope);
      const verb = verbOf(grant.groups.verb ?? "");
      // "let people filter customers": not a role, not an access verb: another rule's.
      if (!m && (!roles || !verb)) return undefined;
      if (!roles || !verb) return null;
      const target = dropArticles(grant.groups.target ?? "").replace(
        /^(?:records? of |entries of )/,
        "",
      );
      const model = modelFor(scope.ir, target);
      if (!model || model.name === USER_MODEL) return null;
      // Who may do what is granted per role in smithable.auth.yml: without it, nothing is guessed.
      if (!scope.auth) return null;
      const things = plural(words(model.name));
      const doing = verb === "write" ? "change" : verb === "create" ? "add" : verb;
      // Reading is the record rule's: under shared access everyone reads everything.
      if (verb === "read" && scope.auth.defaultAccess === "shared")
        return {
          refusal: `Everyone who signs in sees every record (shared access), so who sees ${things} is not a role's grant: make access private first (setDefaultAccess private).`,
        };
      // Each one works with their own records whatever the grants say: "only the owner" takes the
      // grant from every role, "only admins" too, and nobody loses their own.
      const wanted = roles.filter((r) => r !== "owner");
      const ops = grantsFor(scope, verb, model.name, wanted, m !== null && m !== undefined);
      if (ops.length) return ops;
      const who = roles.map((r) => (r === "owner" ? "the record's owner" : plural(r)));
      return {
        refusal: m
          ? `Only ${who.join(" and ")}${who.includes("the record's owner") ? "" : " and each one for their own"} can ${doing} ${things} already.`
          : `${sentence(who.join(" and "))} can ${doing} ${things} already.`,
      };
    },
  },
  {
    // "search customers by name on the customers page", "customers should be searchable by name and email"
    name: "search",
    match(text, scope) {
      const m =
        /^(?:allow (?:users |people )?to |let (?:users |people )?)?search(?:ing)? (?:for |through |in )?(?<target>.+?) by (?<fields>.+?)(?: on (?:the )?(?<page>.+?)(?: page)?)?$/.exec(
          text,
        ) ??
        /^(?:the )?(?<target>.+?) (?:should be|must be|are|is) searchable by (?<fields>.+)$/.exec(
          text,
        ) ??
        /^add (?:a )?search (?:by|on|for) (?<fields>.+?) (?:to|on) (?:the )?(?<page>.+?)(?: page)?$/.exec(
          text,
        );
      if (!m?.groups) return undefined;
      const page = pageFor(scope.ir, m.groups.page ?? m.groups.target ?? "");
      if (!page || page.pattern.kind !== "crud") return null;
      const model = scope.ir.models.find(
        (x) => page.pattern.kind === "crud" && x.name === page.pattern.model,
      );
      if (!model) return null;
      const fields: string[] = [];
      for (const phrase of list(m.groups.fields ?? "")) {
        const field = fieldFor(model, phrase);
        if (!field || !searchable(field)) return null;
        fields.push(field.name);
      }
      const added = fields.filter((f) => !page.search?.includes(f));
      // Nothing new: a model says "already done"; the grammar never proposes a change that changes nothing.
      if (added.length === 0) return null;
      return [
        { op: "setSearch", args: { page: page.id, fields: [...(page.search ?? []), ...added] } },
      ];
    },
  },
  {
    // "let people filter items by category and price", "items can be filtered by category on the catalog page"
    name: "filters",
    match(text, scope) {
      const m =
        /^(?:allow (?:users |people |visitors )?to |let (?:users |people |visitors )?)?filter(?:ing)? (?:the )?(?<target>.+?) by (?<fields>.+?)(?: on (?:the )?(?<page>.+?)(?: page)?)?$/.exec(
          text,
        ) ??
        /^(?:the )?(?<target>.+?) (?:should be|must be|can be|are|is) filter(?:able|ed) by (?<fields>.+?)(?: on (?:the )?(?<page>.+?)(?: page)?)?$/.exec(
          text,
        ) ??
        /^add (?:a )?filters? (?:by|on|for) (?<fields>.+?) (?:to|on) (?:the )?(?<page>.+?)(?: page)?$/.exec(
          text,
        );
      if (!m?.groups) return undefined;
      return listKeyChange(
        scope,
        "filters",
        m.groups.page ?? m.groups.target ?? "",
        m.groups.fields ?? "",
      );
    },
  },
  {
    // "let visitors sort items by price", "orders should be sortable by total and date"
    name: "sortable",
    match(text, scope) {
      const m =
        /^(?:allow (?:users |people |visitors )?to |let (?:users |people |visitors )?)?sort(?:ing)? (?:the )?(?<target>.+?) by (?<fields>.+?)(?: on (?:the )?(?<page>.+?)(?: page)?)?$/.exec(
          text,
        ) ??
        /^(?:the )?(?<target>.+?) (?:should be|must be|can be|are|is) sort(?:able|ed) by (?<fields>.+?)(?: on (?:the )?(?<page>.+?)(?: page)?)?$/.exec(
          text,
        );
      if (!m?.groups) return undefined;
      return listKeyChange(
        scope,
        "sortable",
        m.groups.page ?? m.groups.target ?? "",
        m.groups.fields ?? "",
      );
    },
  },
  {
    // "let people see only their own orders on the orders page", "the my items page shows only my items"
    name: "mine",
    match(text, scope) {
      const m =
        /^(?:let (?:users |people |members )?)?(?:see|show|list) only (?:their|my|your) own (?<target>.+?)(?: on (?:the )?(?<page>.+?)(?: page)?)?$/.exec(
          text,
        ) ??
        /^(?:the )?(?<page>.+?) page (?:should )?(?:shows?|lists?) only (?:their|my|your) own (?<target>.+)$/.exec(
          text,
        );
      if (!m?.groups) return undefined;
      const page = pageFor(scope.ir, m.groups.page ?? m.groups.target ?? "");
      if (!page || page.pattern.kind !== "crud" || page.mine) return null;
      return [{ op: "setMine", args: { page: page.id, mode: "on" } }];
    },
  },
  {
    // "let people save items", "items can be saved as favorites", "add favorites to the catalog page"
    name: "favorites",
    match(text, scope) {
      const m =
        /^(?:allow (?:users |people )?to |let (?:users |people )?)?(?:save|favou?rite|bookmark) (?:the )?(?<target>.+?)(?: as favou?rites)?(?: on (?:the )?(?<page>.+?)(?: page)?)?$/.exec(
          text,
        ) ??
        /^(?:the )?(?<target>.+?) (?:can|should|must) be (?:saved|favou?rited|bookmarked)(?: as favou?rites)?$/.exec(
          text,
        ) ??
        /^add favou?rites (?:to|on) (?:the )?(?<page>.+?)(?: page)?$/.exec(text);
      if (!m?.groups) return undefined;
      const page = pageFor(scope.ir, m.groups.page ?? m.groups.target ?? "");
      if (!page || page.pattern.kind !== "crud") return null;
      if (page.favorites) return null;
      return [{ op: "setFavorites", args: { page: page.id, mode: "on" } }];
    },
  },
  {
    // "let visitors contact the seller of an item", "let people contact the owner of a listing"
    name: "contact",
    match(text, scope) {
      const m =
        /^(?:allow (?:users |people |visitors )?to |let (?:users |people |visitors )?)?contact (?:the )?(?<who>.+?) (?:of|behind) (?:an? |the |each )?(?<target>.+?)(?: on (?:the )?(?<page>.+?)(?: page)?)?$/.exec(
          text,
        );
      if (!m?.groups) return undefined;
      const page = pageFor(scope.ir, m.groups.page ?? m.groups.target ?? "");
      if (!page || page.pattern.kind !== "crud") return null;
      const model = scope.ir.models.find(
        (x) => page.pattern.kind === "crud" && x.name === page.pattern.model,
      );
      if (!model) return null;
      const who = (m.groups.who ?? "").trim();
      let to: string | undefined;
      if (/^(owner|creator|author|person who (?:added|created|made) it)$/i.test(who)) to = "owner";
      else {
        const field = fieldFor(model, who);
        if (field?.type.kind === "relation" && !field.type.many && field.type.model === USER_MODEL)
          to = field.name;
      }
      if (!to || page.contact?.to === to) return null;
      return [{ op: "setContact", args: { page: page.id, to } }];
    },
  },
  {
    // "add a page for orders, and show it in the menu"
    name: "add page",
    match(text, scope) {
      const m =
        /^add (?:a |an )?(?:page|list|screen|view) (?:for|of|listing|showing) (?<model>.+?)(?:,? (?:and )?(?:show|put|add|list) it (?:in|to|on) the (?:main )?menu)?$/.exec(
          text,
        );
      if (!m?.groups) return undefined;
      const model = modelFor(scope.ir, m.groups.model ?? "");
      if (!model || model.name === USER_MODEL) return null;
      if (scope.ir.pages.some((p) => p.pattern.kind === "crud" && p.pattern.model === model.name))
        return null;
      const words = kebab(model.name).split("-");
      const page = [...words.slice(0, -1), plural(words.at(-1) ?? "")].join("-");
      if (scope.ir.pages.some((p) => p.id === page)) return null;
      return [{ op: "addPage", args: { page, model: model.name } }];
    },
  },
  {
    // "show orders first in the menu", "move customers before orders", "put orders last"
    name: "menu order",
    match(text, scope) {
      const m =
        /^(?:show|put|move|place|list) (?:the )?(?<page>.+?)(?: page)? (?<where>first|at the top|to the top|on top|last|at the bottom|to the bottom)(?: (?:in|of) the (?<menu>[a-z]+ )?menu)?$/.exec(
          text,
        ) ??
        /^(?:show|put|move|place|list) (?:the )?(?<page>.+?)(?: page)? (?<where>before|above|after|below) (?:the )?(?<other>.+?)(?: page)?(?: (?:in|of) the (?<menu>[a-z]+ )?menu)?$/.exec(
          text,
        );
      if (!m?.groups) return undefined;
      const menu = menuFor(scope, m.groups.menu?.trim());
      const page = pageFor(scope.ir, m.groups.page ?? "");
      if (!menu || !page || !menu.pages.includes(page.id)) return null;
      const rest = menu.pages.filter((p) => p !== page.id);
      const where = m.groups.where ?? "";
      let pages: string[];
      if (["first", "at the top", "to the top", "on top"].includes(where))
        pages = [page.id, ...rest];
      else if (["last", "at the bottom", "to the bottom"].includes(where))
        pages = [...rest, page.id];
      else {
        const other = pageFor(scope.ir, m.groups.other ?? "");
        if (!other || other.id === page.id) return null;
        const at = rest.indexOf(other.id);
        if (at < 0) return null;
        const offset = where === "before" || where === "above" ? 0 : 1;
        pages = [...rest.slice(0, at + offset), page.id, ...rest.slice(at + offset)];
      }
      if (pages.join() === menu.pages.join()) return null;
      return [{ op: "setNavigation", args: { menu: menu.name, pages } }];
    },
  },
  {
    // "the menu should be: orders, customers, dashboard"
    name: "menu list",
    match(text, scope) {
      const m =
        /^(?:the )?(?<menu>[a-z]+ )?menu (?:order )?(?:should be|is|becomes|should show|shows):? (?<pages>.+)$/.exec(
          text,
        );
      if (!m?.groups) return undefined;
      const menu = menuFor(scope, m.groups.menu?.trim());
      if (!menu) return null;
      const pages: string[] = [];
      for (const phrase of list((m.groups.pages ?? "").replace(/ then /g, ", "))) {
        const page = pageFor(scope.ir, phrase);
        if (!page || pages.includes(page.id)) return null;
        pages.push(page.id);
      }
      if (pages.length === 0 || pages.join() === menu.pages.join()) return null;
      return [{ op: "setNavigation", args: { menu: menu.name, pages } }];
    },
  },
  {
    // "add orders: each order has a number, belongs to a customer and has a total amount"
    name: "add model",
    match(text, scope) {
      const m =
        /^(?:add|create|introduce|we (?:also )?have) (?<plural>[a-z][a-z ]*?)(?::|,|;| -| where| which| that) (?:each|every|an?|one) (?<singular>[a-z][a-z ]*?) (?:has|have|with|contains|holds|stores) (?<fields>.+)$/.exec(
          text,
        ) ??
        /^(?:add|create) (?:a |an )?(?<singular>[a-z][a-z ]*?) (?:model|record|table|entity) (?:with|having|that has) (?<fields>.+)$/.exec(
          text,
        );
      if (!m?.groups) return undefined;
      const name = identifier(dropArticles(m.groups.singular ?? ""));
      if (!name) return null;
      const model = name[0]?.toUpperCase() + name.slice(1);
      if (scope.ir.models.some((x) => x.name === model || key(x.name) === key(model))) return null;
      const fields: Record<string, string> = {};
      for (let item of list(m.groups.fields ?? "")) {
        item = item.replace(/^(?:has|have|with|and) /, "").trim();
        const field = newField(item, scope, true);
        if (!field || fields[field.name]) return null;
        fields[field.name] = field.type;
      }
      if (Object.keys(fields).length === 0) return null;
      return [{ op: "addModel", args: { model, fields } }];
    },
  },
  {
    // "customers should have a phone number", "add a website to customers", "give each order a due date"
    name: "add field",
    match(text, scope) {
      const m =
        /^(?<model>.+?) (?:should|must|need to|needs to|ought to|will) (?:also )?(?:have|get|carry|store|record|include) (?<field>.+)$/.exec(
          text,
        ) ??
        /^(?<model>.+?) (?:need|needs|get|gets|have|has) (?:a |an )(?<field>.+)$/.exec(text) ??
        /^(?:add|store|record|track) (?<field>.+?) (?:to|on|for|in) (?<model>.+)$/.exec(text) ??
        /^give (?<model>.+?) (?<field>(?:a|an) .+)$/.exec(text);
      if (!m?.groups) return undefined;
      const model = modelFor(scope.ir, m.groups.model ?? "");
      if (!model) return null;
      const required =
        /\b(?:must|required|mandatory)\b/.test(text) && !/\b(?:optional|not required)\b/.test(text);
      // "a status: draft, sent or paid" names its values; "a status" alone cannot be guessed.
      const asked = m.groups.field ?? "";
      const status =
        /^(?:a |an |the )?(?<name>[a-z][a-z ]*?(?:status|state|stage))(?:\s*(?::|,|with (?:the )?values|which can be|one of|that is)\s*(?<values>.+))?$/.exec(
          asked.trim(),
        );
      if (status?.groups && !status.groups.values)
        return {
          refusal: `A ${status.groups.name} needs its values: say which, e.g. "${m.groups.model} should have a ${status.groups.name}: draft, sent or paid".`,
        };
      const field = status?.groups?.values
        ? {
            name: camel(status.groups.name ?? "status"),
            type: status.groups.values
              .split(/,| or | and /)
              .map((v) => camel(v.trim().replace(/^(?:a |an |the )/, "")))
              .filter(Boolean)
              .join(" | "),
          }
        : newField(asked, scope, required);
      if (!field) return null;
      const there = model.fields.find(
        (f) => f.name === field.name || key(f.name) === key(field.name),
      );
      if (there)
        return {
          refusal: `${sentence(plural(words(model.name)))} already have a field called "${words(there.name)}".`,
        };
      // Shown in the model's list as the Change form does by default: a starter names its list's
      // columns, and without this the preview showed no change at all (the stranger walk).
      const listed = scope.ir.pages.some(
        (p) => p.pattern.kind === "crud" && pageModel(p) === model.name,
      );
      return [
        {
          op: "addField",
          args: {
            model: model.name,
            field: field.name,
            type: field.type,
            ...(listed ? { list: true } : {}),
          },
        },
      ];
    },
  },
];

/** "the customer email", "email of customers", "customers' phone", or a field named alone. */
function subjectField(
  subject: string,
  scope: Scope,
): { model: ModelIR; field: FieldIR } | undefined {
  const s = dropArticles(subject).replace(/ field$/, "");
  const forms = [
    /^(?<model>.+?)'s? (?<field>.+)$/.exec(s),
    /^(?<field>.+?) (?:of|on|in|for|from) (?<model>.+)$/.exec(s),
    /^(?<model>\S+) (?<field>.+)$/.exec(s),
    /^(?<model>.+) (?<field>\S+)$/.exec(s),
  ];
  for (const m of forms) {
    if (!m?.groups) continue;
    const model = modelFor(scope.ir, m.groups.model ?? "");
    const field = model && fieldFor(model, m.groups.field ?? "");
    if (model && field) return { model, field };
  }
  return fieldAnywhere(scope.ir, s);
}

/**
 * A list's filters or sort choice from a sentence: the page (a crud page, by its name or its
 * model's), then the fields; a field already listed adds nothing ("already done").
 */
function listKeyChange(
  scope: Scope,
  key: "filters" | "sortable",
  pageText: string,
  fieldsText: string,
): PhraseOperation[] | { refusal: string } | null {
  const page = pageFor(scope.ir, pageText);
  if (!page || page.pattern.kind !== "crud") return null;
  const model = scope.ir.models.find(
    (x) => page.pattern.kind === "crud" && x.name === page.pattern.model,
  );
  if (!model) return null;
  const fits = key === "filters" ? filterable : sortableBy;
  const fields: string[] = [];
  for (const phrase of list(fieldsText)) {
    const field = fieldFor(model, phrase);
    if (!field)
      return {
        refusal: `${sentence(plural(words(model.name)))} have no field called "${phrase}". They have: ${model.fields
          .filter(fits)
          .map((f) => words(f.name))
          .join(", ")}.`,
      };
    if (!fits(field)) return null;
    fields.push(field.name);
  }
  const current = page[key] ?? [];
  const added = fields.filter((f) => !current.includes(f));
  if (added.length === 0) return null;
  return [
    {
      op: key === "filters" ? "setFilters" : "setSortable",
      args: { page: page.id, fields: [...current, ...added] },
    },
  ];
}

const searchable = (field: FieldIR) =>
  (field.type.kind === "scalar" &&
    ["string", "text", "email", "phone", "url"].includes(field.type.name)) ||
  field.type.kind === "choice";
