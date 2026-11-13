import {
  type AuthIR,
  applyOperation,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp, privacyReviews } from "./generate.js";
import { TEMPLATES as TEMPLATES_FOR_TEST } from "./templates.gen.js";

test("the privacy page's facts are typed, so a public model with a personal field type-checks", () => {
  // The stranger walk of 2026-10-07: a phone on the public Instructor made `readers: "visitors"`,
  // which TypeScript widened to string against the kit's union, and the app no longer built.
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: X }
models:
  Instructor:
    fields: { name: string!, phone: phone }
  Message:
    fields: { name: string!, email: email! }
pages:
  home: { route: /, landing: { hero: {}, footer: {} } }
  privacy: { route: /privacy, legal: privacy }
`,
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles: { admin: all, member: { pages: all } }\npublic: { pages: [home, privacy], read: [Instructor] }\n",
    },
    ir,
  ).auth as AuthIR;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const route = files.find((f) => f.path === "src/routes/privacy/index.tsx")?.content ?? "";
  expect(route).toContain("const facts: LegalFacts = ");
  expect(route).toContain('readers: "visitors"');
  expect(route).toContain('readers: ["admin"]');
  expect(route).toContain('import { LegalPage, type LegalFacts } from "#/kit/LegalPage"');
});

test("the page names what the files show: Ask, the public forms, what comes in, other services, the owner's functions (legal-page.md §6.1)", () => {
  const read = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: X }
models:
  Message:
    fields: { name: string!, email: email!, text: text }
  Order:
    fields: { total: money! }
actions:
  tidy: { custom: true, input: { note: string }, intent: Tidy up. }
outgoing:
  toKitchen: { when: Order created, to: kitchen }
incoming:
  support: { mail: true, create: Message, fields: { from: email, body: text } }
pages:
  home: { route: /, landing: { hero: {}, footer: {} } }
  messages: { crud: Message }
  orders: { crud: Order, actions: [tidy] }
  privacy: { route: /privacy, legal: privacy }
`,
  });
  const ir = read.ir as SpecIR;
  expect(read.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email, google] }\ndefaultAccess: private\nroles: { admin: all, member: { pages: all } }\npublic: { pages: [home, privacy], create: [Message] }\nassistant: { for: anyone }\n",
    },
    ir,
  ).auth as AuthIR;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const route = files.find((f) => f.path === "src/routes/privacy/index.tsx")?.content ?? "";
  expect(route).toContain('assistant: { for: "visitors", changes: false }');
  expect(route).toContain(
    'forms: [{ label: messageUi.pluralLabel, fields: ["name", "email", "text"] }]',
  );
  expect(route).toContain('services: [{ name: "kitchen", about: "orders" }]');
  expect(route).toContain('mailInto: [{ into: "messages", sender: true }]');
  expect(route).toContain('custom: { actions: ["tidy"] }');
  expect(route).not.toContain("payProvider");
  const page = files.find((f) => f.path === "src/kit/LegalPage.tsx")?.content ?? "";
  expect(page).toContain("{facts.signIn.google && <p>{w.legalGoogle}</p>}");
});

test("what only the running app knows is read when the page is shown, not frozen in (legal-page.md §6.1)", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: X }
models:
  Message:
    fields: { name: string!, email: email! }
pages:
  home: { route: /, landing: { hero: {}, footer: {} } }
  messages: { crud: Message }
  privacy: { route: /privacy, legal: privacy }
`,
  }).ir as SpecIR;
  const withAsk = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles: { admin: all, member: { pages: all } }\npublic: { pages: [home, privacy] }\nassistant: { for: signed-in }\n",
    },
    ir,
  ).auth as AuthIR;
  const route = (auth: AuthIR) =>
    generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() }).find(
      (f) => f.path === "src/routes/privacy/index.tsx",
    )?.content ?? "";
  const asked = route(withAsk);
  expect(asked).toContain(
    "const runningFacts = createServerFn().handler(async () => ({\n  ai: aiFacts(),\n}));",
  );
  expect(asked).toContain("  loader: () => runningFacts(),\n");
  expect(asked).toContain("running={Route.useLoaderData()}");
  // Without Ask or texts there is nothing running to read.
  const plain = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles: { admin: all, member: { pages: all } }\npublic: { pages: [home, privacy] }\n",
    },
    ir,
  ).auth as AuthIR;
  expect(route(plain)).not.toContain("runningFacts");
});

test("what only the maker knows: how long records are kept, their other services, their own functions (legal-page.md §6.2)", () => {
  const spec = `smithable: 0.1
app: { name: X }
models:
  Message:
    fields: { name: string!, email: email! }
  Note:
    fields: { text: string! }
pages:
  home: { route: /, landing: { hero: {}, footer: {} } }
  messages: { crud: Message }
  notes: { crud: Note }
  privacy: { route: /privacy, legal: privacy }
`;
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
  const read = validateContent(
    {
      path: "smithable.content.yml",
      text: `smithableContent: 0.1
pages:
  privacy:
    operator: { name: Calm Ab }
    keeps:
      Message: Until answered, at most six months.
      Note: As long as the project runs.
      Booking: Two years.
    services:
      - { name: Example Mail Ab, for: sending mail, where: in the EU }
    custom: The waiting list mails the next person.
