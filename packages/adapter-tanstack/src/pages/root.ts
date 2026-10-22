// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import {
  type AnalyticsSetting,
  type AuthIR,
  type ContentIR,
  type Icon,
  pageAccess,
  pageIcon,
  type PageIR,
  type SpecIR,
  type UxIR,
} from "@smithable/core";
import { analyticsConstants } from "../analytics.js";
import { hasSignIn } from "../auth.js";
import {
  adminPage,
  HEADER,
  join,
  literal,
  modelNamed,
  names,
  type Texts,
  trashedLists,
} from "../shared.js";
import { publicArticles } from "./articles.js";

// ── Routes ───────────────────────────────────────────────────────────────────

/** Who may open each page. */
export function pagesModule(ir: SpecIR, t: Texts, auth: AuthIR): string {
  const entries = Object.fromEntries(ir.pages.map((p) => [p.id, pageAccess(p, auth)]));
  const words = Object.fromEntries(ir.pages.map((p) => [p.id, t.page(p.id)]));
  // The page at / has the app's name alone as its tab's title.
  const home = ir.pages.filter((p) => p.route === "/").map((p) => p.id);
  const read = (text: string) => (t.translated ? `tx(${text})` : text);
  return `${HEADER}import type { Rule } from "#/kit/access";
import { app } from "#/generated/app";

/** Who may open each page. */
export const pageAccess = ${literal(entries)} satisfies Record<string, Rule>;

interface PageUi {
  title: string;
  subtitle?: string;
  description?: string;
}

/** Each page's words: the menus, its header and its tab read them here. */
export const pageUi = ${literal(words)} satisfies Record<string, PageUi>;

/** A route's head: the tab's title ("<page> · <app>", the page at / the app's name alone), and the description search engines show. */
export function pageHead(page: keyof typeof pageUi) {
  const ui: PageUi = pageUi[page];
  const title = ${home.length ? `${home.map((id) => `page === ${JSON.stringify(id)}`).join(" || ")} ? app.name : ` : ""}\`\${${read("ui.title")}} · \${app.name}\`;
  const described = ui.description ? [{ name: "description", content: ${read("ui.description")} }] : [];
  return { meta: [{ title }, ...described] };
}
`;
}

/** The lucide-react component for each navigation icon. */
// "shield" is the icon core gives the review and team pages without it being among the icons
// a ux file may choose: it needs its Lucide name too, or a page that shows it gets none.
export const LUCIDE: Record<Icon | "shield", string> = {
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
  shield: "Shield",
};

