import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { validateAuth } from "./auth.js";
import type { SpecIR } from "./ir.js";
import { validateSpec } from "./spec.js";

// A status page: the front page shows the incidents that are not over, the history every one.
const spec = (home = "") => `smithable: 0.1
app: { name: Status }
models:
  Incident:
    fields:
      title: string!
      status: investigating | identified | monitoring | resolved
      major: bool
pages:
  home:
    route: /
    landing:
      hero:
      ${home || "open: { records: Incident, where: { status: [investigating, identified, monitoring] } }"}
  incidents: { crud: Incident }
`;
const read = (home?: string) => validateSpec({ path: "smithable.yml", text: spec(home) });
const codes = (home: string) => read(home).diagnostics.map((d) => d.code);
const ir = read().ir as SpecIR;
const auth = (read: string) =>
  validateAuth(
    {
      path: "smithable.auth.yml",
      text: `smithableAuth: 0.1\nsignIn: none\npublic:\n  pages: [home, incidents]\n  read:\n    - ${read}\n`,
    },
    ir,
  );

test("a records section shows only the records its where fits", () => {
  const home = ir.pages[0];
  expect(home?.pattern.kind === "landing" && home.pattern.sections[1]?.where).toEqual({
    status: ["investigating", "identified", "monitoring"],
  });
  expect(
    read("open: { records: Incident, where: { major: true } }").diagnostics.filter(
      (d) => d.severity !== "note",
    ),
  ).toEqual([]);
  expect(codes("open: { records: Incident, where: { status: paused } }")).toEqual([
    "unknown-value",
  ]);
  expect(codes("open: { records: Incident, where: { severity: high } }")).toEqual([
    "unknown-field",
  ]);
  expect(codes("open: { records: Incident, where: { major: yes } }")).toEqual(["invalid-where"]);
  expect(codes("open: { records: Incident, where: { status: [] } }")).toEqual(["invalid-value"]);
  expect(codes("faq: { where: { major: true } }")).toEqual(["invalid-key"]);
});

test("a public read may name several values, written as the choices are on the command line", () => {
  const several = auth("Incident: { where: { status: [investigating, identified] } }");
  expect(several.diagnostics).toEqual([]);
  expect(several.auth?.public.readWhere).toEqual({
    Incident: { status: ["investigating", "identified"] },
  });
  expect(
    auth("Incident: { where: { status: [investigating, paused] } }").diagnostics.map((d) => d.code),
  ).toEqual(["invalid-where"]);
  const set = applyOperation(
    { spec: spec(), auth: `smithableAuth: 0.1\nsignIn: none\npublic:\n  read: [Incident]\n` },
    "setPublicWhere",
    { model: "Incident", where: { status: "investigating | identified", major: "true" } },
  );
  expect(set.ok && set.files.auth).toContain(
    "{ Incident: { where: { status: [investigating, identified], major: true } } }",
  );
});

test("the section's where follows a rename and refuses to lose its field or a value", () => {
  const files = { spec: spec() };
  const renamed = applyOperation(files, "renameField", {
    model: "Incident",
    from: "status",
    to: "state",
  });
  expect(renamed.ok && renamed.files.spec).toContain(
    "where: { state: [investigating, identified, monitoring] }",
  );
  expect(
    applyOperation(files, "removeField", { model: "Incident", field: "status" }),
  ).toMatchObject({ ok: false, message: expect.stringContaining("where status fits") });
  expect(
    applyOperation(files, "changeField", {
      model: "Incident",
      field: "status",
      type: "investigating | monitoring | resolved",
    }),
  ).toMatchObject({ ok: false, message: expect.stringContaining("status is identified") });
  const kept = applyOperation(files, "changeField", {
    model: "Incident",
    field: "status",
    type: "investigating | identified | monitoring | resolved | postmortem",
  });
  expect(kept.ok).toBe(true);
});

test("addSection takes a where, and setSectionWhere changes or clears it", () => {
  const files = { spec: spec("faq:") };
  const added = applyOperation(files, "addSection", {
    page: "home",
    section: "open",
    records: "Incident",
    where: { status: "investigating | identified" },
  });
  expect(added.ok && added.files.spec).toMatch(
    /open:\n\s+records: Incident\n\s+where:\n\s+status: \[investigating, identified\]\n/,
  );
  expect(
    applyOperation(files, "addSection", {
      page: "home",
      section: "faq2",
      where: { major: "true" },
    }),
  ).toMatchObject({ ok: false });
  const changed = applyOperation({ spec: spec() }, "setSectionWhere", {
    page: "home",
    section: "open",
    where: { major: "true" },
  });
  expect(changed.ok && changed.files.spec).toContain("where: { major: true }");
  const cleared = applyOperation({ spec: spec() }, "setSectionWhere", {
    page: "home",
    section: "open",
  });
  expect(cleared.ok && cleared.files.spec).toContain("open: { records: Incident }");
  expect(
    applyOperation({ spec: spec() }, "setSectionWhere", { page: "home", section: "hero" }),
  ).toMatchObject({ ok: false, message: expect.stringContaining("shows no records") });
});
