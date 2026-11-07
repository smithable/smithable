// The app card in English sentences (docs/design/app-card.md §3), for the CLI and Studio: each
// sentence a fixed rule over the facts, no model involved. The generated app's own page renders
// the same facts with the kit's words files instead (app-card.md §4).
import type { CardCell, CardFacts, CardProject } from "./card.js";
import type { SensitiveKind } from "./sensitive.js";

type Block =
  | { h1: string }
  | { h2: string }
  | { p: string }
  | { ul: string[] }
  | { table: string[][] };

const LAST =
  "This card describes how the app is defined. It is not a security review or legal advice.";

const KIND: Record<string, string> = {
  string: "text",
  text: "long text",
  markdown: "formatted text",
  int: "a whole number",
  decimal: "a number",
  money: "an amount",
  bool: "yes or no",
  date: "a date",
  datetime: "a date and time",
  email: "an email address",
  phone: "a phone number",
  url: "a web address",
  picture: "a picture",
  pictures: "pictures",
  file: "a document",
  files: "documents",
};

const PAGE_KIND: Record<string, string> = {
  crud: "a list",
  landing: "a landing page",
  sections: "a page of parts",
  dashboard: "a dashboard",
  settings: "settings",
  onboarding: "a first-time setup",
  users: "the users page",
  data: "a data page",
  review: "a review page",
  calendar: "a calendar",
  calculator: "a calculator",
  articles: "articles",
  custom: "a custom page",
  legal: "the privacy page",
  order: "an order page",
};

const SENSITIVE: Record<SensitiveKind, string> = {
  "card-data": "a payment card's number, security code or expiry",
  "secret-field": "a password, a key or a token",
  "identity-number": "a national identity or passport number",
  "special-category-data": "health data or another specially protected kind of personal data",
};

const POLICY: Record<CardFacts["outside"]["aiPolicy"], string> = {
  "local-only": "only models on the maker's own machine",
  "eu-only": "only models hosted in the EU",
  "best-available": "the best model configured, wherever it runs",
  custom: "only the providers the context file allows",
};

const ANALYTICS: Record<string, string> = {
  plausible: "Plausible",
  umami: "Umami",
  fathom: "Fathom",
  google: "Google Analytics",
};

const list = (items: string[], and = "and") =>
  items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
const quoted = (text: string) => `“${text}”`;
const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** A cell of the access table: each verb allowed, as written, or "none". */
function cellText(cells: [string, CardCell][]): string {
  const said = cells.flatMap(([verb, c]) => {
    if (c.all) return [verb];
    const ways = [c.own ? "own" : "", c.where ? `where ${c.where}` : ""].filter(Boolean);
    return ways.length ? [`${verb} ${ways.join(", or ")}`] : [];
  });
  return said.length ? said.join("; ") : "none";
}

