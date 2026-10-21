import { type AuthIR, type SpecIR, validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import crmAuth from "../../../../examples/crm/smithable.auth.yml?raw";
import crmSpec from "../../../../examples/crm/smithable.yml?raw";
import { mapOf } from "./data-map";

const ir = validateSpec({ path: "smithable.yml", text: crmSpec }).ir as SpecIR;
const auth = validateAuth({ path: "smithable.auth.yml", text: crmAuth }, ir).auth as AuthIR;

test("the CRM's map: its kinds of record and the people, references and ownership as arrows", () => {
  const { nodes, edges } = mapOf(ir, auth);
  expect(nodes.map((n) => n.id)).toEqual(["Customer", "Order", "User"]);
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
  });
  expect(edges).toContainEqual(
    expect.objectContaining({ id: "Order.owner", target: "User", label: "made by (owns it)" }),
  );
  // Each field is listed with what it holds.
  expect(nodes[0]?.fields).toContainEqual({ name: "accountManager", holds: "→ User" });
});

test("without sign-in a record is not its maker's: only ownedBy says whose it is", () => {
  const { nodes, edges } = mapOf(ir);
  expect(edges.filter((e) => e.kind === "owner").map((e) => e.id)).toEqual([
    "Customer.accountManager",
  ]);
  expect(nodes.map((n) => n.id)).toContain("User");
});
