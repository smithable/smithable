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
import { ModelTable, PicturePlaceholder } from "./ModelTable";
import { type AppUi, type RecordUi, type Row, textMarker } from "./model";
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
  header,
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
  /** The header's look (smithable.ux.yml): it stays at the top as the page scrolls unless scrolling. */
  header?: { position?: "sticky" | "scrolling" };
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
    // A sticky header stays over the page as it scrolls; a part reached by its anchor stops below it.
    <div
      data-kit="landing"
      className={cn(
        "flex min-h-screen flex-col",
        header?.position !== "scrolling" && "[&_[id]]:scroll-mt-20",
      )}
    >
      <header
        data-part="header"
        data-position={header?.position}
        className={cn("border-b bg-card", header?.position !== "scrolling" && "sticky top-0 z-30")}
      >
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
 * A section's band: none, an open section on the page; muted, inverse or
 * primary, the section across the width on that surface of the theme, its content in the page's
 * measure. styles.css gives the text, cards, buttons and links inside the band's colors.
 */
export type Band = "none" | "muted" | "inverse" | "primary";
type Banded = {
  /** The section across the width on a surface of the theme (none: an open section). */
  band?: Band;
};

/** A section's frame: its box (open, or boxed by the theme), or a band across the width. */
const frame = (band: Band, padding: string) => ({
  "data-band": band === "none" ? undefined : band,
  className: cn(
    "mx-auto my-(--section-gap) max-w-6xl rounded-lg border-(length:--section-border) px-5",
    band === "none" && "bg-(--section-background)",
    padding,
  ),
});

/**
 * A section's heading block (its eyebrow, title and lead) at the start or centered, as the
 * theme's headings.align says (--heading-align); a narrower block under it (the lead, a FAQ)
 * moves to the middle with it (--heading-inline).
 */
const ALIGN = "[text-align:var(--heading-align,start)]";
const INLINE = "[margin-inline:var(--heading-inline,0)]";

/** The short line over a section's title, in the primary color. */
function Eyebrow({ texts, children }: { texts?: string; children: string }) {
  return (
    <p
      data-part="eyebrow"
      className={cn("mb-2 text-sm font-semibold label-text text-primary", ALIGN)}
      {...mark(texts, "eyebrow")}
    >
      {children}
    </p>
  );
}

function SectionView({
  texts,
  band = "none",
  eyebrow,
  id,
  title,
  text,
  children,
}: Banded & {
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
      {...frame(band, "py-12")}
    >
      {eyebrow && <Eyebrow texts={texts}>{eyebrow}</Eyebrow>}
      {title && (
        <h2
          id={`${id}-title`}
          className={cn(
            "text-[calc(1.5rem*var(--heading-scale))] leading-tight font-(--heading-weight) tracking-(--heading-tracking) [text-transform:var(--heading-case,none)] sm:text-[calc(2rem*var(--heading-scale))]",
            ALIGN,
          )}
          {...mark(texts, "title")}
        >
          {title}
        </h2>
      )}
      {text && (
        <p
          className={cn("mt-3 max-w-2xl text-lg text-muted-foreground", ALIGN, INLINE)}
          {...mark(texts, "text")}
        >
          {text}
        </p>
      )}
      <div className={text ? "mt-8" : title ? "mt-6" : undefined}>{children}</div>
    </section>
  );
}