/** The card as blocks: headings, lines, lists and the access table. */
function blocks(facts: CardFacts, project?: CardProject): Block[] {
  const out: Block[] = [];
  const { app, does, people, access, outside, built, responsible } = facts;
  const model = (name: string) => does.models.find((m) => m.name === name);
  const plural = (name: string) => model(name)?.plural ?? name;
  const page = (id: string) => does.pages.find((p) => p.id === id)?.title ?? id;
  const action = (name: string) => does.actions.find((a) => a.name === name)?.label ?? name;
  const languages = new Intl.DisplayNames(["en"], { type: "language" });

  // 1. The app.
  out.push({ h1: app.name });
  if (app.description) out.push({ p: `${quoted(app.description)} (the maker's words)` });
  out.push({ p: `In ${list(app.languages.map((l) => languages.of(l) ?? l))}.` });
  if (app.rules)
    out.push({ p: `Its rules, in the maker's words: ${app.rules.map(quoted).join(" ")}` });
  out.push({
    p: `Version ${app.hash}${app.smithable ? `, written by Smithable ${app.smithable}` : ""}.`,
  });
  if (project?.commit)
    out.push({
      p: `From the project: commit ${project.commit.id.slice(0, 12)} of ${project.commit.date}${project.commit.uncommitted ? ", with changes not yet committed" : ""}.`,
    });
  out.push({ p: "Written from the app's definition by Smithable. Not edited by hand." });

  // 2. What it does.
  out.push({ h2: "What it does" });
  out.push({
    ul: does.models.map((m) => {
      const fields = m.fields.map((f) => {
        const kind =
          f.kind === "choice"
            ? `a choice of ${list(f.choices ?? [], "or")}`
            : f.kind === "reference"
              ? `a reference to ${f.of}`
              : f.kind === "list"
                ? `a list of ${f.of}`
                : (KIND[f.kind] ?? f.kind);
        const notes = [
          kind,
          f.computed ? "computed" : "",
          f.required ? "required" : "",
          f.unique ? `unique ${f.unique === "owner" ? "per owner" : "in the whole app"}` : "",
        ].filter(Boolean);
        return `${f.label} (${notes.join(", ")})${f.rules ? `, by the rules ${f.rules.map(quoted).join(" ")}` : ""}`;
      });
      const together = m.unique.map(
        (u) =>
          `${list(u.fields)} unique together ${u.scope === "owner" ? "per owner" : "in the whole app"}`,
      );
      return [
        `${m.plural}: ${list(fields)}.`,
        ...together.map((t) => `${t}.`),
        m.ownedBy ? `Each belongs to its ${lower(m.ownedBy)}.` : "",
        m.trash ? "Deleted ones go to a trash first." : "",
        m.rules ? `Rules, in the maker's words: ${m.rules.map(quoted).join(" ")}` : "",
      ]
        .filter(Boolean)
        .join(" ");
    }),
  });
  if (does.pages.length)
    out.push({
      p: `Pages: ${list(does.pages.map((p) => `${p.title} (${PAGE_KIND[p.kind] ?? p.kind}${p.model ? ` of ${lower(p.model)}` : ""}, at ${p.route})`))}.`,
    });
  if (does.actions.length)
    out.push({
      ul: does.actions.map((a) => {
        if (a.kind === "custom") return `${a.label}: custom code, described below.`;
        const one = article(model(a.on ?? "")?.label ?? a.on);
        const what =
          a.kind === "copy"
            ? `copies ${one}`
            : a.kind === "merge"
              ? `merges ${lower(plural(a.on ?? ""))}`
              : a.kind === "split"
                ? `splits ${one}`
                : `changes ${one}${a.sets ? `, setting ${list(a.sets.map(lower))}` : ""}`;
        return `${a.label}: ${what}${a.adds ? `, adding ${list(a.adds.map(plural).map(lower))}` : ""}${a.when ? `; only while ${a.when}` : ""}.${a.rules ? ` Rules, in the maker's words: ${a.rules.map(quoted).join(" ")}` : ""}`;
      }),
    });
  if (does.timers.length) out.push({ ul: does.timers.map((t) => t.text) });

  // 3. What it stores about people.
  const aboutPeople: string[] = [];
  if (people.signIn) {
    const ways = people.signIn.providers.map((p) =>
      p === "email" ? "a code sent by mail" : p.charAt(0).toUpperCase() + p.slice(1),
    );
    aboutPeople.push(
      `People sign in with ${list(ways, "or")}. ${people.signIn.invitedOnly ? "Only invited people and the administrators may sign in." : "Anyone may make an account."}${people.signIn.domains.length ? ` Only addresses at ${list(people.signIn.domains, "or")}.` : ""} The app stores each account's address, name and role.`,
    );
  }
  for (const r of people.records)
    aboutPeople.push(
      `${r.model} hold ${list(r.fields.map(lower))}; read by ${r.readers === "visitors" ? "anyone, signed in or not" : r.readers === "everyone" ? "everyone who signs in" : list([...r.readers, ...(r.owner ? ["each record's owner"] : [])])}.`,
    );
  if (people.uploads.length)
    aboutPeople.push(`Pictures or documents are stored with ${list(people.uploads.map(lower))}.`);
  aboutPeople.push(
    "Every change is written to an audit log in the app's database (who, when, which fields, never their values); addresses and browsers on it are blanked after 90 days, and its lines removed after 12 months. Each request's access line goes to the server's output, kept as long as whoever runs the app keeps it.",
  );
  for (const s of people.sensitive)
    aboutPeople.push(
      `The field ${s.model} › ${s.field} has a name that looks like ${SENSITIVE[s.kind]}.`,
    );
  out.push({ h2: "What it stores about people" }, { ul: aboutPeople });

  // 4. Who may see or change what.
  out.push({ h2: "Who may see or change what" });
  const who = (role?: string) => role ?? "Visitors";
  out.push({
    table: [
      ["", ...does.models.map((m) => m.plural)],
      ...access.rows.map((r) => [
        who(r.role),
        ...r.models.map((m) =>
          cellText([
            ["read", m.read],
            ["add", m.add],
            ["change", m.change],
            ["delete", m.delete],
          ]),
        ),
      ]),
    ],
  });
  out.push({
    ul: access.rows.map((r) => {
      const runs = r.actions.map((a) => {
        const notes = [a.own ? "own only" : "", a.while ? `while ${a.while}` : ""].filter(Boolean);
        return `${action(a.action)}${notes.length ? ` (${notes.join(", ")})` : ""}`;
      });
      return [
        `${who(r.role)}${r.description ? ` (${quoted(r.description)})` : ""}: ${r.pages.length ? `open ${list(r.pages.map(page))}` : "open no page"}`,
        runs.length ? `; run ${list(runs)}` : "",
        r.reviews.length ? `; approve the files of ${list(r.reviews.map(plural).map(lower))}` : "",
        ".",
      ].join("");
    }),
  });
  const accessLines: string[] = [];
  if (access.rows.length > 1) accessLines.push("A person has one role.");
  if (access.api)
    accessLines.push(
      `The API offers ${list(access.api.models.map(plural).map(lower)) || "no records"}${access.api.actions.length ? ` and the actions ${list(access.api.actions.map(action))}` : ""}; a key does what its role may.${access.api.assistants ? ` Assistants connect at /mcp with a key, and ${access.api.assistants.delete ? "may delete what the key's role may" : "never delete"}.` : ""}`,
    );
  if (responsible.customCode)
    accessLines.push(
      "Custom code runs with the access of the person who starts it; what it does is described below by its declarations only.",
    );
  if (accessLines.length) out.push({ ul: accessLines });

  // 5. What it talks to outside the app.
  const talks: string[] = [];
  if (outside.signInCodes) talks.push("Mail: sign-in codes.");
  for (const m of outside.mail) talks.push(`Mail: ${m.text}${sentFields(m.fields)}`);
  for (const c of outside.calls) talks.push(`A call to ${c.to}: ${c.text}${sentFields(c.fields)}`);
  for (const i of outside.incoming) talks.push(`Calls in: ${i.text}`);
  if (access.api) talks.push("The API, for programs with a key.");
  if (outside.analytics)
    talks.push(
      `Analytics: ${ANALYTICS[outside.analytics.provider] ?? outside.analytics.provider}, ${outside.analytics.cookies ? "with cookies, after the visitor agrees" : "without cookies"}.`,
    );
  if (access.ask) {
    const whom =
      access.ask.for === "anyone"
        ? "anyone"
        : access.ask.for === "signed-in"
          ? "everyone who signs in"
          : list(access.ask.for);
    talks.push(
      `Ask, the assistant in the app, is on for ${whom}, ${access.ask.may === "change" ? "reading and changing what they may" : "reading only"}. Its model is the one whoever runs the app sets; this card cannot say where that model runs.`,
    );
  }
  talks.push(`The models that help build the app: ${POLICY[outside.aiPolicy]}.`);
  if (responsible.customCode)
    talks.push("Custom code and plugins may call services this card cannot see.");
  out.push({ h2: "What it talks to outside the app" }, { ul: talks });

  // 6. What is generated and what is custom.
  const parts: string[] = [
    built.adapter
      ? `Built with ${built.adapter}${built.database ? ` on ${built.database}` : ""} (the context file).`
      : "Built with the stack of the Smithable that generates it; the context file names none.",
    "Generated and kit code is rewritten on each change.",
  ];
  for (const a of does.actions.filter((x) => x.kind === "custom"))
    parts.push(
      `Custom action ${a.label}: ${a.touches === "anything" ? "no contract, so it may reach anything the person running it may" : `a contract the type check holds it to (read ${list(a.touches?.reads ?? []) || "nothing"}, write ${list(a.touches?.writes ?? []) || "nothing"}), not a proof of what it does`}; ${a.examples ? `${a.examples === 1 ? "one example tests" : `${a.examples} examples test`} it` : "no example tests it"}.`,
    );
  for (const p of built.customPages) parts.push(`Custom page ${page(p.id)} (${p.component}).`);
  for (const s of built.customSections)
    parts.push(`Custom section ${s.section} on ${page(s.page)} (${s.component}).`);
  for (const q of built.customQueries)
    parts.push(`Custom query ${q.name}, choosing ${lower(q.returns)}.`);
  for (const i of built.customIncoming) parts.push(`Custom code handles the call ${i}.`);
  if (built.plugins.length) parts.push(`Plugins: ${list(built.plugins)}.`);
  if (project) {
    for (const f of project.customFiles)
      parts.push(`From the project: ${f.path}, ${f.bytes} bytes.`);
    if (project.edited.length)
      parts.push(`From the project: generated files edited by hand: ${list(project.edited)}.`);
    parts.push(
      `From the project: ${project.migrations === 1 ? "one database migration" : `${project.migrations} database migrations`}.`,
    );
    if (project.confirmed !== undefined)
      parts.push(
        `From the project: ${project.confirmed === 1 ? "one change" : `${project.confirmed} changes`} a model proposed and a person confirmed.`,
      );
  }
  out.push({ h2: "What is generated and what is custom" }, { ul: parts });

  // 7. What the person running it is responsible for.
  const duties: string[] = [];
  if (responsible.mailServer) duties.push("The mail server's settings, since the app sends mail.");
  for (const i of responsible.incomingSecrets) duties.push(`The secret of the incoming ${i}.`);
  for (const t of responsible.callTargets) duties.push(`The address and secret of ${t}.`);
  if (responsible.assistantModel) duties.push("The assistant's model settings.");
  if (responsible.apiKeys) duties.push("The API keys, made and revoked by an administrator.");
  if (responsible.privacy.page)
    duties.push(
      `The operator's details on the privacy page${responsible.privacy.hosting ? `, which says of the hosting, in the operator's words: ${quoted(responsible.privacy.hosting)}` : ""}.`,
    );
  else if (responsible.privacy.personal)
    duties.push("The app has no privacy page while it stores people's details.");
  duties.push("Backups of the database and the uploads.");
  if (responsible.customCode)
    duties.push(
      "The correctness of custom code, which Smithable type-checks and tests but does not write rules for.",
    );
  out.push({ h2: "What the person running it is responsible for" }, { ul: duties });

  // 8. What this card is not.
  out.push({ h2: "What this card is not" }, { p: LAST });
  return out;
}

