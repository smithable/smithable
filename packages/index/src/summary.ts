import {
  type AuthIR,
  apiOffers,
  type ContentIR,
  capitalize,
  emptyContent,
  type FieldIR,
  type GrantNames,
  hoursText,
  humanize,
  incomingText,
  type LandingSection,
  type ModelIR,
  outgoingText,
  type PageIR,
  type PatternKind,
  type PatternOf,
  pageAccess,
  pageModel,
  plural,
  type RoleIR,
  type SpecIR,
  type SpecPlugin,
  type StandardActionIR,
  USER_MODEL,
  type UxIR,
  type Voice,
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
  markdown: "formatted text",
  picture: "picture",
  pictures: "pictures",
  file: "a document",
  files: "documents",
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

/** The fields every record has, as a list's search, filters and sort say them. */
const AUTOMATIC: Record<string, string> = {
  createdAt: "date added",
  updatedAt: "last change",
  owner: "owner",
};

/**
 * The spec in plain language for the Builder (ARCHITECTURE §10.1): what the app stores, who
 * may do what, its pages and sign-in. Deterministic and free: no AI involved.
 */
/** How the assistant answers, in the summary's words (docs/design/ask-defaults.md §2). */
const VOICE_WORDS: Record<Voice, string> = {
  plain: "It answers plainly.",
  friendly: "It answers in a friendly voice.",
  formal: "It answers formally.",
};

export function summarize(
  ir: SpecIR,
  auth?: AuthIR,
  content: ContentIR = emptyContent(),
  plugins: readonly SpecPlugin[] = [],
  /** smithable.ux.yml, for the assistant's voice and a record's conversations; plain without it. */
  ux?: Pick<UxIR, "assistant"> & Partial<Pick<UxIR, "pages">>,
): SummarySection[] {
  const { label, pluralLabel, one, many, fieldLabel, choice, modelNamed, words, item } = wordsFor(
    ir,
    content,
  );

  const sections: SummarySection[] = [];
  // The app's languages (docs/design/languages.md §2): its own, and the others people choose.
  const named = (code: string) =>
    new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  const languages = content.languages?.length
    ? `The app is in ${named(content.language)}, and in ${list(content.languages.map(named))} for those who choose ${content.languages.length > 1 ? "them" : "it"}.`
    : undefined;
  if (ir.app.description || languages) {
    sections.push({
      concept: "app",
      title: ir.app.name,
      sentences: [
        ...(ir.app.description ? [ir.app.description] : []),
        ...(languages ? [languages] : []),
      ],
    });
  }

  // The pages first: they are the app as people see it.
  if (ir.pages.length) {
    // The home page first, then the others in the spec's order.
    const ordered = [...ir.pages].sort((a, b) => Number(b.route === "/") - Number(a.route === "/"));
    const pages = ordered.map((p) => {
      const crud = pageModel(p);
      const model = crud === undefined ? undefined : modelNamed(crud);
      // A list's page without a title of its own is its records' label, with its letters.
      const title =
        content.pages[p.id]?.title ??
        (model && content.language !== "en" ? pluralLabel(model) : humanize(p.id));
      const labels = (names: string[] | undefined) =>
        (names ?? []).map((name) => {
          const field = model?.fields.find((f) => f.name === name);
          return model && field ? fieldLabel(model, field) : (AUTOMATIC[name] ?? name);
        });
      const searched = labels(p.search);
      const filtered = labels(p.filters);
      const sorted = labels(p.sortable);
      // A page only some roles open may list records visitors still see elsewhere: say where.
      const opens = auth ? pageAccess(p, auth).roles : [];
      const narrowed = auth !== undefined && opens.length < auth.roles.length;
      const shown =
        model && narrowed && auth?.public.read.includes(model.name)
          ? ir.pages.filter(
              (o) =>
                o.pattern.kind === "landing" &&
                auth.public.pages.includes(o.id) &&
                o.pattern.sections.some((x) => x.model === model.name),
            )
          : [];
      const notes = [
        model ? `lists ${many(model)}` : "",
        p.pattern.kind === "landing"
          ? `a landing page: ${list(landingWords(p.pattern.sections))}`
          : (PATTERN_WORDS[p.pattern.kind] as (p: PageIR["pattern"]) => string)(p.pattern),
        searched.length ? `search by ${list(searched, "or")}` : "",
        filtered.length ? `filter by ${list(filtered, "or")}` : "",
        sorted.length ? `sort by ${list(sorted, "or")}` : "",
        p.mine ? "only the viewer's own records" : "",
        p.favorites === "only"
          ? "only the viewer's saved records"
          : p.favorites
            ? "records can be saved as favorites"
            : "",
        p.contact ? contactWords(p.contact, model, fieldLabel) : "",
        // A list on the record page as a conversation (conversation.md §2).
        ...Object.entries(ux?.pages?.[p.id]?.lists ?? {}).flatMap(([name, look]) => {
          const field = model?.fields.find((f) => f.name === name);
          return model && field && look === "thread"
            ? [
                `${article(one(model))}'s ${fieldLabel(model, field)} shown as a conversation with a reply box`,
              ]
            : [];
        }),
        ...(p.actions ?? []).map((a) => `“${humanize(a)}”`),
        narrowed ? `only for ${who(opens)}` : "",
        shown.length && model
          ? `visitors see ${many(model)} on the ${list(shown.map((o) => content.pages[o.id]?.title ?? humanize(o.id)))} page`
          : "",
      ].filter(Boolean);
      return `${title} (${notes.join("; ")})`;
    });
    sections.push({ concept: "pages", title: "Pages", sentences: pages.map((p) => `- ${p}`) });
  }

  /** A landing page's sections in words: what a records section shows, and the footer last. */
  function landingWords(sections: LandingSection[]): string[] {
    const ordered = [...sections].sort(
      (a, b) => Number(a.kind === "footer") - Number(b.kind === "footer"),
    );
    return ordered.map((x) => {
      const shownModel = x.kind === "records" && x.model ? modelNamed(x.model) : undefined;
      if (!shownModel) return humanize(x.name).toLowerCase();
      const only = x.where ? ` where ${conditionWords(x.where)}` : "";
      return `${many(shownModel)}${only}`;
    });
  }

  for (const model of ir.models) {
    const isOwnValue = (f: FieldIR) =>
      !f.formula && !(f.type.kind === "relation" && (f.type.many || f.type.model === USER_MODEL));
    const own = model.fields.filter(isOwnValue);
    const parts = own.map((f) => item(model, f));
    const single = one(model);
    // The fields as a list, one per line, which is also how they are edited.
    const sentences = parts.length
      ? [`${pluralLabel(model)} have:`, ...parts.map((p) => `- ${p}`)]
      : [];
    for (const f of model.fields) {
      if (f.type.kind === "relation" && f.type.model === USER_MODEL) {
        sentences.push(
          `Each ${single} can have ${article(fieldLabel(model, f))} (${["a user", ...ruleNotes(f)].join(", ")}).`,
        );
      } else if (f.type.kind === "relation" && f.type.many) {
        const target = modelNamed(f.type.model);
        if (target) sentences.push(`Each ${single} lists its ${many(target)}.`);
      } else if (f.formula) {
        sentences.push(`The ${fieldLabel(model, f)} is calculated as ${words(model, f.formula)}.`);
      }
    }
    const owner = model.fields.find((f) => f.name === model.ownedBy);
    if (owner) sentences.push(`The ${fieldLabel(model, owner)} owns the ${single}.`);
    if (model.capacity) {
      const per = model.fields.find((f) => f.name === model.capacity?.per);
      const target = per?.type.kind === "relation" ? per.type.model : model.capacity.per;
      const limit =
        typeof model.capacity.max === "number"
          ? String(model.capacity.max)
          : `the ${humanize(target).toLowerCase()}'s ${humanize(model.capacity.max.split(".")[1] ?? "").toLowerCase()}`;
      const counted = Object.entries(model.capacity.where ?? {})
        .map(([k, v]) => `${humanize(k).toLowerCase()} ${valueWords(v)}`)
        .join(" and ");
      sentences.push(
        `At most ${limit} ${many(model)} per ${humanize(target).toLowerCase()}${counted ? ` (counting those with ${counted})` : ""}.`,
      );
    }
    if (model.trash)
      sentences.push(
        `Deleted ${many(model)} stay in the trash for thirty days, where they can be restored.`,
      );
    for (const u of model.unique ?? []) {
      const named = u.fields.map((n) => {
        const f = model.fields.find((x) => x.name === n);
        return f ? fieldLabel(model, f) : humanize(n).toLowerCase();
      });
      const where =
        u.scope === "owner" ? " for one owner" : u.scope === "app" ? " in the whole app" : "";
      sentences.push(`No two ${many(model)} have the same ${named.join(" and ")}${where}.`);
    }
    if (model.review) {
      // "Photos of listings are reviewed before others see them; a listing waits until its photo is."
      const reviewed = model.review.flatMap((n) => model.fields.find((f) => f.name === n) ?? []);
      const word = (f: FieldIR) => humanize(f.name).toLowerCase();
      const plain = list(reviewed.map((f) => (/s$/.test(f.name) ? word(f) : plural(word(f)))));
      const holding = reviewed.filter((f) => f.required);
      sentences.push(
        `${capitalize(plain)} of ${many(model)} are reviewed before others see them${
          holding.length
            ? `; ${article(humanize(model.name).toLowerCase())} waits until its ${list(holding.map(word))} ${holding.length > 1 || /s$/.test(holding[0]?.name ?? "") ? "are" : "is"}`
            : ""
        }.`,
      );
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

  // "For an incident that is investigating, identified or monitoring; sets status to resolved
  // and resolved at to now." Then what it is for, if said.
  const standard = (action: StandardActionIR): string[] => {
    const model = modelNamed(action.on);
    if (!model) return [];
    const field = (name: string) => model.fields.find((f) => f.name === name);
    const when = Object.entries(action.when ?? {}).map(([name, wanted]) => {
      const f = field(name);
      if (!f) return name;
      if (typeof wanted === "boolean") return `${wanted ? "" : "not "}${fieldLabel(model, f)}`;
      return list(
        [wanted].flat().map((v) => choice(model, f, v)),
        "or",
      );
    });
    // A value in words, on the model it is written to: "status to resolved", "the cancel reason".
    const valueWords = (target: ModelIR, v: StandardActionIR["set"][number]) => {
      const f = target.fields.find((x) => x.name === v.field);
      const name = f ? fieldLabel(target, f) : v.field;
      if ("asked" in v) return { asked: name };
      if ("me" in v)
        return { set: `${name} to whoever presses it`, pair: `${name} whoever pressed it` };
      const value =
        "formula" in v
          ? words(model, v.formula)
          : f?.type.kind === "choice"
            ? choice(target, f, String(v.value))
            : typeof v.value === "boolean"
              ? v.value
                ? "yes"
                : "no"
              : String(v.value);
      return { set: `${name} to ${value}`, pair: `${name} ${value}` };
    };
    const own = action.set.map((v) => valueWords(model, v));
    const sets = own.flatMap((w) => ("set" in w && w.set ? [w.set] : []));
    const asked = [
      ...own.flatMap((w) => ("asked" in w && w.asked ? [w.asked] : [])),
      ...(action.add ?? []).flatMap((a) => {
        const target = modelNamed(a.model);
        return target
          ? a.values.flatMap((v) => {
              const w = valueWords(target, v);
              return "asked" in w && w.asked ? [`the ${one(target)}'s ${w.asked}`] : [];
            })
          : [];
      }),
    ];
    const adds = (action.add ?? []).flatMap((a) => {
      const target = modelNamed(a.model);
      if (!target) return [];
      const given = a.values.flatMap((v) => {
        const w = valueWords(target, v);
        return "pair" in w && w.pair ? [w.pair] : [];
      });
      return [`${article(one(target))}${given.length ? ` (${given.join(", ")})` : ""}`];
    });
    const item = one(model);
    // A copy: "Makes a copy of an invoice with status draft, asking for the number; its lines are copied too."
    if (action.copy) {
      const words = action.copy.map((v) => valueWords(model, v));
      const given = words.flatMap((w) => ("pair" in w && w.pair ? [w.pair] : []));
      const askedOf = words.flatMap((w) => ("asked" in w && w.asked ? [`the ${w.asked}`] : []));
      const lists = (action.with ?? []).map((l) => {
        const f = field(l);
        return f ? fieldLabel(model, f) : l;
      });
      return [
        `${when.length ? `For ${article(item)} that is ${list(when)}, makes` : "Makes"} a copy of ${article(item)}${given.length ? ` with ${list(given)}` : ""}${askedOf.length ? `, asking for ${list(askedOf)}` : ""}${lists.length ? `; its ${list(lists)} are copied too` : ""}.`,
        ...(action.intent ? [action.intent] : []),
      ];
    }
    const does = [
      ...(sets.length ? [`sets ${list(sets)}`] : []),
      ...(asked.length
        ? [`asks for ${list(asked.map((a) => (a.startsWith("the ") ? a : `the ${a}`)))}`]
        : []),
      ...(adds.length ? [`adds ${list(adds)}`] : []),
    ].join("; ");
    return [
      `${when.length ? `For ${article(item)} that is ${list(when)}; ${does}` : `${does.charAt(0).toUpperCase()}${does.slice(1)}`}.`,
      ...(action.intent ? [action.intent] : []),
    ];
  };
  for (const action of ir.actions) {
    sections.push({
      concept: `action:${action.name}`,
      title: humanize(action.name),
      sentences: [
        ...(action.custom
          ? [action.intent ?? action.description ?? "Custom code."]
          : standard(action)),
        ...(action.rules ?? []).map((r) => `Rule: ${r.text}`),
      ],
    });
  }

  // Who is told when something happens to a record: one line each, in the content file's words.
  for (const o of ir.outgoing) {
    const subject = content.outgoing[o.name]?.subject;
    sections.push({
      concept: `outgoing:${o.name}`,
      title: humanize(o.name),
      sentences: [
        outgoingText(o, (name) => {
          const model = modelNamed(name);
          return model ? one(model) : humanize(name).toLowerCase();
        }),
        ...(subject ? [`The mail's subject is “${subject}”.`] : []),
      ],
    });
  }

  // What other services may call, and what a call does.
  for (const incoming of ir.incoming) {
    sections.push({
      concept: `incoming:${incoming.name}`,
      title: humanize(incoming.name),
      sentences: [
        incomingText(incoming, (name) => {
          const model = modelNamed(name);
          return model ? one(model) : humanize(name).toLowerCase();
        }),
      ],
    });
  }

  for (const query of ir.queries) {
    const model = modelNamed(query.returns);
    sections.push({
      concept: `query:${query.name}`,
      title: humanize(query.name),
      sentences: [
        `${query.intent ?? query.description ?? "Chosen by custom code."} (${model ? many(model) : query.returns})`,
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

  if (auth) {
    // What other programs may reach with a key (docs/design/integrations.md §2).
    const offered = apiOffers(auth, ir);
    const everything = auth.api?.models === "all" && auth.api.except.length === 0;
    const records = everything
      ? "every kind of record, also ones added later,"
      : list(
          offered.models.flatMap((name) => {
            const model = modelNamed(name);
            return model ? [many(model)] : [];
          }),
        );
    const run = offered.actions.length
      ? `, and run ${list(offered.actions.map((a) => humanize(a).toLowerCase()))}`
      : "";
    const api =
      auth.api && (everything || offered.models.length)
        ? [
            `Other programs can read and change ${records} with a key${run}.${auth.api.assistants ? " AI assistants can use it too." : ""}`,
          ]
        : [];
    // "Ask", the assistant in the app (docs/design/assistant.md §6).
    const ask = auth.assistant;
    const asking = ask
      ? [
          `${
            ask.for === "anyone"
              ? "Anyone, visitors too,"
              : ask.for === "signed-in"
                ? "Everyone who signs in"
                : list(ask.for.map((r) => humanize(r)))
          } can ask the app questions${content.assistant?.name ? ` as ${content.assistant.name}` : ""}; ${ask.may === "change" ? "it may also add and change records and run actions, each confirmed by the person" : "it changes nothing"}.${ask.for === "anyone" ? " Visitors are answered without a model, over what is public." : ""} ${VOICE_WORDS[ux?.assistant.voice ?? "plain"]}`,
        ]
      : [];
    sections.push({
      concept: "auth",
      title: "Sign-in and access",
      sentences: [...access(auth), ...api, ...asking],
    });
  }
  return sections;
}

/** The summary's words for models and fields, with the labels from the content file. */
export function wordsFor(ir: SpecIR, content: ContentIR = emptyContent()) {
  // In another language the English sentences quote the app's own texts as they are ("a field
  // “Rubrik” (required)"), never bending them by English rules ("a rubrik", "newses").
  const foreign = content.language !== "en";
  const quote = (text: string) => `“${text}”`;
  const label = (m: ModelIR) => content.models[m.name]?.label ?? humanize(m.name);
  const pluralLabel = (m: ModelIR) => {
    const own = content.models[m.name];
    return (
      own?.pluralLabel ??
      (own?.label ? (foreign ? own.label : plural(own.label)) : humanize(plural(m.name)))
    );
  };
  /** A model inside a sentence, one and several. */
  const one = (m: ModelIR) => (foreign ? quote(label(m)) : label(m).toLowerCase());
  const many = (m: ModelIR) => (foreign ? quote(pluralLabel(m)) : pluralLabel(m).toLowerCase());
  const fieldLabel = (m: ModelIR, f: FieldIR) => {
    const own = content.models[m.name]?.fields[f.name]?.label;
    return foreign && own ? quote(own) : lower(own ?? humanize(f.name));
  };
  const choice = (m: ModelIR, f: FieldIR, value: string) => {
    const own = content.models[m.name]?.fields[f.name]?.values?.[value];
    return foreign && own ? quote(own) : (own ?? humanize(value)).toLowerCase();
  };
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
      if (target) notes.push(article(one(target)));
    } else if (KINDS[f.type.name] && !name.includes(f.type.name)) {
      notes.push(KINDS[f.type.name] as string);
    }
    if (f.required && f.type.kind !== "choice") notes.push("required");
    if (f.unique === "owner") notes.push("unique per owner");
    else if (f.unique === "app") notes.push("unique in the whole app");
    else if (f.unique) notes.push("unique");
    if (f.default !== undefined && f.type.kind !== "choice") notes.push(`${f.default} by default`);
    if (f.defaultFormula) notes.push(`${words(model, f.defaultFormula)} by default`);
    notes.push(...ruleNotes(f));
    // A field named by a bare preposition ("at", "on", "from") is said by what it holds:
    // "a date and time (at, required)", not "an at (a date and time, required)".
    const kind = f.type.kind === "scalar" ? KINDS[f.type.name] : undefined;
    if (kind && /^(at|on|by|from|to|until|since|in)$/.test(name)) {
      const rest = [name, ...notes.filter((n) => n !== kind)];
      return `${kind} (${rest.join(", ")})`;
    }
    // "notes" and "issued on" read better without "a"; a date named by a verb ("added",
    // "created", "due", "sent") reads "the date added", not "an added".
    const dated =
      f.type.kind === "scalar" && (f.type.name === "date" || f.type.name === "datetime");
    const verbNamed = /^(?:[a-z]+(?:ed|en)|due|sent|paid|born)$/.test(name) && dated;
    if (verbNamed) {
      const rest = notes.filter((n) => n !== kind);
      return `the ${(kind ?? "date").replace(/^an? /, "")} ${name}${rest.length ? ` (${rest.join(", ")})` : ""}`;
    }
    // No "a" before a plural, a yes/no field ("available", "paid": a state, not a thing) or a
    // label that is a question word or preposition ("about", "where").
    const bare =
      /s$| (on|at)$/.test(name) ||
      (f.type.kind === "scalar" && f.type.name === "bool") ||
      /^(about|where|when|who|what|how|why|with|for|after|before)$/.test(name);
    const named = name.startsWith("“") ? `a field ${name}` : bare ? name : article(name);
    return notes.length ? `${named} (${notes.join(", ")})` : named;
  };
  return { label, pluralLabel, one, many, fieldLabel, choice, modelNamed, words, item };
}

function access(auth: AuthIR): string[] {
  const sentences: string[] = [];
  if (auth.signIn === "none") {
    sentences.push("Nobody signs in: only public pages can be used.");
  } else {
    const domains = auth.signIn.allowedDomains;
    sentences.push(
      `People sign in with ${list(
        auth.signIn.providers.map((p) =>
          p === "email" ? "a code sent to their email" : humanize(p),
        ),
        "or",
      )}${domains ? `, only with ${list(domains, "or")} ${auth.signIn.providers.every((p) => p === "email") ? "addresses" : "accounts"}` : ""}.`,
    );
    sentences.push(
      auth.defaultAccess === "shared"
        ? "Everyone who signs in sees all records, and changes and deletes the ones they own."
        : "Everyone sees, changes and deletes only their own records.",
    );
    sentences.push("Roles:");
    for (const r of auth.roles)
      sentences.push(
        `- ${r.description ? `${r.name} (${r.description.replace(/\.$/, "")})` : r.name}: ${grantWords(r)}`,
      );
    sentences.push(`New users get the ${auth.defaultRole} role.`);
  }
  const open = [
    ...auth.public.pages.map((p) => `the ${humanize(p).toLowerCase()} page`),
    ...auth.public.read.map((m) => {
      const where = Object.entries(auth.public.readWhere[m] ?? {});
      const only = where.length ? ` where ${conditionWords(auth.public.readWhere[m] ?? {})}` : "";
      return `reading ${humanize(plural(m)).toLowerCase()}${only}`;
    }),
    ...auth.public.create.map((m) => `adding ${humanize(plural(m)).toLowerCase()}`),
  ];
  if (open.length) sentences.push(`Open to anyone without signing in: ${list(open)}.`);
  return sentences;
}

/** What a role may do beyond the record rule, as a clause: "opens every page; adds bookings". */
function grantWords(role: RoleIR): string {
  if (role.name === "admin" || role.grants === "all") return "everything";
  const names = (g: GrantNames | undefined, one: (n: string) => string, every: string) =>
    g === "all" ? every : g?.length ? list(g.map(one)) : undefined;
  const kinds = (n: string) => humanize(plural(n)).toLowerCase();
  const parts = [
    ((p) => (p ? `opens ${p}` : undefined))(
      names(role.grants.pages, (p) => `the ${humanize(p).toLowerCase()} page`, "every page"),
    ),
    ((m) => (m ? `sees everyone's ${m}` : undefined))(names(role.grants.read, kinds, "records")),
    ((m) => (m ? `adds ${m}` : undefined))(
      names(role.grants.create, kinds, "every kind of record"),
    ),
    ((m) => (m ? `changes everyone's ${m}` : undefined))(
      names(role.grants.write, kinds, "records"),
    ),
    ((m) => (m ? `deletes everyone's ${m}` : undefined))(
      names(role.grants.delete, kinds, "records"),
    ),
    ((a) => (a ? `runs ${a}` : undefined))(
      names(role.grants.actions, (a) => `“${humanize(a)}”`, "every custom action"),
    ),
  ].filter((p): p is string => p !== undefined);
  return parts.length ? parts.join("; ") : "only their own records";
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

/**
 * A role as people: "members", "assistants"; a role named for a department or a mass noun
 * ("sales", "staff", "support") stays "sales users".
 */
const MASS = new Set([
  "sales",
  "staff",
  "support",
  "hr",
  "it",
  "finance",
  "marketing",
  "management",
  "ops",
  "crew",
]);
export const roleWord = (r: string): string =>
  MASS.has(r.toLowerCase()) || plural(r) === r ? `${r} users` : plural(r);

/** Who a list of roles means; admins can always do everything, so they come last. */
export function who(roles: string[]): string {
  const others = roles
    .filter((r) => r !== "admin")
    .map((r) => (r === "owner" ? "the record's owner" : roleWord(r)));
  return list([...others, "admins"]);
}

/**
 * Who may do something with a kind of record, as a sentence: "owner" is each person for the
 * records they own, beside the roles that may for all of them ("Sales users and admins can see
 * all customers; everyone else only the ones they own.").
 */
export function whoCan(roles: string[], verb: string, things: string): string {
  if (!roles.includes("owner")) return `Only ${who(roles)} can ${verb} ${things}`;
  const all = roles.filter((r) => r !== "owner" && r !== "admin").map(roleWord);
  return all.length
    ? `${capitalize(list([...all, "admins"]))} can ${verb} all ${things}; everyone else only the ones they own`
    : `Each person can ${verb} only the ${things} they own; admins can ${verb} all`;
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
  custom: (p) => `a page of your own (${p.component}), written in code`,
  legal: () =>
    "a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights",
  crud: () => "",
  landing: (p) => `a landing page: ${list(p.sections.map((s) => humanize(s.name).toLowerCase()))}`,
  dashboard: (p) => `a dashboard: ${list(p.items.map((i) => humanize(i.name).toLowerCase()))}`,
  settings: (p) => `settings: edits your ${humanize(p.model).toLowerCase()}`,
  onboarding: (p) =>
    `a first-time setup of your ${humanize(p.model).toLowerCase()} in ${p.steps.length} steps`,
  users: () => "who has access: invite people, change roles, remove users",
  calendar: (p) => `a calendar of ${plural(humanize(p.model)).toLowerCase()} by week or month`,
  order: (p) =>
    `where visitors choose ${plural(humanize(p.from)).toLowerCase()} and send ${article(humanize(p.into).toLowerCase())}${p.hours ? `; open ${hoursText(p.hours)}` : ""}`,
  articles: (p) =>
    `${plural(humanize(p.model)).toLowerCase()} as articles, newest first, each on its own page`,
  review: (p) =>
    `the pictures and files waiting for review${p.all ? "" : ` (${list(p.models.map((m) => plural(humanize(m)).toLowerCase()))})`}, to approve or reject`,
  data: (p) =>
    p.all
      ? "every kind of record, to find, open, change and delete"
      : `${list(p.models.map((m) => plural(humanize(m)).toLowerCase()))}, to find, open, change and delete`,
  calculator: (p) =>
    `a calculator: ${list(p.calculator.fields.filter((f) => !f.formula).map((f) => humanize(f.name).toLowerCase()))} give ${list(p.calculator.fields.filter((f) => f.formula).map((f) => humanize(f.name).toLowerCase()))}`,
};

/** "contact the owner by mail", or the user field's label; with where a copy is kept. */
function contactWords(
  contact: NonNullable<PageIR["contact"]>,
  model: ModelIR | undefined,
  fieldLabel: (model: ModelIR, field: FieldIR) => string,
): string {
  const field = model?.fields.find((f) => f.name === contact.to);
  const who =
    contact.to === "owner" || !model || !field
      ? "the owner"
      : `the ${fieldLabel(model, field).toLowerCase()}`;
  return `contact ${who} by mail${contact.keep ? ` (kept in ${contact.keep})` : ""}`;
}

/** A field's rules on the record (record-rules.md) in words: who fills it, when it is fixed or required. */
function ruleNotes(f: FieldIR): string[] {
  return [
    ...(f.defaultMe ? ["who makes it, by default"] : []),
    ...(f.sequence ? ["numbered by the app, counting up"] : f.byApp ? ["filled by the app"] : []),
    ...(f.locked === true
      ? ["fixed once made"]
      : f.locked
        ? [`fixed when ${conditionWords(f.locked)}`]
        : []),
    ...(f.requiredWhen ? [`required when ${conditionWords(f.requiredWhen)}`] : []),
  ];
}

/** A condition in words: "status is published and pinned is yes". */
export function conditionWords(where: Record<string, string | boolean | string[]>): string {
  return Object.entries(where)
    .map(([k, v]) => `${humanize(k).toLowerCase()} is ${valueWords(v)}`)
    .join(" and ");
}

/** A condition's value in words: "yes", "published", "investigating or identified". */
function valueWords(v: string | boolean | string[]): string {
  if (typeof v === "boolean") return v ? "yes" : "no";
  return (Array.isArray(v) ? v : [v]).map((x) => humanize(x).toLowerCase()).join(" or ");
}
