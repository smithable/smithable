// The app card (docs/design/app-card.md): what an app is, as plain, versioned data taken from its
// spec files by the functions the app is built from (modelAccess, pageAccess and explainAccess for
// who may do what, uniqueScope, sensitiveKind, the sections' own sentence helpers). No sentences of
// its own: renderCard (card-render.ts) writes them in English for the CLI and Studio, and the
// generated app's page will write them from these same facts with its words files. Pure, so it runs
// in the browser too: the host passes the files' texts and, apart, what only the project's folder
// knows (CardProject).
import { parseDocument } from "yaml";
import { modelAccess, pageAccess, reviewRoles, uniqueScope } from "./access.js";
import { type AuthIR, apiOffers } from "./auth.js";
import { conditionText } from "./condition.js";
import type { ContentIR, Language } from "./content.js";
import { ANALYTICS, type AnalyticsProvider } from "./context-file.js";
import { explainAccess } from "./explain-access.js";
import {
  type Condition,
  channelsOf,
  type FieldIR,
  isUpload,
  type ModelIR,
  type PatternKind,
  type ScalarType,
  type SpecIR,
  type UniqueScope,
  USER_MODEL,
} from "./ir.js";
import { humanize, plural } from "./naming.js";
import { incomingText } from "./sections/incoming.js";
import { outgoingText } from "./sections/outgoing.js";
import { timerText } from "./sections/timers.js";
import { type SensitiveKind, sensitiveKind } from "./sensitive.js";

/** The version of the facts' shape: a program comparing two cards reads it first. */
export const CARD_VERSION = 1;

/**
 * Who may do one thing (a cell of the access table): `all` the records, only their `own`, or the
 * records that fit `where` (a condition in words). Nothing true is denied.
 */
export interface CardCell {
  all: boolean;
  own: boolean;
  where?: string;
}

/** What a field holds: a scalar type, a choice of values, a reference, or a list of records. */
export type CardKind = ScalarType | "choice" | "reference" | "list";

export interface CardField {
  name: string;
  label: string;
  kind: CardKind;
  required: boolean;
  /** Computed by a formula, never typed in. */
  computed?: true;
  /** A choice's values, as labelled. */
  choices?: string[];
  /** A reference's or list's records, the model's label. */
  of?: string;
  unique?: UniqueScope;
  /** The maker's own words, quoted as written. */
  rules?: string[];
}

export interface CardModel {
  name: string;
  label: string;
  plural: string;
  fields: CardField[];
  /** Fields unique together, by label, and where. */
  unique: { fields: string[]; scope: UniqueScope }[];
  /** The field that says whose a record is, by label; none for the creator. */
  ownedBy?: string;
  /** Deleted records go to a trash first. */
  trash?: true;
  rules?: string[];
}

export interface CardPage {
  id: string;
  title: string;
  kind: PatternKind;
  route: string;
  /** The model its records are, by label. */
  model?: string;
}

export interface CardAction {
  name: string;
  label: string;
  /** custom: code of the project's own; the others are what the spec says they do. */
  kind: "change" | "copy" | "merge" | "split" | "custom";
  /** The model it runs on, by name. */
  on?: string;
  /** The fields it sets, by label. */
  sets?: string[];
  /** The models it adds records of, by name. */
  adds?: string[];
  /** Only while the record fits (in words). */
  when?: string;
  /** A custom action's contract: what it may read and write, or `anything` without one. */
  touches?: { reads: string[]; writes: string[] } | "anything";
  /** How many examples test a custom action. */
  examples?: number;
  rules?: string[];
}

/** A row of the access table: a role, or the visitors (`role` undefined). */
export interface CardRow {
  role?: string;
  /** The role's description, the maker's words. */
  description?: string;
  /** By model name, in the spec's order: read, add, change, delete. */
  models: { model: string; read: CardCell; add: CardCell; change: CardCell; delete: CardCell }[];
  /** The pages it opens, by id. */
  pages: string[];
  /** The actions it runs, by name: on every record or its own only, and only while a condition holds. */
  actions: { action: string; all: boolean; own: boolean; while?: string }[];
  /** The models whose waiting files it approves, by name. */
  reviews: string[];
}

export interface CardSent {
  name: string;
  /** "mail", or the call's target. */
  to: string;
  /** The fields that go, by label; "none" for the text alone; "all" for the record page's; "list" for a list mail's columns (in `text`). */
  fields: string[] | "none" | "all" | "list";
  /** The entry in words, as `smithable` says it elsewhere. */
  text: string;
}

