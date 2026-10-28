import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { validateAuth } from "./auth.js";
import { validateContent } from "./content.js";
import type { SpecIR } from "./ir.js";
import { validateSpec } from "./spec.js";

const spec = `smithable: 0.1
app: { name: CRM }
models:
  Customer:
    fields:
      name: string!
      segment: smb | enterprise
pages:
  customers: { crud: Customer }
navigation:
  main: [customers]
  admin: [customers]
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;

const check = (text: string) => validateContent({ path: "smithable.content.yml", text }, ir);

test("reads labels, help, choice texts, page titles and menu labels", () => {
  const { content, diagnostics } = check(`smithableContent: 0.1
models:
  Customer:
    label: Client
    fields:
      name: { label: Company name, help: As on the invoice. }
      segment: { values: { smb: Small business } }
pages:
  customers: { title: Our clients }
menus:
  admin: { label: Administration }
`);
  expect(diagnostics).toEqual([]);
  expect(content).toEqual({
    language: "en",
    models: {
      Customer: {
        label: "Client",
        fields: {
          name: { label: "Company name", help: "As on the invoice." },
          segment: { values: { smb: "Small business" } },
        },
      },
    },
    pages: { customers: { title: "Our clients" } },
    menus: { admin: { label: "Administration" } },
    actions: {},
    outgoing: {},
  });
});

test("an action's label, by its name in smithable.yml", () => {
  const withAction = validateSpec({
    path: "smithable.yml",
    text: `${spec}actions:\n  upgrade: { on: Customer, set: { segment: enterprise } }\n`,
  }).ir as SpecIR;
  const read = (text: string) =>
    validateContent({ path: "smithable.content.yml", text }, withAction);
  expect(
    read(
      "smithableContent: 0.1\nactions:\n  upgrade: { label: Uppgradera, help: Gör kunden till storkund. }\n",
    ).content?.actions,
  ).toEqual({ upgrade: { label: "Uppgradera", help: "Gör kunden till storkund." } });
  expect(
    read("smithableContent: 0.1\nactions:\n  upgrad: { label: X }\n").diagnostics.map((d) => [
      d.code,
      d.hint,
    ]),
  ).toEqual([["unknown-action", 'Did you mean "upgrade"?']]);
});

test("every reference must exist in the spec", () => {
  const { content, diagnostics } = check(`smithableContent: 0.1
models:
  Custmer: { label: X }
  Customer:
    fields:
      nme: { label: X }
      name: { values: { a: A } }
      segment: { values: { small: S }, tooltip: T }
pages:
  clients: { title: X }
`);
  expect(content).toBeUndefined();
  expect(diagnostics.map((d) => [d.line, d.code, d.hint])).toEqual([
    [3, "unknown-model", 'Did you mean "Customer"?'],
    [6, "unknown-field", 'Did you mean "name"?'],
    [7, "invalid-key", undefined],
    [8, "unknown-value", undefined],
    [8, "unknown-key", undefined],
    [10, "unknown-page", undefined],
  ]);
});

test("the content file needs its version", () => {
  expect(check("models: {}\n").diagnostics.map((d) => d.code)).toEqual(["invalid-version"]);
});

test("a landing page's sections and a dashboard's tiles have their own texts", () => {
  const patterns = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: CRM }
models:
  Customer:
    fields: { name: string! }
pages:
  home:
    route: /
    landing: { hero: { button: customers }, faq: {}, pricing: {} }
  overview:
    dashboard: { customers: { count: Customer } }
  customers: { crud: Customer }
`,
  }).ir as SpecIR;
  const read = (text: string) => validateContent({ path: "smithable.content.yml", text }, patterns);
  const { content } = read(`smithableContent: 0.1
pages:
  home:
    hero: { eyebrow: For small teams, title: Know your customers, button: Open the app }
    faq:
      eyebrow: Questions
      items:
        - { question: Is it free?, answer: Yes. }
    pricing:
      items:
        - { name: Pro, price: €9, features: [Unlimited customers, Support] }
  overview:
    subtitle: The numbers that matter.
    customers: { label: Customers so far }
`);
  expect(content?.pages).toEqual({
    home: {
      sections: {
        hero: {
          eyebrow: "For small teams",
          title: "Know your customers",
          button: "Open the app",
        },
        faq: { eyebrow: "Questions", items: [{ question: "Is it free?", answer: "Yes." }] },
        pricing: {
          items: [{ name: "Pro", price: "€9", features: ["Unlimited customers", "Support"] }],
        },
      },
    },
    overview: {
      subtitle: "The numbers that matter.",
      sections: { customers: { label: "Customers so far" } },
    },
  });
  expect(
    read(`smithableContent: 0.1
pages:
  home:
    heroo: { title: Hi }
    faq: { items: [{ question: Q, reply: A }] }
`).diagnostics.map((d) => d.code),
  ).toEqual(["unknown-key", "unknown-key"]);
  // A hero's picture: a file in public/images/, with what it shows.
  const hero = (image: string) =>
    read(`smithableContent: 0.1\npages:\n  home:\n    hero:\n      image: ${image}\n`);
  expect(hero("{ src: images/hero.webp, alt: A yoga class }").content?.pages.home).toEqual({
    sections: { hero: { image: { src: "images/hero.webp", alt: "A yoga class" } } },
  });
  expect(hero("{ src: images/hero.webp }").diagnostics[0]?.message).toContain('needs "alt"');
  // One an AI made says so, for the badge; a flag that is not a yes or no is an error.
  expect(
    hero("{ src: images/hero.webp, alt: A yoga class, generated: true }").content?.pages.home,
  ).toEqual({
    sections: {
      hero: { image: { src: "images/hero.webp", alt: "A yoga class", generated: true } },
    },
  });
  expect(hero("{ src: images/hero.webp, alt: x, generated: yes }").diagnostics).not.toEqual([]);
  expect(hero("{ src: ../secret.webp, alt: x }").diagnostics[0]?.message).toContain(
    "public/images/",
  );
  expect(hero("{ src: https://x.test/a.jpg, alt: x }").content).toBeUndefined();
});