const article = (label: string | undefined) => {
  const word = lower(label ?? "");
  return `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;
};

const sentFields = (fields: CardFacts["outside"]["mail"][number]["fields"]) =>
  fields === "list"
    ? ""
    : fields === "none"
      ? " The text alone goes."
      : fields === "all"
        ? " The fields its record page shows go."
        : ` Fields that go: ${list(fields)}.`;

/** Plain text for Markdown: its marks escaped, so a quoted text cannot make a link or a heading. */
const md = (text: string) => text.replace(/[\\`*_[\]<>|#~!]/g, "\\$&").replace(/^(\d+)\./, "$1\\.");
const html = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** The card as Markdown, or as one self-contained, printable HTML file. */
export function renderCard(facts: CardFacts, format: "md" | "html", project?: CardProject): string {
  const all = blocks(facts, project);
  if (format === "md")
    return `${all
      .map((b) => {
        if ("h1" in b) return `# ${md(b.h1)}`;
        if ("h2" in b) return `## ${md(b.h2)}`;
        if ("p" in b) return md(b.p);
        if ("ul" in b) return b.ul.map((l) => `- ${md(l)}`).join("\n");
        const [head = [], ...rows] = b.table;
        const line = (r: string[]) => `| ${r.map(md).join(" | ")} |`;
        return [line(head), line(head.map(() => "---")), ...rows.map(line)].join("\n");
      })
      .join("\n\n")}\n`;
  const body = all
    .map((b) => {
      if ("h1" in b) return `<h1>${html(b.h1)}</h1>`;
      if ("h2" in b) return `<h2>${html(b.h2)}</h2>`;
      if ("p" in b) return `<p>${html(b.p)}</p>`;
      if ("ul" in b) return `<ul>${b.ul.map((l) => `<li>${html(l)}</li>`).join("")}</ul>`;
      const [head = [], ...rows] = b.table;
      return `<table><thead><tr>${head.map((c) => `<th>${html(c)}</th>`).join("")}</tr></thead><tbody>${rows
        .map(
          (r) =>
            `<tr><th>${html(r[0] ?? "")}</th>${r
              .slice(1)
              .map((c) => `<td>${html(c)}</td>`)
              .join("")}</tr>`,
        )
        .join("")}</tbody></table>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="${html(facts.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${html(facts.app.name)}: app card</title>
<style>
body { font: 15px/1.5 system-ui, sans-serif; max-width: 52rem; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
h2 { margin-top: 2rem; border-bottom: 1px solid #ddd; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
@media print { body { margin: 0; max-width: none; } }
</style>
</head>
<body>
${body}
</body>
</html>
`;
}