export interface CardFacts {
  card: typeof CARD_VERSION;
  language: Language;
  /** 1. The app. */
  app: {
    name: string;
    /** app.description, the maker's words. */
    description?: string;
    languages: Language[];
    /** A short hash of the spec files the card is written from, in their order. */
    hash: string;
    /** The Smithable version that wrote it, when the host says. */
    smithable?: string;
    rules?: string[];
  };
  /** 2. What it does. */
  does: {
    models: CardModel[];
    pages: CardPage[];
    actions: CardAction[];
    /** Each timer in words. */
    timers: { name: string; text: string }[];
  };
  /** 3. What it stores about people. */
  people: {
    signIn?: { providers: string[]; invitedOnly: boolean; domains: string[] };
    /** Records with an email, phone or user field: who may read them, as a role list or "visitors". */
    records: {
      model: string;
      fields: string[];
      readers: "visitors" | "everyone" | string[];
      /** Each record's owner reads it too. */
      owner: boolean;
      /** Visitors read the records that fit this condition (in words). */
      visitorsWhere?: string;
    }[];
    /** Models with pictures or documents, by label. */
    uploads: string[];
    /** Fields whose names look like sensitive data: a fact about the name. */
    sensitive: { model: string; field: string; kind: SensitiveKind }[];
  };
  /** 4. Who may see or change what. */
  access: {
    rows: CardRow[];
    api?: { models: string[]; actions: string[]; assistants?: { delete: boolean } };
    /** Ask, the assistant in the app: for whom, and whether it may change records. */
    ask?: { for: "signed-in" | "anyone" | string[]; may: "read" | "change" };
  };
  /** 5. What it talks to outside the app. */
  outside: {
    signInCodes: boolean;
    mail: CardSent[];
    calls: CardSent[];
    incoming: { name: string; creates?: string; custom: boolean; mail: boolean; text: string }[];
    analytics?: { provider: string; cookies: boolean };
    /** Where the models that help build the app may run (the context file's ai.policy). */
    aiPolicy: "local-only" | "eu-only" | "best-available" | "custom";
  };
  /** 6. What is generated and what is custom. */
  built: {
    adapter?: string;
    database?: string;
    customActions: string[];
    customPages: { id: string; component: string }[];
    customSections: { page: string; section: string; component: string }[];
    customQueries: { name: string; returns: string }[];
    customIncoming: string[];
    plugins: string[];
  };
  /** 7. What the person running it is responsible for, each true only when the spec makes it so. */
  responsible: {
    mailServer: boolean;
    incomingSecrets: string[];
    /** The targets calls go to, whose address and secret are settings. */
    callTargets: string[];
    assistantModel: boolean;
    apiKeys: boolean;
    /** The privacy page: there, with the operator's hosting text quoted; or missing while people's details are stored. */
    privacy: { page: boolean; personal: boolean; hosting?: string };
    customCode: boolean;
  };
}

/**
 * What only the project's folder knows (app-card.md §3, "From the project"): the host gathers it,
 * the CLI from Git and the disk; the app's own card never has it.
 */
export interface CardProject {
  /** The commit, its date, and whether the spec files differ from it. */
  commit?: { id: string; date: string; uncommitted: boolean };
  /** Each file of src/custom/, with its size; never its content. */
  customFiles: { path: string; bytes: number }[];
  /** Generated files edited by hand (drift). */
  edited: string[];
  migrations: number;
  /** Changes a model proposed and a person confirmed (the Smithable-AI trailer). */
  confirmed?: number;
}

/** The fields the card names as personal: email, phone, and references to a person. */
export function personalFields(model: ModelIR): FieldIR[] {
  return model.fields.filter(
    (f) =>
      (f.type.kind === "scalar" && ["email", "phone"].includes(f.type.name)) ||
      (f.type.kind === "relation" && f.type.model === USER_MODEL),
  );
}

/** A short hash (FNV-1a, 64 bits, over UTF-16 code units) of the files, with LF line endings, in the order given. */
export function cardHash(files: { name: string; text: string }[]): string {
  let h = 0xcbf29ce484222325n;
  const text = files.map((f) => `${f.name}\n${f.text.replace(/\r\n/g, "\n")}\0`).join("");
  for (let i = 0; i < text.length; i++)
    h = ((h ^ BigInt(text.charCodeAt(i))) * 0x100000001b3n) & 0xffffffffffffffffn;
  return h.toString(16).padStart(16, "0").slice(0, 12);
}

