// Questions about the app that the spec answers on its own (docs/design/studio-v2.md §4): who
// may do what, what a thing is, whether something is public, where a field is used, and what
// happens when a record is removed. The shapes are few and plain; anything else is for a model.
import {
  type Allowed,
  type AuthIR,
  type ContentIR,
  emptyContent,
  type FieldIR,
  humanize,
  type ModelIR,
  modelAccess,
  type PageIR,
  pageAccess,
  pageModel,
  type SpecIR,
} from "@smithable/core";
import {
  dropArticles,
  fieldAnywhere,
  fieldFor,
  modelFor,
  normalize,
  pageFor,
  verbOf,
} from "./phrases.js";
import { who, wordsFor } from "./summary.js";

export interface Answer {
  text: string;
  /** The concepts the answer is about, e.g. "model:Order", for linking to their sentences. */
  concepts: string[];
  /** The question shape that answered, e.g. "who-can". */
  rule: string;
}

/** Whether a request is a question about the app rather than a change to it. */
export function looksLikeQuestion(request: string): boolean {
  const text = request.trim().toLowerCase();
  return (
    text.endsWith("?") ||
    /^(?:who|what|which|where|when|why|how|is|are|does|do|can|could|will|would|should)\b/.test(text)
  );
}

const VERB_WORDS = { read: "see", create: "add", write: "change", delete: "delete" } as const;

/**
 * The answer to a question the spec can give, or undefined when a model should read it. The
 * question is matched on its wording; names resolve like the everyday changes' do.
 */
