// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import {
  type AnalyticsSetting,
  type AuthIR,
  type ContentIR,
  type Icon,
  pageAccess,
  pageIcon,
  type SpecIR,
  type UxIR,
} from "@smithable/core";
import { analyticsConstants } from "../analytics.js";
import { hasSignIn } from "../auth.js";
import { HEADER, literal, type Texts } from "../shared.js";
import { publicArticles } from "./articles.js";

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

export function rootRoute(
  ir: SpecIR,
  t: Texts,
  auth: AuthIR,
  ux: UxIR,
  analytics?: AnalyticsSetting,
  consent?: ContentIR["consent"],
): string {
  // The consent bar's link to the privacy page, when the app has one (docs/design/analytics.md).
  const privacy = ir.pages.find((p) => p.id === "privacy")?.route;
  const consentProps = `${consent ? ` texts={${JSON.stringify(consent)}}` : ""}${privacy ? ` privacy=${JSON.stringify(privacy)}` : ""}`;
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
  // "Ask" in the app (docs/design/assistant.md §6): the button and its answers, for the people
  // the auth file's assistant block names.
  const asking = Boolean(auth.assistant);
  // A change Ask proposed is made once the person confirms it (may: change).
  const confirming = auth.assistant?.may === "change";
  // Landing and onboarding pages have their own frame instead of the app's navigation.
  const start = ir.pages.find((p) => p.route === "/");
  const home = start ? ` home={{ to: "/", access: pageAccess[${JSON.stringify(start.id)}] }}` : "";
  const landings = ir.pages
    .filter((p) => p.pattern.kind === "landing" || p.pattern.kind === "onboarding")
    .map((p) => p.route);
  // Public articles have the site's frame too, their list and every article under it.
  const sites = ir.pages.filter((p) => publicArticles(p, { auth })).map((p) => p.route);
  // Other public pages (a schedule) and sign-in have the site's frame for visitors, the app's for those
  // signed in; only in an app with sign-in and a site (its landing page or blog).
  // A public catalog at "/" (marketplace.md §2.5) is a site of its own, with or without a
  // landing page.
  const catalog = ir.pages.some(
    (p) => p.route === "/" && p.pattern.kind === "crud" && auth.public.pages.includes(p.id),
  );
  const visitorPages =
    signIn && (ir.pages.some((p) => p.pattern.kind === "landing") || sites.length || catalog)
      ? ir.pages
          .filter(
            (p) =>
              auth.public.pages.includes(p.id) &&
              !["landing", "onboarding", "articles"].includes(p.pattern.kind),
          )
          .map((p) => p.route)
          // Signing in is a visitor's page too: the frame stays the site's until signed in.
          .concat("/sign-in")
      : [];
  // A path under a visitor page; under a catalog at "/", only its records and new form.
  const under = `pathname.startsWith(\`\${r}/\`)`;
  const framedBySite = sites.length
    ? `landingRoutes.includes(pathname) || siteRoutes.some((r) => pathname === r || pathname.startsWith(\`\${r}/\`))`
    : "landingRoutes.includes(pathname)";
  // Each page's route, longest first: the page a path is on names it for custom styles.
  const pageRoutes = [...ir.pages]
    .sort((a, b) => b.route.length - a.route.length || (a.route < b.route ? -1 : 1))
    .map((p) => [p.route, p.id]);
  return `${HEADER}import { createRootRoute, HeadContent, Scripts${signIn ? ", useRouter" : ""}, useRouterState } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
${icons.length ? `import { ${icons.join(", ")} } from "lucide-react";\n` : ""}import { app } from "#/generated/app";
${ir.pages.length ? 'import { pageAccess } from "#/generated/pages";\n' : ""}import { currentViewer } from "#/lib/viewer.server";
import { AppShell, ErrorNotice, type MenuUi } from "#/kit/AppShell";${asking ? `\nimport { Ask } from "#/kit/Ask";\nimport { z } from "zod";\nimport { ask, asks${confirming ? ", confirm" : ""} } from "#/generated/ask.server";` : ""}${confirming ? '\nimport { getRequestHeaders } from "@tanstack/react-start/server";' : ""}${visitorPages.length ? '\nimport { LandingLayout } from "#/kit/Landing";\nimport { site } from "#/generated/site";' : ""}
import { Consent } from "#/kit/Consent";
${analytics ? 'import { type Analytics, startAnalytics } from "#/kit/consent";\n' : ""}import { pageHeaders } from "#/kit/security";
import { w } from "#/kit/words";
${signIn ? 'import { authClient } from "#/lib/auth-client";\n' : ""}import appCss from "#/styles.css?url";

const menus: MenuUi[] = [
${menus.join("\n")}
];
${landings.length || sites.length ? `\nconst landingRoutes = ${literal(landings)};\n` : ""}${sites.length ? `/** Public articles: their list and each article have the site's frame. */\nconst siteRoutes = ${literal(sites)};\n` : ""}${visitorPages.length ? `/** Public pages that visitors see in the site's frame (signed in, the app's). */\nconst visitorRoutes = ${literal(visitorPages)};\n` : ""}
${analytics ? `${analyticsConstants(analytics)}\n` : ""}/** Each page's route and name, longest route first. */
const pageRoutes: [string, string][] = ${literal(pageRoutes)};

/** The page a path is on, e.g. "customers" for /customers/12 (see data-page, src/custom/styles.css). */
function pageOf(path: string): string | undefined {
  return pageRoutes.find(([route]) => path === route || path.startsWith(route === "/" ? "/" : \`\${route}/\`))?.[1];
}


// Who is signed in, and, when a hosting service runs a copy of the app's data from an earlier
// time to look at (DATA_AS_OF), that time.
${
  asking
    ? `const getViewer = createServerFn().handler(async () => {
  const viewer = await currentViewer();
  return {
    viewer,
    asOf: process.env.DATA_AS_OF,
    demo: process.env.DEMO_SIGN_IN === "1",
    asks: asks(viewer),
  };
});`
    : `const getViewer = createServerFn().handler(async () => ({
  viewer: await currentViewer(),
  asOf: process.env.DATA_AS_OF,
  demo: process.env.DEMO_SIGN_IN === "1",
}));`
}${
  asking
    ? `

/** A question to "Ask", answered as the person signed in (or a visitor), with what they may read. */
const askApp = createServerFn({ method: "POST" })
  .validator(z.object({ question: z.string().trim().min(1).max(500) }))
  .handler(async ({ data }) => ask(await currentViewer(), data.question));${
    confirming
      ? `

/** A change Ask proposed, made as the person once they confirm it (by the proposal's id alone). */
const confirmApp = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().max(100) }))
  .handler(async ({ data }) => {
    await confirm(await currentViewer(), data.id, getRequestHeaders());
    return null;
  });`
      : ""
  }`
    : ""
}

export const Route = createRootRoute({
  // Every page knows who is signed in; pages check their access with it.
  beforeLoad: () => getViewer(),
  headers: ({ ssr }) => pageHeaders(ssr?.nonce${analytics ? ", analyticsAllow" : ""}),
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
    <ErrorNotice title={w.errorTitle} message={error instanceof Error ? error.message : undefined} />
  ),
  notFoundComponent: () => (
    <ErrorNotice title={w.notFound} message={w.notFoundNote} />
  ),
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const { viewer, asOf, demo${asking ? ", asks" : ""} } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // Set once React has taken over the page in the browser, for tests that must not type or
  // click before the page's handlers are attached (body[data-hydrated]).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
${analytics ? "  useEffect(() => startAnalytics(analytics), []);\n" : ""}${
  signIn
    ? `  const router = useRouter();
  const signOut = async () => {
    await authClient.signOut();
    await router.invalidate();
  };
`
    : ""
}  return (
    <html lang=${JSON.stringify(t.language)}>
      <head>
        <HeadContent />
      </head>
      <body data-page={pageOf(pathname)} data-hydrated={hydrated ? "true" : undefined}>
        {asOf && (
          <p role="status" className="bg-warning px-4 py-2 text-center text-sm text-warning-foreground">
            A copy of this app's data as of {asOf.slice(0, 16).replace("T", " ")} UTC: changes made here are not kept.
          </p>
        )}
        {demo && (
          <p role="status" className="bg-warning px-4 py-2 text-center text-sm text-warning-foreground">
            This is a demo: sign in as anyone and try things; the data is reset every hour.
          </p>
        )}
        ${
          landings.length || sites.length || visitorPages.length
            ? `{${
                landings.length || sites.length
                  ? `${framedBySite} ? (
          children
        ) : `
                  : ""
              }${
                visitorPages.length
                  ? `!viewer && visitorRoutes.some((r) => pathname === r || ${catalog ? `(r === "/" ? /^\\/(new|\\d+)$/.test(pathname) : ${under})` : under}) ? (
          <LandingLayout appName={app.name} link={{ to: "/sign-in", label: w.signIn }} site={site}>
            <div className="mx-auto max-w-6xl px-5 py-10">{children}</div>
          </LandingLayout>
        ) : `
                  : ""
              }(
          <AppShell appName={app.name}${home} menus={menus} viewer={viewer}${signIn ? " onSignOut={signOut}" : ""}>
            {children}
          </AppShell>
        )}`
            : `<AppShell appName={app.name}${home} menus={menus} viewer={viewer}${signIn ? " onSignOut={signOut}" : ""}>
          {children}
        </AppShell>`
        }
${asking ? `        {asks && <Ask ask={(question) => askApp({ data: { question } })}${confirming ? " confirm={(id) => confirmApp({ data: { id } })}" : ""} />}\n` : ""}        <Consent${consentProps} />
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

/**
 * /robots.txt from `public`: search engines may read the public pages (and the records under
 * them), nothing else; with nothing public, nothing at all.
 */
export function robotsRoute(ir: SpecIR, auth: AuthIR): string {
  const allowed = ir.pages
    .filter((p) => auth.public.pages.includes(p.id))
    .map((p) => `Allow: ${p.route === "/" ? "/$" : p.route}`);
  // What public pages are made of: scripts and styles (rendered before indexing), pictures, and
  // record pictures (/files checks who may read each one).
  const parts = allowed.length ? ["Allow: /assets/", "Allow: /images/", "Allow: /files/"] : [];
  const text = ["User-agent: *", ...allowed, ...parts, "Disallow: /", ""].join("\n");
  return `${HEADER}import { createFileRoute } from "@tanstack/react-router";

const ROBOTS = ${JSON.stringify(text)};

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => new Response(ROBOTS, { headers: { "Content-Type": "text/plain; charset=utf-8" } }),
    },
  },
});
`;
}
