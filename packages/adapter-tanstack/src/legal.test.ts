import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

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