test("contact, gallery and footer sections: their texts, pictures and links", () => {
  const spec = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Studio }
models:
  Message:
    fields: { name: string!, email: email!, message: text! }
  Visit:
    fields: { message: Message!, at: datetime }
pages:
  home:
    route: /
    landing: { contact: { form: Message }, gallery: {}, footer: {} }
  messages: { crud: Message }
`,
  });
  expect(spec.ir?.pages[0]?.pattern).toMatchObject({
    sections: [{ kind: "contact", form: "Message" }, { kind: "gallery" }, { kind: "footer" }],
  });
  const ir = spec.ir as SpecIR;
  const read = (text: string) => validateContent({ path: "smithable.content.yml", text }, ir);
  const { content } = read(`smithableContent: 0.1
pages:
  home:
    contact: { title: Write to us, address: "Storagatan 1", hours: "Mon–Fri 9–17", thanks: Thanks! }
    gallery:
      items:
        - { image: { src: images/gallery/a.webp, alt: A mat }, caption: The studio }
    footer:
      text: Studio
      items: [{ label: Schedule, link: /sessions }, { label: Email, link: "mailto:a@b.ax" }]
`);
  expect(content?.pages.home?.sections?.gallery?.items?.[0]).toEqual({
    image: { src: "images/gallery/a.webp", alt: "A mat" },
    caption: "The studio",
  });
  expect(content?.pages.home?.sections?.contact?.hours).toBe("Mon–Fri 9–17");
  const bad = read(`smithableContent: 0.1
pages:
  home:
    gallery: { items: [{ image: { src: images/../secret.webp, alt: x } }] }
    footer: { items: [{ label: Evil, link: "javascript:alert(1)" }] }
`);
  expect(bad.diagnostics.map((d) => d.code)).toEqual(["invalid-value", "invalid-value"]);
  // A contact form's model may not link to other records: visitors would pick among them.
  const linked = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Studio }
models:
  Message:
    fields: { name: string! }
  Visit:
    fields: { message: Message!, at: datetime }
pages:
  home: { route: /, landing: { contact: { form: Visit } } }
`,
  });
  expect(linked.diagnostics.map((d) => d.message).join()).toContain("cannot link to other records");
});

