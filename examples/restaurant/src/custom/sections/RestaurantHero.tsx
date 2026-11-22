import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { app } from "#/generated/app";
import type { CustomSectionProps } from "#/generated/custom";
import { venueData } from "#/generated/venue.server";
import { contactHref } from "#/kit/contact-href";
import { Hero, type LandingLink } from "#/kit/Landing";
import { currentViewer } from "#/lib/viewer.server";

const loadBooking = createServerFn().handler(async () => {
  const venue = await venueData.first(await currentViewer());
  return contactHref(venue?.bookingUrl ?? undefined) ?? null;
});

export function RestaurantHero({ title, text }: CustomSectionProps) {
  const [booking, setBooking] = useState<string | null>(null);
  useEffect(() => {
    loadBooking().then(setBooking, () => setBooking(null));
  }, []);
  // The router renders absolute destinations as anchors. The kit types refer to app routes.
  const bookingLink = booking
    ? { to: booking as LandingLink["to"], label: "Book a table" }
    : undefined;

  return (
    <Hero
      layout="photo"
      title={title ?? app.name}
      subtitle={text}
      eyebrow="Waterfront restaurant"
      image={{
        src: "/images/dining-room.webp",
        alt: "Tables set for dinner beside tall windows overlooking the water",
        generated: true,
      }}
      link={{ to: "/menu", label: "See the menu" }}
      secondLink={bookingLink}
    />
  );
}
