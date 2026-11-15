import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { acceptsQuestion, indexedProject, requestProject } from "./smith-cases.mjs";

const set = JSON.parse(
  readFileSync(new URL("../docs/benchmarks/smith-requests.json", import.meta.url)),
);
const read = (starter) =>
  indexedProject({
    spec: readFileSync(new URL(`../examples/${starter}/smithable.yml`, import.meta.url), "utf8"),
  });

for (const [id, field] of [
  ["inv-notes-required", "Invoice.notes"],
  ["ki-calories-rename", "Dish.calories"],
]) {
  test(`${id} gets the previous field and target even when it is selected alone`, () => {
    const request = set.requests.find((r) => r.id === id);
    const base = read(request.starter);
    const before = base.files.spec;
    assert.ok(!base.index.concepts.some((c) => c.concept === `field:${field}`));
    const prepared = requestProject(base, request, set.requests);
    assert.ok(prepared.index.concepts.some((c) => c.concept === `field:${field}`));
    assert.equal(
      prepared.conversation.at(-1).request,
      set.requests.find((r) => r.id === request.after).text,
    );
    assert.equal(base.files.spec, before);
  });
}

test("invalid or cyclic history fails before a model is called", () => {
  const base = read("invoicing");
  const request = { id: "loop", starter: "invoicing", after: "loop" };
  assert.throws(() => requestProject(base, request, [request]), /Invalid predecessor/);
  assert.throws(
    () => requestProject(base, { ...request, after: "missing" }, []),
    /Invalid predecessor/,
  );
});

test("a labelled question must offer both concrete readings in different choices", () => {
  const label = set.requests.find((r) => r.id === "bb-sms-confirm").outcome;
  const proposal = {
    kind: "question",
    question: "Who receives the SMS?",
    options: [
      "The owner as with the existing confirmation",
      "The customer, at the appointment phone number",
    ],
  };
  assert.equal(acceptsQuestion(label, proposal), true);
  assert.equal(
    acceptsQuestion(label, { ...proposal, options: ["Please clarify", "Something else"] }),
    false,
  );
  assert.equal(
    acceptsQuestion(label, { ...proposal, options: ["Owner or customer", "Something else"] }),
    false,
  );
  assert.equal(acceptsQuestion({}, proposal), false);
});
