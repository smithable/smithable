import { conditionArgs, conditionText } from "../condition.js";
import type { YamlEditor, YamlValue } from "../edit.js";
import type { PageIR } from "../ir.js";
import { SECTION_KINDS } from "../ir.js";
import { type AnyOperation, type Operation, OperationError, refTo } from "../operation.js";
import { isOwnSection, pageModel, partSections } from "../patterns.js";

/** Where a page's sections are written: a landing page's under "landing", any other's under "sections". */
function sectionsPath(page: PageIR): string[] {
  return ["pages", page.id, page.pattern.kind === "landing" ? "landing" : "sections"];
}

import { filterValueProblem } from "./list-keys.js";
import { checkFieldArg, FIELD_ARG, type FieldArg } from "./model-operations.js";
import { COMPONENT_PATTERN, FIELD_NAME_PATTERN, NAME_PATTERN, nameRule } from "./names.js";

const addPage: Operation<{ page: string; model: string; route?: string }> = {
  name: "addPage",
  summary:
    "Add a page that lists, shows, creates, edits and deletes a model, and add it to the main menu.",
  schema: {
    type: "object",
    required: ["page", "model"],
    additionalProperties: false,
    properties: {
      page: { type: "string", description: "Page name, e.g. invoices." },
      model: refTo({ ref: "model", label: "Kind of record" }),
      route: { type: "string", description: "Defaults to / plus the page name." },
    },
  },
  positional: ["page", "model", "route"],
  describe: ({ page, model }) => `Add page ${page} for ${model}`,
  destructive: () => false,
  apply({ spec }, { page, model, route }, ir) {
    if (!NAME_PATTERN.test(page)) {
      throw new OperationError(nameRule("page", page));
    }
    if (ir.pages.some((p) => p.id === page))
      throw new OperationError(`Page "${page}" already exists.`);
    if (!ir.models.some((m) => m.name === model))
      throw new OperationError(`There is no model named "${model}".`);
    spec.add(["pages"], page, route ? { route, crud: model } : { crud: model });
    addToMainMenu(spec, page);
    return [];
  },
};

const addLandingPage: Operation<{ page: string; route?: string; public?: boolean }> = {
  name: "addLandingPage",
  summary:
    "Add a landing page for visitors, starting with a hero and a footer (add more with addSection). It opens without sign-in unless public is false.",
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: {
      page: { type: "string", description: "Page name, e.g. home." },
      route: { type: "string", description: "Defaults to / when free, else / plus the page name." },
      public: { type: "boolean", description: "Open without sign-in (the default)." },
    },
  },
  positional: ["page", "route"],
  describe: ({ page }) => `Add landing page ${page}`,
  destructive: () => false,
  apply({ spec, auth }, { page, route, public: open = true }, ir) {
    if (!NAME_PATTERN.test(page)) throw new OperationError(nameRule("page", page));
    if (ir.pages.some((p) => p.id === page))
      throw new OperationError(`Page "${page}" already exists.`);
    const path = route ?? (ir.pages.some((p) => p.route === "/") ? `/${page}` : "/");
    spec.add(["pages"], page, { route: path, landing: { hero: {}, footer: {} } });
    // A landing page is for visitors: listed as public, so it opens without an account.
    if (open && auth) {
      const pages = auth.get(["public", "pages"]);
      if (Array.isArray(pages)) auth.set(["public", "pages"], [...(pages as string[]), page]);
      else auth.add(["public"], "pages", [page]);
    }
    return [];
  },
};

const addUsersPage: Operation<{ page?: string; route?: string }> = {
  name: "addUsersPage",
  summary:
    "Add a page where administrators invite people by email address with a role, change roles and remove users; it goes in the main menu. An app has one.",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      page: { type: "string", description: "Page name; team when left out." },
      route: { type: "string", description: "Defaults to / plus the page name." },
    },
  },
  positional: ["page", "route"],
  describe: ({ page = "team" }) => `Add users page ${page}`,
  destructive: () => false,
  apply({ spec, auth }, { page = "team", route }, ir) {
    if (!NAME_PATTERN.test(page)) throw new OperationError(nameRule("page", page));
    if (ir.pages.some((p) => p.id === page))
      throw new OperationError(`Page "${page}" already exists.`);
    const existing = ir.pages.find((p) => p.pattern.kind === "users");
    if (existing) throw new OperationError(`The ${existing.id} page already manages users.`);
    if (auth?.get(["signIn"]) === "none")
      throw new OperationError("A users page needs sign-in, and this app has none.");
    spec.add(["pages"], page, route ? { route, users: "manage" } : { users: "manage" });
    addToMainMenu(spec, page);
    return [];
  },
};

const addDataPage: Operation<{ page?: string; route?: string; models?: string[] }> = {
  name: "addDataPage",
  summary:
    "Add an administrators' page with every model's records (or the models named) to find, open, change and delete; it goes in the main menu.",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      page: { type: "string", description: "Page name; admin when left out." },
      route: { type: "string", description: "Defaults to / plus the page name." },
      models: refTo(
        { ref: "model", label: "Models" },
        { description: "Leave out for every model." },
        true,
      ),
    },
  },
  positional: ["page", "route", "...models"],
  describe: ({ page = "admin", models }) =>
    `Add data page ${page} (${models?.length ? models.join(", ") : "every model"})`,
  destructive: () => false,
  apply({ spec, auth }, { page = "admin", route, models }, ir) {
    if (!NAME_PATTERN.test(page)) throw new OperationError(nameRule("page", page));
    if (ir.pages.some((p) => p.id === page))
      throw new OperationError(`Page "${page}" already exists.`);
    if (auth?.get(["signIn"]) === "none")
      throw new OperationError(
        "A data page is for administrators: it needs sign-in, and this app has none.",
      );
    for (const m of models ?? [])
      if (!ir.models.some((x) => x.name === m))
        throw new OperationError(`There is no model named "${m}".`);
    const data = models?.length ? models : "all";
    spec.add(["pages"], page, route ? { route, data } : { data });
    addToMainMenu(spec, page);
    return [];
  },
};