test("the reservation block's texts belong to a model with a capacity", () => {
  const booking = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Yoga }
models:
  Session:
    fields:
      startsAt: datetime!
      capacity: int! = 12
  Booking:
    fields:
      session: Session!
    capacity: { per: session, max: session.capacity }
pages:
  sessions: { crud: Session }
`,
  }).ir as SpecIR;
  const ok = validateContent(
    {
      path: "smithable.content.yml",
      text: `smithableContent: 0.1
models:
  Booking:
    reserve: { book: Reserve a mat, full: No mats left }
`,
    },
    booking,
  );
  expect(ok.diagnostics).toEqual([]);
  expect(ok.content?.models.Booking?.reserve).toEqual({
    book: "Reserve a mat",
    full: "No mats left",
  });
  const wrong = validateContent(
    {
      path: "smithable.content.yml",
      text: `smithableContent: 0.1
models:
  Session:
    reserve: { book: Reserve a mat }
  Booking:
    reserve: { join: Reserve }
`,
    },
    booking,
  );
  expect(wrong.diagnostics.map((d) => d.message)).toEqual([
    'Model "Session" has no capacity, so nothing is reserved on it.',
    expect.stringContaining('"join"'),
  ]);
});

test("the language is one the kit has words in; in another one, models say their own plural", () => {
  const read = (text: string) => validateContent({ path: "smithable.content.yml", text }, ir);
  expect(read("smithableContent: 0.1\nlanguage: en\n").content?.language).toBe("en");
  const unknown = read("smithableContent: 0.1\nlanguage: fi\n");
  expect(unknown.content).toBeUndefined();
  expect(unknown.diagnostics).toMatchObject([
    { code: "unknown-language", message: 'The app kit has no words in "fi". Languages: en, sv.' },
  ]);
  const swedish = read(
    "smithableContent: 0.1\nlanguage: sv\nmodels:\n  Customer: { label: Kund }\n",
  );
  expect(swedish.content?.language).toBe("sv");
  expect(swedish.diagnostics.map((d) => [d.severity, d.code, d.message, d.line])).toEqual([
    [
      "warning",
      "plural-in-english",
      'Customer: the plural would be made by an English rule ("Kunds"); give it a pluralLabel.',
      4,
    ],
  ]);
  // A model without an entry: the warning sits on the language key.
  expect(read("smithableContent: 0.1\nlanguage: sv\n").diagnostics.map((d) => d.line)).toEqual([2]);
  expect(
    read(
      "smithableContent: 0.1\nlanguage: sv\nmodels:\n  Customer: { label: Kund, pluralLabel: Kunder }\n",
    ).diagnostics,
  ).toEqual([]);
  expect(read("smithableContent: 0.1\n").diagnostics).toEqual([]);
});

test("an outgoing mail's subject and text come from the content file, for entries the spec has", () => {
  const spec = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp:\n  name: X\nmodels:\n  Booking:\n    fields:\n      title: string!\noutgoing:\n  made:\n    when: Booking created\n    to: mail\n    recipient: owner\n",
  }).ir;
  if (!spec) throw new Error("spec");
  const read = (text: string) => validateContent({ path: "smithable.content.yml", text }, spec);
  const ok = read(
    "smithableContent: 0.1\noutgoing:\n  made: { subject: Your booking, text: See you soon. }\n",
  );
  expect(ok.diagnostics).toEqual([]);
  expect(ok.content?.outgoing).toEqual({
    made: { subject: "Your booking", text: "See you soon." },
  });
  expect(
    read("smithableContent: 0.1\noutgoing:\n  gone: { subject: X }\n").diagnostics,
  ).toMatchObject([{ code: "unknown-outgoing" }]);
});

test("reads the app's logo, and says what is wrong with one", () => {
  expect(check("smithableContent: 0.1\n").content?.logo).toBeUndefined();
  const { content, diagnostics } = check(
    "smithableContent: 0.1\nlogo: { src: images/logo.svg, alt: A lotus }\n",
  );
  expect(diagnostics).toEqual([]);
  expect(content?.logo).toEqual({ src: "images/logo.svg", alt: "A lotus" });
  expect(
    check("smithableContent: 0.1\nlogo: { src: images/logo.webp, alt: A lotus, generated: true }\n")
      .content?.logo,
  ).toEqual({ src: "images/logo.webp", alt: "A lotus", generated: true });
  expect(
    check("smithableContent: 0.1\nlogo: { src: /logo.webp, alt: A lotus }\n").diagnostics,
  ).toMatchObject([{ code: "logo-src" }]);
  expect(
    check("smithableContent: 0.1\nlogo: { src: images/logo.webp }\n").diagnostics,
  ).toMatchObject([{ code: "logo-alt" }]);
});

const TEMPLATE_SPEC = `smithable: 0.1
app:
  name: X
models:
  Customer:
    fields:
      name: string!
      email: email
      notes: text
      bookings: Booking[]
      count: { type: int, formula: COUNT(bookings) }
  Booking:
    fields:
      title: string!
      status: pending | confirmed
      customer: Customer!
      photo: picture
outgoing:
  moved:
    when: Booking changed
    to: mail
    recipient: owner
  made:
    when: Booking created
    to: mail
    recipient: customer.email
  told:
    when: Booking created
    to: mail
    recipient: member
`;

test("an outgoing text's placeholders: fields, a reference and its title, title, link, by, before; the rest refused", () => {
  const spec = validateSpec(
    {
      path: "smithable.yml",
      text: TEMPLATE_SPEC.replace("recipient: customer.email", "recipient: owner"),
    },
    { roles: ["member"] },
  ).ir;
  if (!spec) throw new Error("spec");
  const codes = (entry: string, subject: string, text = "") =>
    validateContent(
      {
        path: "smithable.content.yml",
        text: `smithableContent: 0.1\noutgoing:\n  ${entry}: { subject: ${JSON.stringify(subject)}${text ? `, text: ${JSON.stringify(text)}` : ""} }\n`,
      },
      spec,
    ).diagnostics.map((d) => `${d.severity} ${d.code}`);
  expect(
    codes(
      "moved",
      "{title} is now {status}",
      "Was {before.status}. {customer}, {customer.name}. {link} by {by}",
    ),
  ).toEqual([]);
  expect(codes("moved", "No braces", "None here either.")).toEqual([]);
  expect(codes("moved", "{nothing}")).toEqual(["error unknown-placeholder"]);
  expect(codes("moved", "{customer.nothing}")).toEqual(["error unknown-placeholder"]);
  expect(codes("moved", "{photo}")).toEqual(["error invalid-placeholder"]);
  expect(codes("moved", "{customer.bookings}")).toEqual(["error invalid-placeholder"]);
  expect(codes("moved", "{customer.count}")).toEqual(["error invalid-placeholder"]);
  expect(codes("moved", "{customer.name.x}")).toEqual(["error invalid-placeholder"]);
  expect(codes("moved", "{title.x}")).toEqual(["error invalid-placeholder"]);
  expect(codes("moved", "{before}")).toEqual(["error invalid-placeholder"]);
  expect(codes("made", "{before.status}")).toEqual(["error invalid-placeholder"]);
  // A placeholder said twice is one diagnostic; two texts are two.
  expect(codes("made", "{x} {x}", "{x}")).toEqual([
    "error unknown-placeholder",
    "error unknown-placeholder",
  ]);
});

test("with the auth rules, a reference's field goes only to a recipient who may read that model; by to an address warns", () => {
  const spec = validateSpec(
    { path: "smithable.yml", text: TEMPLATE_SPEC },
    { roles: ["member"] },
  ).ir;
  if (!spec) throw new Error("spec");
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: private\nroles:\n  member: { pages: all, read: [Booking] }\ndefaultRole: member\n",
    },
    spec,
  ).auth;
  if (!auth) throw new Error("auth");
  const codes = (entry: string, text: string) =>
    validateContent(
      {
        path: "smithable.content.yml",
        text: `smithableContent: 0.1\noutgoing:\n  ${entry}: { text: ${JSON.stringify(text)} }\n`,
      },
      spec,
      undefined,
      auth,
    ).diagnostics.map((d) => `${d.severity} ${d.code}`);
  // The title of the referenced record is in every mail; its notes are not the member's to read.
  expect(codes("told", "{customer} {customer.name} {title}")).toEqual([]);
  expect(codes("told", "{customer.notes}")).toEqual(["error placeholder-not-readable"]);
  // An address on the record (an outside person): the title only, and {by} is a warning.
  expect(codes("made", "{customer.notes}")).toEqual(["error placeholder-not-readable"]);
  expect(codes("made", "{by}")).toEqual(["warning by-to-address"]);
  expect(codes("moved", "{by}")).toEqual([]);
  // Without the auth rules only the paths are checked.
  expect(
    validateContent(
      {
        path: "smithable.content.yml",
        text: 'smithableContent: 0.1\noutgoing:\n  told: { text: "{customer.notes}" }\n',
      },
      spec,
    ).diagnostics,
  ).toEqual([]);
});

test("an outgoing text's placeholders follow a renamed field, and hold a removed one", () => {
  const files = {
    spec: TEMPLATE_SPEC.replace("recipient: customer.email", "recipient: owner"),
    content:
      'smithableContent: 0.1\noutgoing:\n  moved: { subject: "{title}: {status}", text: "Was {before.status}; {customer.name}" }\n',
  };
  const renamed = applyOperation(files, "renameField", {
    model: "Booking",
    from: "status",
    to: "state",
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.content).toContain('subject: "{title}: {state}"');
  expect(renamed.files.content).toContain('text: "Was {before.state}; {customer.name}"');
  const other = applyOperation(renamed.files, "renameField", {
    model: "Customer",
    from: "name",
    to: "fullName",
  });
  if (!other.ok) throw new Error(other.message);
  expect(other.files.content).toContain("{customer.fullName}");
  const removed = applyOperation(other.files, "removeField", { model: "Booking", field: "state" });
  expect(removed.ok).toBe(false);
  if (!removed.ok) expect(removed.message).toContain("{state}");
});
