import { emptyContent, validateAuth, validateContent, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { summarize } from "./summary.js";

const crm = import.meta.glob("../../../examples/crm/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const file = (name: string) => crm[`../../../examples/crm/${name}`] as string;

test("the CRM in plain language, with labels from the content file", () => {
  const ir = validateSpec({ path: "smithable.yml", text: file("smithable.yml") }).ir;
  if (!ir) throw new Error("invalid spec");
  const auth = validateAuth({ path: "smithable.auth.yml", text: file("smithable.auth.yml") }).auth;
  const content = validateContent(
    { path: "smithable.content.yml", text: file("smithable.content.yml") },
    ir,
  ).content;
  const sections = summarize(ir, auth, content);
  expect(sections.map((s) => s.concept)).toEqual([
    "app",
    "pages",
    "model:Customer",
    "model:Order",
    "model:FollowUp",
    "action:mergeCustomers",
    "action:scheduleFollowUps",
    "auth",
  ]);
  expect(sections[2]?.sentences).toEqual([
    "Customers have:",
    "- a name (required)",
    "- an email (unique)",
    "- a phone",
    "- a segment (small business, enterprise or government, small business by default)",
    "- a credit limit (an amount)",
    "- notes",
    "Each customer can have an account manager (a user).",
    "Each customer lists its orders.",
    "Each customer lists its follow ups.",
    "The account manager owns the customer.",
    "Deleted customers stay in the trash for thirty days, where they can be restored.",
    "Customers can be merged.",
  ]);
  expect(sections[1]?.sentences).toEqual([
    "- Overview (a dashboard: customers, open orders, follow ups due and recent)",
    "- Customers (lists customers; search by name or email; sort by name or date added; “Merge customers”; “Schedule follow ups”)",
    "- Orders (lists orders; search by number or customer; filter by status; sort by placed on, total or number)",
    "- Follow ups (lists follow ups; search by customer or note; filter by done; sort by due on)",
    "- Team (who has access: invite people, change roles, remove users; only for admins)",
  ]);
});

test("a plugin's section is summarized in its own words", () => {
  const text = `smithable: 0.1
app: { name: Studio }
models:
  Class:
    fields: { name: string! }
newsletter:
  from: hi@example.com
`;
  const plugin = {
    key: "newsletter",
    description: "A newsletter.",
    schema: { type: "object" },
    summarize: (value: unknown) => [
      `The newsletter is sent from ${(value as { from: string }).from}.`,
    ],
  };
  const ir = validateSpec({ path: "smithable.yml", text }, { plugins: [plugin] }).ir;
  if (!ir) throw new Error("invalid");
  const section = summarize(ir, undefined, undefined, [plugin]).find(
    (s) => s.concept === "plugin:newsletter",
  );
  expect(section).toMatchObject({
    title: "Newsletter",
    sentences: ["The newsletter is sent from hi@example.com."],
  });
});

test("a capacity is one sentence on the model", () => {
  const text = `smithable: 0.1
app: { name: Studio }
models:
  Session:
    fields:
      startsAt: datetime!
      capacity: int! = 12
      bookings: Booking[]
  Booking:
    fields:
      session: Session! unique
      status: confirmed | canceled
    capacity: { per: session, max: session.capacity, where: { status: confirmed } }
  Seat:
    fields:
      session: Session!
    capacity: { per: session, max: 4 }
`;
  const ir = validateSpec({ path: "smithable.yml", text }).ir;
  if (!ir) throw new Error("invalid");
  const sections = summarize(ir);
  expect(sections.find((s) => s.concept === "model:Booking")?.sentences).toContain(
    "At most the session's capacity bookings per session (counting those with status confirmed).",
  );
  expect(sections.find((s) => s.concept === "model:Seat")?.sentences).toContain(
    "At most 4 seats per session.",
  );
});

test("the pages come first, the home page first among them", () => {
  const { ir } = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Studio }
models:
  Class:
    fields: { name: string! }
pages:
  classes: { crud: Class }
  home:
    route: /
    landing:
      hero: { button: classes }
`,
  });
  if (!ir) throw new Error("the spec is invalid");
  const sections = summarize(ir, undefined, emptyContent());
  expect(sections[0]?.concept).toBe("pages");
  expect(sections[0]?.sentences[0]).toMatch(/^- Home /);
});

test("a status page in words: what the front page shows, the footer last, and who sees the records", () => {
  const { ir } = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Status }
models:
  Component:
    fields: { name: string!, state: operational | degraded | outage }
  Incident:
    fields: { title: string!, status: investigating | identified | resolved }
pages:
  home:
    route: /
    landing:
      hero:
      footer:
      services: { records: Component }
      open: { records: Incident, where: { status: [investigating, identified] } }
  components: { crud: Component, sortable: [name, createdAt] }
  incidents: { crud: Incident }
`,
  });
  if (!ir) throw new Error("the spec is invalid");
  const { auth } = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\nroles: { admin: all, staff: { pages: [incidents] } }\npublic: { pages: [home], read: [Component, Incident] }\n",
    },
    ir,
  );
  const pages = summarize(ir, auth, emptyContent())[0]?.sentences ?? [];
  expect(pages[0]).toBe(
    "- Home (a landing page: hero, components, incidents where status is investigating or identified and footer)",
  );
  expect(pages[1]).toBe(
    "- Components (lists components; sort by name or date added; only for admins; visitors see components on the Home page)",
  );
  expect(pages[2]).toBe("- Incidents (lists incidents)");
});

