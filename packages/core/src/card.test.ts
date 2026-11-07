import { describe, expect, test } from "vitest";
import { type AuthIR, validateAuth } from "./auth.js";
import { appCard, CARD_VERSION, type CardFacts } from "./card.js";
import { renderCard } from "./card-render.js";
import { AUTH_SCHEMA } from "./companion-schemas.js";
import { type ContentIR, emptyContent, validateContent } from "./content.js";
import { CONTEXT_SCHEMA } from "./context-file.js";
import { explainAccess } from "./explain-access.js";
import type { SpecIR } from "./ir.js";
import { buildJsonSchema } from "./schema.js";
import { validateSpec } from "./spec.js";

const examples = import.meta.glob("../../../examples/*/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const names = [...new Set(Object.keys(examples).map((p) => p.split("/")[4] as string))];

function load(spec: string, authText: string, contentText?: string) {
  const roles = validateAuth({ path: "smithable.auth.yml", text: authText }).auth?.roles.map(
    (r) => r.name,
  );
  const read = validateSpec({ path: "smithable.yml", text: spec }, roles ? { roles } : {});
  if (!read.ir) throw new Error(read.diagnostics.map((d) => d.message).join("\n"));
  const ir = read.ir as SpecIR;
  const auth = validateAuth({ path: "smithable.auth.yml", text: authText }, ir).auth as AuthIR;
  const content = contentText
    ? (validateContent({ path: "smithable.content.yml", text: contentText }, ir, undefined, auth)
        .content as ContentIR)
    : emptyContent();
  return { ir, auth, content, files: [{ name: "smithable.yml", text: spec }] };
}
const example = (name: string) => {
  const file = (f: string) => examples[`../../../examples/${name}/${f}`];
  return load(
    file("smithable.yml") as string,
    file("smithable.auth.yml") as string,
    file("smithable.content.yml"),
  );
};

describe.each(names)("%s", (name) => {
  const input = example(name);
  const facts = appCard(input);

  test("the same files give the same facts and the same card, byte for byte", () => {
    expect(JSON.stringify(appCard(example(name)))).toBe(JSON.stringify(facts));
    expect(renderCard(appCard(example(name)), "md")).toBe(renderCard(facts, "md"));
  });

  test("every model, field, page, action and timer is on the card", () => {
    const md = renderCard(facts, "md").replace(/\\/g, "");
    for (const m of facts.does.models) {
      expect(md).toContain(m.plural);
      for (const f of m.fields) expect(md).toContain(f.label);
    }
    for (const p of facts.does.pages) expect(md).toContain(p.title);
    for (const a of facts.does.actions) expect(md).toContain(a.label);
    for (const t of facts.does.timers) expect(md).toContain(t.text);
  });

  test("every cell agrees with explainAccess, the rules the generated app enforces", () => {
    const { ir, auth } = input;
    for (const row of facts.access.rows) {
      const as = row.role === undefined ? {} : { as: row.role };
      for (const m of row.models)
        for (const [verb, cell] of [
          ["read", m.read],
          ["create", m.add],
          ["write", m.change],
          ["delete", m.delete],
        ] as const) {
          const said = explainAccess(ir, auth, as, { kind: "model", model: m.model }, verb).verdict;
          const expected = cell.all ? "allowed" : cell.own || cell.where ? "conditional" : "denied";
          expect([row.role, m.model, verb, said]).toEqual([row.role, m.model, verb, expected]);
        }
      for (const page of ir.pages) {
        const said = explainAccess(ir, auth, as, { kind: "page", page: page.id }, "open").verdict;
        expect([row.role, page.id, said === "allowed"]).toEqual([
          row.role,
          page.id,
          row.pages.includes(page.id),
        ]);
      }
    }
  });
});

describe("a shop with custom code, a call out, a call in and quoted texts", () => {
  const spec = `smithable: 0.1
app:
  name: "Shop <script>alert(1)</script>"
  description: "Sells [things](javascript:alert(1)) & more"
models:
  Customer:
    fields:
      name: string!
      email: email
      diagnosis: text
      credit: { type: money, default: 4242 }
  Invoice:
    fields:
      number: string! unique
      customer: Customer!
      total: money!
      status: draft | sent
actions:
  markSent: { on: Invoice, set: { status: sent }, when: { status: draft } }
  reconcile:
    custom: true
    input: { statement: file! }
    touches: { reads: [Invoice], writes: [Invoice.status] }
    examples:
      - given: { Invoice: [{ id: 1, number: SECRET-NUMBER-77, customer: 1, total: 120, status: sent }] }
        input: { statement: samples/x.csv }
        output: refused
outgoing:
  invoiceSent: { when: Invoice created, to: ledgerHook, show: [number, total] }
incoming:
  paymentReceived: { custom: true, signed: sha256, as: admin }
pages:
  invoices: { crud: Invoice }
  customers: { crud: Customer }
  planner: { custom: Planner }
`;
  const auth = `smithableAuth: 0.1
signIn:
  providers: [email]
defaultAccess: private
roles:
  admin: {}
  clerk:
    pages: [invoices]
    read: [Invoice]
    create: [Invoice]
    actions: [reconcile]
defaultRole: clerk
admins: [owner@shop.example]
public:
  read:
    - Invoice: { where: { status: sent } }
`;
  const input = load(spec, auth);
  const facts = appCard({
    ...input,
    context:
      "smithableContext: 0.1\nai: { policy: eu-only }\nanalytics: { plausible: shop.example.com }\n",
  });

  test("the facts' shape: versioned, the eight parts in order", () => {
    expect(facts.card).toBe(CARD_VERSION);
    expect(Object.keys(facts)).toEqual([
      "card",
      "language",
      "app",
      "does",
      "people",
      "access",
      "outside",
      "built",
      "responsible",
    ]);
    const clerk = facts.access.rows.find((r) => r.role === "clerk");
    expect(clerk?.models.find((m) => m.model === "Invoice")).toEqual({
      model: "Invoice",
      read: { all: true, own: false },
      add: { all: true, own: false },
      change: { all: false, own: true },
      delete: { all: false, own: true },
    });
    expect(clerk?.actions).toEqual([
      { action: "markSent", all: false, own: true, while: "status is draft" },
      { action: "reconcile", all: true, own: false },
    ]);
    const visitors = facts.access.rows.at(-1);
    expect(visitors?.role).toBeUndefined();
    expect(visitors?.models.find((m) => m.model === "Invoice")?.read).toEqual({
      all: false,
      own: false,
      where: "status is sent",
    });
    expect(facts.does.actions.find((a) => a.name === "reconcile")).toMatchObject({
      kind: "custom",
      touches: { reads: ["Invoices"], writes: ["Invoices (Status)"] },
      examples: 1,
    });
    expect(facts.people.sensitive).toEqual([
      { model: "Customer", field: "Diagnosis", kind: "special-category-data" },
    ]);
    expect(facts.outside).toMatchObject({
      aiPolicy: "eu-only",
      analytics: { provider: "plausible", cookies: false },
      calls: [{ name: "invoiceSent", to: "ledgerHook", fields: ["Number", "Total"] }],
    });
    expect(facts.built.customPages).toEqual([{ id: "planner", component: "Planner" }]);
    expect(facts.responsible).toMatchObject({
      incomingSecrets: ["paymentReceived"],
      callTargets: ["ledgerHook"],
      customCode: true,
      privacy: { page: false, personal: true },
    });
  });

  test("quoted texts are escaped, in HTML and in Markdown", () => {
    const html = renderCard(facts, "html");
    expect(html).not.toContain("<script>");
    expect(html).toContain("Shop &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Sells [things](javascript:alert(1)) &amp; more");
    const md = renderCard(facts, "md");
    expect(md).toContain("Shop \\<script\\>");
    expect(md).toContain("Sells \\[things\\](javascript:alert(1))");
  });

  test("no record values: not a default, not an example's", () => {
    const all = [JSON.stringify(facts), renderCard(facts, "md"), renderCard(facts, "html")];
    for (const text of all) {
      expect(text).not.toContain("4242");
      expect(text).not.toContain("SECRET-NUMBER-77");
      expect(text).not.toContain("samples/x.csv");
    }
  });

  test("the project's facts are said as the project's, and only in the CLI's card", () => {
    const project = {
      commit: { id: "0123456789abcdef", date: "2026-11-07", uncommitted: true },
      customFiles: [{ path: "src/custom/actions/reconcile.ts", bytes: 812 }],
      edited: ["src/routes/index.tsx"],
      migrations: 3,
      confirmed: 2,
    };
    const md = renderCard(facts, "md", project);
    expect(md).toContain("commit 0123456789ab of 2026-11-07, with changes not yet committed");
    expect(md).toContain("src/custom/actions/reconcile.ts, 812 bytes");
    expect(md).toContain("3 database migrations");
    expect(renderCard(facts, "md")).not.toContain("From the project");
  });
});

// Every key of the spec files is on the card or left out on purpose (app-card.md §5): a new key
// fails here until it takes a side. A pattern ending in ".**" covers the key and all beneath it.
const SHOWN = [
  "smithable.yml:app",
  "smithable.yml:app.name",
  "smithable.yml:app.description",
  "smithable.yml:app.rules.**",
  "smithable.yml:models",
  "smithable.yml:models.*.fields",
  "smithable.yml:models.*.fields.*.type",
  "smithable.yml:models.*.fields.*.required",
  "smithable.yml:models.*.fields.*.unique",
  "smithable.yml:models.*.fields.*.sequence",
  "smithable.yml:models.*.fields.*.formula",
  "smithable.yml:models.*.fields.*.rules.**",
  "smithable.yml:models.*.ownedBy",
  "smithable.yml:models.*.review",
  "smithable.yml:models.*.trash",
  "smithable.yml:models.*.unique.**",
  "smithable.yml:models.*.rules.**",
  "smithable.yml:actions",
  "smithable.yml:actions.*.custom",
  "smithable.yml:actions.*.on",
  "smithable.yml:actions.*.when",
  "smithable.yml:actions.*.set",
  "smithable.yml:actions.*.add",
  "smithable.yml:actions.*.copy",
  "smithable.yml:actions.*.merge",
  "smithable.yml:actions.*.split",
  "smithable.yml:actions.*.touches.**",
  "smithable.yml:actions.*.examples",
  "smithable.yml:actions.*.rules.**",
  "smithable.yml:queries",
  "smithable.yml:queries.*.custom",
  "smithable.yml:queries.*.returns",
  "smithable.yml:timers.**",
  "smithable.yml:outgoing.**",
  "smithable.yml:incoming.**",
  "smithable.yml:pages",
  "smithable.yml:pages.*.route",
  ...[
    "crud",
    "landing",
    "sections",
    "dashboard",
    "settings",
    "onboarding",
    "users",
    "data",
    "review",
    "calendar",
    "calculator",
    "articles",
    "custom",
    "legal",
    "order",
  ].map((kind) => `smithable.yml:pages.*.${kind}`),
  "smithable.yml:pages.*.landing.*.custom",
  "smithable.yml:pages.*.sections.*.custom",
  "smithable.auth.yml:signIn.**",
  "smithable.auth.yml:defaultAccess",
  "smithable.auth.yml:roles.**",
  "smithable.auth.yml:public.**",
  "smithable.auth.yml:api.**",
  "smithable.auth.yml:assistant.**",
  "smithable.context.yml:adapter",
  "smithable.context.yml:database",
  "smithable.context.yml:plugins",
  "smithable.context.yml:analytics.**",
  "smithable.context.yml:ai",
  "smithable.context.yml:ai.policy",
];
const LEFT_OUT: Record<string, string> = {
  "smithable.yml:smithable": "the file's format version",
  "smithable.auth.yml:smithableAuth": "the file's format version",
  "smithable.context.yml:smithableContext": "the file's format version",
  "smithable.yml:app.currency": "how values are written, not what the app does",
  "smithable.yml:app.timezone": "how values are written",
  "smithable.yml:app.clock": "how values are written",
  "smithable.yml:app.date": "how values are written",
  "smithable.yml:app.week": "how values are written",
  "smithable.yml:app.numbers": "how values are written",
  "smithable.yml:app.intent": "notes for models and developers",
  "smithable.yml:*.description":
    "notes for models and developers; the card quotes app.description and rules only",
  "smithable.yml:*.intent": "notes for models and developers",
  "smithable.yml:models.*.fields.*.default": "a value: the card holds no record values",
  "smithable.yml:models.*.fields.*.examples.**": "values: the card holds no record values",
  "smithable.yml:models.*.fields.*.min": "a field's bounds: in What it does (Studio)",
  "smithable.yml:models.*.fields.*.max": "a field's bounds",
  "smithable.yml:models.*.fields.*.by": "who fills a field in: the table is per kind of record",
  "smithable.yml:models.*.fields.*.locked":
    "when a field is locked: the table is per kind of record",
  "smithable.yml:models.*.namedBy": "how a record is named on its pages",
  "smithable.yml:models.*.thread.**": "how a list shows as a conversation",
  "smithable.yml:models.*.capacity.**": "booking rules: in What it does (Studio)",
  "smithable.yml:models.*.schedule.**": "booking rules",
  "smithable.yml:models.*.occupies.**": "booking rules",
  "smithable.yml:actions.*.with": "what a copy takes along",
  "smithable.yml:actions.*.into": "where a merge keeps its record",
  "smithable.yml:actions.*.fields": "a merge's rule per field",
  "smithable.yml:actions.*.move": "what a split moves",
  "smithable.yml:actions.*.input": "a custom action's form",
  "smithable.yml:actions.*.output": "a custom action's result",
  "smithable.yml:actions.*.allow": "a custom action's limits on its input",
  "smithable.yml:actions.*.triggers":
    "the outgoing entries a custom action raises, which part 5 lists",
  "smithable.yml:actions.*.examples.**": "values: the card counts the examples, never shows them",
  "smithable.yml:queries.*.rules.**": "a guide for the query's code",
  "smithable.yml:pages.*.landing.**": "a page's parts and look",
  "smithable.yml:pages.*.sections.**": "a page's parts and look",
  "smithable.yml:pages.*.dashboard.**": "a dashboard's tiles",
  "smithable.yml:pages.*.onboarding.**": "the steps of a first-time setup",
  "smithable.yml:pages.*.calendar.**": "a calendar's fields",
  "smithable.yml:pages.*.calculator.**": "a calculator's fields and examples",
  "smithable.yml:pages.*.articles.**": "an articles page's fields",
  "smithable.yml:pages.*.order.**": "an order page's fields",
  "smithable.yml:pages.*.actions": "where a page shows its actions",
  "smithable.yml:pages.*.search": "a list's search",
  "smithable.yml:pages.*.filters": "a list's filters",
  "smithable.yml:pages.*.defaultFilter": "a list's filters",
  "smithable.yml:pages.*.sortable": "a list's sorting",
  "smithable.yml:pages.*.mine": "a list narrowed to the viewer's own, within what they may read",
  "smithable.yml:pages.*.period": "a list's period",
  "smithable.yml:pages.*.favorites": "a list's favorites",
  "smithable.yml:pages.*.export": "a list's download, within what the viewer may read",
  "smithable.yml:pages.*.contact.**": "a record page's contact button",
  "smithable.yml:pages.*.rules.**": "a guide for the page",
  "smithable.yml:navigation": "the menu",
  "smithable.auth.yml:defaultRole": "the role a new account gets; the table shows every role",
  "smithable.auth.yml:admins": "people's addresses: the card names no person",
  "smithable.context.yml:conventions": "instructions for models that write code",
  "smithable.context.yml:guidance": "instructions for models that write code",
  "smithable.context.yml:packages": "pinned versions of the stack",
  "smithable.context.yml:ai.allow":
    "the providers of a custom policy, which the card names as such",
};

const matches = (pattern: string, key: string) => {
  const [file, path] = pattern.split(":") as [string, string];
  const [keyFile, keyPath] = key.split(":") as [string, string];
  if (file !== keyFile) return false;
  const deep = path.endsWith(".**");
  const want = (deep ? path.slice(0, -3) : path).split(".");
  const have = keyPath.split(".");
  // "*.description" matches the key's last part anywhere; the rest from the root.
  if (want[0] === "*" && want.length === 2 && !deep) return have.at(-1) === want[1];
  if (deep ? have.length < want.length : have.length !== want.length) return false;
  return want.every((w, i) => w === "*" || w === have[i]);
};

test("every key of the spec files is on the card or left out on purpose", () => {
  const keys: string[] = [];
  const walk = (file: string, node: Record<string, unknown> | undefined, path: string) => {
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(
      (node.properties ?? {}) as Record<string, Record<string, unknown>>,
    )) {
      keys.push(`${file}:${path}${key}`);
      walk(file, child, `${path}${key}.`);
    }
    if (typeof node.additionalProperties === "object")
      walk(file, node.additionalProperties as Record<string, unknown>, `${path}*.`);
    walk(file, node.items as Record<string, unknown>, `${path}-.`);
    for (const branch of [...((node.oneOf ?? []) as []), ...((node.anyOf ?? []) as [])])
      walk(file, branch, path);
  };
  walk("smithable.yml", buildJsonSchema() as Record<string, unknown>, "");
  walk("smithable.auth.yml", AUTH_SCHEMA as Record<string, unknown>, "");
  walk("smithable.context.yml", CONTEXT_SCHEMA as Record<string, unknown>, "");
  const patterns = [...SHOWN, ...Object.keys(LEFT_OUT)];
  expect([...new Set(keys)].filter((k) => !patterns.some((p) => matches(p, k)))).toEqual([]);
  // And no pattern is stale.
  expect(patterns.filter((p) => !keys.some((k) => matches(p, k)))).toEqual([]);
});

test("the facts are labelled in another of the app's languages, the app's own where it is silent", () => {
  const facts: CardFacts = appCard({
    ...example("crm"),
    content: {
      ...example("crm").content,
      languages: ["sv"],
      translations: {
        sv: {
          ...emptyContent(),
          language: "sv",
          models: { Customer: { label: "Kund", pluralLabel: "Kunder", fields: {} } },
        },
      },
    } as ContentIR,
    language: "sv",
  });
  expect(facts.language).toBe("sv");
  expect(facts.does.models[0]?.plural).toBe("Kunder");
  expect(facts.does.models[1]?.plural).toBe(appCard(example("crm")).does.models[1]?.plural);
});
