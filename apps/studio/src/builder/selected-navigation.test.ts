import { expect, test } from "vitest";
import type { Spec } from "../engine";
import type { Selection } from "../preview";
import { selectedNavigation, selectedNavigationKey } from "./SelectedNavigation";

const spec = {
  ir: {
    navigation: [],
    pages: [
      { id: "home", route: "/", pattern: { kind: "landing" } },
      { id: "customers", route: "/customers", pattern: { kind: "crud", model: "Customer" } },
    ],
  },
  ux: { navigation: "topbar", pages: { customers: { frame: "site" } } },
  content: { languages: ["sv"] },
} as unknown as Spec;

const menu = (path?: string, page: string | null = null) =>
  ({
    type: "select",
    concept: "navigation:workspace",
    part: null,
    page,
    columns: null,
    ...(path === undefined ? {} : { path }),
  }) as Selection;

test("the app's menu offers this page's frame for the page the preview shows (T1695)", () => {
  // The menu carries no page of its own: the preview's address names it, a record's page too.
  for (const path of ["/customers", "/customers/5", "/sv/customers"])
    expect(selectedNavigation(menu(path), spec)).toMatchObject({
      kind: "workspace",
      value: "topbar",
      page: "customers",
      frame: "site",
    });
  // A landing page keeps its own frame, and with no address there is no page choice.
  for (const selection of [menu("/"), menu(), menu("/missing")])
    expect(selectedNavigation(selection, spec)).not.toHaveProperty("page");
  // A page named by the part itself wins over the address.
  expect(selectedNavigation(menu("/", "customers"), spec)).toMatchObject({ page: "customers" });
});

test("the menu's form starts again when the page's frame changes after the click (T1736)", () => {
  const part = selectedNavigation(menu("/customers"), spec);
  if (!part) throw new Error("no menu part");
  const caught = selectedNavigation(menu("/customers"), {
    ...spec,
    ux: { ...spec.ux, pages: { customers: { frame: "app" } } },
  } as unknown as Spec);
  if (!caught) throw new Error("no menu part");
  const key = selectedNavigationKey("navigation:workspace", part);
  expect(selectedNavigationKey("navigation:workspace", caught)).not.toBe(key);
  // The same frame keeps the form, and another selected part starts it again.
  expect(selectedNavigationKey("navigation:workspace", { ...part })).toBe(key);
  expect(selectedNavigationKey("navigation:landing.home", part)).not.toBe(key);
});
