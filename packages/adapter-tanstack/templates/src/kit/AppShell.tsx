// Smithable app kit: the application frame with navigation menus and the signed-in user.
import { Link, type LinkProps } from "@tanstack/react-router";
import { LogOut, type LucideIcon, Menu, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Input, Label } from "#/components/ui/input";
import { AppearancePicker } from "./AppearancePicker";
import { AppLink } from "./AppLink";
import { allows, type Rule, type Viewer } from "./access";
import { ConsentSettings } from "./Consent";
import { textMarker } from "./model";
import { tx, w } from "./words";

export interface MenuUi {
  name: string;
  label?: string;
  /** Only pages the viewer may open are shown. */
  items: { to: LinkProps["to"]; label: string; icon?: LucideIcon; access: Rule }[];
}

interface ShellProps {
  appName: string;
  /** The app's mark, drawn before its name (the name says what it is, so its alt is empty). */
  logo?: string;
  /** The page at "/", if the app has one: the name leads there when the viewer may open it. */
  home?: { to: LinkProps["to"]; access: Rule };
  menus: MenuUi[];
  viewer: Viewer | null;
  /** Without it the app has no sign-in. */
  onSignOut?: () => Promise<void>;
  /** Sets the signed-in person's own name, the one others see (an invited person has none yet). */
  onRename?: (name: string) => Promise<void>;
  /** A number beside a menu entry, by its route: the files waiting on the review page. */
  counts?: Record<string, number>;
}

// Links and buttons on the sidebar's own colors, with 44 px targets.
const sidebarItem =
  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors hover:bg-hover outline-none focus-visible:ring-2 focus-visible:ring-sidebar-foreground";

export function AppShell({ children, ...shell }: ShellProps & { children: React.ReactNode }) {
  const drawer = useRef<HTMLDialogElement>(null);
  // A visitor to an app with no page for visitors (an invite-only CRM): the menu would hold only
  // Sign in, the page they are on, so there is none.
  const anyPage = shell.menus.some((m) => m.items.some((i) => allows(i.access, shell.viewer)));
  const menu = Boolean(shell.viewer) || anyPage;
  return (
    <div data-kit="app-shell" className="min-h-screen lg:flex">
      {/* Desktop: a sidebar. */}
      <aside className="hidden border-r bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-56 lg:shrink-0 lg:flex-col">
        <p className="px-6 pt-7 pb-6 text-2xl font-bold [overflow-wrap:anywhere]">
          <AppName {...shell} />
        </p>
        <Navigation {...shell} />
      </aside>
      {/* Phones and tablets: a header whose menu opens the same navigation as a drawer. */}
      <header
        data-part="header"
        className="sticky top-0 z-10 flex h-18 items-center gap-2 border-b bg-sidebar px-2 text-sidebar-foreground lg:hidden"
      >
        {menu && (
          <button
            type="button"
            aria-label={w.openMenu}
            className={`${sidebarItem} size-11 justify-center px-0`}
            onClick={() => drawer.current?.showModal()}
          >
            <Menu aria-hidden className="size-6" />
          </button>
        )}
        <p className="min-w-0 truncate text-lg font-bold">
          <AppName {...shell} />
        </p>
      </header>
      <dialog
        ref={drawer}
        aria-label={w.menu}
        data-kit="drawer"
        className="m-0 h-dvh max-h-none w-72 max-w-[85vw] flex-col rounded-r-xl bg-sidebar text-sidebar-foreground backdrop:bg-black/50 open:flex lg:hidden"
      >
        <div className="flex h-18 shrink-0 items-center justify-between gap-2 pr-2 pl-5">
          <p className="min-w-0 truncate text-lg font-bold">
            <AppName {...shell} onNavigate={() => drawer.current?.close()} />
          </p>
          <button
            type="button"
            aria-label={w.closeMenu}
            className={`${sidebarItem} size-11 justify-center px-0`}
            onClick={() => drawer.current?.close()}
          >
            <X aria-hidden className="size-6" />
          </button>
        </div>
        <Navigation {...shell} onNavigate={() => drawer.current?.close()} />
      </dialog>
      <main className="min-w-0 flex-1 px-5 py-6 lg:px-9 lg:py-8">{children}</main>
    </div>
  );
}

/** The app's name, a way back to its start: the page at "/", else the first the viewer may open. */
function AppName({
  appName,
  logo,
  home,
  menus,
  viewer,
  onNavigate,
}: ShellProps & { onNavigate?: () => void }) {
  const start =
    home && allows(home.access, viewer)
      ? home.to
      : menus.flatMap((m) => m.items).find((item) => allows(item.access, viewer))?.to;
  const name = logo ? (
    <span className="inline-flex max-w-full items-center gap-2 align-middle">
      <img
        src={logo}
        alt=""
        data-part="logo"
        width={24}
        height={24}
        className="size-6 shrink-0 rounded-[4px] object-contain"
      />
      <span className="min-w-0 truncate">{appName}</span>
    </span>
  ) : (
    appName
  );
  if (!start) return name;
  return (
    <Link
      to={start}
      onClick={onNavigate}
      className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-sidebar-foreground"
    >
      {name}
    </Link>
  );
}

