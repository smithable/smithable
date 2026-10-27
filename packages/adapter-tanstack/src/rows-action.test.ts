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
// records, and its server function checks that the person may read every one of them.
test("a custom action's list input is an array of ids, each checked for reading", () => {
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
    "customers: z.array(z.number().int()).min(1)",
  );
  expect(of("src/generated/actions/tag.ts")).toContain(
    "if (!data.customers.every((id) => customerData.canRead(viewer, id))) throw new AccessDenied(true);",
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
  expect(action).toContain(
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