export interface CardInput {
  ir: SpecIR;
  auth: AuthIR;
  content: ContentIR;
  /** smithable.context.yml's text, when the project has one. */
  context?: string;
  /** The spec files in their order (smithable.yml, auth, ux, content, context, languages). */
  files: { name: string; text: string }[];
  /** The language the labels are in; the app's own by default. */
  language?: Language;
  smithable?: string;
}

const rules = (r: { text: string }[] | undefined) =>
  r?.length ? { rules: r.map((x) => x.text) } : {};

/** The app card's facts: the same for the same files, byte for byte. */
export function appCard(input: CardInput): CardFacts {
  const { ir, auth, content } = input;
  const language = input.language ?? content.language;
  const other = language === content.language ? undefined : content.translations?.[language];
  const pick = <T>(get: (c: ContentIR) => T | undefined): T | undefined =>
    (other && get(other)) || get(content);
  const label = (model: string) => pick((c) => c.models[model]?.label) ?? humanize(model);
  const pluralLabel = (model: string) => {
    // The language's own plural, else its own label, before the app's language's.
    const said = (c: ContentIR | undefined) => c?.models[model]?.pluralLabel;
    const own = pick((c) => c.models[model]?.label);
    return (
      said(other) ??
      (other?.models[model]?.label ? own : undefined) ??
      said(content) ??
      (own ? (language === "en" ? plural(own) : own) : humanize(plural(model)))
    );
  };
  const fieldLabel = (model: string, field: string) =>
    pick((c) => c.models[model]?.fields[field]?.label) ?? humanize(field);
  const pageTitle = (id: string) => pick((c) => c.pages[id]?.title) ?? humanize(id);
  const actionLabel = (name: string) => pick((c) => c.actions[name]?.label) ?? humanize(name);
  const lower = (model: string) => label(model).toLowerCase();

  const field = (m: ModelIR, f: FieldIR): CardField => {
    const t = f.type;
    const unique = uniqueScope(f.unique || Boolean(f.sequence), m, auth);
    return {
      name: f.name,
      label: fieldLabel(m.name, f.name),
      kind:
        t.kind === "scalar"
          ? t.name
          : t.kind === "choice"
            ? "choice"
            : t.many
              ? "list"
              : "reference",
      required: f.required,
      ...(f.formula ? { computed: true as const } : {}),
      ...(t.kind === "choice"
        ? {
            choices: t.values.map(
              (v) => pick((c) => c.models[m.name]?.fields[f.name]?.values?.[v]) ?? humanize(v),
            ),
          }
        : {}),
      ...(t.kind === "relation" ? { of: t.many ? pluralLabel(t.model) : label(t.model) } : {}),
      ...(unique ? { unique } : {}),
      ...rules(f.rules),
    };
  };
  const models: CardModel[] = ir.models.map((m) => ({
    name: m.name,
    label: label(m.name),
    plural: pluralLabel(m.name),
    fields: m.fields.map((f) => field(m, f)),
    unique: (m.unique ?? []).map((u) => ({
      fields: u.fields.map((f) => fieldLabel(m.name, f)),
      scope: uniqueScope(u.scope, m, auth) as UniqueScope,
    })),
    ...(m.ownedBy ? { ownedBy: fieldLabel(m.name, m.ownedBy) } : {}),
    ...(m.trash ? { trash: true as const } : {}),
    ...rules(m.rules),
  }));
  const pages: CardPage[] = ir.pages.map((p) => {
    const model = "model" in p.pattern ? p.pattern.model : undefined;
    return {
      id: p.id,
      title: pageTitle(p.id),
      kind: p.pattern.kind,
      route: p.route,
      ...(typeof model === "string" ? { model: pluralLabel(model) } : {}),
    };
  });
  const actions: CardAction[] = ir.actions.map((a) => {
    if (a.custom)
      return {
        name: a.name,
        label: actionLabel(a.name),
        kind: "custom",
        touches: a.touches
          ? {
              reads: a.touches.reads.map(pluralLabel),
              writes: a.touches.writes.map((w) =>
                w.fields?.length
                  ? `${pluralLabel(w.model)} (${w.fields.map((f) => fieldLabel(w.model, f)).join(", ")})`
                  : pluralLabel(w.model),
              ),
            }
          : "anything",
        examples: a.examples?.length ?? 0,
        ...rules(a.rules),
      };
    return {
      name: a.name,
      label: actionLabel(a.name),
      kind: a.merge ? "merge" : a.split ? "split" : a.copy ? "copy" : "change",
      on: a.on,
      ...(a.set.length ? { sets: a.set.map((s) => fieldLabel(a.on, s.field)) } : {}),
      ...(a.add?.length ? { adds: a.add.map((x) => x.model) } : {}),
      ...(a.when ? { when: conditionText(a.when) } : {}),
      ...rules(a.rules),
    };
  });

  // 3. People: the account, the records with personal fields (as the privacy page finds them).
  const everyone = auth.roles.map((r) => r.name);
  const signIn = auth.signIn === "none" ? undefined : auth.signIn;
  const records = ir.models.flatMap((m) => {
    const personal = personalFields(m);
    if (!personal.length) return [];
    const read = modelAccess(m, auth).read;
    return [
      {
        model: pluralLabel(m.name),
        fields: personal.map((f) => fieldLabel(m.name, f.name)),
        readers:
          read.public && !read.where
            ? ("visitors" as const)
            : everyone.length && read.roles.length >= everyone.length
              ? ("everyone" as const)
              : read.roles,
        owner: !(read.public && !read.where) && read.owner && read.roles.length < everyone.length,
        ...(read.public && read.where ? { visitorsWhere: conditionText(read.where) } : {}),
      },
    ];
  });

  // 4. Who may do what: a cell per verb from modelAccess, the function the generated checks use;
  // an action's from explainAccess, which says when only the record's owner runs it.
  const cell = (all: boolean, own: boolean, where?: Condition): CardCell => ({
    all,
    own: !all && own,
    ...(!all && where ? { where: conditionText(where) } : {}),
  });
  const row = (role?: string): CardRow => {
    const signed = role !== undefined;
    const access = ir.models.map((m) => {
      const a = modelAccess(m, auth);
      const has = (op: keyof typeof a) => signed && a[op].roles.includes(role);
      return {
        model: m.name,
        read: cell(
          has("read") || (a.read.public && !a.read.where),
          signed && a.read.owner,
          a.read.public ? a.read.where : undefined,
        ),
        add: cell(has("create") || a.create.public, false),
        change: cell(has("write"), signed && a.write.owner),
        delete: cell(has("delete"), signed && a.delete.owner),
      };
    });
    const actions = ir.actions.flatMap((action) => {
      const verdict = (record: "own" | "another's") =>
        explainAccess(
          ir,
          auth,
          { ...(role ? { as: role } : {}), record },
          { kind: "action", action: action.name },
          "run",
        ).verdict;
      const all = verdict("another's") !== "denied";
      const own = !all && verdict("own") !== "denied";
      if (!all && !own) return [];
      const when = action.custom ? undefined : action.when;
      return [{ action: action.name, all, own, ...(when ? { while: conditionText(when) } : {}) }];
    });
    const description = auth.roles.find((r) => r.name === role)?.description;
    return {
      ...(role ? { role } : {}),
      ...(description ? { description } : {}),
      models: access,
      pages: ir.pages
        .filter((p) => {
          const a = pageAccess(p, auth);
          return a.public || (signed && a.roles.includes(role));
        })
        .map((p) => p.id),
      actions,
      reviews: signed
        ? ir.models
            .filter((m) => m.review?.length && reviewRoles(m.name, auth).includes(role))
            .map((m) => m.name)
        : [],
    };
  };
  const offers = apiOffers(auth, ir);

  // 5. Outside: the context file's analytics and AI policy, read as data.
  const ctx = (input.context ? parseDocument(input.context).toJSON() : {}) as {
    adapter?: string;
    database?: string;
    plugins?: string[];
    analytics?: Record<string, string>;
    ai?: { policy?: CardFacts["outside"]["aiPolicy"] };
  } | null;
  const analytics = Object.keys(ctx?.analytics ?? {})[0];
  const sent = (o: SpecIR["outgoing"][number]): CardSent => ({
    name: o.name,
    to: o.to,
    fields: o.list
      ? "list"
      : o.show === "none"
        ? "none"
        : o.show
          ? o.show.map((f) => ("model" in o.when ? fieldLabel(o.when.model, f) : humanize(f)))
          : "all",
    text: outgoingText(o, lower, ir.timers),
  });

  const customPages = ir.pages.flatMap((p) =>
    p.pattern.kind === "custom" ? [{ id: p.id, component: p.pattern.component }] : [],
  );
  const customSections = ir.pages.flatMap((p) =>
    p.sections.flatMap((s) =>
      s.component ? [{ page: p.id, section: s.name, component: s.component }] : [],
    ),
  );
  const customActions = ir.actions.filter((a) => a.custom).map((a) => a.name);
  const customIncoming = ir.incoming.filter((i) => i.custom).map((i) => i.name);
  const plugins = [...new Set([...(ctx?.plugins ?? []), ...Object.keys(ir.extensions ?? {})])];
  const customCode =
    customPages.length +
      customSections.length +
      customActions.length +
      customIncoming.length +
      ir.queries.length >
    0;
  // Push and text are named here with their step (notifications.md §9); a target is a call.
  const mail = ir.outgoing.filter((o) => channelsOf(o)?.includes("mail"));
  const calls = ir.outgoing.filter((o) => !channelsOf(o));
  const legal = ir.pages.find((p) => p.pattern.kind === "legal");
  const hosting = legal
    ? (pick((c) => c.pages[legal.id]?.sections?.operator?.hosting) as string | undefined)
    : undefined;
  const uploads = ir.models.filter((m) => m.fields.some(isUpload)).map((m) => pluralLabel(m.name));
  const languages = [content.language, ...(content.languages ?? [])];
  const sensitive = ir.models.flatMap((m) =>
    m.fields.flatMap((f) => {
      const kind = sensitiveKind(f);
      return kind ? [{ model: label(m.name), field: fieldLabel(m.name, f.name), kind }] : [];
    }),
  );

  return {
    card: CARD_VERSION,
    language,
    app: {
      name: ir.app.name,
      ...(ir.app.description ? { description: ir.app.description } : {}),
      languages,
      hash: cardHash(input.files),
      ...(input.smithable ? { smithable: input.smithable } : {}),
      ...rules(ir.app.rules),
    },
    does: {
      models,
      pages,
      actions,
      timers: ir.timers.map((t) => ({ name: t.name, text: timerText(t, lower) })),
    },
    people: {
      ...(signIn
        ? {
            signIn: {
              providers: [...signIn.providers],
              invitedOnly: !signIn.selfSignUp,
              domains: signIn.allowedDomains ?? [],
            },
          }
        : {}),
      records,
      uploads,
      sensitive,
    },
    access: {
      rows: [...(signIn ? everyone : []), undefined].map(row),
      ...(auth.api
        ? {
            api: {
              models: offers.models,
              actions: offers.actions,
              ...(auth.api.assistants
                ? { assistants: { delete: auth.api.assistants.delete } }
                : {}),
            },
          }
        : {}),
      ...(auth.assistant ? { ask: { for: auth.assistant.for, may: auth.assistant.may } } : {}),
    },
    outside: {
      signInCodes: signIn?.providers.includes("email") ?? false,
      mail: mail.map(sent),
      calls: calls.map(sent),
      incoming: ir.incoming.map((i) => ({
        name: i.name,
        ...(i.create ? { creates: pluralLabel(i.create) } : {}),
        custom: i.custom,
        mail: Boolean(i.mail),
        text: incomingText(i, lower),
      })),
      ...(analytics
        ? {
            analytics: {
              provider: analytics,
              cookies: ANALYTICS[analytics as AnalyticsProvider]?.consent ?? false,
            },
          }
        : {}),
      aiPolicy: ctx?.ai?.policy ?? "best-available",
    },
    built: {
      ...(ctx?.adapter ? { adapter: ctx.adapter } : {}),
      ...(ctx?.database ? { database: ctx.database } : {}),
      customActions,
      customPages,
      customSections,
      customQueries: ir.queries.map((q) => ({ name: q.name, returns: pluralLabel(q.returns) })),
      customIncoming,
      plugins,
    },
    responsible: {
      mailServer: mail.length > 0 || (signIn?.providers.includes("email") ?? false),
      incomingSecrets: ir.incoming.map((i) => i.name),
      callTargets: [...new Set(calls.map((o) => o.to))],
      assistantModel: auth.assistant !== undefined,
      apiKeys: auth.api !== undefined,
      privacy: {
        page: legal !== undefined,
        personal: records.length > 0 || signIn !== undefined || sensitive.length > 0,
        ...(hosting ? { hosting } : {}),
      },
      customCode: customCode || plugins.length > 0,
    },
  };
}
