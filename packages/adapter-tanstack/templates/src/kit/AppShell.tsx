// Smithable app kit: the application frame with navigation menus.
import { Link, type LinkProps } from "@tanstack/react-router";

export interface MenuUi {
  name: string;
  label?: string;
  items: { to: LinkProps["to"]; label: string }[];
}

export function AppShell({
  appName,
  menus,
  children,
}: {
  appName: string;
  menus: MenuUi[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b bg-sidebar md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="px-5 py-4 text-base font-semibold tracking-tight">{appName}</div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:gap-4">
          {menus.map((menu) => (
            <div key={menu.name} className="flex gap-1 md:flex-col">
              {menu.label && (
                <p className="hidden px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground md:block">
                  {menu.label}
                </p>
              )}
              {menu.items.map((item) => (
                <Link
                  key={String(item.to)}
                  to={item.to}
                  className="whitespace-nowrap rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  activeProps={{ className: "bg-accent font-medium text-accent-foreground" }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-10 md:py-8">{children}</main>
    </div>
  );
}

export function PageHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
