import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { validateSpec } from "./spec.js";
import { threadBindings } from "./thread.js";
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

const explicit = validateSpec({
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
      summary: text
      content: text!
      sender: agent | customer
      direction: in | out
      agent: User
      author: email
      supportCase: SupportCase!
    thread: { body: content, author: author, side: { field: direction, ours: out } }
pages:
  cases: { crud: SupportCase }
`,
});

test("the model's thread says which fields a conversation reads; the rule fills the rest and warns where it had to pick", () => {
  expect(explicit.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const message = explicit.ir?.models.find((m) => m.name === "Message") as NonNullable<
    typeof ir
  >["models"][number];
  expect(message.thread).toEqual({
    body: "content",
    author: "author",
    side: { field: "direction", ours: "out" },
  });
  const b = threadBindings(message);
  expect([b.body?.name, b.author?.name, b.side?.field.name, b.side?.ours, b.ambiguous]).toEqual([
    "content",
    "author",
    "direction",
    "out",
    [],
  ]);
  const settled = validateUx(
    {
      path: "smithable.ux.yml",
      text: "smithableUx: 0.1\npages:\n  cases:\n    record:\n      lists: { messages: thread }\n",
    },
    explicit.ir as NonNullable<typeof ir>,
  );
  expect(settled.diagnostics).toEqual([]);
  // Without the key the rule picks the first of each and says so.
  const byRule = validateSpec({
    path: "smithable.yml",
    text: explicit.ir
      ? `smithable: 0.1
app: { name: Support }
models:
  SupportCase:
    fields:
      subject: string!
      messages: Message[]
  Message:
    fields:
      summary: text
      content: text!
      sender: agent | customer
      direction: in | out
      agent: User
      author: email
      supportCase: SupportCase!
pages:
  cases: { crud: SupportCase }
`
      : "",
  });
  const guessed = threadBindings(byRule.ir?.models[1] as NonNullable<typeof ir>["models"][number]);
  expect([
    guessed.body?.name,
    guessed.author?.name,
    guessed.side?.field.name,
    guessed.side?.ours,
  ]).toEqual(["summary", "agent", "sender", "agent"]);
  expect(guessed.ambiguous).toEqual(["body", "side"]);
  const warned = validateUx(
    {
      path: "smithable.ux.yml",
      text: "smithableUx: 0.1\npages:\n  cases:\n    record:\n      lists: { messages: thread }\n",
    },
    byRule.ir as NonNullable<typeof ir>,
  );
  const warning = warned.diagnostics.find((d) => d.code === "thread-ambiguous");
  expect(warning?.message).toContain("body, side");
  expect(warning?.hint).toContain(
    "thread: { body: summary, side: { field: sender, ours: agent } }",
  );
});

test("a thread key that names the wrong kind of field is refused", () => {
  const codes = (thread: string) =>
    validateSpec({
      path: "smithable.yml",
      text: `smithable: 0.1\napp: { name: Support }\nmodels:\n  Message:\n    fields:\n      content: text!\n      count: int\n      sender: agent | customer\n      kind: a | b | c\n    thread: ${thread}\npages:\n  messages: { crud: Message }\n`,
    }).diagnostics.map((d) => d.code);
  expect(codes("{ body: count }")).toContain("invalid-value");
  expect(codes("{ author: count }")).toContain("invalid-value");
  expect(codes("{ side: { field: kind, ours: a } }")).toContain("invalid-value");
  expect(codes("{ side: { field: sender, ours: nobody } }")).toContain("invalid-value");
  expect(codes("{ side: { field: sender } }")).toContain("missing-key");
  expect(codes("{ body: nothing }")).toContain("unknown-field");
});

test("setThread writes the key; a renamed field follows into it; a removed one leaves it", () => {
  const files = {
    spec: `smithable: 0.1\napp: { name: Support }\nmodels:\n  Message:\n    fields:\n      content: text!\n      sender: agent | customer\n      agent: User\npages:\n  messages: { crud: Message }\n`,
    auth: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\n",
  };
  const set = applyOperation(files, "setThread", {
    model: "Message",
    body: "content",
    side: "sender",
    ours: "agent",
  });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.spec).toContain(
    "    thread:\n      body: content\n      side:\n        field: sender\n        ours: agent\n",
  );
  const more = applyOperation(set.files, "setThread", { model: "Message", author: "agent" });
  if (!more.ok) throw new Error(more.message);
  expect(more.files.spec).toContain("        ours: agent\n      author: agent\n");
  const renamed = applyOperation(more.files, "renameField", {
    model: "Message",
    from: "sender",
    to: "from",
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.spec).toMatch(/side:\n\s+field: from\n\s+ours: agent/);
  const removed = applyOperation(renamed.files, "removeField", {
    model: "Message",
    field: "agent",
  });
  if (!removed.ok) throw new Error(removed.message);
  expect(removed.files.spec).not.toContain("author");
  expect(removed.files.spec).toContain("body: content");
  const wrong = applyOperation(files, "setThread", { model: "Message", side: "sender" });
  expect(wrong.ok ? "" : wrong.message).toContain("go together");
  const none = applyOperation(more.files, "setThread", { model: "Message", none: true });
  if (!none.ok) throw new Error(none.message);
  expect(none.files.spec).not.toContain("thread:");
});
