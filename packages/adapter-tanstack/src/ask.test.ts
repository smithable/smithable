import {
  type AuthIR,
  assistantOffer,
  type ContentIR,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";

// The kit file is the app's own; it is loaded as the app would have it, not compiled here.
const path: string = "../templates/src/kit/ask.ts";
const { readQuestion, smallTalk, suggestions, turnsOf } = (await import(path)) as {
  readQuestion: (question: string, kinds: unknown[]) => Record<string, unknown> | undefined;
  smallTalk: (question: string) => string | undefined;
  suggestions: (kinds: unknown[]) => string[];
  turnsOf: (value: unknown) => { question: string; answer: string }[];
};

const raw = import.meta.glob("../../../examples/*/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** A starter's kinds of record in the words people use, as an administrator inside the app. */
function kindsOf(starter: string) {
  const at = (file: string) => raw[`../../../examples/${starter}/${file}`] as string;
  const ir = validateSpec({ path: "smithable.yml", text: at("smithable.yml") }).ir as SpecIR;
  const auth = validateAuth({ path: "smithable.auth.yml", text: at("smithable.auth.yml") }, ir)
    .auth as AuthIR;
  const content = validateContent(
    { path: "smithable.content.yml", text: at("smithable.content.yml") },
    ir,
  ).content as ContentIR;
  return assistantOffer(ir, auth, { role: "admin" }, { scope: "app", content }).kinds;
}
const crm = kindsOf("crm");
const ask = (question: string, kinds = crm) => readQuestion(question, kinds);

test("how many: a count, with a choice's value, by a field, in a month", () => {
  expect(ask("How many customers do we have?")).toEqual({ tool: "measure", kind: "Customer" });
  expect(ask("How many customers are enterprise?")).toEqual({
    tool: "measure",
    kind: "Customer",
    where: { segment: "enterprise" },
  });
  expect(ask("How many orders are still drafts?")).toEqual({
    tool: "measure",
    kind: "Order",
    where: { status: "draft" },
  });
  expect(ask("Orders per status?")).toEqual({ tool: "measure", kind: "Order", by: "status" });
  expect(ask("How many invoices per status?", kindsOf("invoicing"))).toEqual({
    tool: "measure",
    kind: "Invoice",
    by: "status",
  });
  // "placed in September" is about when, not about the status "placed".
  expect(ask("How many orders were placed in September 2026?")).toEqual({
    tool: "measure",
    kind: "Order",
    where: { placedAt: { from: "2026-09-01", to: "2026-09-30" } },
  });
});

test("a sum or an average of the number field named, or of the only one", () => {
  expect(ask("What is the total of all placed orders?")).toEqual({
    tool: "measure",
    kind: "Order",
    of: "sum total",
    where: { status: "placed" },
  });
  expect(ask("What is the average order total?")).toEqual({
    tool: "measure",
    kind: "Order",
    of: "average total",
  });
  expect(ask("What's the total credit limit of our SMB customers?")).toEqual({
    tool: "measure",
    kind: "Customer",
    of: "sum creditLimit",
    where: { segment: "smb" },
  });
});

test("lists, a field of a named record, and the largest or smallest", () => {
  expect(ask("Which customers are in the government segment?")).toEqual({
    tool: "find",
    kind: "Customer",
    where: { segment: "government" },
    limit: 50,
  });
  expect(ask("Which orders are over 5 000 €?")).toEqual({
    tool: "find",
    kind: "Order",
    where: { total: { over: 5000 } },
    limit: 50,
  });
  expect(ask("What is Nordic Timber's credit limit?")).toEqual({
    tool: "find",
    kind: "Customer",
    search: "nordic timber",
    fields: ["creditLimit"],
    limit: 3,
  });
  expect(ask("What's Baltic Freight's phone number?")).toMatchObject({
    kind: "Customer",
    search: "baltic freight",
    fields: ["phone"],
  });
  // An app with one kind of record needs no noun: "furniture" is a category, "thing" any item.
  const market = kindsOf("marketplace");
  expect(ask("Show me furniture under 100 €.", market)).toEqual({
    tool: "find",
    kind: "Item",
    where: { price: { under: 100 }, category: "furniture" },
    limit: 50,
  });
  expect(ask("What's the cheapest thing in electronics?", market)).toEqual({
    tool: "find",
    kind: "Item",
    where: { category: "electronics" },
    sort: "price",
    limit: 1,
  });
  expect(ask("What is the most expensive item?", market)).toMatchObject({
    sort: "-price",
    limit: 1,
  });
  // A value by its label ("like new" is likeNew).
  expect(ask("Which items are like new?", market)).toMatchObject({
    where: { condition: "likeNew" },
  });
});

test("every word must be accounted for: what the rules do not fully read is left to the model", () => {
  for (const question of [
    // A word that turns the question into another one.
    "How many orders are not shipped?",
    "Which customers have never ordered anything?",
    "What is our largest order, and who placed it?",
    "How many customers or orders do we have?",
    // A word the app's vocabulary does not have.
    "How many orders are still open?",
    "Which orders go by express shipping?",
    "How many customers are in Mariehamn?",
    "How much has Skerry Software ordered in total?",
    "Who has the highest credit limit?",
    // A field no kind has, or that two could mean.
    "What is Nordic Timber's shoe size?",
    // Nothing at all.
    "",
    "Hello!",
  ])
    expect(ask(question), question).toBeUndefined();
  // Two date fields: which one "in September" means is not the rules' to guess.
  expect(
    ask("How many incidents were there in September 2026?", kindsOf("status")),
  ).toBeUndefined();
});

test("of the bench's hundred questions that only read, the rules answer about three in ten", () => {
  // The count is kept so a change to the rules shows what it does to it (docs/design/assistant.md §9).
  const questions: [string, string[]][] = [
    ["invoicing", ["How many invoices are there?", "Which invoices are overdue?"]],
    ["status", ["Which incident are we monitoring?", "Which components are operational?"]],
    ["booking", ["How many posts are published?", "How many instructors do we have?"]],
    ["records", ["Which are our favorites?", "How many items of each kind?"]],
  ];
  for (const [starter, asked] of questions)
    for (const question of asked) expect(ask(question, kindsOf(starter)), question).toBeDefined();
});

test("a chat: small talk by rule, questions to try that the rules read, earlier turns cut short", () => {
  expect(smallTalk("Hi!")).toBe("Hello! Ask me about the records you can see here.");
  expect(smallTalk("thanks a lot")).toMatch(/welcome/);
  expect(smallTalk("What can you do?")).toMatch(/^I answer questions/);
  expect(smallTalk("how many customers")).toBeUndefined();
  const tries = suggestions(crm);
  expect(tries.length).toBeGreaterThan(1);
  // Each one is read by the rules, so trying it costs nothing.
  for (const question of tries) expect(ask(question), question).toBeDefined();
  const turns = turnsOf([
    ...Array.from({ length: 8 }, (_, i) => ({ question: `q${i}`, answer: "x".repeat(900) })),
    { question: 1, answer: "not a turn" },
  ]);
  expect(turns.map((t) => t.question)).toEqual(["q3", "q4", "q5", "q6", "q7"]);
  expect(turns[0]?.answer.length).toBe(500);
  expect(turnsOf("nope")).toEqual([]);
});