export function rootRoute(
  ir: SpecIR,
  t: Texts,
  auth: AuthIR,
  ux: UxIR,
  analytics?: AnalyticsSetting,
  consent?: ContentIR["consent"],
  assistant?: ContentIR["assistant"],
): string {
  // The consent bar's link to the privacy page, when the app has one (docs/design/analytics.md).
  const privacy = (
    ir.pages.find((p) => p.pattern.kind === "legal") ?? ir.pages.find((p) => p.id === "privacy")
  )?.route;
  const consentProps = `${consent ? ` texts={${JSON.stringify(consent)}}` : ""}${privacy ? ` privacy=${JSON.stringify(privacy)}` : ""}`;
  const pageRoute = new Map(ir.pages.map((p) => [p.id, p.route]));
  const iconOf = (id: string) => {
    const page = ir.pages.find((p) => p.id === id);
    return LUCIDE[page ? pageIcon(ux, page) : "list"];
  };
  // The users page leaves its menu for the last one, Admin, with every trash and the activity
  // (docs/design/admin.md).
  const team = adminPage(ir);
  const trash = team && trashedLists(ir).length > 0;
  const icons = [
    ...new Set([
      ...ir.navigation.flatMap((m) => m.pages.map(iconOf)),
      ...(team ? ["History", ...(trash ? ["Trash2"] : [])] : []),
    ]),
  ].sort();
  const item = (to: string, label: string, icon: string, id: string) =>
    `      {\n        to: ${JSON.stringify(to)},\n        label: ${label},\n        icon: ${icon},\n        access: pageAccess[${JSON.stringify(id)}],\n      },`;
  const admin = team
    ? `  {\n    name: "admin",\n    label: w.admin,\n    items: [\n${[
        item(team.route, t.pageTitleOf(team.id), iconOf(team.id), team.id),
        ...(trash ? [item(join(team.route, "trash"), "w.trashView", "Trash2", team.id)] : []),
        item(join(team.route, "activity"), "w.activity", "History", team.id),
      ].join("\n")}\n    ],\n  },`
    : undefined;
  const menus = ir.navigation.flatMap((menu) => {
    const pages = menu.pages.filter((id) => id !== team?.id);
    if (pages.length === 0) return [];
    const items = pages.map(
      (id) =>
        `      {\n        to: ${JSON.stringify(pageRoute.get(id) ?? "/")},\n        label: ${t.pageTitleOf(id)},\n        icon: ${iconOf(id)},\n        access: pageAccess[${JSON.stringify(id)}],\n      },`,
    );
    const menuLabel = t.menuLabel(menu.name);
    const label = menuLabel === undefined ? "" : ` label: ${JSON.stringify(menuLabel)},`;
    return [
      `  {\n    name: ${JSON.stringify(menu.name)},${label}\n    items: [\n${items.join("\n")}\n    ],\n  },`,
    ];
  });
  if (admin) menus.push(admin);
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
  // A page that says its frame in the ux file (docs/design/page-sections.md §4) has it for
  // everyone: site, the public frame with its menu; none, no frame at all; app, the shell. The
  // kinds with a frame of their own (landing, onboarding, a public blog) keep it.
  const ownFrame = (p: PageIR) =>
    p.pattern.kind === "landing" || p.pattern.kind === "onboarding" || publicArticles(p, { auth });
  const framed = (frame: "site" | "app" | "none") =>
    ir.pages.filter((p) => !ownFrame(p) && ux.pages[p.id]?.frame === frame).map((p) => p.route);
  const sitePages = framed("site");
  const barePages = framed("none");
  // The workspace: the pages in the shell, in the navigation's order; the site frame links to the
  // first the viewer may open.
  const workspace = sitePages.length
    ? ir.navigation
        .flatMap((m) => m.pages)
        .map((id) => ir.pages.find((p) => p.id === id) as PageIR)
        .filter(
          (p) =>
            p &&
            !ownFrame(p) &&
            !["site", "none"].includes(ux.pages[p.id]?.frame ?? "") &&
            !p.route.includes("$"),
        )
        .map((p) => `{ to: ${JSON.stringify(p.route)}, access: pageAccess[${JSON.stringify(p.id)}] }`)
    : [];
  const visitorPages =
    signIn &&
    (ir.pages.some((p) => p.pattern.kind === "landing") ||
      sites.length ||
      catalog ||
      sitePages.length)
      ? ir.pages
          .filter(
            (p) =>
              auth.public.pages.includes(p.id) &&
              !ux.pages[p.id]?.frame &&
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
  // The site frame's way in: the workspace for one who may open a page of it, else signing in.
  const enter = signIn ? `viewer ? undefined : { to: "/sign-in", label: w.signIn }` : "undefined";
  const siteLink = workspace.length
    ? `((page) => (page ? { to: page.to, label: w.workspace } : ${enter}))(workspacePages.find((p) => allows(p.access, viewer)))`
    : enter;
  // The review pages (docs/design/file-review.md): the menu shows how many files wait on each.
  const reviews = hasSignIn(auth)
    ? ir.pages.flatMap((p) =>
        p.pattern.kind === "review" ? [{ route: p.route, models: p.pattern.models }] : [],
      )
    : [];
  const reviewCounts = `{ ${reviews.map((r) => `${JSON.stringify(r.route)}: waitingCount(viewer, ${JSON.stringify(r.models)})`).join(", ")} }`;
  // Each page's route, longest first: the page a path is on names it for custom styles.
  const pageRoutes = [...ir.pages]
    .sort((a, b) => b.route.length - a.route.length || (a.route < b.route ? -1 : 1))
    .map((p) => [p.route, p.id]);
  return `${HEADER}import { createRootRoute, HeadContent, Scripts, ScriptOnce${signIn ? ", useRouter" : ""}, useRouterState } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
${icons.length ? `import { ${icons.join(", ")} } from "lucide-react";\n` : ""}import { app } from "#/generated/app";
${ir.pages.length ? 'import { pageAccess } from "#/generated/pages";\n' : ""}import { currentViewer } from "#/lib/viewer.server";
import { APPEARANCE_SCRIPT } from "#/kit/appearance";
import { AppShell, ErrorNotice, type MenuUi } from "#/kit/AppShell";${asking ? `\nimport { Ask } from "#/kit/Ask";\nimport { field } from "#/kit/params";\nimport { ask, asks${confirming ? ", confirm" : ""} } from "#/generated/ask.server";` : ""}${confirming ? '\nimport { getRequestHeaders } from "@tanstack/react-start/server";' : ""}${visitorPages.length || sitePages.length ? '\nimport { LandingLayout } from "#/kit/Landing";\nimport { site } from "#/generated/site";' : ""}${workspace.length ? '\nimport { allows } from "#/kit/access";' : ""}
import { Consent } from "#/kit/Consent";
${analytics ? 'import { type Analytics, startAnalytics } from "#/kit/consent";\n' : ""}import { pageHeaders } from "#/kit/security";${reviews.length ? '\nimport { waitingCount } from "#/generated/review.server";' : ""}
import { w } from "#/kit/words";${t.translated ? '\nimport { language } from "#/kit/words";\nimport { Alternates, LanguageSwitch } from "#/kit/Languages";' : ""}
${signIn ? 'import { authClient } from "#/lib/auth-client";\n' : ""}import appCss from "#/styles.css?url";

const menus: MenuUi[] = [
${menus.join("\n")}
];
${landings.length || sites.length ? `\nconst landingRoutes = ${literal(landings)};\n` : ""}${sites.length ? `/** Public articles: their list and each article have the site's frame. */\nconst siteRoutes = ${literal(sites)};\n` : ""}${visitorPages.length ? `/** Public pages that visitors see in the site's frame (signed in, the app's). */\nconst visitorRoutes = ${literal(visitorPages)};\n` : ""}${sitePages.length ? `/** Pages in the site's frame for everyone (their frame in smithable.ux.yml). */\nconst sitePageRoutes = ${literal(sitePages)};\n` : ""}${barePages.length ? `/** Pages with no frame: no menu, no header. */\nconst bareRoutes = ${literal(barePages)};\n` : ""}${workspace.length ? `/** The workspace's pages, in the menu's order: the site frame links to the first the viewer may open. */\nconst workspacePages = [\n  ${workspace.join(",\n  ")},\n] as const;\n` : ""}
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
    asks: asks(viewer),${reviews.length ? `\n    counts: ${reviewCounts},` : ""}
  };
});`
    : reviews.length
      ? `const getViewer = createServerFn().handler(async () => {
  const viewer = await currentViewer();
  return {
    viewer,
    asOf: process.env.DATA_AS_OF,
    demo: process.env.DEMO_SIGN_IN === "1",
    // How many files wait for the viewer's review, beside the review page in the menu.
    counts: ${reviewCounts},
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
  .validator((data: unknown) => ({ question: field(data, "question", 500) }))
  .handler(async ({ data }) => ask(await currentViewer(), data.question));${
    confirming
      ? `

/** A change Ask proposed, made as the person once they confirm it (by the proposal's id alone). */
const confirmApp = createServerFn({ method: "POST" })
  .validator((data: unknown) => ({ id: field(data, "id", 100) }))
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
      ${literal(t.icon)},
    ],
  }),
  shellComponent: RootDocument,
  errorComponent: ({ error }) => (
    <ErrorNotice title={w.errorTitle} message={error instanceof Error ? error.message : undefined} />
  ),
  notFoundComponent: () => (
    <ErrorNotice kind="not-found" title={w.notFound} message={w.notFoundNote} />
  ),
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const { viewer, asOf, demo${asking ? ", asks" : ""}${reviews.length ? ", counts" : ""} } = Route.useRouteContext();
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
  const rename = async (name: string) => {
    const { error } = await authClient.updateUser({ name });
    if (error) throw new Error(error.message);
    await router.invalidate();
  };
