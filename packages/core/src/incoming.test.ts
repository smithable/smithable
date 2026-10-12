import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { validateAuth } from "./auth.js";
import { incomingText } from "./sections/incoming.js";
import { validateSpec } from "./spec.js";

const raw = import.meta.glob("../../../examples/status/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const spec = raw["../../../examples/status/smithable.yml"] as string;
const auth = raw["../../../examples/status/smithable.auth.yml"] as string;
const withIncoming = (block: string) => `${spec}\nincoming:\n${block}`;
const read = (block: string) => validateSpec({ path: "smithable.yml", text: withIncoming(block) });
const codes = (block: string) => read(block).diagnostics.map((d) => d.code);

test("an incoming call: a record per call with literals, formulas and {path} texts, or custom code", () => {
  const { ir, diagnostics } = read(`  monitorDown:
    create: Incident
    set: { title: "{check.name} is not responding", status: investigating, detectedAt: NOW() }
    id: "{event.id}"
    as: staff
  paymentReceived:
    custom: true
    signed: sha256
`);
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(ir?.incoming).toEqual([
    {
      name: "monitorDown",
      create: "Incident",
      set: [
        { field: "title", template: "{check.name} is not responding" },
        { field: "status", value: "investigating" },
        expect.objectContaining({ field: "detectedAt", text: "NOW()" }),
      ],
      custom: false,
      id: "{event.id}",
      as: "staff",
    },
    { name: "paymentReceived", set: [], custom: true, signed: "sha256", as: "admin" },
  ]);
  const named = (m: string) => m.toLowerCase();
  expect(incomingText(ir?.incoming[0] as never, named)).toBe(
    "When monitor down is called: adds an incident, as staff.",
  );
  expect(incomingText(ir?.incoming[1] as never, named)).toBe(
    "When payment received is called: its code decides what happens, as admin; the call is signed.",
  );
});

test("a call needs a model or code, fields that exist and can be set, and paths in its templates", () => {
  expect(codes("  x:\n    as: staff\n")).toContain("invalid-incoming");
  expect(codes("  x: { create: Incident, custom: true }\n")).toContain("invalid-incoming");
  expect(codes("  x: { create: Incidnt }\n")).toContain("unknown-model");
  expect(codes("  x: { create: Incident, set: { titel: Down } }\n")).toContain("unknown-field");
  expect(codes("  x: { create: Incident, set: { updates: x } }\n")).toContain("invalid-set");
  expect(codes('  x: { create: Incident, set: { title: "{a b}" } }\n')).toContain(
    "invalid-template",
  );
  expect(codes("  x: { create: Incident, set: { status: broken } }\n").length).toBeGreaterThan(0);
  expect(codes("  Monitor: { custom: true }\n")).toContain("invalid-name");
  expect(codes("  x: { custom: true, signed: md5 }\n")).toContain("invalid-incoming");
});

test("addIncoming and removeIncoming write the entry; the role must exist and may create the record", () => {
  const files = { spec, auth };
  const added = applyOperation(files, "addIncoming", {
    name: "monitorDown",
    create: "Incident",
    set: ["title={check.name} is down", "detectedAt=NOW()"],
    as: "staff",
  });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.spec).toMatch(
    /incoming:\n {2}monitorDown:\n {4}create: Incident\n {4}set:\n {6}title: "?\{check\.name\} is down"?\n {6}detectedAt: NOW\(\)\n {4}as: staff/,
  );
  const custom = applyOperation({ ...files, ...added.files }, "addIncoming", {
    name: "paymentReceived",
    custom: true,
    signed: true,
  });
  expect(custom.ok && custom.files.spec).toMatch(
    /paymentReceived:\n {4}custom: true\n {4}signed: sha256/,
  );
  expect(applyOperation(files, "addIncoming", { name: "x" })).toMatchObject({ ok: false });
  const removed = applyOperation({ ...files, ...added.files }, "removeIncoming", {
    name: "monitorDown",
  });
  expect(removed.ok && removed.files.spec).not.toContain("incoming");
  // The role, against the auth file.
  const ir = read("  x: { create: Incident, as: nobody }\n").ir;
  if (!ir) throw new Error("the spec is invalid");
  expect(
    validateAuth({ path: "smithable.auth.yml", text: auth }, ir).diagnostics.map((d) => d.code),
  ).toContain("unknown-role");
});