test("a field named by a preposition is said by what it holds", () => {
  const { ir } = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Status }
models:
  Update:
    fields: { at: datetime!, message: text!, from: date }
pages:
  updates: { crud: Update }
`,
  });
  if (!ir) throw new Error("the spec is invalid");
  const model = summarize(ir, undefined, emptyContent()).find((s) => s.concept === "model:Update");
  const text = model?.sentences.join(" ") ?? "";
  expect(text).toContain("a date and time (at, required)");
  expect(text).toContain("a date (from)");
  expect(text).not.toContain("an at");
});

test("no article before a yes/no field, a question word or preposition label, nor twice before a date", () => {
  const { ir } = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Torget }
models:
  Item:
    fields: { title: string!, summary: text, place: string, available: bool, addedOn: date!, photos: pictures! }
    review: [photos]
pages:
  items: { crud: Item }
`,
  });
  if (!ir) throw new Error("the spec is invalid");
  const content = validateContent(
    {
      path: "smithable.content.yml",
      text: "smithableContent: 0.1\nmodels:\n  Item:\n    fields:\n      summary: { label: About }\n      place: { label: Where }\n      addedOn: { label: Added }\n",
    },
    ir,
  ).content;
  const text = summarize(ir, undefined, content)
    .find((s) => s.concept === "model:Item")
    ?.sentences.join("\n");
  expect(text).toContain("- about\n");
  expect(text).toContain("- where\n");
  expect(text).toContain("- available (yes or no)");
  expect(text).toContain("- the date added (required)");
  expect(text).toContain("an item waits until its photos are.");
});

test("a standard action in words: for which records, and what it sets", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Status }
models:
  Incident:
    fields:
      title: string!
      status: investigating | identified | monitoring | resolved
      resolvedAt: datetime
      pinned: bool
actions:
  resolve:
    on: Incident
    when: { status: [investigating, identified, monitoring] }
    set: { status: resolved, resolvedAt: NOW(), pinned: false }
    intent: The incident is over.
  pin:
    on: Incident
    set: { pinned: true }
