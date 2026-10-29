import { type AuthIR, type SpecIR, validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import bookingSpec from "../../../../examples/booking/smithable.yml?raw";
import crmAuth from "../../../../examples/crm/smithable.auth.yml?raw";
import crmSpec from "../../../../examples/crm/smithable.yml?raw";
import { mapOf } from "./data-map";

const ir = validateSpec({ path: "smithable.yml", text: crmSpec }).ir as SpecIR;
const auth = validateAuth({ path: "smithable.auth.yml", text: crmAuth }, ir).auth as AuthIR;

test("the CRM's map: its kinds of record and the people, references and ownership as arrows", () => {
  const { nodes, edges } = mapOf(ir, auth);
  expect(nodes.map((n) => n.id)).toEqual(["Customer", "Order", "FollowUp", "User"]);
  // An order refers to its customer; a list is the other side of that arrow, not one of its own.
  expect(edges).toContainEqual(
    expect.objectContaining({ source: "Order", target: "Customer", kind: "reference" }),
  );
  expect(edges.filter((e) => e.source === "Customer" && e.target === "Order")).toEqual([]);
  // The account manager owns the customer (ownedBy); an order is whoever made it.
  expect(edges).toContainEqual({
    id: "Customer.accountManager",
    source: "Customer",
    target: "User",
    label: "accountManager (owns it)",
    kind: "owner",
    relation: "many to one",
    ends: ["*", "0..1"],
  });
  // How they relate, with the list on the other side.
  expect(edges.find((e) => e.id === "Order.customer")).toMatchObject({
    relation: "many to one",
    list: "Customer.orders",
    label: "customer · Customer.orders",
    ends: ["*", "1"],
  });
  // An order is whoever made it: said in its box, not by an arrow to the people.
  expect(nodes.find((n) => n.id === "Order")?.madeBy).toBe(true);
  expect(nodes.find((n) => n.id === "Customer")?.madeBy).toBeUndefined();
  expect(edges.filter((e) => e.target === "User").map((e) => e.id)).toEqual([
    "Customer.accountManager",
  ]);
  // Each field is listed with what it holds.
  expect(nodes[0]?.fields).toContainEqual({ name: "accountManager", holds: "→ User" });
});

test("without sign-in a record is not its maker's: only ownedBy says whose it is", () => {
  const { nodes, edges } = mapOf(ir);
  expect(edges.filter((e) => e.kind === "owner").map((e) => e.id)).toEqual([
    "Customer.accountManager",
  ]);
  expect(nodes.some((n) => n.madeBy)).toBe(false);
  expect(nodes.map((n) => n.id)).toContain("User");
});

test("a kind no arrow reaches says where its records come from and where they show (A 164)", () => {
  const booking = validateSpec({ path: "smithable.yml", text: bookingSpec }).ir as SpecIR;
  const { nodes } = mapOf(booking);
  // A post is written on its page and shown on the blog and the home page's news; a message
  // comes from the home page's contact form.
  expect(Object.fromEntries(nodes.filter((n) => n.alone).map((n) => [n.id, n.alone]))).toEqual({
    Post: { from: ["the posts page"], shown: ["home", "blog", "admin"], actions: ["publish"] },
    Message: {
      from: ["the contact form on home", "the messages page"],
      shown: ["admin"],
      actions: [],
    },
  });
  expect(nodes.find((n) => n.id === "Session")?.alone).toBeUndefined();
});