const addReviewPage: Operation<{ page?: string; route?: string; models?: string[] }> = {
  name: "addReviewPage",
  summary:
    "Add the page where the pictures and files that wait for review (a model's review) are approved or rejected, for admins and the roles granted review; it goes in the main menu.",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      page: { type: "string", description: "Page name; review when left out." },
      route: { type: "string", description: "Defaults to / plus the page name." },
      models: refTo(
        { ref: "model", label: "Models" },
        { description: "Leave out for every model with review." },
        true,
      ),
    },
  },
  positional: ["page", "route", "...models"],
  describe: ({ page = "review", models }) =>
    `Add review page ${page} (${models?.length ? models.join(", ") : "every reviewed model"})`,
  destructive: () => false,
  apply({ spec, auth }, { page = "review", route, models }, ir) {
    if (!NAME_PATTERN.test(page)) throw new OperationError(nameRule("page", page));
    if (ir.pages.some((p) => p.id === page))
      throw new OperationError(`Page "${page}" already exists.`);
    if (auth?.get(["signIn"]) === "none")
      throw new OperationError(
        "A review page is for reviewers: it needs sign-in, and this app has none.",
      );
    for (const m of models ?? [])
      if (!ir.models.some((x) => x.name === m))
        throw new OperationError(`There is no model named "${m}".`);
    const review = models?.length ? models : "all";
    spec.add(["pages"], page, route ? { route, review } : { review });
    addToMainMenu(spec, page);
    return [];
  },
};

const addCalendarPage: Operation<{ page: string; model: string; starts?: string }> = {
  name: "addCalendarPage",
  summary:
    "Add a page showing a model's records in a week or month calendar, placed by a date or date-time field; it goes in the main menu.",
  schema: {
    type: "object",
    required: ["page", "model"],
    additionalProperties: false,
    properties: {
      page: { type: "string", description: "Page name, e.g. schedule." },
      model: refTo({ ref: "model", label: "Kind of record" }),
      starts: refTo(
        { ref: "field", model: "model", label: "Placed by" },
        { description: "Needed when the model has more than one date field." },
      ),
    },
  },
  positional: ["page", "model", "starts"],
  describe: ({ page, model }) => `Add calendar page ${page} for ${model}`,
  destructive: () => false,
  apply({ spec }, { page, model, starts }, ir) {
    if (!NAME_PATTERN.test(page)) throw new OperationError(nameRule("page", page));
    if (ir.pages.some((p) => p.id === page))
      throw new OperationError(`Page "${page}" already exists.`);
    if (!ir.models.some((m) => m.name === model))
      throw new OperationError(`There is no model named "${model}".`);
    spec.add(["pages"], page, { calendar: starts ? { model, starts } : model });
    addToMainMenu(spec, page);
    return [];
  },
};

const addOrderPage: Operation<{
  page: string;
  from: string;
  into: string;
  ask?: string[];
  route?: string;
}> = {
  name: "addOrderPage",
  summary:
    "Add a page where visitors choose records of one model (dishes) and send them as one order of another (with its lines and a number counting up); it is not in the menu.",
  schema: {
    type: "object",
    required: ["page", "from", "into"],
    additionalProperties: false,
    properties: {
      page: { type: "string", description: "Page name, e.g. menu." },
      from: refTo({ ref: "model", label: "Chosen from" }),
      into: refTo({ ref: "model", label: "An order is" }),
      ask: {
        type: "array",
        items: { type: "string" },
        description:
          "The order's fields the customer fills, in order, e.g. [name, phone, wanted, note].",
      },
      route: { type: "string", description: "Its address, e.g. / for the home page." },
    },
  },
  positional: ["page", "from", "into"],
  describe: ({ page, from, into }) => `Add order page ${page}: ${from} into ${into}`,
  destructive: () => false,
  apply({ spec }, { page, from, into, ask, route }, ir) {
    if (!NAME_PATTERN.test(page)) throw new OperationError(nameRule("page", page));
    if (ir.pages.some((p) => p.id === page))
      throw new OperationError(`Page "${page}" already exists.`);
    for (const model of [from, into])
      if (!ir.models.some((m) => m.name === model))
        throw new OperationError(`There is no model named "${model}".`);
    // What the models lack (a price, a list of lines, a number) validation says in words.
    spec.add(["pages"], page, {
      ...(route ? { route } : {}),
      order: { from, into, ...(ask?.length ? { ask } : {}) },
    });
    return [];
  },
};

const addArticlesPage: Operation<{ page: string; model: string }> = {
  name: "addArticlesPage",
  summary:
    "Add a page showing a model's records as articles (a blog or news): a list, and a page per article; it goes in the main menu.",
  schema: {
    type: "object",
    required: ["page", "model"],
    additionalProperties: false,
    properties: {
      page: { type: "string", description: "Page name, e.g. blog." },
      model: refTo({ ref: "model", label: "Kind of record" }),
    },
  },
  positional: ["page", "model"],
  describe: ({ page, model }) => `Add articles page ${page} for ${model}`,
  destructive: () => false,
  apply({ spec }, { page, model }, ir) {
    if (!NAME_PATTERN.test(page)) throw new OperationError(nameRule("page", page));
    if (ir.pages.some((p) => p.id === page))
      throw new OperationError(`Page "${page}" already exists.`);
    if (!ir.models.some((m) => m.name === model))
      throw new OperationError(`There is no model named "${model}".`);
    // The long form names nothing the reader cannot infer: validation says what is missing.
    spec.add(["pages"], page, { articles: model });
    addToMainMenu(spec, page);
    return [];
  },
};

const addCalculatorPage: Operation<{ page: string; fields: Record<string, FieldArg> }> = {
  name: "addCalculatorPage",
  summary:
    "Add a calculator page: fields written as a model's, the entered ones its inputs and the formula fields its results, stored nowhere; it goes in the main menu.",
  schema: {
    type: "object",
    required: ["page", "fields"],
    additionalProperties: false,
    properties: {
      page: { type: "string", description: "Page name, e.g. mortgage." },
      fields: {
        type: "object",
        additionalProperties: FIELD_ARG,
        description:
          'Field name → type shorthand, e.g. { "price": "money = 300000", "years": "int = 25" }; a result is a computed field, { "type": "money", "formula": "price / years" }.',
      },
    },
  },
  positional: ["page", "...fields"],
  describe: ({ page, fields }) =>
    `Add calculator page ${page} with ${Object.keys(fields).join(", ")}`,
  destructive: () => false,
  apply({ spec }, { page, fields }, ir) {
    if (!NAME_PATTERN.test(page)) throw new OperationError(nameRule("page", page));
    if (ir.pages.some((p) => p.id === page))
      throw new OperationError(`Page "${page}" already exists.`);
    if (!Object.keys(fields).length)
      throw new OperationError("A calculator needs at least one field, e.g. price=money.");
    for (const [f, value] of Object.entries(fields)) checkFieldArg(f, value);
    spec.add(["pages"], page, { calculator: { fields } });
    addToMainMenu(spec, page);
    return [];
  },
};