`,
  }).ir;
  if (!ir) throw new Error("invalid spec");
  const sections = summarize(ir, undefined, emptyContent());
  expect(sections.find((s) => s.concept === "action:resolve")?.sentences).toEqual([
    "For an incident that is investigating, identified or monitoring; sets status to resolved, resolved at to now and pinned to no.",
    "The incident is over.",
  ]);
  expect(sections.find((s) => s.concept === "action:pin")?.sentences).toEqual([
    "Sets pinned to yes.",
  ]);
});

test("a standard action that asks and adds, in words", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Status }
models:
  Incident:
    fields: { title: string!, status: open | resolved, note: text, updates: "Update[]" }
  Update:
    fields: { incident: Incident!, message: text!, at: datetime! }
actions:
  resolve:
    on: Incident
    when: { status: open }
    set: { status: resolved, note: }
    add:
      Update: { at: NOW(), message: }
`,
  }).ir;
  if (!ir) throw new Error("invalid spec");
  expect(
    summarize(ir, undefined, emptyContent()).find((s) => s.concept === "action:resolve")?.sentences,
  ).toEqual([
    "For an incident that is open; sets status to resolved; asks for the note and the update's message; adds an update (at now).",
  ]);
});

test("a copy and ME() in words", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Billing }
models:
  Invoice:
    fields: { number: string! unique, status: draft | sent, handler: User, lines: "Line[]" }
  Line:
    fields: { invoice: Invoice!, amount: money }
actions:
  duplicate:
    on: Invoice
    copy: { status: draft, number: }
    with: [lines]
  take:
    on: Invoice
    set: { handler: ME() }
`,
  }).ir;
  if (!ir) throw new Error("invalid spec");
  const sentences = (name: string) =>
    summarize(ir, undefined, emptyContent()).find((s) => s.concept === `action:${name}`)?.sentences;
  expect(sentences("duplicate")).toEqual([
    "Makes a copy of an invoice with status draft, asking for the number; its lines are copied too.",
  ]);
  expect(sentences("take")).toEqual(["Sets handler to whoever presses it."]);
});

test("what other programs may reach is said with sign-in and access", () => {
  const { ir } = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Status }
models:
  Component:
    fields: { name: string! }
  Incident:
    fields: { title: string!, status: investigating | resolved }
actions:
  resolve: { on: Incident, when: { status: investigating }, set: { status: resolved } }
pages:
  incidents: { crud: Incident, actions: [resolve] }
  components: { crud: Component }
`,
  });
  if (!ir) throw new Error("the spec is invalid");
  const sentences = (api: string) => {
    const { auth } = validateAuth(
      {
        path: "smithable.auth.yml",
        text: `smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\n${api}`,
      },
      ir,
    );
    return summarize(ir, auth, emptyContent()).find((s) => s.concept === "auth")?.sentences ?? [];
  };
  expect(sentences("api: { models: [Component, Incident], actions: [resolve] }\n")).toContain(
    "Other programs can read and change components and incidents with a key, and run resolve.",
  );
  expect(sentences("api: { models: all, assistants: true }\n")).toContain(
    "Other programs can read and change every kind of record, also ones added later, with a key. AI assistants can use it too.",
  );
  expect(sentences("").join(" ")).not.toContain("Other programs");
});

test("files reviewed before others see them, and the review page, in plain words", () => {
  const text = `smithable: 0.1
app: { name: Market }
models:
  Listing:
    fields: { title: string!, photo: picture!, contract: file }
    review: all
pages:
  listings: { crud: Listing }
  moderation: { review: all }
`;
  const ir = validateSpec({ path: "smithable.yml", text }).ir;
  if (!ir) throw new Error("invalid spec");
  const sections = summarize(ir, undefined, emptyContent());
  expect(sections.find((s) => s.concept === "model:Listing")?.sentences).toContain(
    "Photos and contracts of listings are reviewed before others see them; a listing waits until its photo is.",
  );
  expect(sections.find((s) => s.concept === "pages")?.sentences.join("\n")).toContain(
    "the pictures and files waiting for review, to approve or reject",
  );
});

