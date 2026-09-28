// Smithable app kit: a landing page's layout and sections. Each section takes its texts as
// props, and the generated page composes them. To change one, copy this file into
// src/custom/components/ and edit the copy.
import { Link, type LinkProps } from "@tanstack/react-router";
import { Check, ChevronDown } from "lucide-react";
import { buttonVariants } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { cn } from "#/lib/utils";
import { textMarker } from "./model";

export interface LandingLink {
  to: LinkProps["to"];
  label: string;
}

/** The page frame: the app's name, a link into the app, and the sections. */
export function LandingLayout({
  appName,
  link,
  children,
}: {
  appName: string;
  link?: LandingLink;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-5">
          <p className="min-w-0 truncate text-xl font-bold">{appName}</p>
          {link && (
            <Link to={link.to} className={buttonVariants({ variant: "outline" })}>
              {link.label}
            </Link>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t">
        <p className="mx-auto max-w-6xl px-5 py-8 text-sm text-muted-foreground">{appName}</p>
      </footer>
    </div>
  );
}

/** Marks one of a section's texts with where it is kept, e.g. "pages.home.hero.title". */
const mark = (texts: string | undefined, key: string) =>
  texts ? textMarker(`${texts}.${key}`) : {};

function Section({
  texts,
  id,
  title,
  text,
  children,
}: {
  id: string;
  title?: string;
  text?: string;
  children: React.ReactNode;
  texts?: string;
}) {
  return (
    <section
      aria-labelledby={title ? `${id}-title` : undefined}
      className="mx-auto max-w-6xl px-5 py-16"
    >
      {title && (
        <h2 id={`${id}-title`} className="text-2xl font-bold sm:text-3xl" {...mark(texts, "title")}>
          {title}
        </h2>
      )}
      {text && (
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground" {...mark(texts, "text")}>
          {text}
        </p>
      )}
      <div className={title || text ? "mt-10" : undefined}>{children}</div>
    </section>
  );
}

export function Hero({
  texts,
  title,
  subtitle,
  link,
}: {
  title: string;
  subtitle?: string;
  link?: LandingLink;
  texts?: string;
}) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
      <h1
        className="max-w-3xl text-4xl leading-tight font-bold sm:text-5xl"
        {...mark(texts, "title")}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground" {...mark(texts, "subtitle")}>
          {subtitle}
        </p>
      )}
      {link && (
        <Link to={link.to} className={cn(buttonVariants(), "mt-10 h-12 px-6 text-base")}>
          <span {...mark(texts, "button")}>{link.label}</span>
        </Link>
      )}
    </section>
  );
}

export function Features({
  texts,
  title,
  text,
  items,
}: {
  title?: string;
  text?: string;
  items: { title?: string; text?: string }[];
  texts?: string;
}) {
  return (
    <Section id="features" texts={texts} title={title} text={text}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.title ?? item.text}>
            <Card className="h-full space-y-2 p-card">
              {item.title && <h3 className="text-lg font-semibold">{item.title}</h3>}
              {item.text && <p className="text-muted-foreground">{item.text}</p>}
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Records shown as cards, e.g. the classes a studio offers. */
export function RecordCards({
  texts,
  id,
  title,
  text,
  cards,
}: {
  id: string;
  title?: string;
  text?: string;
  cards: { key: string | number; title: string; text?: string; badge?: string }[];
  texts?: string;
}) {
  if (cards.length === 0) return null;
  return (
    <Section id={id} texts={texts} title={title} text={text}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <li key={card.key}>
            <Card className="flex h-full flex-col gap-2 p-card">
              <h3 className="text-lg font-semibold">{card.title}</h3>
              {card.text && <p className="flex-1 text-muted-foreground">{card.text}</p>}
              {card.badge && (
                <p className="mt-2">
                  <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                    {card.badge}
                  </span>
                </p>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Pricing({
  texts,
  title,
  text,
  plans,
  link,
}: {
  title?: string;
  text?: string;
  plans: {
    name?: string;
    price?: string;
    period?: string;
    text?: string;
    features?: string[];
    button?: string;
  }[];
  link?: LandingLink;
  texts?: string;
}) {
  return (
    <Section id="pricing" texts={texts} title={title} text={text}>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <li key={plan.name}>
            <Card className="flex h-full flex-col gap-4 p-card">
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              {plan.price && (
                <p>
                  <span className="text-3xl font-bold tabular-nums">{plan.price}</span>
                  {plan.period && <span className="text-muted-foreground"> {plan.period}</span>}
                </p>
              )}
              {plan.text && <p className="text-muted-foreground">{plan.text}</p>}
              {plan.features && (
                <ul className="flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              )}
              {link && (
                <Link to={link.to} className={buttonVariants({ variant: "outline" })}>
                  {plan.button ?? link.label}
                </Link>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Testimonials({
  texts,
  title,
  items,
}: {
  title?: string;
  items: { quote?: string; name?: string; role?: string }[];
  texts?: string;
}) {
  return (
    <Section id="testimonials" texts={texts} title={title}>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.quote}>
            <Card className="h-full p-card">
              <figure className="space-y-4">
                <blockquote className="text-lg">“{item.quote}”</blockquote>
                <figcaption className="text-sm">
                  <span className="font-semibold">{item.name}</span>
                  {item.role && <span className="text-muted-foreground">, {item.role}</span>}
                </figcaption>
              </figure>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Questions that open in place; the browser handles the keyboard and the expanded state. */
export function Faq({
  texts,
  title,
  items,
}: {
  title?: string;
  items: { question?: string; answer?: string }[];
  texts?: string;
}) {
  return (
    <Section id="faq" texts={texts} title={title}>
      <div className="max-w-3xl divide-y border-y">
        {items.map((item) => (
          <details key={item.question} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDown
                aria-hidden
                className="size-5 shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="pb-4 text-muted-foreground">{item.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function CallToAction({
  texts,
  title,
  text,
  link,
}: {
  title: string;
  text?: string;
  link?: LandingLink;
  texts?: string;
}) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <div className="rounded-xl bg-primary px-6 py-12 text-primary-foreground sm:px-12">
        <h2 className="text-2xl font-bold sm:text-3xl" {...mark(texts, "title")}>
          {title}
        </h2>
        {text && (
          <p className="mt-3 max-w-2xl text-lg" {...mark(texts, "text")}>
            {text}
          </p>
        )}
        {link && (
          <Link
            to={link.to}
            className={cn(buttonVariants({ variant: "secondary" }), "mt-8 h-12 px-6 text-base")}
          >
            <span {...mark(texts, "button")}>{link.label}</span>
          </Link>
        )}
      </div>
    </section>
  );
}
