// Each page pattern's routes, registered like the patterns themselves (PAGE_PATTERNS in core):
// the files a page of that pattern gets, and the kit files only such pages need.
import type { PageIR, PatternKind, PatternOf } from "@smithable/core";
import { calculatorRoute } from "../calculators.js";
import type { GenContext } from "../shared.js";
import { articlesRoutes } from "./articles.js";
import { calendarRoute } from "./calendar.js";
import { dashboardRoute } from "./dashboard.js";
import { dataRoutes } from "./data.js";
import { landingRoute } from "./landing.js";
import { listRoute } from "./list.js";
import { detailRoute, newRoute, recordPageRoute } from "./record.js";
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
  crud: {
    routes(page, { ir, t, ux, auth, options }): Record<string, string> {
      const model = ir.models.find((m) => m.name === page.pattern.model);
      if (!model) return {};
      const custom = options.customPages?.includes(page.id) ?? false;
      return {
        "index.tsx": listRoute(page, model, t, ir, custom, ux),
        "new.tsx": newRoute(page, model, t, ir, ux),
        "$id.tsx": detailRoute(page, model, t, ir, ux, undefined, auth),
      };
    },
  },
  landing: {
    kit: ["src/kit/Landing.tsx"],
    routes: (page, { ir, t, auth, ux }) => ({
      "index.tsx": landingRoute(page, page.pattern.sections, ir, t, auth, ux),
    }),
  },
  dashboard: {
    kit: ["src/kit/Dashboard.tsx", "src/kit/aggregate.ts"],
    routes: (page, { ir, t, ux }) => ({
      "index.tsx": dashboardRoute(page, page.pattern.items, ir, t, ux),
    }),
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
  data: {
    // An overview and each model's crud routes inside the page; no kit of its own.
    routes: (page, ctx) => dataRoutes(page, ctx),
  },
  users: {
    kit: ["src/kit/Users.tsx"],
    routes: (page, { ir, t, auth }) => ({ "index.tsx": usersRoute(page, ir, t, auth) }),
  },
};

/** A page's route files (the lookup TypeScript cannot type). */
export function pageRoutes(page: PageIR, ctx: GenContext): Record<string, string> {
  const generator = PAGE_GENERATORS[page.pattern.kind] as (typeof PAGE_GENERATORS)["crud"];
  return generator.routes(page as PageOf<"crud">, ctx);
}
