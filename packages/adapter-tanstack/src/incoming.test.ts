import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Status }
models:
  Incident:
    fields: { title: string!, status: investigating | resolved, detectedAt: datetime!, minutes: int }
pages:
  incidents: { crud: Incident }
incoming:
  monitorDown:
    create: Incident
    set: { title: "{check.name} is down", minutes: "{check.minutes}", detectedAt: NOW() }
    id: "{event.id}"
  paymentReceived:
    custom: true
    signed: sha256
`,
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: all }\n",
  },
  ir,
).auth as AuthIR;
const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
const file = (path: string) => files.find((f) => f.path === path);

test("a call that adds a record: its route checks the secret, fills the values from the JSON and remembers its id", () => {
  const route = file("src/routes/incoming/monitorDown.ts")?.content ?? "";
  expect(route).toContain('createFileRoute("/incoming/monitorDown")');
  expect(route).toContain("process.env.INCOMING_MONITORDOWN_SECRET");
  expect(route).toContain("const expected = `Bearer ${secret}`;");
  expect(route).toContain('title: fill("{check.name} is down", body),');
  expect(route).toContain('minutes: whole(fill("{check.minutes}", body)),');
  expect(route).toContain("detectedAt: new Date(F.NOW()),");
  expect(route).toContain('fill("{event.id}", body)');
  expect(route).toContain("incidentSchema.safeParse(");
  expect(file("src/db/schema.ts")?.content).toContain('"incoming_seen"');
});

test("a custom, signed call: an HMAC of the body, and a stub of the project's own, written once", () => {
  const route = file("src/routes/incoming/paymentReceived.ts")?.content ?? "";
  expect(route).toContain('createHmac("sha256", secret).update(raw)');
  expect(route).toContain('request.headers.get("x-signature-256")');
  expect(route).toContain('import { handle } from "#/custom/incoming/payment-received";');
  const stub = file("src/custom/incoming/payment-received.ts");
  expect(stub?.zone).toBe("custom");
  expect(stub?.content).toContain("export async function handle(body: unknown, caller: Viewer)");
});
