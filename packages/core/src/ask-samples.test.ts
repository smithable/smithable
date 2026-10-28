import { expect, test } from "vitest";
import { validateAsk } from "./ask-samples.js";
import { type AuthIR, validateAuth } from "./auth.js";
import type { SpecIR } from "./ir.js";
import { validateSpec } from "./spec.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Status }
models:
  Component:
    fields:
      name: string!
      status: operational | degraded | outage
      uptime: decimal
  Incident:
    fields:
      title: string!
      component: Component!
pages:
  components: { crud: Component }
`,
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles:\n  admin: all\n  operator: { pages: [components] }\n",
  },
  ir,
).auth as AuthIR;
const ask = (text: string) => validateAsk({ path: "samples/ask.yml", text }, ir, auth);
const codes = (text: string) => ask(text).diagnostics.map((d) => `${d.severity}:${d.code}`);

test("questions with a role, a question and the shape expected", () => {
  const read = ask(`- role: operator
  question: Is anything down?
  expects: { kind: Component, where: { status: [degraded, outage] }, answer: names }
- role: visitor
  question: How many components are there?
  expects: { kind: Component, answer: count }
- role: admin
  question: What is the average uptime?
  expects:
    kind: Component
    measure: uptime
    answer: number
`);
  expect(read.diagnostics).toEqual([]);
  expect(read.asks).toEqual([
    {
      role: "operator",
      question: "Is anything down?",
      expects: { kind: "Component", where: { status: ["degraded", "outage"] }, answer: "names" },
    },
    {
      role: "visitor",
      question: "How many components are there?",
      expects: { kind: "Component", answer: "count" },
    },
    {
      role: "admin",
      question: "What is the average uptime?",
      expects: { kind: "Component", measure: "uptime", answer: "number" },
    },
  ]);
});

test("what names a kind, field, value or role no longer in the spec is a warning, and left out", () => {
  const read = ask(`- role: operator
  question: Is anything down?
  expects: { kind: Component, where: { status: down }, answer: names }
- role: operator
  question: Which services are down?
  expects: { kind: Service, answer: names }
- role: operator
  question: What is the average latency?
  expects: { kind: Component, measure: latency, answer: number }
- role: sales
  question: How many components are there?
  expects: { kind: Component, answer: count }
`);
  expect(read.diagnostics.map((d) => [d.severity, d.code, d.line])).toEqual([
    ["warning", "unknown-value", 3],
    ["warning", "unknown-kind", 6],
    ["warning", "unknown-field", 9],
    ["warning", "unknown-role", 10],
  ]);
  expect(read.diagnostics[0]?.hint).toContain("The values: operational, degraded, outage.");
  // Every question is kept as written: the host says what each finds now.
  expect(read.asks).toHaveLength(4);
  expect(read.asks[0]?.expects.where).toEqual({ status: "down" });
  expect(
    ask(
      "- role: admin\n  question: Average name?\n  expects: { kind: Component, measure: name, answer: number }\n",
    ).diagnostics.map((d) => d.code),
  ).toEqual(["not-a-number"]);
  expect(
    ask(
      "- role: admin\n  question: Which?\n  expects: { kind: Component, where: { status: 1, size: big }, answer: names }\n",
    ).diagnostics.map((d) => d.code),
  ).toEqual(["unknown-value", "unknown-field"]);
});

test("the file's shape: a list of mappings, each with the three keys, the answer one of three", () => {
  expect(codes("role: operator\n")).toEqual(["error:expected-list"]);
  expect(codes("- role: operator\n  question: Hi\n")).toEqual(["error:missing-key"]);
  expect(
    codes("- role: ''\n  question: Hi\n  expects: { kind: Component, answer: count }\n"),
  ).toEqual(["error:expected-text"]);
  expect(
    codes("- role: operator\n  question: Hi\n  expects: { kind: Component, answer: words }\n"),
  ).toEqual(["error:unknown-answer"]);
  expect(codes("- role: operator\n  question: Hi\n  expects: { answer: count }\n")).toEqual([
    "error:missing-key",
  ]);
  expect(ask("# none yet\n").asks).toEqual([]);
});