function Navigation({
  menus,
  viewer,
  onSignOut,
  onRename,
  counts,
  onNavigate,
}: ShellProps & { onNavigate?: () => void }) {
  // A link with another under it (Team over Team's activity) is lit only on its own page: by
  // default a link is lit on every page under it, which would light both.
  const routes = menus.flatMap((menu) => menu.items.map((item) => String(item.to)));
  const hasBelow = (to: string) =>
    routes.some((other) => other !== to && other.startsWith(to.endsWith("/") ? to : `${to}/`));
  return (
    <>
      <nav
        aria-label={w.mainMenu}
        data-kit="nav"
        className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4"
      >
        {menus.map((menu) => {
          const items = menu.items.filter((item) => allows(item.access, viewer));
          if (items.length === 0) return null;
          return (
            <div key={menu.name} className="flex flex-col gap-1">
              {menu.label && (
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide">
                  {tx(menu.label)}
                </p>
              )}
              {items.map((item) => (
                <Link
                  key={String(item.to)}
                  to={item.to}
                  onClick={onNavigate}
                  className={sidebarItem}
                  activeOptions={{ exact: hasBelow(String(item.to)) }}
                  activeProps={{
                    className:
                      "bg-primary font-semibold text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  }}
                >
                  {item.icon && <item.icon aria-hidden className="size-5 shrink-0" />}
                  {tx(item.label)}
                  {(counts?.[String(item.to)] ?? 0) > 0 && (
                    <span
                      data-part="count"
                      className="ml-auto rounded-full bg-primary px-2 text-xs text-primary-foreground"
                    >
                      {counts?.[String(item.to)]}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
      <ConsentSettings className="mx-3 px-3 pb-2 text-left text-xs underline-offset-4 hover:underline" />
      <AppearancePicker className="mx-3 px-3 pb-2 text-xs" />
      {onSignOut && (
        <div className="mx-3 border-t border-sidebar-foreground/30 px-3 py-4 text-sm">
          {viewer ? (
            <>
              {onRename ? (
                <YourName name={viewer.name} email={viewer.email} onRename={onRename} />
              ) : (
                <p className="truncate font-semibold" title={viewer.email}>
                  {viewer.name}
                </p>
              )}
              <p className="capitalize">{viewer.role}</p>
              <button
                type="button"
                data-part="sign-out"
                onClick={onSignOut}
                className={`${sidebarItem} -mx-3 mt-2`}
              >
                <LogOut aria-hidden className="size-5" />
                {w.signOut}
              </button>
            </>
          ) : (
            <AppLink href="/sign-in" className={`${sidebarItem} -mx-3`}>
              {w.signIn}
            </AppLink>
          )}
        </div>
      )}
    </>
  );
}

/** The signed-in person's name, which they set themselves: an invited person starts with none. */
function YourName({
  name,
  email,
  onRename,
}: {
  name: string;
  email: string;
  onRename: (name: string) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setFailure(undefined);
    try {
      await onRename(value.trim());
      dialog.current?.close();
    } catch {
      setFailure(w.tryAgain);
    }
    setBusy(false);
  }
  return (
    <>
      <button
        type="button"
        title={email}
        onClick={() => {
          setValue(name);
          dialog.current?.showModal();
        }}
        className="block max-w-full truncate rounded-sm text-left font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-sidebar-foreground"
      >
        {name.trim() || w.addYourName}
      </button>
      <dialog
        ref={dialog}
        aria-label={w.yourName}
        className="m-auto w-[calc(100%-2.5rem)] max-w-md bg-transparent p-0 text-foreground backdrop:bg-black/50"
      >
        <Card className="rounded-xl p-card">
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="your-name">{w.yourName}</Label>
              <Input
                id="your-name"
                required
                maxLength={100}
                value={value}
                autoComplete="name"
                onChange={(e) => setValue(e.target.value)}
                disabled={busy}
              />
              <p className="text-sm text-muted-foreground">{w.yourNameHelp}</p>
            </div>
            {failure && (
              <p role="alert" className="text-sm text-destructive">
                {failure}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? w.saving : w.saveChanges}
              </Button>
              <Button type="button" variant="outline" onClick={() => dialog.current?.close()}>
                {w.cancel}
              </Button>
            </div>
          </form>
        </Card>
      </dialog>
    </>
  );
}

/** Shown while a page's data loads for longer than a moment: the shape of a page, no words. */
export function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label={w.loading}
      className="max-w-3xl animate-pulse space-y-6"
      role="status"
    >
      <div className="h-8 w-1/3 rounded-md bg-muted" />
      <div className="space-y-3">
        <div className="h-row rounded-md bg-muted" />
        <div className="h-row rounded-md bg-muted" />
        <div className="h-row rounded-md bg-muted" />
      </div>
    </div>
  );
}

/** Shown instead of a page that failed, e.g. "You are not allowed to do this." A sentence, so never
 *  in the theme's capitals. */
export function ErrorNotice({
  title,
  message,
  kind = "error",
}: {
  title: string;
  message?: string;
  /** What the page is: an error (the preview loads it again while the app updates), or a page not found. */
  kind?: "error" | "not-found";
}) {
  return (
    <div data-kit={kind} className="max-w-xl">
      <h1
        data-part="title"
        className="mb-6 break-words text-[28px] leading-9 font-bold lg:text-[32px] lg:leading-10"
      >
        {title}
      </h1>
      {message && <p className="text-muted-foreground">{message}</p>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  page,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** The page's name in the spec: its texts can then be changed in the preview. */
  page?: string;
}) {
  return (
    <div
      data-part="header"
      className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <h1
          data-part="title"
          className="break-words text-[28px] leading-9 font-bold [text-transform:var(--heading-case,none)] lg:text-[32px] lg:leading-10"
          {...(page ? textMarker(`pages.${page}.title`) : {})}
        >
          {tx(title)}
        </h1>
        {subtitle && (
          <p
            className="mt-1 text-muted-foreground"
            {...(page ? textMarker(`pages.${page}.subtitle`) : {})}
          >
            {tx(subtitle)}
          </p>
        )}
      </div>
      {actions && (
        <div
          data-part="actions"
          className="flex flex-wrap items-center gap-2 max-sm:[&>*:not([data-part=save])]:flex-1"
        >
          {actions}
        </div>
      )}
    </div>
  );
}