`,
    },
    ir,
  );
  // A line for a kind of record the app does not have is said, not dropped silently.
  expect(read.diagnostics.map((d) => d.code)).toContain("privacy-keeps-unknown");
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles: { admin: all, member: { pages: all } }\npublic: { pages: [home, privacy] }\n",
    },
    ir,
  ).auth as AuthIR;
  const files = generateApp(ir, {
    smithableVersion: "0.0.0",
    auth,
    content: read.content as NonNullable<typeof read.content>,
  });
  const route = files.find((f) => f.path === "src/routes/privacy/index.tsx")?.content ?? "";
  expect(route).toContain('keeps: "Until answered, at most six months."');
  // Note holds nothing personal by its fields, but the maker named it: it is listed.
  expect(route).toContain('keeps: "As long as the project runs."');
  expect(route).toContain(
    'ownServices: [{ name: "Example Mail Ab", for: "sending mail", where: "in the EU" }]',
  );
  expect(route).toContain(
    'custom: { actions: [], text: "The waiting list mails the next person." }',
  );
});

test("the owner's review: recorded by reviewPrivacyPage, shown while the facts are the ones reviewed (legal-page.md §6.4)", () => {
  const spec = `smithable: 0.1
app: { name: X }
models:
  Message:
    fields: { name: string!, email: email! }
pages:
  home: { route: /, landing: { hero: {}, footer: {} } }
  messages: { crud: Message }
  privacy: { route: /privacy, legal: privacy }
`;
  const auth =
    "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles: { admin: all, member: { pages: all } }\npublic: { pages: [home, privacy] }\n";
  const contentText =
    "smithableContent: 0.1\npages:\n  privacy:\n    operator: { name: Calm Ab }\n";
  const build = (specText: string, content: string) => {
    const ir = validateSpec({ path: "smithable.yml", text: specText }).ir as SpecIR;
    const a = validateAuth({ path: "smithable.auth.yml", text: auth }, ir).auth as AuthIR;
    const c = validateContent({ path: "smithable.content.yml", text: content }, ir)
      .content as NonNullable<ReturnType<typeof validateContent>["content"]>;
    return { ir, options: { smithableVersion: "0.0.0", auth: a, content: c } };
  };
  const before = build(spec, contentText);
  const [review] = privacyReviews(before.ir, before.options);
  expect(review).toMatchObject({ page: "privacy", state: "never" });
  expect(review?.facts).toMatch(/^[0-9a-f]{16}$/);
  // The operation writes the record; the page then says the description was reviewed.
  const applied = applyOperation({ spec, auth, content: contentText }, "reviewPrivacyPage", {
    page: "privacy",
    facts: review?.facts,
    on: "2026-11-13",
  });
  expect(applied.ok).toBe(true);
  const files = applied.ok ? applied.files : { spec, content: contentText };
  expect(files.content).toContain("reviewed:");
  const reviewed = build(spec, files.content ?? "");
  expect(privacyReviews(reviewed.ir, reviewed.options)[0]?.state).toBe("reviewed");
  const route = (b: ReturnType<typeof build>) =>
    generateApp(b.ir, b.options).find((f) => f.path === "src/routes/privacy/index.tsx")?.content ??
    "";
  expect(route(reviewed)).toContain('reviewedOn: "2026-11-13"');
  // A new personal field changes the facts: no review line, and the review is "changed".
  const changed = build(
    spec.replace("email: email! }", "email: email!, phone: phone }"),
    files.content ?? "",
  );
  expect(privacyReviews(changed.ir, changed.options)[0]?.state).toBe("changed");
  expect(route(changed)).not.toContain("reviewedOn");
  // Not a privacy page: refused.
  const refused = applyOperation({ spec, auth, content: contentText }, "reviewPrivacyPage", {
    page: "messages",
    facts: review?.facts,
    on: "2026-11-13",
  });
  expect(refused.ok).toBe(false);
});

test("the owner's functions: 'described below' with the maker's text, and the fingerprint's sentences fall back as the kit does", () => {
  const en = TEMPLATES_FOR_TEST["src/kit/words/en.ts"] ?? "";
  expect(en).toContain(
    '${described ? "The owner describes them below." : "This page does not describe what they do."}',
  );
  const spec = `smithable: 0.1
app: { name: X }
models:
  Message:
    fields: { name: string!, email: email! }
pages:
  home: { route: /, landing: { hero: {}, footer: {} } }
  messages: { crud: Message }
  privacy: { route: /privacy, legal: privacy }
`;
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles: { admin: all, member: { pages: all } }\npublic: { pages: [home, privacy] }\n",
    },
    ir,
  ).auth as AuthIR;
  const fingerprint = (language: string) =>
    privacyReviews(ir, {
      smithableVersion: "0.0.0",
      auth,
      content: { ...emptyContent(), language } as ReturnType<typeof emptyContent>,
    })[0]?.facts;
  // A language the kit has no words file for counts English's sentences, as the kit shows them.
  expect(fingerprint("zz")).toBe(fingerprint("en"));
  expect(fingerprint("sv")).not.toBe(fingerprint("en"));
});
