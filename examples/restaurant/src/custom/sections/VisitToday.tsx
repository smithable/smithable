import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { app } from "#/generated/app";
import type { CustomSectionProps } from "#/generated/custom";
import { serviceHourData } from "#/generated/service-hour.server";
import { venueData } from "#/generated/venue.server";
import { AppLink } from "#/kit/AppLink";
import { dayText } from "#/kit/format";
import { Section } from "#/kit/Landing";
import { now } from "#/kit/now";
import { currentViewer } from "#/lib/viewer.server";
import { localServiceDay, serviceLabel, servingWeek } from "./service";

const loadVisit = createServerFn().handler(async () => {
  const { date, weekday } = localServiceDay(now(), app.timeZone);
  const viewer = await currentViewer();
  const [windows, venue] = await Promise.all([
    serviceHourData.list(viewer),
    venueData.first(viewer),
  ]);
  const week = servingWeek(windows);
  return {
    date,
    weekday,
    today: week.find((day) => day.weekday === weekday)?.hours ?? [],
    week,
    address: venue?.address,
    booking: venue?.bookingUrl,
    directions: venue?.directionsUrl,
    phone: venue?.phone,
  };
});

export function VisitToday({ name, texts, title, text }: CustomSectionProps) {
  const [visit, setVisit] = useState<Awaited<ReturnType<typeof loadVisit>>>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    loadVisit().then(setVisit, () => setFailed(true));
  }, []);
  const phone = visit?.phone?.replace(/^(\+\d{1,3})\s*\(0\)/, "$1").replace(/[^+\d]/g, "");

  return (
    <Section id={name} texts={texts} title={title} text={text}>
      <div aria-live="polite">
        {visit ? (
          <div className="grid gap-x-12 gap-y-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div>
              <time dateTime={visit.date} className="text-sm text-muted-foreground">
                {dayText(visit.date, { weekday: "long" })}
              </time>
              <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-3">
                {visit.today.map(({ service, times }) => (
                  <div key={service}>
                    <dt className="font-semibold">{serviceLabel[service]}</dt>
                    <dd className="text-muted-foreground">
                      {times.length ? times.join(", ") : "Not served today"}
                    </dd>
                  </div>
                ))}
              </dl>
              <details className="mt-4 border-y border-border">
                <summary className="min-h-11 cursor-pointer py-3 font-semibold">
                  Hours for the week
                </summary>
                <dl className="divide-y divide-border">
                  {visit.week.map(({ weekday, hours }) => {
                    const served = hours.filter(({ times }) => times.length);
                    return (
                      <div key={weekday} className="grid grid-cols-[6rem_1fr] gap-2 py-2 text-sm">
                        <dt
                          aria-current={weekday === visit.weekday ? "date" : undefined}
                          className="font-semibold"
                        >
                          {weekday[0].toUpperCase() + weekday.slice(1)}
                        </dt>
                        <dd className="space-y-1">
                          {served.length
                            ? served.map(({ service, times }) => (
                                <p key={service}>
                                  {serviceLabel[service]} {times.join(", ")}
                                </p>
                              ))
                            : "Closed"}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </details>
            </div>
            {(visit.address || visit.booking || visit.directions || visit.phone) && (
              <div className="space-y-2">
                {(visit.address || phone) && (
                  <address className="wrap-break-word not-italic">
                    {visit.address && <p>{visit.address}</p>}
                    {phone && /\d/.test(phone) && (
                      <AppLink
                        href={`tel:${phone}`}
                        className="inline-flex min-h-11 items-center underline underline-offset-4"
                      >
                        {visit.phone}
                      </AppLink>
                    )}
                  </address>
                )}
                <div className="flex flex-wrap gap-3">
                  {visit.booking && (
                    <AppLink
                      href={visit.booking}
                      className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 font-semibold text-primary-foreground hover:opacity-90"
                    >
                      Book a table
                    </AppLink>
                  )}
                  {visit.directions && (
                    <AppLink
                      href={visit.directions}
                      className="inline-flex min-h-11 items-center rounded-md border border-border px-4 font-semibold hover:bg-muted"
                    >
                      Get directions
                    </AppLink>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">
            {failed ? "Service hours could not load. Please try again." : "Loading service hours…"}
          </p>
        )}
      </div>
    </Section>
  );
}
