type StopWindow = {
  status: string | null;
  startsAt: Date | string;
  endsAt: Date | string;
};

export function upcomingStops<T extends StopWindow>(stops: T[], now: Date): T[] {
  return stops
    .filter((stop) => {
      const startsAt = new Date(stop.startsAt).getTime();
      const endsAt = new Date(stop.endsAt).getTime();
      return stop.status === "confirmed" && endsAt > startsAt && endsAt > now.getTime();
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}
