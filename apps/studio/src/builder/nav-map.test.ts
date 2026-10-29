import { type AuthIR, type SpecIR, validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import crmAuth from "../../../../examples/crm/smithable.auth.yml?raw";
import crmSpec from "../../../../examples/crm/smithable.yml?raw";
import { mapOf } from "./data-map";
import { dataMermaid, navMermaid } from "./mermaid";
import { navOf } from "./nav-map";

const ir = validateSpec({ path: "smithable.yml", text: crmSpec }).ir as SpecIR;
const auth = validateAuth({ path: "smithable.auth.yml", text: crmAuth }, ir).auth as AuthIR;

test("the CRM's navigation as a role and as a visitor: what opens and what reads, as core says", () => {
  const sales = navOf(ir, auth, "sales");
  expect(sales.menus).toEqual(["main"]);
  expect(sales.pages).toEqual([
    { id: "customers", menu: "main", open: "allowed", model: "Customer", read: "allowed" },
    { id: "orders", menu: "main", open: "allowed", model: "Order", read: "allowed" },
    { id: "followUps", menu: "main", open: "allowed", model: "FollowUp", read: "allowed" },
    // The team page is the administrators'.
    { id: "team", menu: "main", open: "denied" },
  ]);
  expect(navOf(ir, auth).pages.every((p) => p.open === "denied")).toBe(true);
});

test("the maps as Mermaid: the same boxes and arrows, ids Mermaid takes", () => {
  const nav = navMermaid(navOf(ir, auth, "sales"), "sales");
  expect(nav).toContain('app(("The app, as sales"))');
  expect(nav).toContain('p_team["team<br/>opens: no"]');
  expect(nav).toContain("menu_0 --> p_customers");
  const data = dataMermaid(mapOf(ir, auth));
  expect(data).toContain("m_Order -->|");
  // Whose a record is: a dashed arrow.
  expect(data).toMatch(/m_Customer -\.->\|"accountManager \(owns it\)/);
});

test("a reference unique on its own is one to one", () => {
  const one = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Desk }\nmodels:\n  Person:\n    fields:\n      name: string!\n  Badge:\n    fields:\n      person: Person! unique\n",
  }).ir as SpecIR;
  expect(mapOf(one).edges[0]).toMatchObject({ source: "Badge", relation: "one to one" });
});