export const calculatorOperations: AnyOperation[] = [addCalculatorPage];

const addCustomPage: Operation<{ page: string; component: string }> = {
  name: "addCustomPage",
  summary:
    "Add a page of your own (a chart, a map, a planner): its component is created once in src/custom/pages/ and is yours; the route, access and menu entry stay Smithable's.",
  schema: {
    type: "object",
    required: ["page", "component"],
    additionalProperties: false,
    properties: {
      page: { type: "string", description: "Page name, e.g. planner." },
      component: { type: "string", description: "The component's name, e.g. Planner." },
    },
  },
  positional: ["page", "component"],
  describe: ({ page, component }) => `Add page ${page}, your own ${component}`,
  destructive: () => false,
  apply({ spec }, { page, component }, ir) {
    if (!NAME_PATTERN.test(page)) throw new OperationError(nameRule("page", page));
    if (ir.pages.some((p) => p.id === page))
      throw new OperationError(`Page "${page}" already exists.`);
    componentName(component);
    spec.add(["pages"], page, { custom: component });
    addToMainMenu(spec, page);
    return [];
  },
};

export const customOperations: AnyOperation[] = [addCustomPage];

/** A privacy page written from the app (docs/design/legal-page.md); public, linked from the footer. */
const addPrivacyPage: Operation<{ page?: string; route?: string }> = {
  name: "addPrivacyPage",
  summary:
    "Add a privacy page written from the app itself (who runs it, what it stores and why, cookies, mail, logs, rights); open to visitors and linked from the site's footer. The operator's name and contact go in smithable.content.yml.",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      page: { type: "string", description: 'Page name; "privacy" unless said otherwise.' },
      route: { type: "string", description: "Defaults to /privacy." },
    },
  },
  positional: ["page", "route"],
  describe: ({ page = "privacy" }) => `Add the privacy page ${page}`,
  destructive: () => false,
  apply({ spec, auth }, { page = "privacy", route }, ir) {
    if (!NAME_PATTERN.test(page)) throw new OperationError(nameRule("page", page));
    if (ir.pages.some((p) => p.id === page))
      throw new OperationError(`Page "${page}" already exists.`);
    if (ir.pages.some((p) => p.pattern.kind === "legal"))
      throw new OperationError("The app has a privacy page already.");
    const path = route ?? `/${page}`;
    if (ir.pages.some((p) => p.route === path))
      throw new OperationError(`Another page is at ${path} already.`);
    spec.add(["pages"], page, { route: path, legal: "privacy" });
    // For visitors: listed as public.
    if (auth) {
      const pages = auth.get(["public", "pages"]);
      if (Array.isArray(pages)) auth.set(["public", "pages"], [...(pages as string[]), page]);
      else auth.add(["public"], "pages", [page]);
    }
    return [];
  },
};

export const legalOperations: AnyOperation[] = [addPrivacyPage];

/** Puts a new page at the end of the main menu. */
function addToMainMenu(spec: YamlEditor, page: string): void {
  // Without a "navigation" key every page is in the main menu already.
  const navigation = spec.get(["navigation"]);
  if (Array.isArray(navigation)) spec.set(["navigation"], [...navigation, page]);
  else if (spec.has(["navigation", "main"])) {
    spec.set(["navigation", "main"], [...(spec.get(["navigation", "main"]) as string[]), page]);
  }
}

const addTile: Operation<{
  page: string;
  tile: string;
  measure: "count" | "sum" | "average" | "list" | "query";
  of: string;
  where?: Record<string, string | boolean | string[]>;
  by?: string;
  period?: string;
  limit?: number;
}> = {
  name: "addTile",
  summary:
    "Add a tile to a dashboard page (created, and added to the main menu, when it does not exist): a count, sum or average of records, a list of the latest ones, or a custom query's records.",
  schema: {
    type: "object",
    required: ["page", "tile", "measure", "of"],
    additionalProperties: false,
    properties: {
      page: refTo(
        { ref: "page", label: "Page" },
        { description: "The dashboard page, e.g. overview." },
      ),
      tile: {
        type: "string",
        pattern: FIELD_NAME_PATTERN.source,
        description: "The tile's name, camelCase, e.g. outstanding.",
      },
      measure: { type: "string", enum: ["count", "sum", "average", "list", "query"] },
      of: {
        type: "string",
        description:
          'A model for count and list ("Invoice"), a number field for sum and average ("Invoice.total"), a query name for query.',
      },
      where: {
        type: "object",
        description:
          'Only records with these values, e.g. { "status": "sent" } or { "status": "sent | overdue" }.',
      },
      by: {
        type: "string",
        description:
          "A date field (one bar per period), a choice field, or a reference's choice field like customer.segment (one bar per value).",
      },
      period: {
        type: "string",
        enum: ["week", "month", "quarter", "year"],
        description: "For a date by: the span of each bar; month unless said.",
      },
      limit: { type: "integer", minimum: 1, description: "For a list or query: how many records." },
    },
  },
  positional: ["page", "tile", "measure", "of"],
  describe: ({ page, tile, measure, of }) =>
    `Add tile ${tile} (${measure} of ${of}) to ${page === "dashboard" ? "the dashboard" : `the ${page} dashboard`}`,
  destructive: () => false,
  apply({ spec }, { page, tile, measure, of, where, by, period, limit }, ir) {
    if (period && !by) throw new OperationError('"--period" goes with "--by" a date field.');
    const value = {
      [measure]: of,
      ...(where && Object.keys(where).length ? { where: conditionArgs(where) } : {}),
      ...(by ? { by } : {}),
      ...(period ? { period } : {}),
      ...(limit ? { limit } : {}),
    };
    if (!FIELD_NAME_PATTERN.test(tile)) throw new OperationError(nameRule("tile", tile));
    const existing = ir.pages.find((p) => p.id === page);
    if (!existing) {
      if (!NAME_PATTERN.test(page)) throw new OperationError(nameRule("page", page));
      spec.add(["pages"], page, { dashboard: { [tile]: value } });
      addToMainMenu(spec, page);
    } else if (existing.pattern.kind !== "dashboard") {
      throw new OperationError(
        `Page "${page}" is a ${existing.pattern.kind} page, not a dashboard.`,
      );
    } else if (existing.pattern.items.some((i) => i.name === tile)) {
      throw new OperationError(`The ${page} dashboard already has a tile named "${tile}".`);
    } else {
      spec.add(["pages", page, "dashboard"], tile, value);
    }
    return [];
  },
};

