import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { validateSpec } from "./spec.js";
import { validateUx } from "./ux.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Support }
models:
  SupportCase:
    fields:
      subject: string!
      messages: Message[]
      tags: Tag[]
  Message:
    fields:
      content: text!
      sender: agent | customer
      supportCase: SupportCase!
  Tag:
    fields:
      name: string!
      priority: int!
      supportCase: SupportCase!
pages:
  cases: { crud: SupportCase }
`,
}).ir;

const ux = (lists: string) =>
  validateUx(
    {
      path: "smithable.ux.yml",
      text: `smithableUx: 0.1\npages:\n  cases:\n    record:\n      lists: ${lists}\n`,
    },
    ir as NonNullable<typeof ir>,
  );

test("a list on the record page as a thread, read from the listed model", () => {
  const result = ux("{ messages: thread }");
  expect(result.diagnostics).toEqual([]);
  expect(result.ux?.pages.cases?.lists).toEqual({ messages: "thread" });
});

test("a model with no long text cannot be a thread; a field the reply box cannot fill is a warning", () => {
  const codes = ux("{ tags: thread }").diagnostics.map((d) => d.message);
  expect(codes.join()).toContain("Tag cannot be a thread");
  expect(ux("{ subject: thread }").diagnostics.map((d) => d.code)).toContain("unknown-field");
  const withPriority = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Support }
models:
  SupportCase:
    fields:
      subject: string!
      messages: Message[]
  Message:
    fields:
      content: text!
      priority: int!
      supportCase: SupportCase!
pages:
  cases: { crud: SupportCase }
`,
  }).ir;
  const warned = validateUx(
    {
      path: "smithable.ux.yml",
      text: "smithableUx: 0.1\npages:\n  cases:\n    record:\n      lists: { messages: thread }\n",
    },
    withPriority as NonNullable<typeof withPriority>,
  ).diagnostics;
  expect(warned.map((d) => d.code)).toEqual(["thread-needs-form"]);
});

const portal = `smithable: 0.1
app: { name: Support }
models:
  SupportCase:
    fields:
      subject: string!
      messages: Message[]
  Message:
    fields:
      content: text!
      sender: agent | customer
      supportCase: SupportCase!
pages:
  cases: { crud: SupportCase }
`;
const threadUx =
  "smithableUx: 0.1\npages:\n  cases:\n    record:\n      lists: { messages: thread }\n";
const op = (name: string, args: Record<string, unknown>) =>
  applyOperation({ spec: portal, ux: threadUx }, name, args);

test("the thread follows its list's rename, and goes with the list", () => {
  const renamed = op("renameField", { model: "SupportCase", from: "messages", to: "notes" });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.ux).toContain("lists: { notes: thread }");
  const removed = op("removeField", { model: "SupportCase", field: "messages" });
  if (!removed.ok) throw new Error(removed.message);
  expect(removed.files.ux).not.toContain("record");
});

test("the message's only long text cannot go while a thread shows its model", () => {
  const removed = op("removeField", { model: "Message", field: "content" });
  expect(removed.ok ? "" : removed.message).toContain(
    "Message.content is the message of the thread on the cases page",
  );
});
