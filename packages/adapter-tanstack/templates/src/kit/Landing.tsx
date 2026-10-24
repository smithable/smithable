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
  type LucideIcon,
  Mail,
  MapPin,
  Menu,
  Phone,
  X,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { buttonVariants } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { cn } from "#/lib/utils";
import { AiMarked } from "./AiMark";
import { AppearancePicker } from "./AppearancePicker";
import { AppLink } from "./AppLink";
import { allows, type Rule, type Viewer } from "./access";
import { ConsentSettings } from "./Consent";
import { PicturePlaceholder } from "./ModelTable";
import { textMarker } from "./model";
import { tx, w } from "./words";

export interface LandingLink {
  to: LinkProps["to"];
  label: string;
  /** Who may open it, for a menu entry not every visitor sees (a members' page in the site frame). */
  access?: Rule;
}

/** A hero's shortcut: a page, shown as a round icon with its title under it. */
export interface LandingShortcut extends LandingLink {
  icon: LucideIcon;
}

/** A footer of its own: a line of text and links (a page's address, or a full one). */
export interface LandingFooter {
  text?: string;
  links: { label?: string; link?: string }[];
  texts?: string;
  /** A short line over the title, e.g. what the section is ("Popular dishes"). */
  eyebrow?: string;
}

/** The page frame: the app's name, a link into the app, the sections and the footer. */
/** The public site's frame (src/generated/site.ts): its menu and how to reach the business. */
export interface LandingSite {
  /** The landing page's address: the app's name leads there. */
  home?: LinkProps["to"];
  menu: LandingLink[];
  /** The privacy page and the like: a footer line, not a menu entry. */
  legal?: LandingLink[];
  contact?: { address?: string; phone?: string; email?: string; hours?: string };
}

