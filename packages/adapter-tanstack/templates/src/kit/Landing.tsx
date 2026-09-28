// Smithable app kit: a landing page's layout and sections. Each section takes its texts as
// props, and the generated page composes them. To change one, copy this file into
// src/custom/components/ and edit the copy.
import { Link, type LinkProps } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mail,
  MapPin,
  Phone,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { buttonVariants } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { cn } from "#/lib/utils";
import { textMarker } from "./model";

export interface LandingLink {
  to: LinkProps["to"];
  label: string;
}

/** A footer of its own: a line of text and links (a page's address, or a full one). */
export interface LandingFooter {
  text?: string;
  links: { label?: string; link?: string }[];
  texts?: string;
}

/** The page frame: the app's name, a link into the app, the sections and the footer. */
export function LandingLayout({
  appName,
  link,
  footer,
  children,
}: {
  appName: string;
  link?: LandingLink;
  footer?: LandingFooter;
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
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p {...mark(footer?.texts, "text")}>{footer?.text ?? appName}</p>
          {footer && footer.links.length > 0 && (
            <nav aria-label="Footer">
              <ul className="flex flex-wrap gap-x-6 gap-y-2">
                {footer.links.map((l, i) => (
                  <li key={l.link ?? i}>
                    <a
                      href={l.link}
                      className="underline-offset-4 hover:text-foreground hover:underline"
                      {...mark(footer.texts, `items.${i}.label`)}
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
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

/** A picture from public/, e.g. { src: "/images/hero.webp", alt: "A yoga class" }. */
export interface LandingImage {
  src: string;
  alt: string;
}

export function Hero({
  texts,
  title,
  subtitle,
  link,
  image,
}: {
  title: string;
  subtitle?: string;
  link?: LandingLink;
  image?: LandingImage;
  texts?: string;
}) {
  const text = (
    <div>
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
    </div>
  );
  if (!image) return <section className="mx-auto max-w-6xl px-5 py-20 sm:py-28">{text}</section>;
  // Beside the text on wide screens, above it on narrow ones; the first thing loaded.
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 sm:py-20 lg:grid-cols-2">
      <img
        src={image.src}
        alt={image.alt}
        width={1200}
        height={800}
        fetchPriority="high"
        className="aspect-[3/2] w-full rounded-xl object-cover lg:order-2"
      />
      {text}
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
        {items.map((item, i) => (
          <li key={item.title ?? item.text}>
            <Card className="h-full space-y-2 p-card">
              {item.title && (
                <h3 className="text-lg font-semibold" {...mark(texts, `items.${i}.title`)}>
                  {item.title}
                </h3>
              )}
              {item.text && (
                <p className="text-muted-foreground" {...mark(texts, `items.${i}.text`)}>
                  {item.text}
                </p>
              )}
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
        {plans.map((plan, i) => (
          <li key={plan.name}>
            <Card className="flex h-full flex-col gap-4 p-card">
              <h3 className="text-lg font-semibold" {...mark(texts, `items.${i}.name`)}>
                {plan.name}
              </h3>
              {plan.price && (
                <p>
                  <span
                    className="text-3xl font-bold tabular-nums"
                    {...mark(texts, `items.${i}.price`)}
                  >
                    {plan.price}
                  </span>{" "}
                  {plan.period && (
                    <span className="text-muted-foreground" {...mark(texts, `items.${i}.period`)}>
                      {plan.period}
                    </span>
                  )}
                </p>
              )}
              {plan.text && (
                <p className="text-muted-foreground" {...mark(texts, `items.${i}.text`)}>
                  {plan.text}
                </p>
              )}
              {plan.features && (
                <ul className="flex-1 space-y-2">
                  {plan.features.map((feature, j) => (
                    <li key={feature} className="flex gap-2">
                      <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
                      <span {...mark(texts, `items.${i}.features.${j}`)}>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}
              {link && (
                <Link to={link.to} className={buttonVariants({ variant: "outline" })}>
                  <span {...mark(texts, `items.${i}.button`)}>{plan.button ?? link.label}</span>
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
        {items.map((item, i) => (
          <li key={item.quote}>
            <Card className="h-full p-card">
              <figure className="space-y-4">
                <blockquote className="text-lg">
                  “<span {...mark(texts, `items.${i}.quote`)}>{item.quote}</span>”
                </blockquote>
                <figcaption className="text-sm">
                  <span className="font-semibold" {...mark(texts, `items.${i}.name`)}>
                    {item.name}
                  </span>
                  {item.role && (
                    <span className="text-muted-foreground">
                      , <span {...mark(texts, `items.${i}.role`)}>{item.role}</span>
                    </span>
                  )}
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
        {items.map((item, i) => (
          <details key={item.question} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <span {...mark(texts, `items.${i}.question`)}>{item.question}</span>
              <ChevronDown
                aria-hidden
                className="size-5 shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="pb-4 text-muted-foreground" {...mark(texts, `items.${i}.answer`)}>
              {item.answer}
            </p>
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

/**
 * Contact details (address with a map link, phone, email, opening hours one per line) and,
 * when the app has one, a form visitors send; `thanks` replaces it once sent.
 */
export function Contact({
  texts,
  title,
  text,
  address,
  phone,
  email,
  hours,
  thanks,
  form,
}: {
  title?: string;
  text?: string;
  address?: string;
  phone?: string;
  email?: string;
  hours?: string;
  thanks?: string;
  /** The form; it calls `sent` once the message is stored. */
  form?: (sent: () => void) => React.ReactNode;
  texts?: string;
}) {
  const [sent, setSent] = useState(false);
  const details = (
    <dl className="space-y-5">
      {address && (
        <div className="flex gap-3">
          <dt>
            <MapPin aria-hidden className="mt-0.5 size-5 text-primary" />
            <span className="sr-only">Address</span>
          </dt>
          <dd>
            <p className="whitespace-pre-line" {...mark(texts, "address")}>
              {address}
            </p>
            {/* A link, not an embedded map: no third party is called when the page opens. */}
            <a
              href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`}
              className="text-sm text-primary underline-offset-4 hover:underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              Show on map
            </a>
          </dd>
        </div>
      )}
      {phone && (
        <div className="flex gap-3">
          <dt>
            <Phone aria-hidden className="mt-0.5 size-5 text-primary" />
            <span className="sr-only">Phone</span>
          </dt>
          <dd>
            <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} {...mark(texts, "phone")}>
              {phone}
            </a>
          </dd>
        </div>
      )}
      {email && (
        <div className="flex gap-3">
          <dt>
            <Mail aria-hidden className="mt-0.5 size-5 text-primary" />
            <span className="sr-only">Email</span>
          </dt>
          <dd>
            <a href={`mailto:${email}`} {...mark(texts, "email")}>
              {email}
            </a>
          </dd>
        </div>
      )}
      {hours && (
        <div className="flex gap-3">
          <dt>
            <Clock aria-hidden className="mt-0.5 size-5 text-primary" />
            <span className="sr-only">Opening hours</span>
          </dt>
          <dd className="whitespace-pre-line" {...mark(texts, "hours")}>
            {hours}
          </dd>
        </div>
      )}
    </dl>
  );
  return (
    <Section id="contact" texts={texts} title={title} text={text}>
      <div className={cn("grid gap-10", form && "lg:grid-cols-2")}>
        {details}
        {form &&
          (sent ? (
            <Card className="p-card">
              <p role="status" className="text-lg" {...mark(texts, "thanks")}>
                {thanks ?? "Thank you! We will get back to you soon."}
              </p>
            </Card>
          ) : (
            // The form draws its own card.
            form(() => setSent(true))
          ))}
      </div>
    </Section>
  );
}

/** Pictures in a grid; one opens large in a lightbox, with the arrow keys to move on. */
export function Gallery({
  texts,
  title,
  text,
  items,
}: {
  title?: string;
  text?: string;
  items: { image?: LandingImage; caption?: string }[];
  texts?: string;
}) {
  const pictures = items.filter((i): i is { image: LandingImage; caption?: string } =>
    Boolean(i.image),
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(0);
  const show = (i: number) => setOpen((i + pictures.length) % pictures.length);
  const current = pictures[open];
  return (
    <Section id="gallery" texts={texts} title={title} text={text}>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {pictures.map((item, i) => (
          <li key={item.image.src}>
            <figure>
              <button
                type="button"
                className="block w-full overflow-hidden rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={`Open ${item.image.alt}`}
                onClick={() => {
                  show(i);
                  dialog.current?.showModal();
                }}
              >
                <img
                  src={item.image.src}
                  alt={item.image.alt}
                  loading="lazy"
                  width={600}
                  height={400}
                  className="aspect-[3/2] w-full object-cover transition-transform hover:scale-105"
                />
              </button>
              {item.caption && (
                <figcaption
                  className="mt-2 text-sm text-muted-foreground"
                  {...mark(texts, `items.${items.indexOf(item)}.caption`)}
                >
                  {item.caption}
                </figcaption>
              )}
            </figure>
          </li>
        ))}
      </ul>
      {/* The browser's own dialog: Escape closes it, focus stays inside. */}
      <dialog
        ref={dialog}
        aria-label={current?.image.alt}
        className="m-auto max-h-[92vh] w-[min(1200px,94vw)] bg-transparent p-0 backdrop:bg-black/85"
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") show(open + 1);
          if (e.key === "ArrowLeft") show(open - 1);
        }}
      >
        {current && (
          <figure className="relative">
            <img
              src={current.image.src}
              alt={current.image.alt}
              className="max-h-[80vh] w-full rounded-lg object-contain"
            />
            {current.caption && (
              <figcaption className="mt-3 text-center text-white">{current.caption}</figcaption>
            )}
            <div className="mt-3 flex justify-center gap-2">
              {pictures.length > 1 && (
                <button
                  type="button"
                  aria-label="Previous picture"
                  className={buttonVariants({ variant: "secondary", size: "icon" })}
                  onClick={() => show(open - 1)}
                >
                  <ChevronLeft aria-hidden />
                </button>
              )}
              <button
                type="button"
                aria-label="Close"
                className={buttonVariants({ variant: "secondary", size: "icon" })}
                onClick={() => dialog.current?.close()}
              >
                <X aria-hidden />
              </button>
              {pictures.length > 1 && (
                <button
                  type="button"
                  aria-label="Next picture"
                  className={buttonVariants({ variant: "secondary", size: "icon" })}
                  onClick={() => show(open + 1)}
                >
                  <ChevronRight aria-hidden />
                </button>
              )}
            </div>
          </figure>
        )}
      </dialog>
    </Section>
  );
}
