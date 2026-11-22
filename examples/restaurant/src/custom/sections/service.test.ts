import { expect, test } from "vitest";
import { activeMenu, dishSections, localServiceDay, servingWeek } from "./service";

const regular = { id: 1, kind: "regular", startsOn: null, endsOn: null } as const;
const holiday = { id: 2, kind: "seasonal", startsOn: "2026-12-24", endsOn: "2027-01-06" } as const;
const menus = [regular, holiday];

test("uses an inclusive holiday range before returning to the regular menu", () => {
  expect(activeMenu(menus, "2026-12-23")).toEqual(regular);
  expect(activeMenu(menus, "2026-12-24")).toEqual(holiday);
  expect(activeMenu(menus, "2027-01-06")).toEqual(holiday);
  expect(activeMenu(menus, "2027-01-07")).toEqual(regular);
});

test("selects the newest date in an overlap and leaves an empty catalog empty", () => {
  const feature = { ...holiday, id: 3, startsOn: "2026-12-31" } as const;
  expect(activeMenu([feature, holiday, regular], "2026-12-31")).toEqual(feature);
  expect(activeMenu([holiday], "2027-01-07")).toBeUndefined();
});

test("changes both service hours and the menu date at the restaurant's midnight", () => {
  const zone = "Europe/Mariehamn";
  const before = localServiceDay(new Date("2026-12-23T21:59:59Z"), zone);
  const after = localServiceDay(new Date("2026-12-23T22:00:00Z"), zone);
  expect(before).toEqual({ weekday: "wednesday", date: "2026-12-23" });
  expect(after).toEqual({ weekday: "thursday", date: "2026-12-24" });
  expect(localServiceDay(new Date("2026-12-27T21:59:59Z"), zone).weekday).toBe("sunday");
  expect(localServiceDay(new Date("2026-12-27T22:00:00Z"), zone).weekday).toBe("monday");
  expect(activeMenu(menus, before.date)).toEqual(regular);
  expect(activeMenu(menus, after.date)).toEqual(holiday);
});

test("the week starts on Monday and keeps all serving windows in start-time order", () => {
  const week = servingWeek([
    { weekday: "monday", service: "lunch", hours: "17:00–18:00" },
    { weekday: "monday", service: "lunch", hours: "9:00–10:00" },
    { weekday: "monday", service: "lunch", hours: "By reservation" },
  ]);
  expect(week.map(({ weekday }) => weekday)).toEqual([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ]);
  expect(week[0].hours[0].times).toEqual(["9:00–10:00", "17:00–18:00", "By reservation"]);
  expect(week[1].hours.every(({ times }) => times.length === 0)).toBe(true);
});

test("menu sections preserve dish order and group blank labels together", () => {
  const first = { section: "Desserts", name: "Pear" };
  const second = { section: " ", name: "Water" };
  const third = { section: " desserts ", name: "Pie" };
  expect(dishSections([second, first, third])).toEqual([
    { title: "Desserts", items: [first, third] },
    { title: null, items: [second] },
  ]);
  expect(dishSections([])).toEqual([]);
});