function LandingLayoutView({
  appName,
  logo,
  link,
  footer,
  site,
  viewer,
  onSignOut,
  children,
}: {
  appName: string;
  /** The app's mark, drawn before its name in the header (with an empty alt: the name says it). */
  logo?: string;
  link?: LandingLink;
  footer?: LandingFooter;
  site?: LandingSite;
  /** Who is signed in: the menu shows the pages they may open. */
  viewer?: Viewer | null;
  /** Signing out, for one signed in who sees the site frame (a member). */
  onSignOut?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const menu = (site?.menu ?? []).filter((m) => !m.access || allows(m.access, viewer ?? null));
  const contact = site?.contact;
  // Columns when there is something to put in them; otherwise the one line it always had.
  const columns = menu.length > 0 || contact !== undefined;
  const named = logo ? (
    <>
      <img
        src={logo}
        alt=""
        data-part="logo"
        width={28}
        height={28}
        className="size-7 shrink-0 rounded-[4px] object-contain"
      />
      <span className="min-w-0 truncate">{appName}</span>
    </>
  ) : (
    appName
  );
  // With a mark, a row of the two; either way a long name ends in an ellipsis instead of
  // pushing the header wider.
  const nameClass = `${logo ? "flex items-center gap-2" : "block truncate"} min-w-0 text-xl font-bold`;
  const name = site?.home ? (
    <Link to={site.home} className={nameClass}>
      {named}
    </Link>
  ) : (
    <p className={nameClass}>{named}</p>
  );
  const footerLinks = footer && footer.links.length > 0 && (
    <ul className="flex flex-wrap gap-x-6 gap-y-2">
      {footer.links.map((l, i) => (
        <li key={l.link ?? i}>
          <AppLink
            href={l.link}
            className="underline-offset-4 hover:text-foreground hover:underline"
            {...mark(footer.texts, `items.${i}.label`)}
          >
            {l.label}
          </AppLink>
        </li>
      ))}
    </ul>
  );
  return (
    <div data-kit="landing" className="flex min-h-screen flex-col">
      <header data-part="header" className="border-b bg-card">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-5">
          {name}
          {menu.length > 0 && (
            <nav aria-label={w.site} className="hidden md:block">
              <ul className="flex items-center gap-6 text-sm font-medium">
                {menu.map((m) => (
                  <li key={String(m.to)}>
                    <Link
                      to={m.to}
                      className="underline-offset-4 hover:underline"
                      activeProps={{ "aria-current": "page", className: "text-primary" }}
                    >
                      {m.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <div className="flex items-center gap-2">
            {link && (
              <Link to={link.to} className={buttonVariants({ variant: "outline" })}>
                {link.label}
              </Link>
            )}
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className={buttonVariants({ variant: "ghost" })}
              >
                {w.signOut}
              </button>
            )}
            {menu.length > 0 && (
              <button
                type="button"
                aria-expanded={open}
                aria-controls="site-menu"
                aria-label={w.menu}
                onClick={() => setOpen(!open)}
                className={cn(buttonVariants({ variant: "ghost" }), "md:hidden")}
              >
                {open ? (
                  <X aria-hidden className="size-5" />
                ) : (
                  <Menu aria-hidden className="size-5" />
                )}
              </button>
            )}
          </div>
        </div>
        {open && menu.length > 0 && (
          <nav id="site-menu" aria-label={w.site} className="border-t md:hidden">
            <ul className="mx-auto max-w-6xl px-5 py-2">
              {menu.map((m) => (
                <li key={String(m.to)}>
                  <Link to={m.to} onClick={() => setOpen(false)} className="block py-3 font-medium">
                    {m.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer data-part="footer" className="border-t">
        {columns ? (
          <div className="mx-auto max-w-6xl px-5 py-12 text-sm">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <p className="text-base font-semibold">{appName}</p>
                {contact?.address && <p className="text-muted-foreground">{contact.address}</p>}
                {contact?.phone && (
                  <p>
                    <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="hover:underline">
                      {contact.phone}
                    </a>
                  </p>
                )}
                {contact?.email && (
                  <p>
                    <a href={`mailto:${contact.email}`} className="hover:underline">
                      {contact.email}
                    </a>
                  </p>
                )}
                {contact?.hours && <p className="text-muted-foreground">{contact.hours}</p>}
              </div>
              {menu.length > 0 && (
                <nav aria-label={w.pages} className="space-y-2">
                  <p className="text-base font-semibold">{w.pages}</p>
                  <ul className="space-y-2">
                    {menu.map((m) => (
                      <li key={String(m.to)}>
                        <Link
                          to={m.to}
                          className="text-muted-foreground hover:text-foreground hover:underline"
                        >
                          {m.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
              {(footer?.text || footerLinks) && (
                <div className="space-y-3 text-muted-foreground">
                  {footer?.text && <p {...mark(footer.texts, "text")}>{footer.text}</p>}
                  {footerLinks && <nav aria-label={w.footer}>{footerLinks}</nav>}
                </div>
              )}
            </div>
            <div className="mt-10 flex flex-wrap justify-between gap-4 border-t pt-6 text-muted-foreground">
              <p>
                © {new Date().getFullYear()} {appName}
              </p>
              <LegalLinks links={site?.legal} />
              <ConsentSettings className="hover:underline" />
              <AppearancePicker />
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p {...mark(footer?.texts, "text")}>{footer?.text ?? appName}</p>
            {footerLinks && <nav aria-label={w.footer}>{footerLinks}</nav>}
            <LegalLinks links={site?.legal} />
            <ConsentSettings className="text-left hover:underline" />
            <AppearancePicker />
          </div>
        )}
      </footer>
    </div>
  );
}

/** The privacy page's link in the footer line. */
function LegalLinks({ links }: { links?: LandingLink[] }) {
  if (!links?.length) return null;
  return (
    <>
      {links.map((l) => (
        <Link key={String(l.to)} to={l.to} className="hover:underline">
          {l.label}
        </Link>
      ))}
    </>
  );
}

/** A section's hooks for custom styles: its name, the last part of where its texts are kept. */
const sectionHooks = (texts: string | undefined) => ({
  "data-kit": "section",
  "data-section": texts?.split(".").at(-1),
});

/** Marks one of a section's texts with where it is kept, e.g. "pages.home.hero.title". */
const mark = (texts: string | undefined, key: string) =>
  texts ? textMarker(`${texts}.${key}`) : {};

/**
 * A section's heading block: at the start or centered, as the theme's headings.align says
 * (--heading-align, --heading-inline), its lead centered under the title with it.
 */
const HEADER =
  "[text-align:var(--heading-align,start)] [&>p]:[margin-inline:var(--heading-inline,0)]";

/** The short line over a section's title, in the primary color. */
function Eyebrow({ texts, children }: { texts?: string; children: string }) {
  return (
    <p
      data-part="eyebrow"
      className="mb-2 text-sm font-semibold tracking-wide text-primary uppercase"
      {...mark(texts, "eyebrow")}
    >
      {children}
    </p>
  );
}

function SectionView({
  texts,
  eyebrow,
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
  /** A short line over the title, e.g. what the section is ("Popular dishes"). */
  eyebrow?: string;
}) {
  return (
    <section
      {...sectionHooks(texts)}
      aria-labelledby={title ? `${id}-title` : undefined}
      className="mx-auto my-(--section-gap) max-w-6xl rounded-lg border-(length:--section-border) bg-(--section-background) px-5 py-12"
    >
      {(eyebrow || title || text) && (
        <div data-part="header" className={HEADER}>
          {eyebrow && <Eyebrow texts={texts}>{eyebrow}</Eyebrow>}
          {title && (
            <h2
              id={`${id}-title`}
              className="text-[calc(1.5rem*var(--heading-scale))] leading-tight font-(--heading-weight) tracking-(--heading-tracking) [text-transform:var(--heading-case,none)] sm:text-[calc(2rem*var(--heading-scale))]"
              {...mark(texts, "title")}
            >
              {title}
            </h2>
          )}
          {text && (
            <p className="mt-3 max-w-2xl text-lg text-muted-foreground" {...mark(texts, "text")}>
              {text}
            </p>
          )}
        </div>
      )}
      <div className={text ? "mt-8" : title ? "mt-6" : undefined}>{children}</div>
    </section>
  );
}

/** A text section: a heading and paragraphs (a blank line between them in the content file). */
function TextSectionView({
  texts,
  eyebrow,
  id,
  title,
  text,
}: {
  id: string;
  title?: string;
  text?: string;
  texts?: string;
  /** A short line over the title, e.g. what the section is ("Popular dishes"). */
  eyebrow?: string;
}) {
  return (
    <section
      {...sectionHooks(texts)}
      aria-labelledby={title ? `${id}-title` : undefined}
      className="mx-auto my-(--section-gap) max-w-6xl rounded-lg border-(length:--section-border) bg-(--section-background) px-5 py-10"
    >
      {eyebrow && (
        <div data-part="header" className={HEADER}>
          <Eyebrow texts={texts}>{eyebrow}</Eyebrow>
        </div>
      )}
      {title && (
        <h2
          id={`${id}-title`}
          className="text-[calc(1.5rem*var(--heading-scale))] leading-tight font-(--heading-weight) tracking-(--heading-tracking) [text-transform:var(--heading-case,none)]"
          {...mark(texts, "title")}
        >
          {title}
        </h2>
      )}
      {text && (
        <div className="mt-3 max-w-2xl space-y-3 text-lg" {...mark(texts, "text")}>
          {text.split(/\n\s*\n/).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      )}
    </section>
  );
}

/** A picture from public/, e.g. { src: "/images/hero.webp", alt: "A yoga class" }. */
export interface LandingImage {
  src: string;
  alt: string;
  /** Made by an AI: marked where it is shown whole (AiMark.tsx). */
  generated?: boolean;
}

function HeroView({
  texts,
  eyebrow,
  title,
  subtitle,
  link,
  image,
  more,
  shortcuts = [],
  layout = "split",
  imageSide = "right",
}: {
  title: string;
  subtitle?: string;
  link?: LandingLink;
  image?: LandingImage;
  /** Sections follow: a quiet arrow under the content says the page goes on. */
  more?: boolean;
  /** Up to four pages, as round icons over the hero's lower edge. */
  shortcuts?: LandingShortcut[];
  /**
   * split: text beside the picture; centered: text over it; plain: no picture; cover: the
   * picture across the width with the theme's primary washing over it under the text.
   */
  layout?: "split" | "centered" | "plain" | "cover";
  /** The picture's side in a split hero on wide screens. */
  imageSide?: "left" | "right";
  texts?: string;
  /** A short line over the title, e.g. what the section is ("Popular dishes"). */
  eyebrow?: string;
}) {
  const after = useId();
  // A link to where the next section starts, so it works by keyboard and without JavaScript.
  const cue = more && (
    <a
      href={`#${after}`}
      aria-label={w.moreBelow}
      className="mx-auto flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground lg:col-span-2"
    >
      <ChevronDown aria-hidden className="size-6 motion-safe:animate-bounce" />
    </a>
  );
  const end = more && <span id={after} tabIndex={-1} />;
  const shortcutList = shortcuts.length > 0 && (
    <nav aria-label={w.shortcuts} className="relative z-10 mx-auto -mt-12 max-w-4xl px-5">
      <ul className="grid grid-cols-2 gap-4 sm:flex sm:justify-center sm:gap-8">
        {shortcuts.map((s) => (
          <li key={String(s.to)} data-part="shortcut">
            <Link
              to={s.to}
              className="group flex flex-col items-center gap-2 rounded-lg text-center text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-20 items-center justify-center rounded-full border bg-card text-primary shadow-md transition group-hover:-translate-y-0.5 group-hover:shadow-lg">
                <s.icon aria-hidden className="size-8" />
              </span>
              <span className="max-w-32">{s.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
  const text = (
    <div>
      {eyebrow && (
        <p
          data-part="eyebrow"
          className="mb-4 text-sm font-semibold tracking-wide uppercase opacity-90"
          {...mark(texts, "eyebrow")}
        >
          {eyebrow}
        </p>
      )}
      <h1
        className="max-w-3xl text-[calc(2.25rem*var(--heading-scale))] leading-tight font-(--heading-weight) tracking-(--heading-tracking) [text-transform:var(--heading-case,none)] sm:text-[calc(3rem*var(--heading-scale))] lg:text-[calc(3.75rem*var(--heading-scale))]"
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
  // Without a picture every look is plain, so a missing picture never breaks the page.
  if (!image || layout === "plain")
    return (
      <section
        {...sectionHooks(texts)}
        data-hero=""
        className={cn("mx-auto max-w-6xl px-5 py-20 sm:py-28", more && "pb-6 sm:pb-6")}
      >
        {text}
        {shortcutList && <div className="mt-16 [&_nav]:mt-0 [&_nav]:px-0">{shortcutList}</div>}
        {cue && <div className="mt-12">{cue}</div>}
        {end}
      </section>
    );
  // Across the width: the primary washes over the picture where the text is, so the text keeps
  // the theme's own contrast (primary against its foreground), checked like the rest; on a phone,
  // where the text spans the picture, the wash is nearly solid.
  if (layout === "cover")
    return (
      <>
        <section {...sectionHooks(texts)} data-hero="" className="relative isolate overflow-hidden">
          <img
            src={image.src}
            alt={image.alt}
            width={1600}
            height={900}
            fetchPriority="high"
            className="absolute inset-0 -z-10 size-full object-cover"
          />
          <div
            aria-hidden
            className={cn(
              "absolute inset-0 -z-10 bg-primary/90 sm:bg-transparent sm:bg-linear-to-r sm:from-primary sm:via-primary/85 sm:to-primary/10",
              // Dark mode's primary is a light one: the wash is the background tinted with it, so
              // the picture still shows and the text is the page's own (look-references.md §3).
              "dark:bg-(--cover-wash)/90 dark:sm:from-(--cover-wash) dark:sm:via-(--cover-wash)/85 dark:sm:to-(--cover-wash)/10 [--cover-wash:color-mix(in_oklch,var(--primary)_30%,var(--background))]",
            )}
          />
          <div
            className={cn(
              "mx-auto max-w-6xl px-5 py-24 text-primary-foreground sm:py-32 [&_a]:bg-background [&_a]:text-foreground [&_a:hover]:bg-background/90 [&_p]:text-primary-foreground/90",
              "dark:text-foreground dark:[&_a]:bg-primary dark:[&_a]:text-primary-foreground dark:[&_a:hover]:bg-primary-hover dark:[&_p]:text-foreground/90",
              shortcutList && "pb-28 sm:pb-36",
            )}
          >
            {text}
          </div>
        </section>
        {shortcutList}
        {cue && <div className="mt-8">{cue}</div>}
        {end}
      </>
    );
  // Shortcuts sit over the hero's lower edge; the arrow down, if any, then comes after them.
  const framed = (hero: React.ReactNode) =>
    shortcutList ? (
      <>
        {hero}
        {shortcutList}
        {cue && <div className="mt-8">{cue}</div>}
        {end}
      </>
    ) : (
      hero
    );
  // Over the picture: a dark veil keeps the text readable on any picture.
  if (layout === "centered")
    return framed(
      <section {...sectionHooks(texts)} data-hero="" className="relative isolate overflow-hidden">
        <img
          src={image.src}
          alt={image.alt}
          width={1200}
          height={800}
          fetchPriority="high"
          className="absolute inset-0 -z-10 size-full object-cover"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-black/60" />
        <div
          className={cn(
            "mx-auto flex max-w-4xl flex-col items-center px-5 py-24 text-center text-white sm:py-36 [&_h1]:mx-auto [&_p]:mx-auto [&_p]:text-white/90",
            shortcutList && "pb-28 sm:pb-40",
          )}
        >
          {text}
          {!shortcutList && cue && <div className="mt-12 text-white/80">{cue}</div>}
          {!shortcutList && end}
        </div>
      </section>,
    );
  // Beside the text on wide screens, above it on narrow ones; the first thing loaded.
  return framed(
    <section
      {...sectionHooks(texts)}
      data-hero=""
      className={cn(
        "mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 sm:py-20 lg:grid-cols-2",
        shortcutList && "pb-20 sm:pb-28",
      )}
    >
      <AiMarked
        generated={image.generated}
        full
        className={cn(imageSide === "right" && "lg:order-2")}
      >
        <img
          src={image.src}
          alt={image.alt}
          width={1200}
          height={800}
          fetchPriority="high"
          className={cn(
            "aspect-[3/2] w-full rounded-[var(--picture-radius,var(--radius-xl))] border-(length:--picture-frame) object-cover",
            imageSide === "right" && "lg:order-2",
          )}
        />
      </AiMarked>
      {text}
      {/* After the picture too (it moves to the right with order-2), across both columns. */}
      {!shortcutList && more && (
        <div className="lg:order-3 lg:col-span-2">
          {cue}
          {end}
        </div>
      )}
    </section>,
  );
}

function FeaturesView({
  texts,
  eyebrow,
  title,
  text,
  items,
  columns = 3,
}: {
  title?: string;
  text?: string;
  items: { title?: string; text?: string }[];
  /** Items side by side on wide screens: 2, 3 or 4. */
  columns?: 2 | 3 | 4;
  texts?: string;
  /** A short line over the title, e.g. what the section is ("Popular dishes"). */
  eyebrow?: string;
}) {
  const grid = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[columns];
  return (
    <Section id="features" texts={texts} eyebrow={eyebrow} title={title} text={text}>
      <ul className={cn("grid gap-4", grid)}>
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

/** How many cards or pictures stand side by side on wide screens. */
const COLUMNS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-3 lg:grid-cols-4",
};

/** Records shown as cards, e.g. the classes a studio offers. */
function RecordCardsView({
  texts,
  eyebrow,
  id,
  title,
  text,
  cards,
  layout = "cards",
  columns,
  icon,
  door,
}: {
  id: string;
  title?: string;
  text?: string;
  cards: {
    key: string | number;
    title: string;
    text?: string;
    /** An amount of money, formatted: a price. */
    amount?: string;
    badge?: string;
    /** The badge's color by meaning; without one it is neutral. */
    tone?: "success" | "warning" | "danger";
    /** Where the card opens, e.g. its article. */
    href?: string;
    picture?: { src: string; alt: string; width: number; height: number; generated?: boolean };
  }[];
  /** cards: a grid of cards; list: rows with a small picture; grid: the pictures, titled. */
  layout?: "cards" | "list" | "grid";
  /** Cards or pictures side by side on wide screens: 2, 3 or 4 (cards 3, grid 4 when not said). */
  columns?: 2 | 3 | 4;
  /** The model's icon, for a model with pictures: the placeholder where a record has none. */
  icon?: LucideIcon;
  texts?: string;
  /** A short line over the title, e.g. what the section is ("Popular dishes"). */
  eyebrow?: string;
  /**
   * A catalog's door: a search box and filter chips that open the model's list (`to`) with
   * the same address state, e.g. /?q=sofa or /?category=furniture.
   */
  door?: {
    to: string;
    search?: { label: string; placeholder: string };
    chips?: { name: string; label: string; options: { value: string; label: string }[] }[];
  };
}) {
  if (cards.length === 0 && !door) return null;
  type CardItem = (typeof cards)[number];
  // The whole card or row opens it; the link is the title.
  const heading = (card: CardItem) =>
    card.href ? (
      <AppLink
        href={card.href}
        className="outline-none after:absolute after:inset-0 focus-visible:underline"
      >
        {card.title}
      </AppLink>
    ) : (
      card.title
    );
  // A record without a picture gets the placeholder when its model has pictures (it is given
  // an icon then), so the cards stay even; a model without pictures keeps text cards.
  const picture = (card: CardItem, className: string) =>
    !card.picture ? (
      icon && <PicturePlaceholder icon={icon} className={className} />
    ) : (
      <AiMarked generated={card.picture.generated} className="shrink-0">
        <img
          src={card.picture.src}
          alt={card.picture.alt}
          width={card.picture.width}
          height={card.picture.height}
          loading="lazy"
          className={className}
        />
      </AiMarked>
    );
  const details = (card: CardItem) => (
    <>
      {card.amount && <p className="text-lg font-semibold tabular-nums">{card.amount}</p>}
      {card.text && <p className="flex-1 text-muted-foreground">{card.text}</p>}
      {card.badge && (
        <p className="mt-2">
          <Badge variant={card.tone}>{card.badge}</Badge>
        </p>
      )}
    </>
  );
  return (
    <Section id={id} texts={texts} eyebrow={eyebrow} title={title} text={text}>
      {door && (
        <div data-part="door" className="mb-8 space-y-4">
          {door.search && (
            <search>
              <form action={door.to} method="get" className="flex max-w-xl gap-2">
                <input
                  type="search"
                  name="q"
                  aria-label={door.search.label}
                  placeholder={door.search.placeholder}
                  className="h-control min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button type="submit" className={buttonVariants()}>
                  {w.searchAction}
                </button>
              </form>
            </search>
          )}
          {door.chips?.map((chip) => (
            <nav key={chip.name} aria-label={chip.label} className="flex flex-wrap gap-2">
              {chip.options.map((option) => (
                <AppLink
                  key={option.value}
                  href={`${door.to}?${new URLSearchParams({ [chip.name]: option.value })}`}
                  className="inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {option.label}
                </AppLink>
              ))}
            </nav>
          ))}
        </div>
      )}
      {layout === "list" ? (
        <ul className="divide-y border-y">
          {cards.map((card) => (
            <li
              key={card.key}
              className={cn("relative flex items-start gap-4 py-4", card.href && "hover:bg-hover")}
            >
              {picture(
                card,
                "aspect-[3/2] w-28 shrink-0 rounded-[var(--picture-radius,var(--radius-md))] border-(length:--picture-frame) object-cover sm:w-40",
              )}
              <div className="flex flex-1 flex-col gap-1">
                <h3 className="text-lg font-semibold">{heading(card)}</h3>
                {details(card)}
              </div>
            </li>
          ))}
        </ul>
      ) : layout === "grid" ? (
        <ul className={cn("grid grid-cols-2 gap-3", COLUMNS[columns ?? 4])}>
          {cards.map((card) => (
            <li key={card.key} className="relative">
              <figure className="space-y-2">
                {picture(
                  card,
                  "aspect-square w-full rounded-[var(--picture-radius,var(--radius-lg))] border-(length:--picture-frame) object-cover",
                )}
                <figcaption className="font-semibold">{heading(card)}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      ) : (
        <ul className={cn("grid gap-4", COLUMNS[columns ?? 3])}>
          {cards.map((card) => (
            <li key={card.key}>
              <Card
                className={cn(
                  "relative flex h-full flex-col gap-2 overflow-hidden",
                  card.href && "hover:bg-hover",
                )}
              >
                {picture(card, "aspect-[3/2] w-full object-cover")}
                <div className="flex flex-1 flex-col gap-2 p-card">
                  <h3 className="text-lg font-semibold">{heading(card)}</h3>
                  {details(card)}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function PricingView({
  texts,
  eyebrow,
  title,
  text,
  plans,
  link,
  highlight,
}: {
  title?: string;
  text?: string;
  /** The plan drawn forward, by its name. */
  highlight?: string;
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
  /** A short line over the title, e.g. what the section is ("Popular dishes"). */
  eyebrow?: string;
}) {
  const forward = (name?: string) =>
    Boolean(highlight && name && name.trim().toLowerCase() === highlight.trim().toLowerCase());
  return (
    <Section id="pricing" texts={texts} eyebrow={eyebrow} title={title} text={text}>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan, i) => (
          <li key={plan.name}>
            <Card
              data-part={forward(plan.name) ? "highlight" : undefined}
              className={cn(
                "flex h-full flex-col gap-4 p-card",
                forward(plan.name) && "border-primary ring-2 ring-primary",
              )}
            >
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
                <Link
                  to={link.to}
                  className={buttonVariants({
                    variant: forward(plan.name) ? "default" : "outline",
                  })}
                >
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

function TestimonialsView({
  texts,
  eyebrow,
  title,
  items,
  layout = "cards",
}: {
  title?: string;
  items: { quote?: string; name?: string; role?: string }[];
  /** cards: side by side; carousel: a row that scrolls sideways; one: the first quote, large. */
  layout?: "cards" | "carousel" | "one";
  texts?: string;
  /** A short line over the title, e.g. what the section is ("Popular dishes"). */
  eyebrow?: string;
}) {
  const quote = (item: (typeof items)[number], i: number, large = false) => (
    <figure className={cn("space-y-4", large && "mx-auto max-w-3xl text-center")}>
      <blockquote className={large ? "text-2xl leading-snug sm:text-3xl" : "text-lg"}>
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
  );
  const first = items[0];
  return (
    <Section id="testimonials" texts={texts} eyebrow={eyebrow} title={title}>
      {layout === "one" && first ? (
        quote(first, 0, true)
      ) : (
        <ul
          className={
            layout === "carousel"
              ? "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
              : "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          }
          // A row that scrolls sideways: reachable with the keyboard's arrow keys.
          {...(layout === "carousel" ? { tabIndex: 0, "aria-label": title ?? w.testimonials } : {})}
        >
          {items.map((item, i) => (
            <li
              key={item.quote}
              className={
                layout === "carousel"
                  ? "w-[85%] shrink-0 snap-start sm:w-[45%] lg:w-[31%]"
                  : undefined
              }
            >
              <Card className="h-full p-card">{quote(item, i)}</Card>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Questions that open in place; the browser handles the keyboard and the expanded state. */
function FaqView({
  texts,
  eyebrow,
  title,
  items,
  layout = "accordion",
}: {
  title?: string;
  items: { question?: string; answer?: string }[];
  /** accordion: answers open on a click; list: every answer shown. */
  layout?: "accordion" | "list";
  texts?: string;
  /** A short line over the title, e.g. what the section is ("Popular dishes"). */
  eyebrow?: string;
}) {
  if (layout === "list")
    return (
      <Section id="faq" texts={texts} eyebrow={eyebrow} title={title}>
        <dl className="max-w-3xl space-y-6">
          {items.map((item, i) => (
            <div key={item.question}>
              <dt className="font-semibold" {...mark(texts, `items.${i}.question`)}>
                {item.question}
              </dt>
              <dd className="mt-1 text-muted-foreground" {...mark(texts, `items.${i}.answer`)}>
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
      </Section>
    );
  return (
    <Section id="faq" texts={texts} eyebrow={eyebrow} title={title}>
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

function CallToActionView({
  texts,
  title,
  text,
  link,
}: {
  title: string;
  text?: string;
  link?: LandingLink;
  texts?: string;
  /** A short line over the title, e.g. what the section is ("Popular dishes"). */
  eyebrow?: string;
}) {
  return (
    <section
      {...sectionHooks(texts)}
      className="mx-auto my-(--section-gap) max-w-6xl rounded-lg border-(length:--section-border) bg-(--section-background) px-5 py-12"
    >
      <div className="rounded-xl bg-primary px-6 py-12 text-primary-foreground sm:px-12">
        <h2
          className="text-[calc(1.5rem*var(--heading-scale))] leading-tight font-(--heading-weight) tracking-(--heading-tracking) [text-transform:var(--heading-case,none)] sm:text-[calc(2rem*var(--heading-scale))]"
          {...mark(texts, "title")}
        >
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
function ContactView({
  texts,
  eyebrow,
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
  /**
   * The form; it calls `sent` once the message is stored, and stores it only when `human()`:
   * a field people never see stays empty, while form-filling bots fill it.
   */
  form?: (sent: () => void, human: () => boolean) => React.ReactNode;
  texts?: string;
  /** A short line over the title, e.g. what the section is ("Popular dishes"). */
  eyebrow?: string;
}) {
  const [sent, setSent] = useState(false);
  const trap = useRef<HTMLInputElement>(null);
  const hasDetails = Boolean(address || phone || email || hours);
  const details = hasDetails && (
    <dl className="space-y-5">
      {address && (
        <div className="flex gap-3">
          <dt>
            <MapPin aria-hidden className="mt-0.5 size-5 text-primary" />
            <span className="sr-only">{w.address}</span>
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
              {w.showOnMap}
            </a>
          </dd>
        </div>
      )}
      {phone && (
        <div className="flex gap-3">
          <dt>
            <Phone aria-hidden className="mt-0.5 size-5 text-primary" />
            <span className="sr-only">{w.phone}</span>
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
            <span className="sr-only">{w.email}</span>
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
            <span className="sr-only">{w.openingHours}</span>
          </dt>
          <dd className="whitespace-pre-line" {...mark(texts, "hours")}>
            {hours}
          </dd>
        </div>
      )}
    </dl>
  );
  return (
    // A form without a heading of its own still says what it is.
    <Section
      id="contact"
      texts={texts}
      eyebrow={eyebrow}
      title={title ?? (form ? w.contactUs : undefined)}
      text={text}
    >
      {/* Details beside the form; a form alone is centred rather than left beside an empty column. */}
      <div
        className={cn("grid gap-10", form && hasDetails ? "lg:grid-cols-2" : "mx-auto max-w-2xl")}
      >
        {details}
        {form &&
          (sent ? (
            <Card className="p-card">
              <p role="status" className="text-lg" {...mark(texts, "thanks")}>
                {thanks ?? w.thankYou}
              </p>
            </Card>
          ) : (
            <div>
              {/* Off screen and out of the tab order: only a bot fills it in. */}
              <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label>
                  {w.leaveThisEmpty}
                  <input ref={trap} tabIndex={-1} autoComplete="off" name="company-website" />
                </label>
              </div>
              {/* The form draws its own card. */}
              {form(
                () => setSent(true),
                () => !trap.current?.value,
              )}
            </div>
          ))}
      </div>
    </Section>
  );
}

/** Pictures in a grid; one opens large in a lightbox, with the arrow keys to move on. */
function GalleryView({
  texts,
  eyebrow,
  title,
  text,
  items,
}: {
  title?: string;
  text?: string;
  items: { image?: LandingImage; caption?: string }[];
  texts?: string;
  /** A short line over the title, e.g. what the section is ("Popular dishes"). */
  eyebrow?: string;
}) {
  const pictures = items.filter((i): i is { image: LandingImage; caption?: string } =>
    Boolean(i.image),
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(0);
  const show = (i: number) => setOpen((i + pictures.length) % pictures.length);
  const current = pictures[open];
  return (
    <Section id="gallery" texts={texts} eyebrow={eyebrow} title={title} text={text}>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {pictures.map((item, i) => (
          <li key={item.image.src}>
            <figure>
              <button
                type="button"
                className="relative block w-full overflow-hidden rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={w.openPicture(item.image.alt)}
                onClick={() => {
                  show(i);
                  dialog.current?.showModal();
                }}
              >
                <AiMarked generated={item.image.generated}>
                  <img
                    src={item.image.src}
                    alt={item.image.alt}
                    loading="lazy"
                    width={600}
                    height={400}
                    className="aspect-[3/2] w-full object-cover transition-transform hover:scale-105"
                  />
                </AiMarked>
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
            {/* As wide as the picture, so the mark sits on its corner. */}
            <AiMarked generated={current.image.generated} full className="mx-auto w-fit">
              <img
                src={current.image.src}
                alt={current.image.alt}
                className="mx-auto block max-h-[80vh] max-w-full rounded-lg"
              />
            </AiMarked>
            {current.caption && (
              <figcaption className="mt-3 text-center text-white">{current.caption}</figcaption>
            )}
            <div className="mt-3 flex justify-center gap-2">
              {pictures.length > 1 && (
                <button
                  type="button"
                  aria-label={w.previousPicture}
                  className={buttonVariants({ variant: "secondary", size: "icon" })}
                  onClick={() => show(open - 1)}
                >
                  <ChevronLeft aria-hidden />
                </button>
              )}
              <button
                type="button"
                aria-label={w.close}
                className={buttonVariants({ variant: "secondary", size: "icon" })}
                onClick={() => dialog.current?.close()}
              >
                <X aria-hidden />
              </button>
              {pictures.length > 1 && (
                <button
                  type="button"
                  aria-label={w.nextPicture}
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

/** The keys whose texts a person reads: those go through tx; addresses, records and markers do not. */
const TEXT_KEYS = new Set([
  "eyebrow",
  "title",
  "subtitle",
  "text",
  "label",
  "button",
  "caption",
  "question",
  "answer",
  "alt",
  "quote",
  "period",
  "note",
]);

/**
 * A section's props in the language now (docs/design/languages.md §4): each text through tx, the
 * records it shows (cards), its children and its marker for the preview as they are.
 */
function translated<P>(props: P): P {
  const walk = (value: unknown, key?: string): unknown => {
    if (typeof value === "string") return key && TEXT_KEYS.has(key) ? tx(value) : value;
    if (Array.isArray(value)) return value.map((v) => walk(v, key));
    if (!value || typeof value !== "object" || "$$typeof" in value) return value;
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        k === "cards" || k === "children" ? v : walk(v, k),
      ]),
    );
  };
  return walk(props) as P;
}

export function LandingLayout(props: Parameters<typeof LandingLayoutView>[0]) {
  return LandingLayoutView(translated(props));
}

export function Section(props: Parameters<typeof SectionView>[0]) {
  return SectionView(translated(props));
}

export function TextSection(props: Parameters<typeof TextSectionView>[0]) {
  return TextSectionView(translated(props));
}

export function Hero(props: Parameters<typeof HeroView>[0]) {
  return HeroView(translated(props));
}

export function Features(props: Parameters<typeof FeaturesView>[0]) {
  return FeaturesView(translated(props));
}

export function RecordCards(props: Parameters<typeof RecordCardsView>[0]) {
  return RecordCardsView(translated(props));
}

export function Pricing(props: Parameters<typeof PricingView>[0]) {
  return PricingView(translated(props));
}

export function Testimonials(props: Parameters<typeof TestimonialsView>[0]) {
  return TestimonialsView(translated(props));
}

export function Faq(props: Parameters<typeof FaqView>[0]) {
  return FaqView(translated(props));
}

export function CallToAction(props: Parameters<typeof CallToActionView>[0]) {
  return CallToActionView(translated(props));
}

export function Contact(props: Parameters<typeof ContactView>[0]) {
  return ContactView(translated(props));
}

export function Gallery(props: Parameters<typeof GalleryView>[0]) {
  return GalleryView(translated(props));
}
