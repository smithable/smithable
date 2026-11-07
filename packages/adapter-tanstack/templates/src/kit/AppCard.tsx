// Smithable app kit: the app card (docs/design/app-card.md), served at /app-card to the
// administrators. The facts are written by the generator from the app's own definition, one set
// per language; every sentence here is a word of the kit's, filled with them. The card says how
// the app is defined, never what its records hold.

import { language, w } from "./words";

/** One cell of the access table: every record, its own, or the ones that fit a condition. */
export interface CardCell {
  all: boolean;
  own: boolean;
  where?: string;
}

interface CardSent {
  name: string;
  to: string;
  fields: string[] | "none" | "all" | "list";
  text: string;
}

/** The facts (packages/core/src/card.ts CardFacts, version 1): the same shape the CLI writes. */
export interface CardFacts {
  card: 1;
  language: string;
  app: {
    name: string;
    description?: string;
    languages: string[];
    hash: string;
    smithable?: string;
    rules?: string[];
  };
  does: {
    models: {
      name: string;
      label: string;
      plural: string;
      fields: {
        name: string;
        label: string;
        kind: string;
        required: boolean;
        computed?: true;
        choices?: string[];
        of?: string;
        unique?: "owner" | "app";
        rules?: string[];
      }[];
      unique: { fields: string[]; scope: "owner" | "app" }[];
      ownedBy?: string;
      trash?: true;
      rules?: string[];
    }[];
    pages: { id: string; title: string; kind: string; route: string; model?: string }[];
    actions: {
      name: string;
      label: string;
      kind: "change" | "copy" | "merge" | "split" | "custom";
      on?: string;
      sets?: string[];
      adds?: string[];
      when?: string;
      touches?: { reads: string[]; writes: string[] } | "anything";
      examples?: number;
      rules?: string[];
    }[];
    timers: { name: string; text: string }[];
  };
  people: {
    signIn?: { providers: string[]; invitedOnly: boolean; domains: string[] };
    records: {
      model: string;
      fields: string[];
      readers: "visitors" | "everyone" | string[];
      owner: boolean;
      visitorsWhere?: string;
    }[];
    uploads: string[];
    sensitive: { model: string; field: string; kind: string }[];
  };
  access: {
    rows: {
      role?: string;
      description?: string;
      models: {
        model: string;
        read: CardCell;
        add: CardCell;
        change: CardCell;
        delete: CardCell;
      }[];
      pages: string[];
      actions: { action: string; all: boolean; own: boolean; while?: string }[];
      reviews: string[];
    }[];
    api?: { models: string[]; actions: string[]; assistants?: { delete: boolean } };
    ask?: { for: "signed-in" | "anyone" | string[]; may: "read" | "change" };
  };
  outside: {
    signInCodes: boolean;
    mail: CardSent[];
    calls: CardSent[];
    incoming: { name: string; creates?: string; custom: boolean; mail: boolean; text: string }[];
    analytics?: { provider: string; cookies: boolean };
    aiPolicy: "local-only" | "eu-only" | "best-available" | "custom";
  };
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
  responsible: {
    mailServer: boolean;
    incomingSecrets: string[];
    callTargets: string[];
    assistantModel: boolean;
    apiKeys: boolean;
    privacy: { page: boolean; personal: boolean; hosting?: string };
    customCode: boolean;
  };
}

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** The card in the language now, or the app's own when it has none for it. */
export function AppCard({ cards, main }: { cards: Record<string, CardFacts>; main: string }) {
  const facts = cards[language()] ?? (cards[main] as CardFacts);
  const { app, does, people, access, outside, built, responsible } = facts;
  const c = w.card;
  const list = (items: string[], or = false) => c.list(items, or);
  const model = (name: string) => does.models.find((m) => m.name === name);
  const plural = (name: string) => model(name)?.plural ?? name;
  const page = (id: string) => does.pages.find((p) => p.id === id)?.title ?? id;
  const action = (name: string) => does.actions.find((a) => a.name === name)?.label ?? name;
  const names = new Intl.DisplayNames([facts.language], { type: "language" });
  const rules = (r?: string[]) => (r ? ` ${c.rules(r.map(c.quoted).join(" "))}` : "");
  const sent = (fields: CardSent["fields"]) =>
    fields === "list"
      ? ""
      : fields === "none"
        ? ` ${c.sentNone}`
        : fields === "all"
          ? ` ${c.sentAll}`
          : ` ${c.sentFields(list(fields))}`;
  const cell = (cells: [string, CardCell][]) => {
    const said = cells.flatMap(([verb, x]) => {
      if (x.all) return [verb];
      const ways = [x.own ? c.own : "", x.where ? c.where(x.where) : ""].filter(Boolean);
      return ways.length ? [`${verb} ${ways.join(c.orJoin)}`] : [];
    });
    return said.length ? said.join("; ") : c.none;
  };

  const models = does.models.map((m) => {
    const fields = m.fields.map((f) => {
      const kind =
        f.kind === "choice"
          ? c.choiceOf(list(f.choices ?? [], true))
          : f.kind === "reference"
            ? c.referenceTo(f.of ?? "")
            : f.kind === "list"
              ? c.listOf(f.of ?? "")
              : (c.kinds[f.kind as keyof typeof c.kinds] ?? f.kind);
      const notes = [
        kind,
        f.computed ? c.computed : "",
        f.required ? c.required : "",
        f.unique ? c.unique(f.unique) : "",
      ].filter(Boolean);
      return `${f.label} (${notes.join(", ")})${f.rules ? `, ${c.byRules(f.rules.map(c.quoted).join(" "))}` : ""}`;
    });
    return [
      `${m.plural}: ${list(fields)}.`,
      ...m.unique.map((u) => `${c.uniqueTogether(list(u.fields), u.scope)}.`),
      m.ownedBy ? c.belongs(lower(m.ownedBy)) : "",
      m.trash ? c.trash : "",
      rules(m.rules).trim(),
    ]
      .filter(Boolean)
      .join(" ");
  });
  const actions = does.actions.map((a) => {
    if (a.kind === "custom") return c.customAction(a.label);
    const one = lower(model(a.on ?? "")?.label ?? a.on ?? "");
    const what =
      a.kind === "copy"
        ? c.copies(one)
        : a.kind === "merge"
          ? c.merges(lower(plural(a.on ?? "")))
          : a.kind === "split"
            ? c.splits(one)
            : c.changes(one, a.sets ? list(a.sets.map(lower)) : undefined);
    return `${a.label}: ${what}${a.adds ? c.adding(list(a.adds.map(plural).map(lower))) : ""}${a.when ? c.onlyWhile(a.when) : ""}.${rules(a.rules)}`;
  });

  const aboutPeople: string[] = [];
  if (people.signIn)
    aboutPeople.push(
      c.signIn(
        list(
          people.signIn.providers.map((p) =>
            p === "email" ? c.byCode : p.charAt(0).toUpperCase() + p.slice(1),
          ),
          true,
        ),
        people.signIn.invitedOnly,
        list(people.signIn.domains, true),
      ),
    );
  for (const r of people.records)
    aboutPeople.push(
      c.holds(
        r.model,
        list(r.fields.map(lower)),
        r.readers === "visitors"
          ? c.readAnyone
          : r.readers === "everyone"
            ? c.readSignedIn
            : list([...r.readers, ...(r.owner ? [c.eachOwner] : [])]) || c.noOne,
        r.visitorsWhere,
      ),
    );
  if (people.uploads.length) aboutPeople.push(c.uploads(list(people.uploads.map(lower))));
  aboutPeople.push(c.auditLog);
  for (const s of people.sensitive)
    aboutPeople.push(
      c.sensitive(
        `${s.model} › ${s.field}`,
        c.sensitiveKinds[s.kind as keyof typeof c.sensitiveKinds] ?? s.kind,
      ),
    );

  const who = (role?: string) => role ?? c.visitors;
  const runs = access.rows.map((r) => {
    const acts = r.actions.map((a) => {
      const notes = [a.own ? c.ownOnly : "", a.while ? c.whileWhen(a.while) : ""].filter(Boolean);
      return `${action(a.action)}${notes.length ? ` (${notes.join(", ")})` : ""}`;
    });
    return [
      `${who(r.role)}${r.description ? ` (${c.quoted(r.description)})` : ""}: ${r.pages.length ? c.opens(list(r.pages.map(page))) : c.opensNone}`,
      acts.length ? `; ${c.runs(list(acts))}` : "",
      r.reviews.length ? `; ${c.approves(list(r.reviews.map(plural).map(lower)))}` : "",
      ".",
    ].join("");
  });
  const accessLines: string[] = [];
  if (access.rows.length > 1) accessLines.push(c.oneRole);
  if (access.api)
    accessLines.push(
      c.api(
        list(access.api.models.map(plural).map(lower)),
        list(access.api.actions.map(action)),
        access.api.assistants?.delete,
      ),
    );
  if (responsible.customCode) accessLines.push(c.customRunsAs);

  const talks: string[] = [];
  if (outside.signInCodes) talks.push(c.mailCodes);
  for (const m of outside.mail) talks.push(`${c.mail(m.text)}${sent(m.fields)}`);
  for (const x of outside.calls) talks.push(`${c.call(x.to, x.text)}${sent(x.fields)}`);
  for (const i of outside.incoming) talks.push(c.callsIn(i.text));
  if (access.api) talks.push(c.apiTalks);
  if (outside.analytics)
    talks.push(c.analytics(outside.analytics.provider, outside.analytics.cookies));
  if (access.ask)
    talks.push(
      c.ask(
        access.ask.for === "anyone"
          ? c.anyone
          : access.ask.for === "signed-in"
            ? c.readSignedIn
            : list(access.ask.for),
        access.ask.may,
      ),
    );
  talks.push(c.policy(outside.aiPolicy));
  if (responsible.customCode) talks.push(c.customMayCall);

  const parts: string[] = [c.builtWith(built.adapter, built.database), c.rewritten];
  for (const a of does.actions.filter((x) => x.kind === "custom"))
    parts.push(
      `${c.customContract(
        a.label,
        a.touches === "anything" ? undefined : a.touches,
        a.examples ?? 0,
      )}${rules(a.rules)}`,
    );
  for (const p of built.customPages) parts.push(c.customPage(page(p.id), p.component));
  for (const s of built.customSections)
    parts.push(c.customSection(s.section, page(s.page), s.component));
  for (const q of built.customQueries) parts.push(c.customQuery(q.name, lower(q.returns)));
  for (const i of built.customIncoming) parts.push(c.customIncoming(i));
  if (built.plugins.length) parts.push(c.plugins(list(built.plugins)));

  const duties: string[] = [];
  if (responsible.mailServer) duties.push(c.dutyMail);
  for (const i of responsible.incomingSecrets) duties.push(c.dutySecret(i));
  for (const t of responsible.callTargets) duties.push(c.dutyCall(t));
  if (responsible.assistantModel) duties.push(c.dutyAssistant);
  if (responsible.apiKeys) duties.push(c.dutyKeys);
  if (responsible.privacy.page) duties.push(c.dutyPrivacy(responsible.privacy.hosting));
  else if (responsible.privacy.personal) duties.push(c.noPrivacy);
  duties.push(c.dutyBackups(people.uploads.length > 0));
  if (responsible.customCode) duties.push(c.dutyCustom);

  const Part = ({ title, items }: { title: string; items: string[] }) => (
    <section className="space-y-2">
      <h2 className="border-b pb-1 text-xl font-semibold">{title}</h2>
      <ul className="list-disc space-y-1 pl-5">
        {items.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: two lines may say the same
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  );
  return (
    <article data-kit="app-card" className="mx-auto max-w-4xl space-y-8 px-5 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{app.name}</h1>
        {app.description && <p>{c.makersWords(c.quoted(app.description))}</p>}
        <p>{c.inLanguages(list(app.languages.map((l) => names.of(l) ?? l)))}</p>
        {app.rules && <p>{c.appRules(app.rules.map(c.quoted).join(" "))}</p>}
        <p className="text-muted-foreground">{c.version(app.hash, app.smithable)}</p>
        <p className="text-muted-foreground">{c.written}</p>
      </header>
      <section className="space-y-2">
        <h2 className="border-b pb-1 text-xl font-semibold">{c.doesTitle}</h2>
        {models.length > 0 && (
          <ul className="list-disc space-y-1 pl-5">
            {models.map((m, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: two lines may say the same
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}
        {does.pages.length > 0 && (
          <p>
            {c.pages(
              list(
                does.pages.map(
                  (p) =>
                    `${p.title} (${c.pageKinds[p.kind as keyof typeof c.pageKinds] ?? p.kind}${p.model ? c.ofModel(lower(p.model)) : ""}, ${c.at(p.route)})`,
                ),
              ),
            )}
          </p>
        )}
        {actions.length > 0 && (
          <ul className="list-disc space-y-1 pl-5">
            {actions.map((a, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: two lines may say the same
              <li key={i}>{a}</li>
            ))}
          </ul>
        )}
        {does.timers.length > 0 && (
          <ul className="list-disc space-y-1 pl-5">
            {does.timers.map((t) => (
              <li key={t.name}>{t.text}</li>
            ))}
          </ul>
        )}
      </section>
      <Part title={c.peopleTitle} items={aboutPeople} />
      <section className="space-y-2">
        <h2 className="border-b pb-1 text-xl font-semibold">{c.accessTitle}</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border p-1" />
                {does.models.map((m) => (
                  <th key={m.name} className="border p-1 text-left">
                    {m.plural}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {access.rows.map((r) => (
                <tr key={r.role ?? ""}>
                  <th className="border p-1 text-left">{who(r.role)}</th>
                  {/* Each cell under its own column, by the model's name, not its place. */}
                  {does.models.map((dm) => {
                    const m = r.models.find((x) => x.model === dm.name);
                    return (
                      <td key={dm.name} className="border p-1 align-top">
                        {m
                          ? cell([
                              [c.read, m.read],
                              [c.add, m.add],
                              [c.change, m.change],
                              [c.delete, m.delete],
                            ])
                          : c.none}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="list-disc space-y-1 pl-5">
          {[...runs, ...accessLines].map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: two lines may say the same
            <li key={i}>{line}</li>
          ))}
        </ul>
      </section>
      <Part title={c.outsideTitle} items={talks} />
      <Part title={c.builtTitle} items={parts} />
      <Part title={c.dutiesTitle} items={duties} />
      <section className="space-y-2">
        <h2 className="border-b pb-1 text-xl font-semibold">{c.notTitle}</h2>
        <p>{c.not}</p>
      </section>
    </article>
  );
}
