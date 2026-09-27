import {
  type AuthIR,
  type ContentIR,
  emptyContent,
  type FieldIR,
  formatFormula,
  humanize,
  type ModelIR,
  pageModel,
  plural,
  type SpecIR,
  USER_MODEL,
} from "@smithable/core";

/** One part of the plain-language summary, e.g. a model or the pages. */
export interface SummarySection {
  /** The concept it describes, e.g. "model:Customer", for linking to it. */
  concept: string;
  title: string;
  sentences: string[];
}

/** What a field holds, where its name does not say it; plain text needs no note. */
const KINDS: Record<string, string> = {
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
): SummarySection[] {
  const label = (m: ModelIR) => content.models[m.name]?.label ?? humanize(m.name);
  const pluralLabel = (m: ModelIR) => {
    const own = content.models[m.name];
    return own?.pluralLabel ?? (own?.label ? plural(own.label) : humanize(plural(m.name)));
  };
  const fieldLabel = (m: ModelIR, f: FieldIR) =>
    (content.models[m.name]?.fields[f.name]?.label ?? humanize(f.name)).toLowerCase();
  const choice = (m: ModelIR, f: FieldIR, value: string) =>
    (content.models[m.name]?.fields[f.name]?.values?.[value] ?? humanize(value)).toLowerCase();
  const modelNamed = (name: string) => ir.models.find((m) => m.name === name);

  const sections: SummarySection[] = [];
  if (ir.app.description) {
    sections.push({ concept: "app", title: ir.app.name, sentences: [ir.app.description] });
  }

  for (const model of ir.models) {
    const isOwnValue = (f: FieldIR) =>
      !f.formula && !(f.type.kind === "relation" && (f.type.many || f.type.model === USER_MODEL));
    const parts = model.fields.filter(isOwnValue).map((f) => {
      const name = fieldLabel(model, f);
      const notes: string[] = [];
      if (f.type.kind === "choice") {
        notes.push(
          list(
            f.type.values.map((v) => choice(model, f, v)),
            "or",
          ),
        );
        if (f.default !== undefined)
          notes.push(`${choice(model, f, String(f.default))} by default`);
      } else if (f.type.kind === "relation") {
        const target = modelNamed(f.type.model);
        if (target) notes.push(article(label(target).toLowerCase()));
      } else if (KINDS[f.type.name] && !name.includes(f.type.name)) {
        notes.push(KINDS[f.type.name] as string);
      }
      if (f.required && f.type.kind !== "choice") notes.push("required");
      if (f.unique) notes.push("unique");
      if (f.default !== undefined && f.type.kind !== "choice")
        notes.push(`${f.default} by default`);
      if (f.defaultFormula) notes.push(`${formatFormula(f.defaultFormula)} by default`);
      const named = name.endsWith("s") ? name : article(name);
      return notes.length ? `${named} (${notes.join(", ")})` : named;
    });
    const one = label(model).toLowerCase();
    const sentences = [`${pluralLabel(model)} have ${list(parts)}.`];
    for (const f of model.fields) {
      if (f.type.kind === "relation" && f.type.model === USER_MODEL) {
        sentences.push(`Each ${one} can have ${article(fieldLabel(model, f))} (a user).`);
      } else if (f.type.kind === "relation" && f.type.many) {
        const target = modelNamed(f.type.model);
        if (target) sentences.push(`Each ${one} lists its ${pluralLabel(target).toLowerCase()}.`);
      } else if (f.formula) {
        sentences.push(`The ${fieldLabel(model, f)} is calculated: ${formatFormula(f.formula)}.`);
      }
    }
    const owner = model.fields.find((f) => f.name === model.ownedBy);
    if (owner) sentences.push(`The ${fieldLabel(model, owner)} owns the ${one}.`);
    for (const [op, roles] of Object.entries(model.access ?? {})) {
      const verb = VERBS[op as keyof typeof VERBS];
      sentences.push(`Only ${who(roles)} can ${verb} ${pluralLabel(model).toLowerCase()}.`);
    }
    for (const rule of model.rules ?? []) sentences.push(`Rule: ${rule.text}`);
    sections.push({ concept: `model:${model.name}`, title: pluralLabel(model), sentences });
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
        p.pattern.kind === "landing"
          ? `a landing page: ${list(p.pattern.sections.map((s) => humanize(s.name).toLowerCase()))}`
          : "",
        p.pattern.kind === "dashboard"
          ? `a dashboard: ${list(p.pattern.items.map((i) => humanize(i.name).toLowerCase()))}`
          : "",
        searched.length ? `search by ${list(searched, "or")}` : "",
        ...(p.actions ?? []).map((a) => `“${humanize(a)}”`),
        p.access ? `only for ${who(p.access)}` : "",
      ].filter(Boolean);
      return `${title} (${notes.join("; ")})`;
    });
    sections.push({ concept: "pages", title: "Pages", sentences: [`${list(pages)}.`] });
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

  if (auth)
    sections.push({ concept: "auth", title: "Sign-in and access", sentences: access(auth) });
  return sections;
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
    const roles = auth.roles.map((r) =>
      r.description ? `${r.name} (${r.description.replace(/\.$/, "")})` : r.name,
    );
    sentences.push(`Roles: ${roles.join("; ")}. New users get the ${auth.defaultRole} role.`);
  }
  const open = [
    ...auth.public.pages.map((p) => `the ${humanize(p).toLowerCase()} page`),
    ...auth.public.read.map((m) => `reading ${humanize(plural(m)).toLowerCase()}`),
    ...auth.public.create.map((m) => `adding ${humanize(plural(m)).toLowerCase()}`),
  ];
  if (open.length) sentences.push(`Open to anyone without signing in: ${list(open)}.`);
  return sentences;
}

/** Who a list of roles means; admins can always do everything, so they come last. */
function who(roles: string[]): string {
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
  return `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;
}
