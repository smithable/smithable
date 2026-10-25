// Each page pattern's routes, registered like the patterns themselves (PAGE_PATTERNS in core):
// the files a page of that pattern gets, and the kit files only such pages need.
import { type PageIR, type PatternKind, type PatternOf, partSections } from "@smithable/core";
import { calculatorRoute } from "../calculators.js";
import { hasKeys } from "../keys.js";
import { reviewFileRoute, reviewRoute } from "../review.js";
import { type GenContext, trashedLists } from "../shared.js";
import { articlesRoutes } from "./articles.js";
import { calendarRoute } from "./calendar.js";
import { customRoute } from "./custom.js";
import { dashboardRoute } from "./dashboard.js";
import { activityRoute, dataRoutes } from "./data.js";
import { landingRoute } from "./landing.js";
import { legalRoute } from "./legal.js";
import { listRoute } from "./list.js";
import { orderRoute } from "./order.js";
import { allTrashRoute, detailRoute, newRoute, recordPageRoute, trashRoute } from "./record.js";
import { usersRoute } from "./users.js";

type PageOf<K extends PatternKind> = PageIR & { pattern: PatternOf<K> };

export const PAGE_GENERATORS: {
  [K in PatternKind]: {
    /** Kit files only apps with a page of this pattern need. */
    kit?: string[];
    /** Its route files, by name in the page's route folder. */
    routes(page: PageOf<K>, ctx: GenContext): Record<string, string>;
  };
} = {
  order: {
    kit: ["src/kit/OrderPage.tsx", "src/kit/hours.ts"],
    routes: (page, ctx) => ({ "index.tsx": orderRoute(page, ctx) }),
  },
  crud: {
    routes(page, { ir, t, ux, auth, options }): Record<string, string> {
      const model = ir.models.find((m) => m.name === page.pattern.model);
      if (!model) return {};
      const custom = options.customPages?.includes(page.id) ?? false;
      return {
        "index.tsx": listRoute(page, model, t, ir, custom, ux, undefined, auth),
        "new.tsx": newRoute(page, model, t, ir, ux),
        "$id.tsx": detailRoute(page, model, t, ir, ux, undefined, auth),
        ...(model.trash ? { "trash.tsx": trashRoute(page, model, t) } : {}),
      };
    },
  },
  landing: {
    kit: ["src/kit/Landing.tsx"],
    routes: (page, { ir, t, auth, ux }) => ({
      "index.tsx": landingRoute(page, page.pattern.sections, ir, t, auth, ux),
    }),
  },
  // A page of parts and no kind: laid out as a landing page's sections are, in the page's frame
  // (docs/design/page-sections.md §4), which the root gives it.
  sections: {
    kit: ["src/kit/Landing.tsx"],
    routes: (page, { ir, t, auth, ux }) => ({
      "index.tsx": landingRoute(page, page.sections, ir, t, auth, ux, false),
    }),
  },
  dashboard: {
    kit: ["src/kit/Dashboard.tsx", "src/kit/aggregate.ts"],
    routes: (page, { ir, t, ux, options }) => {
      const custom = options.customPages?.includes(page.id) ?? false;
      return {
        "index.tsx": dashboardRoute(page, page.pattern.items, ir, t, ux, custom),
      };
    },
  },
  settings: {
    routes: (page, { ir, t, auth }) => ({
      "index.tsx": recordPageRoute(page, page.pattern, ir, t, auth),
    }),
  },
  onboarding: {
    kit: ["src/kit/Onboarding.tsx"],
    routes: (page, { ir, t, auth }) => ({
      "index.tsx": recordPageRoute(page, page.pattern, ir, t, auth),
    }),
  },
  calculator: {
    kit: ["src/kit/Calculator.tsx"],
    routes: (page, { t, ux }) => ({ "index.tsx": calculatorRoute(page, t, ux) }),
  },
  calendar: {
    kit: ["src/kit/Calendar.tsx"],
    routes: (page, ctx) => ({ "index.tsx": calendarRoute(page, ctx) }),
  },
  articles: {
    kit: ["src/kit/Articles.tsx"],
    routes: articlesRoutes,
  },
  custom: {
    routes: (page, { t }) => ({ "index.tsx": customRoute(page, t) }),
  },
  legal: {
    kit: ["src/kit/LegalPage.tsx"],
    routes: (page, ctx) => ({ "index.tsx": legalRoute(page, ctx) }),
  },
  review: {
    // What waits for review, and the waiting file a reviewer opens (docs/design/file-review.md).
    kit: ["src/kit/Review.tsx", "src/kit/review-mail.server.ts"],
    routes: (page, { t }) => ({
      "index.tsx": reviewRoute(page, t),
      "file.$id.ts": reviewFileRoute(page),
    }),
  },
  data: {
    // An overview and each model's crud routes inside the page; no kit of its own.
    routes: (page, ctx) => dataRoutes(page, ctx),
  },
  users: {
    kit: ["src/kit/Users.tsx"],
    // Beside the team, the administrator's other pages: every trash and the activity
    // (docs/design/admin.md).
    routes: (page, { ir, t, auth }) => ({
      "index.tsx": usersRoute(page, ir, t, auth),
      ...(trashedLists(ir).length ? { "trash.tsx": allTrashRoute(page, ir, t) } : {}),
      "activity.tsx": activityRoute(page, { ir, t }, hasKeys(ir, auth)),
    }),
  },
};

/**
 * A page's route files (the lookup TypeScript cannot type). A kind's page with parts beside its
 * own (docs/design/page-sections.md §2) gets them from a module beside its route (a "-" file,
 * which is no route), around its own component.
 */
export function pageRoutes(page: PageIR, ctx: GenContext): Record<string, string> {
  const generator = PAGE_GENERATORS[page.pattern.kind] as (typeof PAGE_GENERATORS)["crud"];
  const files = generator.routes(page as PageOf<"crud">, ctx);
  const index = files["index.tsx"];
  // Records beside a kind need the route's loader: a page of sections shows them for now.
  const parts = page.sections.filter((s) => s.own || !s.model);
  const kind = page.pattern.kind;
  if (kind === "landing" || kind === "sections" || !index || !partSections(page).length)
    return files;
  const module = `-${page.id}-parts`;
  const own = /\n {2}component: (\w+),\n/;
  const component = own.exec(index)?.[1];
  if (!component) return files;
  return {
    ...files,
    [`${module}.tsx`]: landingRoute(page, parts, ctx.ir, ctx.t, ctx.auth, ctx.ux, "parts"),
    "index.tsx": index
      .replace(
        "\nexport const Route",
        () =>
          `import { After as PartsAfter, Before as PartsBefore } from "./${module}";\n\nexport const Route`,
      )
      .replace(
        own,
        () =>
          `\n  component: () => (\n    <>\n      <PartsBefore />\n      <${component} />\n      <PartsAfter />\n    </>\n  ),\n`,
      ),
  };
}