`
    : ""
}  return (
    // data-appearance is set by the head's script before React takes over (src/kit/appearance.ts).
    <html lang=${t.translated ? "{language()}" : JSON.stringify(t.language)} suppressHydrationWarning>
      <head>
        <ScriptOnce children={APPEARANCE_SCRIPT} />
        <HeadContent />${t.translated ? "\n        <Alternates path={pathname} />" : ""}
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
          landings.length || sites.length || visitorPages.length || sitePages.length || barePages.length
            ? `{${
                landings.length || sites.length
                  ? `${framedBySite} ? (
          children
        ) : `
                  : ""
              }${
                barePages.length
                  ? `bareRoutes.some((r) => pathname === r || ${under}) ? (
          children
        ) : `
                  : ""
              }${
                sitePages.length
                  ? `sitePageRoutes.some((r) => pathname === r || ${under}) ? (
          <LandingLayout appName={app.name}${t.logo} link={${siteLink}} site={site} viewer={viewer}${signIn ? " onSignOut={viewer ? signOut : undefined}" : ""}>
            <div className="mx-auto max-w-6xl px-5 py-10">{children}</div>
          </LandingLayout>
        ) : `
                  : ""
              }${
                visitorPages.length
                  ? `!viewer && visitorRoutes.some((r) => pathname === r || ${catalog ? `(r === "/" ? /^\\/(new|\\d+)$/.test(pathname) : ${under})` : under}) ? (
          <LandingLayout appName={app.name}${t.logo} link={{ to: "/sign-in", label: w.signIn }} site={site}>
            <div className="mx-auto max-w-6xl px-5 py-10">{children}</div>
          </LandingLayout>
        ) : `
                  : ""
              }(
          <AppShell appName={app.name}${t.logo}${home} menus={menus} viewer={viewer}${signIn ? " onSignOut={signOut} onRename={rename}" : ""}${reviews.length ? " counts={counts}" : ""}>
            {children}
          </AppShell>
        )}`
            : `<AppShell appName={app.name}${t.logo}${home} menus={menus} viewer={viewer}${signIn ? " onSignOut={signOut} onRename={rename}" : ""}${reviews.length ? " counts={counts}" : ""}>
          {children}
        </AppShell>`
        }
${asking ? `        {asks && <Ask ask={(question) => askApp({ data: { question } })}${confirming ? " confirm={(id) => confirmApp({ data: { id } })}" : ""}${assistant && Object.keys(assistant).length ? ` texts={${JSON.stringify(assistant)}}` : ""} />}\n` : ""}${t.translated ? "        <LanguageSwitch path={pathname} />\n" : ""}        <Consent${consentProps} />
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
  // With public pages, the sitemap's address too, at the site's own origin.
  const sitemap = allowed.length
    ? `\`\${ROBOTS}Sitemap: \${originOf(request)}/sitemap.xml\n\``
    : "ROBOTS";
  return `${HEADER}import { createFileRoute } from "@tanstack/react-router";${allowed.length ? '\nimport { originOf } from "#/kit/origin";' : ""}

const ROBOTS = ${JSON.stringify(text)};

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: (${allowed.length ? "{ request }" : ""}) => new Response(${sitemap}, { headers: { "Content-Type": "text/plain; charset=utf-8" } }),
    },
  },
});
`;
}

