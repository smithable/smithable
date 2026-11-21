import { afterEach, expect, test, vi } from "vitest";

const kit: string = "../templates/src/kit/model.ts";
const { menuItemMarker, navigationMarker } = await import(kit);

afterEach(() => vi.unstubAllEnvs());

test("frame and menu labels carry their stable preview marks", () => {
  vi.stubEnv("DEV", true);
  expect(navigationMarker()).toEqual({ "data-sm-concept": "navigation:workspace" });
  expect(navigationMarker("home")).toEqual({ "data-sm-concept": "navigation:landing.home" });
  expect(menuItemMarker("class-schedule")).toEqual({
    "data-sm-concept": "text:pages.class-schedule.title",
    "data-sm-part": "menu-item",
  });
  expect(menuItemMarker(undefined)).toEqual({});
});

test("release builds leave the navigation marks out", () => {
  vi.stubEnv("DEV", false);
  expect(navigationMarker()).toEqual({});
  expect(navigationMarker("home")).toEqual({});
  expect(menuItemMarker("class-schedule")).toEqual({});
});
