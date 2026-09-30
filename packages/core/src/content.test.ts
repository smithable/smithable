import { expect, test } from "vitest";
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
  });
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
    hero: { title: Know your customers, button: Open the app }
    faq:
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
        hero: { title: "Know your customers", button: "Open the app" },
        faq: { items: [{ question: "Is it free?", answer: "Yes." }] },
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
