import { type AuthIR, type SpecIR, validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

test("a landing page reads each list once and sends each section only the rows it shows (A 154)", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Status }
models:
  Incident: { fields: { title: string!, status: open | resolved } }
pages:
  home:
    route: /
    landing:
      hero: { button: incidents }
      open: { records: Incident, where: { status: open }, limit: 3 }
      recent: { records: Incident, where: { status: resolved }, limit: 5 }
  incidents: { crud: Incident }
navigation:
  main: [incidents]
`,
  }).ir as SpecIR;
  const auth = validateAuth(
    { path: "smithable.auth.yml", text: "smithableAuth: 0.1\nsignIn: none\n" },
    ir,
  ).auth as AuthIR;
  const route =
    generateApp(ir, { smithableVersion: "0.0.0", auth }).find(
      (f) => f.path === "src/routes/index.tsx",
    )?.content ?? "";
  // One read of the list for both sections, and each section's rows cut on the server.
  expect(route.match(/await listIncidents\(\)/g)).toHaveLength(1);
  expect(route).toContain(
    '"open": incidents.filter((row) => row.status === "open").slice(0, 3), "recent": incidents.filter((row) => row.status === "resolved").slice(0, 5)',
  );
  expect(route).toContain('cards={data["recent"].map((row) => ({');
  expect(route).not.toContain("data.incidents");
});
