import { wallTime } from "#/kit/zoned";

export const services = ["lunch", "dinner"] as const;
export const serviceLabel = { lunch: "Lunch", dinner: "Dinner" };

const weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export function localServiceDay(instant: Date, zone?: string) {
  const date = wallTime(instant, zone).slice(0, 10);
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  const weekday = weekdays[(day + 6) % 7];
  return { date, weekday };
}

type ServingWindow = {
  weekday: (typeof weekdays)[number];
  service: (typeof services)[number];
  hours: string;
};

/** Keep written hours as entered, with recognizable start times in chronological order. */
function startsAt(hours: string): number {
  const time = /^(\d{1,2}):(\d{2})\b/.exec(hours.trim());
  if (!time) return Infinity;
  const hour = Number(time[1]);
  const minute = Number(time[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : Infinity;
}

export function servingWeek(windows: readonly ServingWindow[]) {
  return weekdays.map((weekday) => ({
    weekday,
    hours: services.map((service) => ({
      service,
      times: windows
        .filter((row) => row.weekday === weekday && row.service === service)
        .map((row) => row.hours)
        .sort((a, b) => startsAt(a) - startsAt(b) || a.localeCompare(b)),
    })),
  }));
}

export function dishSections<Dish extends { section: string | null }>(dishes: readonly Dish[]) {
  const groups = new Map<string, { title: string | null; items: Dish[] }>();
  for (const dish of dishes) {
    const title = dish.section?.trim() || null;
    const key = title?.toLowerCase() ?? "";
    const group = groups.get(key) ?? { title, items: [] };
    group.items.push(dish);
    groups.set(key, group);
  }
  const other = groups.get("");
  groups.delete("");
  return other ? [...groups.values(), other] : [...groups.values()];
}

type MenuPeriod = {
  id: number;
  kind: "regular" | "seasonal";
  startsOn: string | null;
  endsOn: string | null;
};

export function activeMenu<Menu extends MenuPeriod>(menus: readonly Menu[], date: string) {
  const seasonal = menus.filter(
    (menu): menu is Menu & { startsOn: string; endsOn: string } =>
      menu.kind === "seasonal" &&
      menu.startsOn !== null &&
      menu.endsOn !== null &&
      menu.startsOn <= date &&
      date <= menu.endsOn,
  );
  // The most recently started seasonal menu takes over, then the regular menu resumes.
  return (
    seasonal.sort((a, b) => b.startsOn.localeCompare(a.startsOn) || b.id - a.id)[0] ??
    menus.filter((menu) => menu.kind === "regular").sort((a, b) => b.id - a.id)[0]
  );
}