const setNavigation: Operation<{ menu: string; pages: string[] }> = {
  name: "setNavigation",
  summary:
    "Set which pages a menu shows, in order. The list replaces the menu: include every page that stays.",
  schema: {
    type: "object",
    required: ["menu", "pages"],
    additionalProperties: false,
    properties: {
      menu: refTo({ ref: "menu", label: "Menu" }),
      pages: refTo({ ref: "page", label: "Pages" }, {}, true),
    },
  },
  positional: ["menu", "...pages"],
  describe: ({ menu, pages }, ir) => {
    // A page that leaves the menu is easy to miss in a list: name it.
    const before = ir.navigation.find((m) => m.name === menu)?.pages ?? [];
    const dropped = before.filter((p) => !pages.includes(p));
    return `Set the ${menu} menu to ${pages.join(", ")}${dropped.length ? ` (no longer in it: ${dropped.join(", ")})` : ""}`;
  },
  destructive: () => false,
  apply({ spec }, { menu, pages }, ir) {
    const unknown = pages.filter((p) => !ir.pages.some((page) => page.id === p));
    if (unknown.length)
      throw new OperationError(
        `Unknown page${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}.`,
      );
    const navigation = spec.get(["navigation"]);
    if (menu === "main" && (navigation === undefined || Array.isArray(navigation))) {
      if (navigation === undefined) spec.add([], "navigation", pages);
      else spec.set(["navigation"], pages);
    } else if (navigation === undefined) {
      // The implicit main menu (every page) becomes explicit next to the new menu.
      spec.add([], "navigation", { main: ir.pages.map((p) => p.id), [menu]: pages });
    } else if (Array.isArray(navigation)) {
      // Turn the single main menu into named menus.
      spec.set(["navigation"], { main: navigation as string[], [menu]: pages });
    } else if (spec.has(["navigation", menu])) {
      spec.set(["navigation", menu], pages);
    } else {
      spec.add(["navigation"], menu, pages);
    }
    return [];
  },
};

const setSearch: Operation<{ page: string; fields?: string[] }> = {
  name: "setSearch",
  summary: "Let a page's list be searched by these fields, or remove the search (no fields).",
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      fields: refTo(
        { ref: "field", page: "page", label: "Search by" },
        { description: "Text, email, phone, web address or choice fields of the page's model." },
        true,
      ),
    },
  },
  positional: ["page", "...fields"],
  describe: ({ page, fields }) =>
    fields?.length ? `Search ${page} by ${fields.join(", ")}` : `Remove the search from ${page}`,
  destructive: () => false,
  apply({ spec }, { page, fields = [] }, ir) {
    if (!ir.pages.some((p) => p.id === page))
      throw new OperationError(`There is no page named "${page}".`);
    const path = ["pages", page, "search"];
    if (fields.length === 0) {
      if (spec.has(path)) spec.remove(path);
    } else if (spec.has(path)) spec.set(path, fields);
    else spec.add(["pages", page], "search", fields);
    return [];
  },
};

/** An operation like setSearch for one of a list's other field lists (filters, sortable). */
function listKeyOperation(
  key: "filters" | "sortable",
  summary: string,
  label: string,
  description: string,
  describe: (page: string, fields: string[]) => string,
): Operation<{ page: string; fields?: string[] }> {
  return {
    name: key === "filters" ? "setFilters" : "setSortable",
    summary,
    schema: {
      type: "object",
      required: ["page"],
      additionalProperties: false,
      properties: {
        page: refTo({ ref: "page", label: "Page" }),
        fields: refTo({ ref: "field", page: "page", label }, { description }, true),
      },
    },
    positional: ["page", "...fields"],
    describe: ({ page, fields }) => describe(page, fields ?? []),
    destructive: () => false,
    apply(editors, { page, fields = [] }, ir) {
      const { spec } = editors;
      if (!ir.pages.some((p) => p.id === page))
        throw new OperationError(`There is no page named "${page}".`);
      const path = ["pages", page, key];
      if (fields.length === 0) {
        if (spec.has(path)) spec.remove(path);
      } else if (spec.has(path)) spec.set(path, fields);
      else spec.add(["pages", page], key, fields);
      if (key === "filters") {
        // A filter that goes takes its default and its place among those shown first with it.
        const defaults = ["pages", page, "defaultFilter"];
        for (const name of Object.keys(
          spec.has(defaults) ? (spec.get(defaults) as Record<string, unknown>) : {},
        ))
          if (!fields.includes(name)) spec.removeAndPrune([...defaults, name], 3);
        const shown = ["pages", page, "filters", "shown"];
        const ux = editors.ux;
        if (ux?.has(shown)) {
          const kept = (ux.get(shown) as string[]).filter((name) => fields.includes(name));
          if (kept.length) ux.set(shown, kept);
          else ux.removeAndPrune(shown, 0);
        }
      }
      return [];
    },
  };
}

const setFilters = listKeyOperation(
  "filters",
  "Let a page's list be filtered by these fields (choices, references, numbers, dates, yes/no), or remove the filters (no fields).",
  "Filter by",
  "Choice, reference, number, amount, date or yes/no fields of the page's model.",
  (page, fields) =>
    fields.length ? `Filter ${page} by ${fields.join(", ")}` : `Remove the filters from ${page}`,
);