test("in another language the summary quotes the app's texts instead of bending them", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Elbolaget }
models:
  News:
    fields:
      title: string!
      kind: outage | notice
pages:
  arenden: { crud: News }
`,
  }).ir;
  if (!ir) throw new Error("invalid spec");
  const content = validateContent(
    {
      path: "smithable.content.yml",
      text: `smithableContent: 0.1
language: sv
models:
  News:
    label: Nyhet
    pluralLabel: Nyheter
    fields:
      title: { label: Rubrik }
      kind: { label: Typ, values: { outage: Avbrott, notice: Meddelande } }
`,
    },
    ir,
  ).content;
  const sections = summarize(ir, undefined, content);
  const text = sections.flatMap((s) => [s.title, ...s.sentences]).join("\n");
  expect(text).toContain("a field “Rubrik” (required)");
  expect(text).toContain("“Avbrott” or “Meddelande”");
  expect(text).toContain("Nyheter");
  expect(text).not.toMatch(/newses|a rubrik|Arenden/);
});

test("Ask in the summary: who, its name from the content file, and its voice", () => {
  const { ir } = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Order:\n    fields: { number: string! }\npages:\n  orders: { crud: Order }\n",
  });
  if (!ir) throw new Error("the spec is invalid");
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: all, staff: { pages: all } }\ndefaultRole: staff\nassistant: { for: signed-in }\n",
    },
    ir,
  ).auth;
  const content = validateContent(
    { path: "smithable.content.yml", text: "smithableContent: 0.1\nassistant: { name: Nova }\n" },
    ir,
  ).content;
  const said = (voice?: "plain" | "friendly" | "formal") =>
    summarize(ir, auth, content, [], voice ? { assistant: { voice } } : undefined)
      .find((s) => s.concept === "auth")
      ?.sentences.join(" ");
  expect(said()).toContain(
    "Everyone who signs in can ask the app questions as Nova; it changes nothing. It answers plainly.",
  );
  expect(said("formal")).toContain("It answers formally.");
});

test("a field's rules on the record are said with it: who fills it, when it is fixed or required", () => {
  const text = file("smithable.yml").replace(
    "      total: money!\n",
    "      total: { type: money!, locked: { status: [shipped, canceled] } }\n      trackingCode: { type: string, required: { status: shipped } }\n      handledBy: { type: User, by: app, default: ME() }\n",
  );
  const ir = validateSpec({ path: "smithable.yml", text }).ir;
  if (!ir) throw new Error("invalid spec");
  const auth = validateAuth({ path: "smithable.auth.yml", text: file("smithable.auth.yml") }).auth;
  const lines =
    summarize(ir, auth, emptyContent()).find((s) => s.concept === "model:Order")?.sentences ?? [];
  const said = lines.join("\n");
  expect(said).toContain("fixed when status is shipped or canceled");
  expect(said).toContain("required when status is shipped");
  expect(said).toContain("who makes it, by default, filled by the app");
});

test("a list shown as a conversation is said on its page", () => {
  const { ir } = validateSpec({
    path: "smithable.yml",
    text: 'smithable: 0.1\napp: { name: Desk }\nmodels:\n  SupportCase:\n    fields: { subject: string!, messages: "Message[]" }\n  Message:\n    fields: { content: text!, supportCase: SupportCase! }\npages:\n  cases: { crud: SupportCase }\n',
  });
  if (!ir) throw new Error("the spec is invalid");
  const pages = (lists?: Record<string, "thread" | "table">) =>
    summarize(ir, undefined, emptyContent(), [], {
      assistant: { voice: "plain" },
      pages: { cases: { lists } },
    })
      .find((s) => s.concept === "pages")
      ?.sentences.join(" ");
  expect(pages({ messages: "thread" })).toContain(
    "a support case's messages shown as a conversation with a reply box",
  );
  expect(pages({ messages: "table" })).not.toContain("conversation");
});