/** A text section: a heading and paragraphs (a blank line between them in the content file). */
function TextSectionView({
  texts,
  band = "none",
  eyebrow,
  id,
  title,
  text,
}: Banded & {
  id: string;
  title?: string;
  text?: string;
  texts?: string;
  /** A short line over the title, e.g. what the section is ("Our story"). */
  eyebrow?: string;
}) {
  return (
    <section
      {...sectionHooks(texts)}
      aria-labelledby={title ? `${id}-title` : undefined}
      {...frame(band, "py-10")}
    >
      {eyebrow && <Eyebrow texts={texts}>{eyebrow}</Eyebrow>}
      {title && (
        <h2
          id={`${id}-title`}
          className={cn(
            "text-[calc(1.5rem*var(--heading-scale))] leading-tight font-(--heading-weight) tracking-(--heading-tracking) [text-transform:var(--heading-case,none)]",
            ALIGN,
          )}
          {...mark(texts, "title")}
        >
          {title}
        </h2>
      )}
      {/* The paragraphs read from the start; their column moves to the middle with the heading. */}
      {text && (
        <div className={cn("mt-3 max-w-2xl space-y-3 text-lg", INLINE)} {...mark(texts, "text")}>
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
  secondLink,
  image,
  more,
  shortcuts = [],
  layout: given = "split",
  imageSide = "right",
  overlay,
  facts = [],
  stage,
}: {
  title: string;
  subtitle?: string;
  link?: LandingLink;
  /** A second button beside the first, an outline one. */
  secondLink?: LandingLink;
  image?: LandingImage;
  /** Sections follow: a quiet arrow under the content says the page goes on. */
  more?: boolean;
  /** Up to four pages, as round icons over the hero's lower edge. */
  shortcuts?: LandingShortcut[];
  /**
   * split: text beside the picture; centered: text over it; plain: no picture; cover: the
   * picture across the width with the theme's primary washing over it under the text; photo:
   * the picture across the width, a dark scrim from the start side, white text at the start.
   */
  layout?: "split" | "centered" | "plain" | "cover" | "photo" | "inset" | "stage";
  /**
   * A cover or photo hero's wash: brand (the primary, the cover's own) or dark (a scrim, the
   * photo's own); each layout keeps its size and takes the other's wash (look-gap §4).
   */
  overlay?: "brand" | "dark";
  /** A row of figures under the text: each model's count of the records the viewer may read. */
  facts?: { label: string; value: number }[];
  /**
   * A stage hero's list (look-breadth §3): the app's own list page drawn by the kit's table with
   * its first records, a picture of the list beside the headline, not a list to use.
   */
  stage?: {
    // Any model's list: the stage draws whichever list page the ux file names.
    // biome-ignore lint/suspicious/noExplicitAny: a record of any model, drawn as a picture
    ui: RecordUi<any>;
    app: AppUi;
    rows: Row[];
    label: string;
    columns?: string[];
    /** The list's own look on a wide screen: cards where its page shows cards. */
    view?: "table" | "cards";
  };
  /** The picture's side in a split hero on wide screens. */
  imageSide?: "left" | "right";
  texts?: string;
  /** A short line over the title, e.g. who the app is for ("For small studios"). */
  eyebrow?: string;
}) {
  const layout = given;
  // Over a picture across the width: the brand's wash (the cover's own) or a dark scrim (the
  // photo's own); each layout keeps its size and takes the wash it is given (look-gap §4).
  const wash = overlay ?? (layout === "cover" ? "brand" : "dark");
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
  // Without a picture every look is plain.
  const shown = image ? layout : "plain";
  // The second button: an outline one, in the hero's own text color on a picture or a wash.
  const second = secondLink && (
    <Link
      to={secondLink.to}
      data-part="second-button"
      className={cn(
        buttonVariants({ variant: "outline" }),
        "h-12 px-6 text-base",
        (shown === "centered" || ((shown === "photo" || shown === "cover") && wash === "dark")) &&
          "border-white/70 bg-transparent text-white hover:bg-white/10",
        // Over the cover's rule for its links (the first button's fill), so marked as important.
        (shown === "cover" || shown === "photo") &&
          wash === "brand" &&
          "border-primary-foreground/70 bg-transparent! text-primary-foreground! hover:bg-primary-foreground/10! dark:border-foreground/70 dark:text-foreground! dark:hover:bg-foreground/10!",
      )}
    >
      <span {...mark(texts, "secondButton")}>{secondLink.label}</span>
    </Link>
  );
  const text = (
    <div>
      {/* In the hero's own text color, so it reads on a picture and on the cover's wash too. */}
      {eyebrow && (
        <p
          data-part="eyebrow"
          className="mb-4 text-sm font-semibold label-text opacity-90"
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
      {(link || second) && (
        <div className={cn("mt-10 flex flex-wrap gap-3", shown === "centered" && "justify-center")}>
          {link && (
            <Link to={link.to} className={cn(buttonVariants(), "h-12 px-6 text-base")}>
              <span {...mark(texts, "button")}>{link.label}</span>
            </Link>
          )}
          {second}
        </div>
      )}
      {facts.length > 0 && (
        <dl data-part="facts" className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
          {facts.map((fact) => (
            <div key={fact.label} className="flex flex-col-reverse">
              <dt className="text-sm label-text opacity-80">{fact.label}</dt>
              <dd className="text-3xl font-(--heading-weight) tabular-nums">
                {new Intl.NumberFormat(undefined, { minimumIntegerDigits: 2 }).format(fact.value)}
              </dd>
            </div>
          ))}
        </dl>
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
  // where the text spans the picture, the wash is nearly solid. Dark mode's primary is a light
  // one, so there the wash is the dark background tinted with it and the text is the page's own.
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
          {wash === "dark" ? (
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-linear-to-t from-black/90 via-black/65 to-black/20 sm:bg-linear-to-r sm:from-black/85 sm:via-black/60 sm:to-black/5 sm:rtl:bg-linear-to-l"
            />
          ) : (
            <div
              aria-hidden
              className={cn(
                "absolute inset-0 -z-10 bg-primary/90 sm:bg-transparent sm:bg-linear-to-r sm:from-primary sm:via-primary/85 sm:to-primary/10",
                "[--cover-wash:color-mix(in_oklch,var(--primary)_35%,var(--background))] dark:bg-(--cover-wash)/90 dark:sm:bg-transparent dark:sm:from-(--cover-wash) dark:sm:via-(--cover-wash)/85 dark:sm:to-(--cover-wash)/10",
              )}
            />
          )}
          <div
            className={cn(
              "mx-auto max-w-6xl px-5 py-24 sm:py-32",
              wash === "dark"
                ? "text-white [&_p]:text-white/90"
                : "text-primary-foreground [&_a]:bg-background [&_a]:text-foreground [&_a:hover]:bg-background/90 [&_p]:text-primary-foreground/90 dark:text-foreground dark:[&_a]:bg-primary dark:[&_a]:text-primary-foreground dark:[&_a:hover]:bg-primary-hover dark:[&_p]:text-foreground/90",
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
  // Across the width at a large size: a dark scrim from the start side (from the foot on a
  // phone, where the text sits low) keeps the text white and readable on any picture, in light
  // and dark mode alike; the text and buttons stand at the start.
  if (layout === "photo")
    return framed(
      <section
        {...sectionHooks(texts)}
        data-hero=""
        className="relative isolate flex min-h-[34rem] items-end overflow-hidden sm:min-h-[38rem] lg:min-h-[80vh] lg:items-center"
      >
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
          className={
            wash === "brand"
              ? "absolute inset-0 -z-10 bg-primary/90 [--cover-wash:color-mix(in_oklch,var(--primary)_35%,var(--background))] sm:bg-transparent sm:bg-linear-to-r sm:from-primary sm:via-primary/85 sm:to-primary/10 dark:bg-(--cover-wash)/90 dark:sm:bg-transparent dark:sm:from-(--cover-wash) dark:sm:via-(--cover-wash)/85 dark:sm:to-(--cover-wash)/10"
              : "absolute inset-0 -z-10 bg-linear-to-t from-black/90 via-black/65 to-black/20 sm:bg-linear-to-r sm:from-black/85 sm:via-black/60 sm:to-black/5 sm:rtl:bg-linear-to-l"
          }
        />
        <div
          className={cn(
            "mx-auto w-full max-w-6xl px-5 py-16 sm:py-24 [&_h1]:max-w-2xl",
            wash === "brand"
              ? "text-primary-foreground [&_a]:bg-background [&_a]:text-foreground [&_a:hover]:bg-background/90 [&_p]:text-primary-foreground/90 dark:text-foreground dark:[&_a]:bg-primary dark:[&_a]:text-primary-foreground dark:[&_a:hover]:bg-primary-hover dark:[&_p]:text-foreground/90"
              : "text-white [&_p]:text-white/90",
            shortcutList && "pb-28 sm:pb-36",
          )}
        >
          {text}
          {!shortcutList && cue && <div className="mt-12 text-white/80">{cue}</div>}
          {!shortcutList && end}
        </div>
      </section>,
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
  // The app's own list beside the headline (look-breadth §3), on the card's surface (glass where
  // the theme's cards are), as a picture: nothing in it opens or is chosen.
  if (layout === "stage" && stage)
    return framed(
      <section
        {...sectionHooks(texts)}
        data-hero=""
        data-layout="stage"
        className={cn(
          "mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 sm:py-20 lg:grid-cols-12",
          shortcutList && "pb-20 sm:pb-28",
        )}
      >
        <div className="lg:col-span-5">{text}</div>
        <div
          data-part="stage"
          role="img"
          aria-label={w.previewOf(stage.label)}
          className="pointer-events-none overflow-hidden rounded-[var(--radius-xl)] border-(length:--card-border) border-(--card-border-color) bg-(--card-surface) p-4 shadow-card [backdrop-filter:var(--card-blur)] lg:col-span-7"
        >
          <p aria-hidden className="mb-3 text-sm font-semibold">
            {stage.label}
          </p>
          <div aria-hidden inert>
            <ModelTable
              ui={stage.ui}
              app={stage.app}
              rows={stage.rows}
              {...(stage.columns ? { columns: stage.columns } : {})}
              {...(stage.view ? { view: stage.view } : {})}
            />
          </div>
        </div>
        {!shortcutList && more && (
          <div className="lg:col-span-12">
            {cue}
            {end}
          </div>
        )}
      </section>,
    );
  // The picture as a tall card on the page beside the text (look-gap §4): in the card's surface,
  // with its edge and shadow; on a phone the card comes first, wider than tall.
  if (layout === "inset")
    return framed(
      <section
        {...sectionHooks(texts)}
        data-hero=""
        data-layout="inset"
        className={cn(
          "mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 sm:py-20 lg:grid-cols-12",
          shortcutList && "pb-20 sm:pb-28",
        )}
      >
        <div
          className={cn(
            "rounded-[var(--radius-xl)] border-(length:--card-border) border-(--card-border-color) bg-(--card-surface) p-3 shadow-card lg:col-span-5",
            imageSide === "right" ? "lg:order-2" : "",
          )}
        >
          <AiMarked generated={image.generated} full>
            <img
              src={image.src}
              alt={image.alt}
              width={960}
              height={1200}
              fetchPriority="high"
              className="aspect-[4/3] w-full rounded-[var(--picture-radius,var(--radius-lg))] object-cover lg:aspect-[4/5]"
            />
          </AiMarked>
        </div>
        <div className="lg:col-span-7">{text}</div>
        {!shortcutList && more && (
          <div className="lg:order-3 lg:col-span-12">
            {cue}
            {end}
          </div>
        )}
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

/**
 * Cards side by side on wide screens (features, records as cards), by columns. Written out in
 * full: Tailwind makes only the classes it finds in the source.
 */
const CARD_COLUMNS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-3 lg:grid-cols-5",
  6: "sm:grid-cols-3 lg:grid-cols-6",
};

/** Pictures side by side (records as a grid), two on a phone. */
const PICTURE_COLUMNS = {
  2: "",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-3 lg:grid-cols-4",
  5: "sm:grid-cols-3 lg:grid-cols-5",
  6: "sm:grid-cols-4 lg:grid-cols-6",
};

/** A gallery's pictures side by side, two on a phone. */
const GALLERY_COLUMNS = {
  2: "",
  3: "md:grid-cols-3",
  4: "md:grid-cols-3 lg:grid-cols-4",
  5: "md:grid-cols-3 lg:grid-cols-5",
  6: "md:grid-cols-4 lg:grid-cols-6",
};

function FeaturesView({
  texts,
  band = "none",
  eyebrow,
  title,
  text,
  items,
  columns = 3,
}: Banded & {
  title?: string;
  text?: string;
  items: { title?: string; text?: string }[];
  /** Items side by side on wide screens: 2 to 6. */
  columns?: 2 | 3 | 4 | 5 | 6;
  texts?: string;
  /** A short line over the title, e.g. what the section is ("Why us"). */
  eyebrow?: string;
}) {
  return (
    <Section id="features" texts={texts} band={band} eyebrow={eyebrow} title={title} text={text}>
      <ul className={cn("grid gap-4", CARD_COLUMNS[columns])}>
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
function RecordCardsView({
  texts,
  band = "none",
  eyebrow,
  id,
  title,
  text,
  cards,
  layout = "cards",
  columns,
  icon,
  door,
}: Banded & {
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
  /** Cards or pictures side by side on wide screens, 2 to 6: cards 3 and a grid 4 when not said; a list has none. */
  columns?: 2 | 3 | 4 | 5 | 6;
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
    <Section id={id} texts={texts} band={band} eyebrow={eyebrow} title={title} text={text}>
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
        <ul className={cn("grid grid-cols-2 gap-3", PICTURE_COLUMNS[columns ?? 4])}>
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
        <ul className={cn("grid gap-4", CARD_COLUMNS[columns ?? 3])}>
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
  band = "none",
  eyebrow,
  title,
  text,
  plans,
  link,
  highlight,
}: Banded & {
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
  /** A short line over the title, e.g. what the section is ("Plans"). */
  eyebrow?: string;
}) {
  const forward = (name?: string) =>
    Boolean(highlight && name && name.trim().toLowerCase() === highlight.trim().toLowerCase());
  return (
    <Section id="pricing" texts={texts} band={band} eyebrow={eyebrow} title={title} text={text}>
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
  band = "none",
  eyebrow,
  title,
  items,
  layout = "cards",
}: Banded & {
  title?: string;
  items: { quote?: string; name?: string; role?: string }[];
  /** cards: side by side; carousel: a row that scrolls sideways; one: the first quote, large. */
  layout?: "cards" | "carousel" | "one";
  texts?: string;
  /** A short line over the title, e.g. what the section is ("Reviews"). */
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
    <Section id="testimonials" texts={texts} band={band} eyebrow={eyebrow} title={title}>
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
  band = "none",
  eyebrow,
  title,
  items,
  layout = "accordion",
  columns = 1,
}: Banded & {
  title?: string;
  items: { question?: string; answer?: string }[];
  /** accordion: answers open on a click; list: every answer shown. */
  layout?: "accordion" | "list";
  /** The list's questions side by side on wide screens: 1 or 2. */
  columns?: 1 | 2;
  texts?: string;
  /** A short line over the title, e.g. what the section is ("Questions"). */
  eyebrow?: string;
}) {
  if (layout === "list")
    return (
      <Section id="faq" texts={texts} band={band} eyebrow={eyebrow} title={title}>
        <dl
          className={
            columns === 2
              ? "grid gap-x-10 gap-y-6 md:grid-cols-2"
              : cn("max-w-3xl space-y-6", INLINE)
          }
        >
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
    <Section id="faq" texts={texts} band={band} eyebrow={eyebrow} title={title}>
      <div className={cn("max-w-3xl divide-y border-y", INLINE)}>
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
  band = "none",
  title,
  text,
  link,
}: Banded & {
  title: string;
  text?: string;
  link?: LandingLink;
  texts?: string;
}) {
  return (
    <section {...sectionHooks(texts)} {...frame(band, "py-12")}>
      {/* On the primary band the band is its box: the words on it, the button inverse. */}
      <div
        className={
          band === "primary"
            ? "py-4"
            : "rounded-xl bg-primary px-6 py-12 text-primary-foreground sm:px-12"
        }
      >
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
            className={cn(
              buttonVariants({ variant: band === "primary" ? "default" : "secondary" }),
              "mt-8 h-12 px-6 text-base",
            )}
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
  band = "none",
  eyebrow,
  title,
  text,
  address,
  phone,
  email,
  hours,
  thanks,
  form,
}: Banded & {
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
  /** A short line over the title, e.g. what the section is ("Visit us"). */
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
      band={band}
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
  band = "none",
  eyebrow,
  title,
  text,
  items,
  columns = 3,
}: Banded & {
  title?: string;
  text?: string;
  items: { image?: LandingImage; caption?: string }[];
  /** Pictures side by side on wide screens: 2 to 6. */
  columns?: 2 | 3 | 4 | 5 | 6;
  texts?: string;
  /** A short line over the title, e.g. what the section is ("Our rooms"). */
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
    <Section id="gallery" texts={texts} band={band} eyebrow={eyebrow} title={title} text={text}>
      <ul className={cn("grid grid-cols-2 gap-3", GALLERY_COLUMNS[columns])}>
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
