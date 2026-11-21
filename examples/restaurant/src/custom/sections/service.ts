import { wallTime } from "#/kit/zoned";

export const services = ["lunch", "dinner"] as const;
export const serviceLabel = { lunch: "Lunch", dinner: "Dinner" };

const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export function localServiceDay(instant: Date, zone?: string) {
  const date = wallTime(instant, zone).slice(0, 10);
  const weekday = weekdays[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return { date, weekday };
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
