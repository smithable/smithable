import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// A custom action on the rows picked (A 171): its one list input is typed as the ids of the
// records, and its run checks in one read that the person may read every one of them.
test("a custom action's list input is an array of ids, all checked for reading in one read", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Customer:\n    fields: { name: string!, segment: smb | enterprise }\nactions:\n  tag:\n    custom: true\n    input: { customers: 'Customer[]', segment: 'smb | enterprise' }\n    intent: Put the chosen customers in a segment.\npages:\n  customers: { crud: Customer, actions: [tag] }\n",
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: {} }\n",
    },
    ir,
  ).auth as AuthIR;
  const out = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const of = (path: string) => out.find((f) => f.path === path)?.content ?? "";
  expect(of("src/generated/actions/tag.input.ts")).toContain(
    "customers: z.array(z.number().int()).min(1).max(1000)",
  );
  expect(of("src/generated/actions/tag.server.ts")).toContain(
    "if (!customerData.canReadAll(viewer, data.customers)) throw new AccessDenied(true);",
  );
  expect(of("src/generated/customer.server.ts")).toContain(
    "canReadAll(viewer: Viewer | null, ids: number[]): boolean {",
  );
});

test("the list's selection bar runs it on the rows picked, asking the rest once; one Activity line a run", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Customer:\n    fields: { name: string!, segment: smb | enterprise }\nactions:\n  tag:\n    custom: true\n    input: { customers: 'Customer[]', segment: 'smb | enterprise' }\n    intent: Put the chosen customers in a segment.\npages:\n  customers: { crud: Customer, actions: [tag] }\n",
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: {} }\n",
    },
    ir,
  ).auth as AuthIR;
  const out = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const of = (path: string) => out.find((f) => f.path === path)?.content ?? "";
  const action = of("src/generated/actions/tag.ts");
  expect(action).toContain("export const tagAsks = tagInput.omit({ customers: true });");
  // The server function runs the shared run, which records it.
  expect(action).toContain("return runTag(viewer, data);");
  expect(of("src/generated/actions/tag.server.ts")).toContain(
    'audit(db, viewer, { action: "tag", model: "Customer", details: { records: data.customers } });',
  );
  const list = of("src/routes/customers/index.tsx");
  expect(list).toContain("applies: allows(tagAccess, viewer) ? chosen.length : 0,");
  expect(list).toContain("ask: { ui: tagAskUi, schema: tagAsks },");
  expect(list).toContain(
    "await tag({ data: { ...(values as object), customers: chosen.map((row) => row.id) } as never });",
  );
  // A page that does not list it has no such button.
  const other = generateApp(
    validateSpec({
      path: "smithable.yml",
      text: "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Customer:\n    fields: { name: string!, segment: smb | enterprise }\nactions:\n  tag:\n    custom: true\n    input: { customers: 'Customer[]', segment: 'smb | enterprise' }\npages:\n  customers: { crud: Customer }\n",
    }).ir as SpecIR,
    { smithableVersion: "0.0.0", auth, content: emptyContent() },
  );
  expect(other.find((f) => f.path === "src/routes/customers/index.tsx")?.content).not.toContain(
    "tagAccess",
  );
});

test("programs and assistants run it on ids: the API route, its OpenAPI path, and the run tool", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Customer:\n    fields: { name: string!, segment: smb | enterprise }\nactions:\n  tag:\n    custom: true\n    input: { customers: 'Customer[]', segment: 'smb | enterprise' }\n    intent: Put the chosen customers in a segment.\npages:\n  customers: { crud: Customer, actions: [tag] }\n  team: { users: manage }\n",
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: {} }\napi: { models: [Customer], actions: [tag], assistants: true }\nassistant: { for: [admin], may: change }\n",
    },
    ir,
  ).auth as AuthIR;
  const out = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const of = (path: string) => out.find((f) => f.path === path)?.content ?? "";
  const route = of("src/routes/api/v1/customers/actions.$action.ts");
  expect(route).toContain('createFileRoute("/api/v1/customers/actions/$action")');
  expect(route).toContain(
    "return (await runTag(viewer, tagInput.parse({ ...rest, customers: ids }))) ?? {};",
  );
  expect(of("src/generated/api.server.ts")).toContain('"/api/v1/customers/actions/tag"');
  const run =
    "return (await runTag(keyed(viewer), tagInput.parse({ ...((args.input ?? {}) as object), customers: args.ids }))) ?? {};";
  expect(of("src/generated/mcp.server.ts")).toContain(run);
  const ask = of("src/generated/ask.server.ts");
  expect(ask).toContain(run);
  // Ask proposes it with a card saying how many rows, for the person to confirm.
  expect(ask).toContain('"tag": { access: tagAccess, input: tagInput, field: "customers"');
});