export function answerQuestion(
  ir: SpecIR,
  request: string,
  auth?: AuthIR,
  content: ContentIR = emptyContent(),
): Answer | undefined {
  const text = normalize(request).replace(/\?$/, "").trim();
  const w = wordsFor(ir, content);
  const plural = (m: ModelIR) => w.pluralLabel(m).toLowerCase();
  const the = (m: ModelIR) => w.label(m).toLowerCase();
  const rolesOf = (rule: Allowed) =>
    rule.public
      ? rule.where
        ? `Anyone, without signing in, for records where ${Object.entries(rule.where)
            .map(
              ([k, v]) =>
                `${humanize(k).toLowerCase()} is ${typeof v === "boolean" ? (v ? "yes" : "no") : humanize(v).toLowerCase()}`,
            )
            .join(
              " and ",
            )}; otherwise ${who([...rule.roles, ...(rule.owner ? ["owner"] : [])]).toLowerCase()}`
        : "Anyone, without signing in"
      : rule.roles.length || rule.owner
        ? capitalize(who([...rule.roles, ...(rule.owner ? ["owner"] : [])]))
        : "Nobody";

  // "who can delete orders", "who may see customers", "who is allowed to add sessions"
  let m = /^who (?:can|may|is allowed to|is able to|are allowed to) (\w+) (.+)$/.exec(text);
  if (m && auth) {
    const verb = verbOf(m[1] as string);
    const model = modelFor(ir, m[2] as string);
    const page = !model ? pageFor(ir, m[2] as string) : undefined;
    if (verb && model) {
      const rule = modelAccess(model, auth)[verb];
      return {
        text: `${rolesOf(rule)} can ${VERB_WORDS[verb]} ${plural(model)}.`,
        concepts: [`model:${model.name}`],
        rule: "who-can",
      };
    }
    if (page && (verb === "read" || /^(?:open|use|visit|access)$/.test(m[1] as string))) {
      const rule = pageAccess(page, auth);
      return {
        text: `${rolesOf(rule)} can open the ${humanize(page.id).toLowerCase()} page.`,
        concepts: [`page:${page.id}`],
        rule: "who-can",
      };
    }
    if (verb && !model && !page) return undefined;
  }

  // "is the schedule public", "is the schedule page public", "are sessions public",
  // "can visitors see sessions", "can anyone read posts"
  m =
    /^(?:is|are) (.+?) (?:public|open to (?:anyone|everyone|visitors)|visible (?:to|for) (?:anyone|everyone|visitors))$/.exec(
      text,
    ) ?? /^can (?:visitors|anyone|everyone|the public) (?:see|read|view|open|use) (.+)$/.exec(text);
  if (m && auth) {
    const model = modelFor(ir, m[1] as string);
    const page = !model ? pageFor(ir, m[1] as string) : undefined;
    if (model) {
      const rule = modelAccess(model, auth).read;
      const create = modelAccess(model, auth).create.public;
      return {
        text: rule.public
          ? `Yes: anyone can see ${plural(model)}${
              rule.where
                ? ` where ${Object.entries(rule.where)
                    .map(
                      ([k, v]) =>
                        `${humanize(k).toLowerCase()} is ${typeof v === "boolean" ? (v ? "yes" : "no") : humanize(v).toLowerCase()}`,
                    )
                    .join(" and ")}`
                : ""
            } without signing in${create ? `, and add them` : ""}.`
          : `No: ${plural(model)} need sign-in; ${who([...rule.roles, ...(rule.owner ? ["owner"] : [])]).toLowerCase()} can see them.`,
        concepts: [`model:${model.name}`],
        rule: "is-public",
      };
    }
    if (page) {
      const rule = pageAccess(page, auth);
      return {
        text: rule.public
          ? `Yes: the ${humanize(page.id).toLowerCase()} page opens without signing in.`
          : `No: the ${humanize(page.id).toLowerCase()} page needs sign-in (${who(rule.roles).toLowerCase()}).`,
        concepts: [`page:${page.id}`],
        rule: "is-public",
      };
    }
    return undefined;
  }

  // "what is a customer", "what are orders", "what is the schedule page", "what is a credit limit"
  m = /^what (?:is|are|does) (.+?)(?: (?:mean|for|do))?$/.exec(text);
  if (m) {
    const phrase = m[1] as string;
    const model = modelFor(ir, phrase);
    if (model)
      return { text: describeModel(model, w), concepts: [`model:${model.name}`], rule: "what-is" };
    const page = pageFor(ir, phrase);
    if (page)
      return { text: describePage(page, ir, w), concepts: [`page:${page.id}`], rule: "what-is" };
    const found = fieldAnywhere(ir, phrase) ?? fieldOfModel(ir, phrase);
    if (found) {
      const { model: owner, field } = found;
      // The field's notes as its list line gives them: "a phone (a phone number, required)".
      const notes = /\((.*)\)$/.exec(w.item(owner, field))?.[1];
      const calculated = field.formula ? `calculated as ${w.words(owner, field.formula)}` : "";
      const what = [notes, calculated].filter(Boolean).join(", ");
      return {
        text: `The ${w.fieldLabel(owner, field)} of ${article(the(owner))} is ${what || "a field of its own"}.`,
        concepts: [`model:${owner.name}`],
        rule: "what-is",
      };
    }
    return undefined;
  }

  // "where is the email used", "where is credit limit used", "which pages show customers"
  m =
    /^where (?:is|are) (.+?) (?:used|shown|displayed)$/.exec(text) ??
    /^(?:which|what) pages? (?:shows?|lists?|uses?) (.+)$/.exec(text);
  if (m) {
    const phrase = m[1] as string;
    const model = modelFor(ir, phrase);
    if (model) {
      const pages = ir.pages.filter(
        (p) =>
          pageModel(p) === model.name ||
          (p.pattern.kind === "landing" && p.pattern.sections.some((s) => s.model === model.name)),
      );
      const refs = ir.models.filter(
        (o) =>
          o !== model &&
          o.fields.some(
            (f) => f.type.kind === "relation" && f.type.model === model.name && !f.type.many,
          ),
      );
      const parts = [
        pages.length
          ? `on the ${list(pages.map((p) => humanize(p.id).toLowerCase()))} ${pages.length === 1 ? "page" : "pages"}`
          : "",
        refs.length
          ? `by ${list(refs.map((r) => plural(r)))}, which refer to ${article(the(model))}`
          : "",
      ].filter(Boolean);
      return {
        text: parts.length
          ? `${w.pluralLabel(model)} are shown ${parts.join(", and used ")}.`
          : `${w.pluralLabel(model)} are not shown on any page.`,
        concepts: [`model:${model.name}`, ...pages.map((p) => `page:${p.id}`)],
        rule: "where-used",
      };
    }
    const found = fieldAnywhere(ir, phrase) ?? fieldOfModel(ir, phrase);
    if (found) {
      const { model: owner, field } = found;
      const formulas = owner.fields.filter(
        (f) => f.formula && JSON.stringify(f.formula).includes(`"${field.name}"`),
      );
      const tiles = ir.pages.flatMap((p) =>
        p.pattern.kind === "dashboard"
          ? p.pattern.items
              .filter(
                (i) =>
                  i.field === field.name ||
                  i.by === field.name ||
                  (i.where && field.name in i.where),
              )
              .map(() => p)
          : [],
      );
      const parts = [
        `in the ${the(owner)} form and list`,
        ...(formulas.length
          ? [
              `in the ${list(formulas.map((f) => w.fieldLabel(owner, f)))} ${formulas.length === 1 ? "formula" : "formulas"}`,
            ]
          : []),
        ...(tiles.length
          ? [
              `on the ${list([...new Set(tiles.map((p) => humanize(p.id).toLowerCase()))])} dashboard`,
            ]
          : []),
      ];
      return {
        text: `The ${w.fieldLabel(owner, field)} is used ${list(parts)}.`,
        concepts: [`model:${owner.name}`],
        rule: "where-used",
      };
    }
    return undefined;
  }

  // "what happens when i delete a customer", "what happens if a customer is removed"
  m =
    /^what happens (?:when|if) (?:i |we |someone |you |a user )?(?:delete|remove) (.+)$/.exec(
      text,
    ) ?? /^what happens (?:when|if) (.+?) (?:is|are|gets) (?:deleted|removed)$/.exec(text);
  if (m) {
    const model = modelFor(ir, m[1] as string);
    if (!model) return undefined;
    const holders = ir.models.flatMap((o) =>
      o.fields
        .filter((f) => f.type.kind === "relation" && f.type.model === model.name && !f.type.many)
        .map((f) => ({ model: o, field: f })),
    );
    const blocked = holders.filter((h) => h.field.required);
    const cleared = holders.filter((h) => !h.field.required);
    const parts = [
      ...(blocked.length
        ? [
            `it cannot be deleted while ${list(blocked.map((h) => plural(h.model)))} still refer to it`,
          ]
        : []),
      ...(cleared.length
        ? [
            `${list(cleared.map((h) => `${plural(h.model)} lose their ${w.fieldLabel(h.model, h.field)}`))}`,
          ]
        : []),
    ];
    return {
      text: parts.length
        ? `When ${article(the(model))} is deleted, ${parts.join("; and ")}.`
        : `${capitalize(article(the(model)))} can be deleted; nothing else refers to it.`,
      concepts: [`model:${model.name}`, ...holders.map((h) => `model:${h.model.name}`)],
      rule: "what-happens",
    };
  }
  return undefined;
}