const setSortable = listKeyOperation(
  "sortable",
  "Let a page's list be sorted by these fields from a Sort by control, or remove the choice (no fields).",
  "Sort by",
  "Stored fields of the page's model with an order: not pictures or long text.",
  (page, fields) =>
    fields.length ? `Sort ${page} by ${fields.join(", ")}` : `Remove the sort choice from ${page}`,
);

const setDefaultFilter: Operation<{ page: string; field: string; value: string }> = {
  name: "setDefaultFilter",
  summary:
    'What a page\'s list is filtered by until the viewer chooses: a filter and its value, as the address carries it (startsAt upcoming; status "open,pending"); "none" takes the default away.',
  schema: {
    type: "object",
    required: ["page", "field", "value"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      field: refTo(
        { ref: "field", page: "page", label: "Filter" },
        { description: "One of the page's filters." },
      ),
      value: {
        type: "string",
        description:
          'A date filter: upcoming, past, today, thisWeek, thisMonth or a range (2026-01-01..); a number: a range (10..500); a choice: its values, comma-separated; yes/no: true or false; owner: mine; a person: me or none. "none" removes the default.',
      },
    },
  },
  positional: ["page", "field", "value"],
  describe: ({ page, field, value }) =>
    value === "none"
      ? `Open ${page} without a default ${field} filter`
      : `Open ${page} filtered by ${field}: ${value}`,
  destructive: () => false,
  apply({ spec }, { page, field, value }, ir) {
    const p = ir.pages.find((x) => x.id === page);
    if (!p) throw new OperationError(`There is no page named "${page}".`);
    const path = ["pages", page, "defaultFilter", field];
    if (value === "none") {
      if (spec.has(path)) spec.removeAndPrune(path, 3);
      return [];
    }
    if (!p.filters?.includes(field))
      throw new OperationError(
        `"${field}" is not among the filters of ${page}${p.filters?.length ? ` (${p.filters.join(", ")})` : ""}; add it with setFilters first.`,
      );
    const model = ir.models.find((m) => m.name === pageModel(p));
    const problem = model ? filterValueProblem(model, field, value.trim()) : undefined;
    if (problem) throw new OperationError(problem);
    // Several values are a list for a choice or a person; a range keeps its decimal comma.
    const f = model?.fields.find((x) => x.name === field);
    const listed =
      f?.type.kind === "choice" || (f?.type.kind === "relation" && f.type.model === "User");
    const parts = listed ? value.split(",").map((v) => v.trim()) : [value.trim()];
    const written: YamlValue =
      parts.length > 1 ? parts : value === "true" ? true : value === "false" ? false : value.trim();
    if (spec.has(path)) spec.set(path, written);
    else if (spec.has(["pages", page, "defaultFilter"]))
      spec.add(["pages", page, "defaultFilter"], field, written);
    else spec.add(["pages", page], "defaultFilter", { [field]: written });
    return [];
  },
};

const setFavorites: Operation<{ page: string; mode?: "on" | "only" | "off" }> = {
  name: "setFavorites",
  summary:
    "Let people save a page's records (a heart on each, and a Saved view), list only the viewer's saved ones (only), or remove favorites (off).",
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      mode: {
        type: "string",
        enum: ["on", "only", "off"],
        description:
          "on: a heart and a Saved view (default); only: the viewer's saved records; off: none.",
      },
    },
  },
  positional: ["page", "mode"],
  describe: ({ page, mode = "on" }) =>
    mode === "off"
      ? `Remove favorites from ${page}`
      : mode === "only"
        ? `Make ${page} list the viewer's saved records`
        : `Let people save records on ${page}`,
  destructive: () => false,
  apply({ spec }, { page, mode = "on" }, ir) {
    if (!ir.pages.some((p) => p.id === page))
      throw new OperationError(`There is no page named "${page}".`);
    const path = ["pages", page, "favorites"];
    if (mode === "off") {
      if (spec.has(path)) spec.remove(path);
      return [];
    }
    const value = mode === "only" ? "only" : true;
    if (spec.has(path)) spec.set(path, value);
    else spec.add(["pages", page], "favorites", value);
    return [];
  },
};

const setMine: Operation<{ page: string; mode?: "on" | "off" }> = {
  name: "setMine",
  summary:
    "Make a page list only the viewer's own records (my items, my orders), or every record again (off).",
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      mode: { type: "string", enum: ["on", "off"], description: "on (default) or off." },
    },
  },
  positional: ["page", "mode"],
  describe: ({ page, mode = "on" }) =>
    mode === "off"
      ? `Make ${page} list every record again`
      : `Make ${page} list only the viewer's own records`,
  destructive: () => false,
  apply({ spec }, { page, mode = "on" }, ir) {
    if (!ir.pages.some((p) => p.id === page))
      throw new OperationError(`There is no page named "${page}".`);
    const path = ["pages", page, "mine"];
    if (mode === "off") {
      if (spec.has(path)) spec.remove(path);
    } else if (spec.has(path)) spec.set(path, true);
    else spec.add(["pages", page], "mine", true);
    return [];
  },
};

const setContact: Operation<{ page: string; to?: string; keep?: string }> = {
  name: "setContact",
  summary:
    "Give a page's record page a contact block that mails the record's owner (or the user a field names), optionally keeping a copy in a model; no recipient removes it.",
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      to: refTo(
        { ref: "field", page: "page", label: "Mail to" },
        { description: "owner, or a user field of the page's model, e.g. seller." },
      ),
      keep: refTo(
        { ref: "model", label: "Keep a copy in" },
        { description: "A model of its own for messages, with no links to other records." },
      ),
    },
  },
  positional: ["page", "to"],
  describe: ({ page, to, keep }) =>
    to
      ? `Let people contact the ${to} of a record on ${page}${keep ? `, keeping each message in ${keep}` : ""}`
      : `Remove the contact block from ${page}`,
  destructive: () => false,
  apply({ spec }, { page, to, keep }, ir) {
    if (!ir.pages.some((p) => p.id === page))
      throw new OperationError(`There is no page named "${page}".`);
    const path = ["pages", page, "contact"];
    if (!to) {
      if (spec.has(path)) spec.remove(path);
      return [];
    }
    const value = keep ? { to, keep } : to;
    if (spec.has(path)) spec.set(path, value);
    else spec.add(["pages", page], "contact", value);
    return [];
  },
};

