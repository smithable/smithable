// The status starter's section of its own (docs/spec/v0.1.md, Pages and sections of your own):
// the last 90 days of each service, one bar a day, and the share of the time it was up. The
// data comes from the generated data functions, so visitors see what they may read.
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { componentData } from "#/generated/component.server";
import type { CustomSectionProps } from "#/generated/custom";
import { incidentData } from "#/generated/incident.server";
import { Section } from "#/kit/Landing";
import { currentViewer } from "#/lib/viewer.server";
import { uptime } from "./uptime";

const DAYS = 90;

/** The services and when each one's incidents began and ended. */
const loadUptime = createServerFn().handler(async () => {
  const viewer = await currentViewer();
  const [components, incidents] = await Promise.all([
    componentData.list(viewer),
    incidentData.list(viewer),
  ]);
  return {
    now: Date.now(),
    services: components.map((c) => ({
      id: c.id,
      name: c.name,
      outages: incidents
        .filter((i) => i.componentId === c.id)
        .map((i) => ({ from: i.detectedAt.getTime(), to: i.resolvedAt?.getTime() ?? null })),
    })),
  };
});

export function Uptime({ name, texts, title, text }: CustomSectionProps) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadUptime>>>();
  useEffect(() => {
    loadUptime().then(setData, () => undefined);
  }, []);
  return (
    <Section id={name} texts={texts} title={title} text={text}>
      {data ? (
        <ul className="space-y-6">
          {data.services.map((service) => {
            const { days, up } = uptime(service.outages, data.now, DAYS);
            const percent = `${(Math.floor(up * 10_000) / 100).toFixed(2)}%`;
            return (
              <li key={service.id}>
                <div className="mb-2 flex justify-between gap-4 text-sm">
                  <span className="font-medium">{service.name}</span>
                  <span className="text-muted-foreground">{percent} up</span>
                </div>
                <div
                  role="img"
                  aria-label={`${service.name}: ${percent} up over the last ${DAYS} days`}
                  className="flex h-8 gap-px"
                >
                  {days.map((day) => (
                    <span
                      key={day.date}
                      title={`${day.date}: ${day.minutes ? `${day.minutes} minutes down` : "no incidents"}`}
                      className={`flex-1 rounded-sm ${day.minutes === 0 ? "bg-emerald-500" : day.minutes < 60 ? "bg-amber-500" : "bg-red-500"}`}
                    />
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>{DAYS} days ago</span>
                  <span>Today</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
    </Section>
  );
}
