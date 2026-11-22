import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { app } from "#/generated/app";
import type { CustomSectionProps } from "#/generated/custom";
import { stopData } from "#/generated/stop.server";
import { AppLink } from "#/kit/AppLink";
import { Section } from "#/kit/Landing";
import { now } from "#/kit/now";
import { clockText, dateText, whenOf } from "#/kit/time-text";
import { wallTime } from "#/kit/zoned";
import { currentViewer } from "#/lib/viewer.server";
import { upcomingStops } from "./schedule";

const loadStops = createServerFn().handler(async () => {
  const rows = await stopData.list(await currentViewer());
  const checkedAt = now();
  const stops = upcomingStops(rows, checkedAt).map(
    ({ id, place, address, startsAt, endsAt, directionsUrl, menuOverride, photo }) => ({
      id,
      place,
      address,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      directionsUrl,
      menuOverride,
      photo: photo && {
        src: `/files/stop/${id}/photo?v=${photo.file.slice(-29, -5)}`,
        alt: photo.alt,
        width: photo.width,
        height: photo.height,
      },
    }),
  );
  const nextEnd = stops.reduce(
    (soonest, stop) => Math.min(soonest, Date.parse(stop.endsAt)),
    Infinity,
  );
  return { stops, refreshAfter: stops.length ? nextEnd - checkedAt.getTime() : null };
});

type Stops = Awaited<ReturnType<typeof loadStops>>["stops"];

function StopCard({ stop }: { stop: Stops[number] }) {
  const startLocal = wallTime(new Date(stop.startsAt), app.timeZone);
  const endLocal = wallTime(new Date(stop.endsAt), app.timeZone);
  const start = whenOf(startLocal);
  const end = whenOf(endLocal);
  const sameDay = startLocal.slice(0, 10) === endLocal.slice(0, 10);

  return (
    <li className="space-y-2 py-5">
      <h3 className="wrap-break-word font-heading text-xl font-semibold">{stop.place}</h3>
      {stop.address && <address className="wrap-break-word not-italic">{stop.address}</address>}
      {stop.photo && (
        <img
          src={stop.photo.src}
          alt={stop.photo.alt}
          width={stop.photo.width}
          height={stop.photo.height}
          loading="lazy"
          className="aspect-video w-full max-w-md rounded-lg object-cover"
        />
      )}
      <p className="text-muted-foreground">
        <time dateTime={stop.startsAt}>{dateText(start, { weekday: "long", time: true })}</time>
        {" – "}
        <time dateTime={stop.endsAt}>
          {sameDay
            ? clockText(end.hour, end.minute)
            : dateText(end, { weekday: "long", time: true })}
        </time>
      </p>
      {stop.directionsUrl && (
        <AppLink
          href={stop.directionsUrl}
          className="inline-flex min-h-11 items-center text-primary-text underline underline-offset-4"
        >
          Map and directions
        </AppLink>
      )}
      {stop.menuOverride?.trim() ? (
        <div>
          <h4 className="font-semibold">Menu for this stop</h4>
          <p className="wrap-break-word whitespace-pre-line">{stop.menuOverride}</p>
        </div>
      ) : (
        <AppLink
          href="/menu"
          className="inline-flex min-h-11 items-center text-primary-text underline underline-offset-4"
        >
          Regular menu
        </AppLink>
      )}
    </li>
  );
}

export function UpcomingStops({ name, texts, title, text }: CustomSectionProps) {
  const [stops, setStops] = useState<Stops>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let refresh: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const { stops: rows, refreshAfter } = await loadStops();
        if (!active) return;
        setStops(rows);
        if (refreshAfter !== null)
          refresh = setTimeout(load, Math.min(refreshAfter, 2_147_483_647));
      } catch {
        if (active) {
          setStops(undefined);
          setFailed(true);
        }
      }
    };
    void load();
    return () => {
      active = false;
      clearTimeout(refresh);
    };
  }, []);

  return (
    <Section id={name} texts={texts} title={title} text={text}>
      <div aria-live="polite">
        {stops?.length ? (
          <ol className="divide-y divide-border border-y border-border">
            {stops.map((stop) => (
              <StopCard key={stop.id} stop={stop} />
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground">
            {failed
              ? "Stops could not load. Please try again."
              : stops
                ? "No stop planned."
                : "Loading stops…"}
          </p>
        )}
      </div>
      <AppLink
        href="/catering"
        className="mt-4 inline-flex min-h-11 items-center rounded-md border border-border px-4 font-semibold hover:bg-muted"
      >
        Ask about catering
      </AppLink>
    </Section>
  );
}
