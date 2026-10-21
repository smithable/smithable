import { expect, test } from "vitest";
import { validateAuth } from "./auth.js";
import { writeExplicit } from "./explicit.js";
import { validateSpec } from "./spec.js";
import { validateUx } from "./ux.js";

const text = `smithable: 0.1
app: { name: Desk }
models:
  Ticket:
    fields:
      title: string!
      code: string unique
      status: open | closed
      notes: Note[]
  Note:
    fields:
      body: text!
      ticket: Ticket!
      sender: agent | customer
  Post:
    fields:
      heading: string!
      key: string unique
      blurb: text
      text: markdown!
      when: datetime
  Dish:
    fields:
      name: string!
      price: money!
      available: bool = true
  Order:
    fields:
      number: { type: int!, sequence: true }
      name: string!
      lines: OrderLine[]
  OrderLine:
    fields:
      order: Order!
      dish: Dish!
      quantity: int! = 1
      unitPrice: money!
pages:
  tickets: { crud: Ticket }
  blog: { articles: Post }
  schedule: { calendar: Post }
  menu: { route: /, order: { from: Dish, into: Order, ask: [name] } }
`;
const auth =
  "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: private\nroles:\n  admin: all\n  agent: { pages: all, read: [Ticket] }\ndefaultRole: agent\n";
const uxText =
  "smithableUx: 0.1\npages:\n  tickets:\n    record:\n      lists: { notes: thread }\n";

function load(spec: string) {
  const { ir, diagnostics } = validateSpec({ path: "smithable.yml", text: spec });
  if (!ir) throw new Error(diagnostics.map((d) => d.message).join("\n"));
  const a = validateAuth({ path: "smithable.auth.yml", text: auth }, ir).auth;
  if (!a) throw new Error("auth");
  const ux = validateUx({ path: "smithable.ux.yml", text: uxText }, ir).ux;
  return { ir, auth: a, ux };
}

test("validate --write says every rule's result in the spec, once; the spec then means the same", () => {
  const first = load(text);
  const written = writeExplicit(text, first.ir, first.auth, first.ux);
  expect(written.written).toEqual([
    // Agents read every ticket, so a ticket's code is unique in the whole app; a post is its
    // owner's; an order's number counts up per owner.
    "Ticket.code: unique app",
    "Post.key: unique owner",
    "Order.number: unique owner",
    "Ticket: namedBy title",
    "Note: namedBy body",
    "Note: thread body body, side sender (agent ours)",
    "Post: namedBy heading",
    "Dish: namedBy name",
    "Order: namedBy name",
    "blog: articles title heading, body text, date when, address key, summary blurb",
    "schedule: calendar starts when",
    "menu: order price price, quantity quantity, available available",
  ]);
  const second = load(written.text);
  // The same app: titles, parts and scopes as the rules read them.
  expect(second.ir.models.map((m) => [m.name, m.namedBy])).toEqual([
    ["Ticket", "title"],
    ["Note", "body"],
    ["Post", "heading"],
    ["Dish", "name"],
    ["Order", "name"],
    ["OrderLine", undefined],
  ]);
  expect(second.ir.models[1]?.thread).toEqual({
    body: "body",
    side: { field: "sender", ours: "agent" },
  });
  expect(second.ir.pages[1]?.pattern).toEqual(first.ir.pages[1]?.pattern);
  expect(second.ir.pages[2]?.pattern).toEqual(first.ir.pages[2]?.pattern);
  expect(second.ir.pages[3]?.pattern).toEqual(first.ir.pages[3]?.pattern);
  // Nothing is left to write.
  expect(writeExplicit(written.text, second.ir, second.auth, second.ux).written).toEqual([]);
  // What was written stays: a part named by hand is not replaced.
  const partly = text.replace(
    "  blog: { articles: Post }",
    "  blog: { articles: { model: Post, summary: none } }",
  );
  const third = load(partly);
  const more = writeExplicit(partly, third.ir, third.auth, third.ux);
  expect(more.written.find((w) => w.startsWith("blog:"))).toBe(
    "blog: articles title heading, body text, date when, address key",
  );
  expect(more.text).toContain("summary: none");
});