const removePage: Operation<{ page: string }> = {
  name: "removePage",
  summary: "Remove a page, from the menus too. Its records and their data stay.",
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: { page: refTo({ ref: "page", label: "Page" }) },
  },
  positional: ["page"],
  describe: ({ page }) => `Remove page ${page}`,
  destructive: () => false,
  apply({ spec }, { page }, ir) {
    if (!ir.pages.some((p) => p.id === page))
      throw new OperationError(`There is no page named "${page}".`);
    if (ir.pages.length === 1) throw new OperationError("An app needs at least one page.");
    spec.removeAndPrune(["pages", page], 0);
    // Out of every menu: a list (the main menu) or named menus.
    const navigation = spec.get(["navigation"]);
    if (Array.isArray(navigation))
      spec.set(
        ["navigation"],
        (navigation as string[]).filter((p) => p !== page),
      );
    else if (navigation && typeof navigation === "object")
      for (const [menu, pages] of Object.entries(navigation as Record<string, string[]>))
        if (pages.includes(page))
          spec.set(
            ["navigation", menu],
            pages.filter((p) => p !== page),
          );
    // Its texts and presentation go with it (the companions follow the effect).
    return [{ kind: "remove-page", page }];
  },
};

const renamePage: Operation<{ from: string; to: string }> = {
  name: "renamePage",
  summary:
    "Rename a page. Its menus, grants, texts and look follow; without a route of its own, its address becomes / plus the new name.",
  schema: {
    type: "object",
    required: ["from", "to"],
    additionalProperties: false,
    properties: {
      from: refTo({ ref: "page", label: "Page" }),
      to: { type: "string", description: "The new name, like invoices." },
    },
  },
  positional: ["from", "to"],
  describe: ({ from, to }) => `Rename page ${from} to ${to}`,
  destructive: () => false,
  apply({ spec }, { from, to }, ir) {
    const page = ir.pages.find((p) => p.id === from);
    if (!page) throw new OperationError(`There is no page named "${from}".`);
    if (!NAME_PATTERN.test(to)) throw new OperationError(nameRule("page", to));
    if (to === from) throw new OperationError(`The page is already called ${from}.`);
    if (ir.pages.some((p) => p.id === to)) throw new OperationError(`Page "${to}" already exists.`);
    const ownRoute = spec.has(["pages", from, "route"]);
    // The key, the menus and the landing links are rewritten by applyOperation from the effect,
    // and the companions follow it (companion.ts).
    return [
      { kind: "rename-page", from, to },
      ...(ownRoute ? [] : [{ note: `its address is now /${to}` }]),
    ];
  },
};

/** A landing page's section kinds other than records, which any name can have. */
const KINDS = SECTION_KINDS.filter(
  (k) => k !== "records" && k !== "calculator" && k !== "custom" && k !== "text",
);

const componentName = (component: string) => {
  if (!COMPONENT_PATTERN.test(component))
    throw new OperationError(
      `A component is named like Planner: a capital letter, then letters and digits; not "${component}".`,
    );
};

const addSection: Operation<{
  page: string;
  section: string;
  records?: string;
  view?: "cards" | "table" | "calendar";
  starts?: string;
  where?: Record<string, string | boolean | string[]>;
  form?: string;
  button?: string;
  custom?: string;
  text?: boolean;
  kind?: string;
}> = {
  name: "addSection",
  summary: `Add a section to a page, below its others: one named after its kind (${KINDS.join(", ")}), or any name with records (a model's records as cards, a table or a calendar), text (a heading and paragraphs) or custom. Its texts go in smithable.content.yml.`,
  schema: {
    type: "object",
    required: ["page", "section"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }, { description: "The page, e.g. home or about." }),
      section: {
        type: "string",
        description: `A kind (${KINDS.join(", ")}) or, with records, text or custom, any name.`,
      },
      records: refTo(
        { ref: "model", label: "Records of" },
        { description: "A model whose records the section shows." },
      ),
      view: {
        type: "string",
        enum: ["cards", "table", "calendar"],
        description: "With records: as cards (the default), a table or a calendar.",
      },
      starts: {
        type: "string",
        description: "A calendar view: the date field the records are placed by.",
      },
      text: {
        type: "boolean",
        description:
          "A text section, any name: a heading and paragraphs from smithable.content.yml.",
      },
      kind: {
        type: "string",
        enum: [...KINDS],
        description: "A section of this kind under another name, e.g. a second faq called more.",
      },
      where: {
        type: "object",
        description:
          'With records: only those with these values, e.g. { "status": "investigating | identified" } or { "featured": "true" }.',
      },
      form: refTo(
        { ref: "model", label: "Form for" },
        { description: "A contact section's form: the model visitors add." },
      ),
      button: refTo(
        { ref: "page", label: "Button opens" },
        { description: "The page a hero's or call to action's button opens." },
      ),
      custom: {
        type: "string",
        description:
          "A section of your own, any name: its component in src/custom/sections/, e.g. RepaymentChart.",
      },
    },
  },
  positional: ["page", "section"],
  describe: ({ page, section }) => `Add a ${section} section to the ${page} page`,
  destructive: () => false,
  apply(
    { spec },
    { page, section, records, view, starts, where, form, button, custom, text, kind },
    ir,
  ) {
    const existing = ir.pages.find((p) => p.id === page);
    if (!existing) throw new OperationError(`There is no page named "${page}".`);
    if (existing.sections.some((s) => s.name === section))
      throw new OperationError(`The ${page} page already has a section named "${section}".`);
    if (custom) componentName(custom);
    if ([records, custom, text, kind].filter(Boolean).length > 1)
      throw new OperationError(
        "A section shows records, or is text, or is custom, or of a kind: one of them.",
      );
    const named = kind ?? ((KINDS as readonly string[]).includes(section) ? section : undefined);
    if (!records && !custom && !text && !named)
      throw new OperationError(
        `There is no section kind "${section}". Kinds: ${KINDS.join(", ")}; or give it records, text or custom.`,
      );
    if ((button || form) && !named)
      throw new OperationError(
        "Only a hero, call to action or contact section has a button or a form.",
      );
    if (where && Object.keys(where).length && !records)
      throw new OperationError('Only a section with records has a "where".');
    if ((view || starts) && !records)
      throw new OperationError("Only a section with records has a view.");
    if (starts && view !== "calendar")
      throw new OperationError('"starts" goes with the calendar view.');
    const options = {
      ...(records ? { records } : {}),
      ...(view && view !== "cards" ? { view } : {}),
      ...(starts ? { starts } : {}),
      ...(where && Object.keys(where).length ? { where: conditionArgs(where) } : {}),
      ...(form ? { form } : {}),
      ...(button ? { button } : {}),
      ...(custom ? { custom } : {}),
      ...(text ? { text: null } : {}),
      ...(kind ? { [kind]: null } : {}),
    };
    const path = sectionsPath(existing);
    if (spec.has(path) && spec.get(path) != null) spec.add(path, section, options);
    else if (spec.has(path)) spec.set(path, { [section]: options });
    else spec.add(["pages", page], path[2] as string, { [section]: options });
    return [];
  },
};