/**
 * /sitemap.xml: the public pages, and every article of a public blog by its address (read as a
 * visitor, so only what visitors may read). Only made when something is public.
 */
export function sitemapRoute(ir: SpecIR, auth: AuthIR, t: Texts): string {
  const pages = ir.pages.filter((p) => auth.public.pages.includes(p.id));
  const blogs = pages.filter((p) => p.pattern.kind === "articles");
  const imports = blogs.map((p) => {
    const n = names(modelNamed(ir, (p.pattern as { model: string }).model), t);
    return `import { ${n.data} } from "${n.module}.server";`;
  });
  const articles = blogs
    .map((p) => {
      const pattern = p.pattern as { model: string; address?: string };
      const n = names(modelNamed(ir, pattern.model), t);
      const address = pattern.address
        ? `String(row.${pattern.address} || row.id)`
        : "String(row.id)";
      return `    ...(await ${n.data}.list(null)).map((row) => ({ loc: \`${p.route === "/" ? "" : p.route}/\${encodeURIComponent(${address})}\`, lastmod: row.updatedAt })),`;
    })
    .join("\n");
  return `${HEADER}import { createFileRoute } from "@tanstack/react-router";
import { originOf } from "#/kit/origin";${t.translated ? '\nimport { OFFERED } from "#/generated/languages";' : ""}
${imports.join("\n")}${imports.length ? "\n" : ""}
const PAGES = ${JSON.stringify(pages.map((p) => p.route))};

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = originOf(request);
        const entries: { loc: string; lastmod?: string | Date | null }[] = [
          ...PAGES.map((route) => ({ loc: route })),
${articles}
        ]${t.translated ? `.flatMap((e) => [e, ...OFFERED.others.map((code) => ({ ...e, loc: \`/\${code}\${e.loc === "/" ? "" : e.loc}\` }))])` : ""};
        const body = \`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
\${entries
  .map(
    (e) =>
      \`  <url><loc>\${escape(origin + e.loc)}</loc>\${e.lastmod ? \`<lastmod>\${new Date(e.lastmod).toISOString().slice(0, 10)}</lastmod>\` : ""}</url>\`,
  )
  .join("\\n")}
</urlset>
\`;
        return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
      },
    },
  },
});
`;
}
