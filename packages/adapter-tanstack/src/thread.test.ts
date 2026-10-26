import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  type UxIR,
  validateAuth,
  validateSpec,
  validateUx,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// A record page's conversation reads the message model as its `thread` says
// (docs/design/conversation.md §2), the rule filling what it leaves out.
const spec = `smithable: 0.1
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
      supportCase: SupportCase!
    thread: { body: content, side: { field: direction, ours: out } }
pages:
  cases: { crud: SupportCase }
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const auth = validateAuth({
  path: "smithable.auth.yml",
  text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\n",
}).auth as AuthIR;
const ux = validateUx(
  {
    path: "smithable.ux.yml",
    text: "smithableUx: 0.1\npages:\n  cases:\n    record:\n      lists: { messages: thread }\n",
  },
  ir,
).ux as UxIR;

test("the conversation shows the body and the side the model names, and the author by rule", () => {
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent(), ux });
  const page = files.find((f) => f.path === "src/routes/cases/$id.tsx")?.content ?? "";
  expect(page).toContain('text="content"');
  expect(page).toContain('writer="agentId"');
  expect(page).toContain('side={{ field: "direction", ours: "out" }}');
  expect(page).not.toContain('text="summary"');
});

test("a thread with nothing to add on its page destructures no canAdd it never reads (M12 app 12)", () => {
  // A required field the reply box cannot fill, and no page of the message's own: no reply box,
  // no Add button, so the page reads no canAdd (TS6133 otherwise).
  const strict = validateSpec({
    path: "smithable.yml",
    text: spec.replace("      content: text!\n", "      content: text!\n      kind: string!\n"),
  }).ir as SpecIR;
  const files = generateApp(strict, {
    smithableVersion: "0.0.0",
    auth,
    content: emptyContent(),
    ux,
  });
  const page = files.find((f) => f.path === "src/routes/cases/$id.tsx")?.content ?? "";
  expect(page).not.toContain("canAdd?.");
  expect(page).not.toMatch(/const \{[^}]*\bcanAdd\b[^}]*\} = Route\.useLoaderData/);
  // With the reply box (the first spec), it reads it.
  const replying = generateApp(ir, {
    smithableVersion: "0.0.0",
    auth,
    content: emptyContent(),
    ux,
  });
  expect(replying.find((f) => f.path === "src/routes/cases/$id.tsx")?.content).toMatch(
    /const \{[^}]*\bcanAdd\b[^}]*\} = Route\.useLoaderData/,
  );
});