const removeSection: Operation<{ page: string; section: string }> = {
  name: "removeSection",
  summary:
    "Remove a section from a page, with its texts. A page kind's own part (a crud page's list) stays.",
  schema: {
    type: "object",
    required: ["page", "section"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      section: refTo({ ref: "section", page: "page", label: "Section" }),
    },
  },
  positional: ["page", "section"],
  describe: ({ page, section }) => `Remove the ${section} section from the ${page} page`,
  destructive: () => false,
  apply({ spec }, { page, section }, ir) {
    const existing = ir.pages.find((p) => p.id === page);
    const found = existing?.sections.find((s) => s.name === section);
    if (!existing || !found)
      throw new OperationError(`The ${page} page has no section named "${section}".`);
    if (isOwnSection(found))
      throw new OperationError(
        `The ${section} section is the ${page} page's own, as a ${existing.pattern.kind} page; remove the page or change its kind instead.`,
      );
    if (
      (existing.pattern.kind === "landing" || existing.pattern.kind === "sections") &&
      partSections(existing).length === 1
    )
      throw new OperationError(
        `A ${existing.pattern.kind === "landing" ? "landing page" : "page of sections"} needs at least one section.`,
      );
    // The last part taken away takes the empty "sections" with it; a landing keeps its map.
    spec.removeAndPrune(
      [...sectionsPath(existing), section],
      existing.pattern.kind === "landing" ? 3 : 2,
    );
    return [{ kind: "remove-section", page, section }];
  },
};

const setSectionWhere: Operation<{
  page: string;
  section: string;
  where?: Record<string, string | boolean | string[]>;
}> = {
  name: "setSectionWhere",
  summary:
    "Show only some of a records section's records: those with these values (none shows every record).",
  schema: {
    type: "object",
    required: ["page", "section"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      section: refTo({ ref: "section", page: "page", label: "Section" }),
      where: {
        type: "object",
        description:
          'Field values a record must have, e.g. { "status": "investigating | identified" } or { "featured": "true" }; none shows every record.',
      },
    },
  },
  positional: ["page", "section", "...where"],
  describe: ({ page, section, where }) =>
    Object.keys(where ?? {}).length
      ? `Show in the ${section} section of ${page} only records where ${conditionText(conditionArgs(where ?? {}))}`
      : `Show every record in the ${section} section of ${page}`,
  destructive: () => false,
  apply({ spec }, { page, section, where }, ir) {
    const existing = ir.pages.find((p) => p.id === page);
    const found = existing ? partSections(existing).find((s) => s.name === section) : undefined;
    if (!existing || !found)
      throw new OperationError(`The ${page} page has no section named "${section}".`);
    if (!found.model)
      throw new OperationError(`The ${section} section shows no records, so it has no "where".`);
    const at = [...sectionsPath(existing), section];
    const path = [...at, "where"];
    const conditions = conditionArgs(where ?? {});
    if (!Object.keys(conditions).length) {
      if (spec.has(path)) spec.remove(path);
    } else if (spec.has(path)) spec.set(path, conditions);
    else spec.add(at, "where", conditions);
    return [];
  },
};

const setShortcuts: Operation<{ page: string; pages?: string[] }> = {
  name: "setShortcuts",
  summary:
    "Give a landing page's hero up to four shortcuts to other pages, shown as round icons (no pages removes them).",
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Landing page" }, { description: "e.g. home." }),
      pages: refTo(
        { ref: "page", label: "Shortcuts to" },
        { description: "Up to four pages; their titles and icons are the shortcuts'." },
        true,
      ),
    },
  },
  positional: ["page", "...pages"],
  describe: ({ page, pages }) =>
    pages?.length
      ? `Give the ${page} hero shortcuts to ${pages.join(", ")}`
      : `Remove the shortcuts from the ${page} hero`,
  destructive: () => false,
  apply({ spec }, { page, pages = [] }, ir) {
    const existing = ir.pages.find((p) => p.id === page);
    const hero = existing?.sections.find((s) => s.kind === "hero");
    if (!existing || !hero) throw new OperationError(`The ${page} page has no hero.`);
    if (pages.length > 4) throw new OperationError("A hero has at most four shortcuts.");
    const at = [...sectionsPath(existing), hero.name];
    const path = [...at, "shortcuts"];
    if (pages.length === 0) {
      if (spec.has(path)) spec.remove(path);
    } else if (spec.has(path)) spec.set(path, pages);
    else if (spec.get(at) == null) spec.set(at, { shortcuts: pages });
    else spec.add(at, "shortcuts", pages);
    return [];
  },
};

/** Operations on pages of every pattern. */
export const pageOperations: AnyOperation[] = [renamePage, removePage];
/** Operations of the crud pattern. */
export const crudOperations: AnyOperation[] = [
  addPage,
  setSearch,
  setFilters,
  setDefaultFilter,
  setSortable,
  setFavorites,
  setContact,
  setMine,
];
/**
 * A hero's buttons: the first (the page it opens; without one, the first section's button or the
 * app's first page, as "Get started") and a second, an outline button beside it (none unless
 * given). "none" takes one away; a button not named stays as it is.
 */