/** A field named as "the customer's email" or "email of customer". */
function fieldOfModel(ir: SpecIR, phrase: string): { model: ModelIR; field: FieldIR } | undefined {
  const m =
    /^(.+?)'s (.+)$/.exec(dropArticles(phrase)) ?? /^(.+?) of (.+)$/.exec(dropArticles(phrase));
  if (!m) return undefined;
  const [first, second] = m[0].includes("'s")
    ? [m[1] as string, m[2] as string]
    : [m[2] as string, m[1] as string];
  const model = modelFor(ir, first);
  const field = model && fieldFor(model, second);
  return model && field ? { model, field } : undefined;
}

function describeModel(model: ModelIR, w: ReturnType<typeof wordsFor>): string {
  const own = model.fields.filter(
    (f) => !f.formula && !(f.type.kind === "relation" && f.type.many),
  );
  const fields = own.map((f) => w.item(model, f));
  return `${model.description ? `${model.description.replace(/\.$/, "")}. ` : ""}${w.pluralLabel(model)} have ${list(fields)}.`;
}

function describePage(page: PageIR, ir: SpecIR, w: ReturnType<typeof wordsFor>): string {
  const modelName = pageModel(page);
  const model = modelName ? ir.models.find((m) => m.name === modelName) : undefined;
  const kind = page.pattern.kind;
  const what =
    kind === "crud" && model
      ? `lists ${w.pluralLabel(model).toLowerCase()}, with a form to add, change and delete them`
      : kind === "landing"
        ? "is a page for visitors, built from sections"
        : kind === "dashboard"
          ? "shows numbers, charts and the latest records"
          : kind === "calendar" && model
            ? `shows ${w.pluralLabel(model).toLowerCase()} by week or month`
            : `is a ${kind} page`;
  return `The ${humanize(page.id).toLowerCase()} page (${page.route}) ${what}.`;
}

const article = (s: string) => (/^[aeiou]/.test(s) ? `an ${s}` : `a ${s}`);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function list(items: string[], last = "and"): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${last} ${items.at(-1)}`;
}
