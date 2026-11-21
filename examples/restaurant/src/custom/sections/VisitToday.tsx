import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { useEffect, useState } from "react";
import { serviceHours } from "#/db/schema";
import { app } from "#/generated/app";
import type { CustomSectionProps } from "#/generated/custom";
import { serviceHourData } from "#/generated/service-hour.server";
import { venueData } from "#/generated/venue.server";
import { AppLink } from "#/kit/AppLink";
import { dayText } from "#/kit/format";
import { Section } from "#/kit/Landing";
import { now } from "#/kit/now";
import { currentViewer } from "#/lib/viewer.server";
import { localServiceDay, serviceLabel, services } from "./service";

const loadVisit = createServerFn().handler(async () => {
  const { date, weekday } = localServiceDay(now(), app.timeZone);
  const viewer = await currentViewer();
  const [hours, venue] = await Promise.all([
    serviceHourData.list(viewer, eq(serviceHours.weekday, weekday)),
    venueData.first(viewer),
  ]);
  return {
    date,
    hours: services.map((service) => ({
      service,
      times: hours
        .filter((row) => row.service === service)
        .map((row) => row.hours)
        .sort(),
    })),
    booking: venue?.bookingUrl,
    directions: venue?.directionsUrl,
  };
});

export function VisitToday({ name, texts, title, text }: CustomSectionProps) {
  const [visit, setVisit] = useState<Awaited<ReturnType<typeof loadVisit>>>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    loadVisit().then(setVisit, () => setFailed(true));
  }, []);

  return (
    <Section id={name} texts={texts} title={title} text={text}>
      <div aria-live="polite">
        {visit ? (
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
            <div>
              <time dateTime={visit.date} className="text-sm text-muted-foreground">
                {dayText(visit.date, { weekday: "long" })}
              </time>
              <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-3">
                {visit.hours.map(({ service, times }) => (
                  <div key={service}>
                    <dt className="font-semibold">{serviceLabel[service]}</dt>
                    <dd className="text-muted-foreground">
                      {times.length ? times.join(", ") : "Not served today"}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            {(visit.booking || visit.directions) && (
              <div className="flex flex-wrap items-center gap-3">
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