const setHeroButtons: Operation<{ page: string; button?: string; secondButton?: string }> = {
  name: "setHeroButtons",
  summary:
    'Choose the pages a landing page\'s hero buttons open: its button and a second one beside it, an outline button ("none" takes one away). Their words are setText … button / secondButton.',
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Landing page" }, { description: "e.g. home." }),
      button: {
        type: "string",
        description:
          "The page the first button opens, or none (then the first section's button's page, else the app's first page).",
      },
      secondButton: {
        type: "string",
        description:
          "The page the second button opens, or none (no second button, the default). Its words default to the page's title.",
      },
    },
  },
  positional: ["page", "button", "secondButton"],
  describe: ({ page, button, secondButton }) =>
    [
      button &&
        (button === "none"
          ? `the ${page} hero's button opens its default page`
          : `the ${page} hero's button opens ${button}`),
      secondButton &&
        (secondButton === "none"
          ? `the ${page} hero has no second button`
          : `the ${page} hero's second button opens ${secondButton}`),
    ]
      .filter(Boolean)
      .join("; ")
      .replace(/^t/, "T") || `Leave the ${page} hero's buttons as they are`,
  destructive: () => false,
  apply({ spec }, { page, button, secondButton }, ir) {
    const existing = ir.pages.find((p) => p.id === page);
    const hero = existing?.sections.find((s) => s.kind === "hero");
    if (!existing || !hero) throw new OperationError(`The ${page} page has no hero.`);
    if (!button && !secondButton)
      throw new OperationError("Name a page for the button or the second button, or none.");
    const at = [...sectionsPath(existing), hero.name];
    for (const [key, target] of [
      ["button", button],
      ["secondButton", secondButton],
    ] as const) {
      if (!target) continue;
      const path = [...at, key];
      if (target === "none") {
        if (spec.has(path)) spec.removeAndPrune(path, at.length);
        continue;
      }
      if (!ir.pages.some((p) => p.id === target))
        throw new OperationError(`There is no page named "${target}".`);
      if (spec.has(path)) spec.set(path, target);
      else if (spec.get(at) == null) spec.set(at, { [key]: target });
      else spec.add(at, key, target);
    }
    return [];
  },
};

/** Operations of the landing pattern. */
const moveSection: Operation<{ page: string; section: string; before?: string; after?: string }> = {
  name: "moveSection",
  summary:
    "Move a page's section above or below another of its sections: they show in the order written. A page kind's own part moves once its name is among the sections.",
  schema: {
    type: "object",
    required: ["page", "section"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      section: refTo({ ref: "section", page: "page", label: "Section" }),
      before: refTo(
        { ref: "section", page: "page", label: "Above" },
        { description: "The section it goes above (one of before and after)." },
      ),
      after: refTo(
        { ref: "section", page: "page", label: "Below" },
        { description: "The section it goes below (one of before and after)." },
      ),
    },
  },
  positional: ["page", "section"],
  describe: ({ page, section, before, after }) =>
    `Move the ${section} section of the ${page} page ${before ? `above ${before}` : `below ${after}`}`,
  destructive: () => false,
  apply({ spec }, { page, section, before, after }, ir) {
    const existing = ir.pages.find((p) => p.id === page);
    // The sections as written: a page kind's own part is among them only when placed by name.
    let written = existing ? spec.get(sectionsPath(existing)) : undefined;
    // The page kind's own part is placed by writing its name among the sections, first.
    const own = existing?.sections.find((s) => s.own);
    if (existing && own && (section === own.name || before === own.name || after === own.name)) {
      const has = written && typeof written === "object" && own.name in (written as object);
      if (!has) {
        const path = sectionsPath(existing);
        const rest =
          written && typeof written === "object" ? (written as Record<string, unknown>) : {};
        if (spec.has(path)) spec.set(path, { [own.name]: null, ...rest } as YamlValue);
        else spec.add(["pages", page], path[2] as string, { [own.name]: null });
        written = spec.get(path);
      }
    }
    const names = written && typeof written === "object" ? Object.keys(written as object) : [];
    if (!existing || !names.includes(section))
      throw new OperationError(`The ${page} page has no section named "${section}".`);
    if ((before ? 1 : 0) + (after ? 1 : 0) !== 1)
      throw new OperationError(
        "Say which section it goes above (before) or below (after), one of them.",
      );
    const other = (before ?? after) as string;
    if (!names.includes(other))
      throw new OperationError(`The ${page} page has no section named "${other}".`);
    if (other === section) throw new OperationError("A section cannot be moved beside itself.");
    spec.move(sectionsPath(existing), section, before ? { before } : { after: other });
    return [];
  },
};

const addSectionsPage: Operation<{ page: string; route?: string }> = {
  name: "addSectionsPage",
  summary:
    "Add a page of parts and no kind (an about page), starting with a text section; add more with addSection. It is in the main menu.",
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: {
      page: { type: "string", description: "Page name, e.g. about." },
      route: { type: "string", description: "Defaults to / plus the page name." },
    },
  },
  positional: ["page", "route"],
  describe: ({ page }) => `Add page ${page}, a page of sections`,
  destructive: () => false,
  apply({ spec }, { page, route }, ir) {
    if (!NAME_PATTERN.test(page)) throw new OperationError(nameRule("page", page));
    if (ir.pages.some((p) => p.id === page))
      throw new OperationError(`Page "${page}" already exists.`);
    const sections = { intro: { text: null } };
    spec.add(["pages"], page, route ? { route, sections } : { sections });
    addToMainMenu(spec, page);
    return [];
  },
};

/** Operations of a page of sections. */
export const sectionsOperations: AnyOperation[] = [addSectionsPage];

export const landingOperations: AnyOperation[] = [
  addLandingPage,
  addSection,
  removeSection,
  moveSection,
  setSectionWhere,
  setShortcuts,
  setHeroButtons,
];
/** Operations of the dashboard pattern. */
export const dashboardOperations: AnyOperation[] = [addTile];
/** Operations of the calendar pattern. */
export const calendarOperations: AnyOperation[] = [addCalendarPage];
export const articlesOperations: AnyOperation[] = [addArticlesPage];
/** Operations of the order pattern (docs/design/orders.md §3). */
export const orderOperations: AnyOperation[] = [addOrderPage];
/** Operations of the data pattern. */
export const dataOperations: AnyOperation[] = [addDataPage];
export const reviewOperations: AnyOperation[] = [addReviewPage];
/** Operations of the users pattern. */
export const usersOperations: AnyOperation[] = [addUsersPage];
export const navigationOperations: AnyOperation[] = [setNavigation];
