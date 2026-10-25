// "Can you make the menu stick when I scroll down?", said on the landing page (Johan,
// 2026-10-25): the rules read it, with no model, as the landing page's header kept at the top.
import { applyOperation, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { matchRequest } from "./phrases.js";

const raw = import.meta.glob("../../../examples/booking/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const file = (name: string) => raw[`../../../examples/booking/${name}`] as string;
const ir = validateSpec({ path: "smithable.yml", text: file("smithable.yml") }).ir;
if (!ir) throw new Error("the booking starter is invalid");
const header = (value: string) => [
  { op: "setSectionLook", args: { page: "home", section: "header", key: "position", value } },
];
const read = (request: string) => matchRequest(ir, request)?.operations;

test("the menu, the header or the navigation sticks to the top of the landing page", () => {
  for (const request of [
    "Can you make the menu stick when I scroll down?",
    "Make the header sticky.",
    "The top menu should stay at the top when the page scrolls",
    "Keep the navigation bar at the top while scrolling.",
    "I want a sticky header",
    "The menu should not scroll away on the home page",
  ])
    expect(read(request), request).toEqual(header("sticky"));
  const files = {
    spec: file("smithable.yml"),
    auth: file("smithable.auth.yml"),
    ux: file("smithable.ux.yml"),
    content: file("smithable.content.yml"),
  };
  const [one] = header("sticky");
  const applied = one && applyOperation(files, one.op, one.args);
  if (!applied?.ok) throw new Error(applied ? applied.message : "no operation");
  expect(applied.files.ux).toContain("header:\n      position: sticky");
});

test("and the opposite: it scrolls away with the page again", () => {
  for (const request of [
    "Make the menu scroll away with the page",
    "The header should not be sticky.",
    "The top menu should not stick when I scroll",
  ])
    expect(read(request), request).toEqual(header("scrolling"));
});

test("an app without a landing page leaves it to a model: its own menu stays at the top already", () => {
  const crud = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Item: { fields: { name: string! } }\npages:\n  items: { crud: Item }\n",
  }).ir;
  if (!crud) throw new Error("invalid");
  expect(matchRequest(crud, "Make the menu stick when I scroll down")).toBeUndefined();
});
