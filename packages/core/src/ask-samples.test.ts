import { expect, test } from "vitest";
import { staleMeaningWords, validateAsk } from "./ask-samples.js";
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
  // A stale value or measure keeps the question, said; a kind or a role that is gone drops it.
  expect(read.asks.map((a) => a.question)).toEqual([
    "Is anything down?",
    "What is the average latency?",
  ]);
});

test("the file's shape: a list of mappings, each with the three keys, the answer one of three", () => {
  expect(codes("role: operator\n")).toEqual(["error:expected-list"]);
  expect(codes("- role: operator\n  question: Hi\n")).toEqual(["error:missing-key"]);
  expect(
    codes("- role: operator\n  question: Hi\n  expects: { kind: Component, answer: words }\n"),
  ).toEqual(["error:unknown-answer"]);
  expect(codes("- role: operator\n  question: Hi\n  expects: { answer: count }\n")).toEqual([
    "error:missing-key",
  ]);
  expect(ask("# none yet\n").asks).toEqual([]);
});

test("a meaning text that quotes a word the choice no longer has is a warning", () => {
  const described = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Status }
models:
  Component:
    fields:
      name: string!
      status:
        type: operational | degraded | outage
        description: In a question, "down" means any status but 'operational'.
pages:
  components: { crud: Component }
`,
  }).ir as SpecIR;
  const stale = staleMeaningWords(described);
  expect(stale.map((d) => d.message)).toEqual([
    'The meaning of Component.status names "down", which is not one of its values (operational, degraded, outage).',
  ]);
  expect(
    validateAsk({ path: "samples/ask.yml", text: "" }, described, auth).diagnostics.map(
      (d) => d.code,
    ),
  ).toEqual(["stale-meaning-word"]);
});
