// Smithable app kit: the application frame with navigation menus and the signed-in user.
import { Link, type LinkProps } from "@tanstack/react-router";
import { LogOut, type LucideIcon, Menu, X } from "lucide-react";
import { useRef } from "react";
import { allows, type Rule, type Viewer } from "./access";

export interface MenuUi {
  name: string;
  label?: string;
  /** Only pages the viewer may open are shown. */
  items: { to: LinkProps["to"]; label: string; icon?: LucideIcon; access: Rule }[];
}

interface ShellProps {
  appName: string;
  menus: MenuUi[];
  viewer: Viewer | null;
  /** Without it the app has no sign-in. */
  onSignOut?: () => Promise<void>;
}

// Links and buttons on the sidebar's own colours, with 44 px targets.
const sidebarItem =
  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-foreground";

export function AppShell({ children, ...shell }: ShellProps & { children: React.ReactNode }) {
  const drawer = useRef<HTMLDialogElement>(null);
  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop: a sidebar. */}
      <aside className="hidden border-r bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-56 lg:shrink-0 lg:flex-col">
        <p className="px-6 pt-7 pb-6 text-2xl font-bold">{shell.appName}</p>
        <Navigation {...shell} />
      </aside>
      {/* Phones and tablets: a header whose menu opens the same navigation as a drawer. */}
      <header className="sticky top-0 z-10 flex h-18 items-center gap-2 border-b bg-sidebar px-2 text-sidebar-foreground lg:hidden">
        <button
          type="button"
          aria-label="Open menu"
          className={`${sidebarItem} size-11 justify-center px-0`}
          onClick={() => drawer.current?.showModal()}
        >
          <Menu aria-hidden className="size-6" />
        </button>
        <p className="min-w-0 truncate text-lg font-bold">{shell.appName}</p>
      </header>
      <dialog
        ref={drawer}
        aria-label="Menu"
        className="m-0 h-dvh max-h-none w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground backdrop:bg-black/50 open:flex lg:hidden"
      >
        <div className="flex h-18 shrink-0 items-center justify-between gap-2 pr-2 pl-5">
          <p className="min-w-0 truncate text-lg font-bold">{shell.appName}</p>
          <button
            type="button"
            aria-label="Close menu"
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

function Navigation({
  menus,
  viewer,
  onSignOut,
  onNavigate,
}: ShellProps & { onNavigate?: () => void }) {
  return (
    <>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
        {menus.map((menu) => {
          const items = menu.items.filter((item) => allows(item.access, viewer));
          if (items.length === 0) return null;
          return (
            <div key={menu.name} className="flex flex-col gap-1">
              {menu.label && (
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide">
                  {menu.label}
                </p>
              )}
              {items.map((item) => (
                <Link
                  key={String(item.to)}
                  to={item.to}
                  onClick={onNavigate}
                  className={sidebarItem}
                  activeProps={{
                    className:
                      "bg-primary font-semibold text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  }}
                >
                  {item.icon && <item.icon aria-hidden className="size-5 shrink-0" />}
                  {item.label}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
      {onSignOut && (
        <div className="mx-3 border-t border-sidebar-foreground/30 px-3 py-4 text-sm">
          {viewer ? (
            <>
              <p className="truncate font-semibold" title={viewer.email}>
                {viewer.name}
              </p>
              <p className="capitalize">{viewer.role}</p>
              <button type="button" onClick={onSignOut} className={`${sidebarItem} -mx-3 mt-2`}>
                <LogOut aria-hidden className="size-5" />
                Sign out
              </button>
            </>
          ) : (
            <a href="/sign-in" className={`${sidebarItem} -mx-3`}>
              Sign in
            </a>
          )}
        </div>
      )}
    </>
  );
}

/** Shown instead of a page that failed, e.g. "You are not allowed to do this." */
export function ErrorNotice({ title, message }: { title: string; message?: string }) {
  return (
    <div className="max-w-xl">
      <PageHeader title={title} />
      {message && <p className="text-muted-foreground">{message}</p>}
    </div>
  );
}

export function PageHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <h1 className="min-w-0 break-words text-[28px] leading-9 font-bold lg:text-[32px] lg:leading-10">
        {title}
      </h1>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 max-sm:[&>*]:flex-1">{actions}</div>
      )}
    </div>
  );
}
