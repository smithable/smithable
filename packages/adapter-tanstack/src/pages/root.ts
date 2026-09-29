// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import {
  type AuthIR,
  type Icon,
  pageAccess,
  pageIcon,
  type SpecIR,
  type UxIR,
} from "@smithable/core";
import { hasSignIn } from "../auth.js";
import { HEADER, literal, type Texts } from "../shared.js";

// ── Routes ───────────────────────────────────────────────────────────────────

/** Who may open each page. */
export function pagesModule(ir: SpecIR, auth: AuthIR): string {
  const entries = Object.fromEntries(ir.pages.map((p) => [p.id, pageAccess(p, auth)]));
  return `${HEADER}import type { Rule } from "#/kit/access";

/** Who may open each page. */
export const pageAccess = ${literal(entries)} satisfies Record<string, Rule>;
`;
}

/** The lucide-react component for each navigation icon. */
export const LUCIDE: Record<Icon, string> = {
  users: "Users",
  user: "User",
  file: "FileText",
  receipt: "Receipt",
  cart: "ShoppingCart",
  package: "Package",
  calendar: "Calendar",
  layers: "Layers",
  book: "BookOpen",
  briefcase: "Briefcase",
  building: "Building2",
  chart: "ChartColumn",
  clipboard: "ClipboardList",
  home: "House",
  mail: "Mail",
  settings: "Settings",
  star: "Star",
  tag: "Tag",
  truck: "Truck",
  list: "List",
};

export function rootRoute(ir: SpecIR, t: Texts, auth: AuthIR, ux: UxIR): string {
  const pageRoute = new Map(ir.pages.map((p) => [p.id, p.route]));
  const iconOf = (id: string) => {
    const page = ir.pages.find((p) => p.id === id);
    return LUCIDE[page ? pageIcon(ux, page) : "list"];
  };
  const icons = [...new Set(ir.navigation.flatMap((m) => m.pages.map(iconOf)))].sort();
  const menus = ir.navigation.map((menu) => {
    const items = menu.pages.map(
      (id) =>
        `      {\n        to: ${JSON.stringify(pageRoute.get(id) ?? "/")},\n        label: ${JSON.stringify(t.pageTitle(id))},\n        icon: ${iconOf(id)},\n        access: pageAccess[${JSON.stringify(id)}],\n      },`,
    );
    const menuLabel = t.menuLabel(menu.name);
    const label = menuLabel === undefined ? "" : ` label: ${JSON.stringify(menuLabel)},`;
    return `  {\n    name: ${JSON.stringify(menu.name)},${label}\n    items: [\n${items.join("\n")}\n    ],\n  },`;
  });
  const signIn = hasSignIn(auth);
  // Landing and onboarding pages have their own frame instead of the app's navigation.
  const landings = ir.pages
    .filter((p) => p.pattern.kind === "landing" || p.pattern.kind === "onboarding")
    .map((p) => p.route);
  return `${HEADER}import { createRootRoute, HeadContent, Scripts${signIn ? ", useRouter" : ""}${landings.length ? ", useRouterState" : ""} } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
${icons.length ? `import { ${icons.join(", ")} } from "lucide-react";\n` : ""}import { app } from "#/generated/app";
import { pageAccess } from "#/generated/pages";
import { currentViewer } from "#/lib/viewer.server";
import { AppShell, ErrorNotice, type MenuUi } from "#/kit/AppShell";
import { pageHeaders } from "#/kit/security";
${signIn ? 'import { authClient } from "#/lib/auth-client";\n' : ""}import appCss from "#/styles.css?url";

const menus: MenuUi[] = [
${menus.join("\n")}
];
${landings.length ? `\nconst landingRoutes = ${literal(landings)};\n` : ""}

const getViewer = createServerFn().handler(() => currentViewer());

export const Route = createRootRoute({
  // Every page knows who is signed in; pages check their access with it.
  beforeLoad: async () => ({ viewer: await getViewer() }),
  headers: ({ ssr }) => pageHeaders(ssr?.nonce),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: app.name },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootDocument,
  errorComponent: ({ error }) => (
    <ErrorNotice title="Something went wrong" message={error instanceof Error ? error.message : undefined} />
  ),
  notFoundComponent: () => (
    <ErrorNotice title="Not found" message="This page or record does not exist, or you cannot see it." />
  ),
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const { viewer } = Route.useRouteContext();${
    landings.length
      ? `
  // Landing pages have their own frame instead of the app's navigation.
  const pathname = useRouterState({ select: (state) => state.location.pathname });`
      : ""
  }
${
  signIn
    ? `  const router = useRouter();
  const signOut = async () => {
    await authClient.signOut();
    await router.invalidate();
  };
`
    : ""
}  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        ${
          landings.length
            ? `{landingRoutes.includes(pathname) ? (
          children
        ) : (
          <AppShell appName={app.name} menus={menus} viewer={viewer}${signIn ? " onSignOut={signOut}" : ""}>
            {children}
          </AppShell>
        )}`
            : `<AppShell appName={app.name} menus={menus} viewer={viewer}${signIn ? " onSignOut={signOut}" : ""}>
          {children}
        </AppShell>`
        }
        <Scripts />
      </body>
    </html>
  );
}
`;
}

export function indexRoute(ir: SpecIR): string {
  const first = ir.navigation[0]?.pages[0] ?? ir.pages[0]?.id;
  const target = ir.pages.find((p) => p.id === first);
  if (!target) {
    return `${HEADER}import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "#/kit/AppShell";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  return <PageHeader title="Welcome" />;
}
`;
  }
  return `${HEADER}import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: ${JSON.stringify(target.route)} });
  },
});
`;
}
