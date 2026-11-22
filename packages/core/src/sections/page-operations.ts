import { conditionArgs, conditionText } from "../condition.js";
import { sectionTextKeys } from "../content.js";
import type { YamlEditor, YamlValue } from "../edit.js";
import type { DocumentIR, PageIR } from "../ir.js";
import { SECTION_KINDS } from "../ir.js";
import { type AnyOperation, type Operation, OperationError, refTo } from "../operation.js";
import { isOwnSection, LANDING_SECTIONS, pageModel, partSections } from "../patterns.js";

/** Where a page's sections are written: a landing page's under "landing", any other's under "sections". */
function sectionsPath(page: PageIR): string[] {
  return ["pages", page.id, page.pattern.kind === "landing" ? "landing" : "sections"];
}

import { DOCUMENT_BLOCKS, documentSchema } from "./document.js";
import { filterThrough, filterValueProblem } from "./list-keys.js";
import { checkFieldArg, FIELD_ARG, type FieldArg } from "./model-operations.js";
import { COMPONENT_PATTERN, FIELD_NAME_PATTERN, NAME_PATTERN, nameRule } from "./names.js";
import { hoursArg } from "./schedule-operations.js";

const addPage: Operation<{ page: string; model: string; route?: string }> = {
  name: "addPage",
  summary:
    "Add a page that lists, shows, creates, edits and deletes a model, and add it to the main menu.",
  sets: ["smithable.yml:pages.*", "smithable.yml:pages.*.route", "smithable.yml:pages.*.crud"],
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
  sets: [
    "smithable.yml:pages.*",
    "smithable.yml:pages.*.route",
    "smithable.yml:pages.*.landing",
    "smithable.yml:pages.*.landing.*.hero",
    "smithable.yml:pages.*.landing.*.footer",
  ],
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
  sets: ["smithable.yml:pages.*", "smithable.yml:pages.*.route", "smithable.yml:pages.*.users"],
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
  sets: ["smithable.yml:pages.*", "smithable.yml:pages.*.route", "smithable.yml:pages.*.data"],
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
  sets: ["smithable.yml:pages.*", "smithable.yml:pages.*.route", "smithable.yml:pages.*.review"],
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
  sets: [
    "smithable.yml:pages.*",
    "smithable.yml:pages.*.calendar",
    "smithable.yml:pages.*.calendar.model",
    "smithable.yml:pages.*.calendar.starts",
  ],
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
  sets: [
    "smithable.yml:pages.*",
    "smithable.yml:pages.*.route",
    "smithable.yml:pages.*.order",
    "smithable.yml:pages.*.order.from",
    "smithable.yml:pages.*.order.into",
    "smithable.yml:pages.*.order.ask",
  ],
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
  sets: ["smithable.yml:pages.*", "smithable.yml:pages.*.articles"],
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
  sets: [
    "smithable.yml:pages.*",
    "smithable.yml:pages.*.calculator",
    "smithable.yml:pages.*.calculator.fields",
  ],
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
  sets: ["smithable.yml:pages.*", "smithable.yml:pages.*.custom"],
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
  sets: ["smithable.yml:pages.*", "smithable.yml:pages.*.route", "smithable.yml:pages.*.legal"],
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

const setPeriod: Operation<{
  page: string;
  field?: string;
  byModel?: Record<string, string>;
}> = {
  name: "setPeriod",
  sets: ["smithable.yml:pages.*.period", "smithable.yml:pages.*.period.*"],
  summary:
    "Give a dashboard a period: the date field its tiles are scoped by, with chips on the page (none takes it away).",
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      field: { type: "string", description: "A date field every tile's model has, or none." },
      byModel: {
        type: "object",
        additionalProperties: { type: "string" },
        description:
          "A date field per model, when they differ: { Invoice: issuedOn, Payment: paidOn }.",
      },
    },
  },
  positional: ["page", "field"],
  describe: ({ page, field, byModel }) =>
    field === "none"
      ? `Take the period from ${page}`
      : `Scope ${page} by ${
          byModel
            ? Object.entries(byModel)
                .map(([m, f]) => `${m}.${f}`)
                .join(", ")
            : field
        }`,
  destructive: () => false,
  apply({ spec }, { page, field, byModel }, ir) {
    const p = ir.pages.find((x) => x.id === page);
    if (!p) throw new OperationError(`There is no page named "${page}".`);
    if (p.pattern.kind !== "dashboard") throw new OperationError(`${page} is not a dashboard.`);
    const path = ["pages", page, "period"];
    if (field === "none") {
      if (spec.has(path)) spec.remove(path);
      return [];
    }
    const written: YamlValue | undefined = byModel ?? field;
    if (written === undefined) throw new OperationError("Say a date field, or one per model.");
    if (spec.has(path)) spec.set(path, written);
    else spec.add(["pages", page], "period", written);
    return [];
  },
};

const addTile: Operation<{
  page: string;
  tile: string;
  measure: "count" | "sum" | "average" | "list" | "query" | "activity";
  of: string;
  where?: Record<string, string | boolean | string[]>;
  by?: string;
  period?: string;
  limit?: number;
  when?: string;
  within?: string;
}> = {
  name: "addTile",
  summary:
    "Add a tile to a dashboard page (created, and added to the main menu, when it does not exist): a count, sum or average of records, a list of the latest ones or of what is due (when, within), a custom query's records, or the app's latest changes (activity of changes).",
  sets: [
    "smithable.yml:pages.*.dashboard",
    "smithable.yml:pages.*.dashboard.*",
    "smithable.yml:pages.*.dashboard.*.count",
    "smithable.yml:pages.*.dashboard.*.sum",
    "smithable.yml:pages.*.dashboard.*.average",
    "smithable.yml:pages.*.dashboard.*.list",
    "smithable.yml:pages.*.dashboard.*.query",
    "smithable.yml:pages.*.dashboard.*.where",
    "smithable.yml:pages.*.dashboard.*.by",
    "smithable.yml:pages.*.dashboard.*.period",
    "smithable.yml:pages.*.dashboard.*.limit",
    "smithable.yml:pages.*.dashboard.*.activity",
    "smithable.yml:pages.*.dashboard.*.when",
    "smithable.yml:pages.*.dashboard.*.within",
  ],
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
      measure: { type: "string", enum: ["count", "sum", "average", "list", "query", "activity"] },
      of: {
        type: "string",
        description:
          'A model for count and list ("Invoice"), a number field for sum and average ("Invoice.total"), a query name for query, changes for activity.',
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
      limit: {
        type: "integer",
        minimum: 1,
        description: "For a list, query or activity: how many records.",
      },
      when: {
        type: "string",
        description:
          "For a list: a date or date-time field; the list holds what falls due before the end of within, the overdue first.",
      },
      within: {
        type: "string",
        pattern: "^[1-9]\\d* (days?|weeks?)$",
        description: "With when: how far ahead, e.g. 2 weeks; 7 days unsaid.",
      },
    },
  },
  positional: ["page", "tile", "measure", "of"],
  describe: ({ page, tile, measure, of }) =>
    `Add tile ${tile} (${measure} of ${of}) to ${page === "dashboard" ? "the dashboard" : `the ${page} dashboard`}`,
  destructive: () => false,
  apply({ spec }, { page, tile, measure, of, where, by, period, limit, when, within }, ir) {
    if (measure === "activity" && of !== "changes")
      throw new OperationError('An activity tile shows the app\'s changes: "activity changes".');
    if (measure === "activity" && ((where && Object.keys(where).length) || by || when))
      throw new OperationError("An activity tile takes no where, by or when.");
    if (when && measure !== "list") throw new OperationError('"--when" goes with a list.');
    if (within && !when) throw new OperationError('"--within" goes with "--when".');
    if (period && !by) throw new OperationError('"--period" goes with "--by" a date field.');
    if (period && by) {
      const model = ir.models.find((m) => m.name === of.split(".")[0]);
      const field = model?.fields.find((f) => f.name === by.split(".")[0]);
      if (by.includes(".") || field?.type.kind === "choice")
        throw new OperationError('"--period" goes with "--by" a date field, not a choice.');
    }
    const value = {
      [measure]: of,
      ...(where && Object.keys(where).length ? { where: conditionArgs(where) } : {}),
      ...(by ? { by } : {}),
      ...(period ? { period } : {}),
      ...(limit ? { limit } : {}),
      ...(when ? { when } : {}),
      ...(within ? { within } : {}),
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
  sets: ["smithable.yml:navigation", "smithable.yml:navigation.*"],
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
  sets: ["smithable.yml:pages.*.search", "smithable.yml:pages.*.search.*"],
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
    sets: [`smithable.yml:pages.*.${key}`, `smithable.yml:pages.*.${key}.*`],
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
  sets: ["smithable.yml:pages.*.defaultFilter", "smithable.yml:pages.*.defaultFilter.*"],
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
    const problem = model ? filterValueProblem(model, field, value.trim(), ir.models) : undefined;
    if (problem) throw new OperationError(problem);
    // Several values are a list for a choice or a person; a range keeps its decimal comma.
    const away = model && field.includes(".") ? filterThrough(model, field, ir.models) : undefined;
    const f = away && "field" in away ? away.field : model?.fields.find((x) => x.name === field);
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

const setExport: Operation<{ page: string; offered: "on" | "off" }> = {
  name: "setExport",
  sets: ["smithable.yml:pages.*.export"],
  summary:
    "Offer Export CSV on a list page (on, as a list does unless it says otherwise) or not (off).",
  schema: {
    type: "object",
    required: ["page", "offered"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      offered: {
        type: "string",
        enum: ["on", "off"],
        description: "on: the list offers Export CSV; off: its records stay in the app.",
      },
    },
  },
  positional: ["page", "offered"],
  describe: ({ page, offered }) =>
    offered === "off" ? `Offer no Export CSV on ${page}` : `Offer Export CSV on ${page}`,
  destructive: () => false,
  apply({ spec }, { page, offered }, ir) {
    const p = ir.pages.find((x) => x.id === page);
    if (!p) throw new OperationError(`There is no page named "${page}".`);
    if (p.pattern.kind !== "crud") throw new OperationError(`${page} is not a list page.`);
    const path = ["pages", page, "export"];
    if (offered === "on") {
      if (spec.has(path)) spec.remove(path);
    } else if (!spec.has(path)) spec.add(["pages", page], "export", false);
    return [];
  },
};

const setFavorites: Operation<{ page: string; mode?: "on" | "only" | "off" }> = {
  name: "setFavorites",
  sets: ["smithable.yml:pages.*.favorites"],
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
  sets: ["smithable.yml:pages.*.mine"],
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
  sets: [
    "smithable.yml:pages.*.contact",
    "smithable.yml:pages.*.contact.to",
    "smithable.yml:pages.*.contact.keep",
  ],
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

type DocumentArgs = Omit<DocumentIR, "show"> & { page: string; show?: string[] };

const setDocument: Operation<DocumentArgs> = {
  name: "setDocument",
  sets: ["smithable.yml:pages.*.document", "smithable.yml:pages.*.document.**"],
  summary:
    "Make a list page's record printable as a document (an invoice, a quote, a receipt): the blocks it prints and the fields each names; without show it removes the document.",
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      ...documentSchema.properties,
      show: {
        ...documentSchema.properties.show,
        description: "The record's fields; none removes the document.",
      },
    },
  },
  positional: ["page"],
  describe: ({ page, show }) =>
    show?.length ? `Print ${page}'s records as a document` : `Remove the document from ${page}`,
  destructive: () => false,
  apply({ spec }, { page, ...doc }, ir) {
    const p = ir.pages.find((x) => x.id === page);
    if (!p) throw new OperationError(`There is no page named "${page}".`);
    if (p.pattern.kind !== "crud") throw new OperationError(`${page} is not a list page.`);
    const path = ["pages", page, "document"];
    if (!doc.show?.length) {
      if (spec.has(path)) spec.remove(path);
      return [];
    }
    const value = Object.fromEntries(
      DOCUMENT_BLOCKS.flatMap((block) => (doc[block] === undefined ? [] : [[block, doc[block]]])),
    ) as YamlValue;
    if (spec.has(path)) spec.set(path, value);
    else spec.add(["pages", page], "document", value);
    return [];
  },
};

const removePage: Operation<{ page: string }> = {
  name: "removePage",
  sets: ["smithable.yml:pages.*"],
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
  calculator?: Record<string, FieldArg>;
  before?: string;
  after?: string;
}> = {
  name: "addSection",
  summary: `Add a section to a page, below its others (above its footer) or where before or after says: one named after its kind (${KINDS.join(", ")}), or any name with records (a model's records as cards, a table or a calendar), text (a heading and paragraphs), calculator (its fields) or custom. Its texts go in smithable.content.yml.`,
  sets: [
    "smithable.yml:pages.*.landing.*",
    "smithable.yml:pages.*.sections.*",
    "smithable.yml:pages.*.landing.*.records",
    "smithable.yml:pages.*.landing.*.view",
    "smithable.yml:pages.*.landing.*.starts",
    "smithable.yml:pages.*.landing.*.where",
    "smithable.yml:pages.*.landing.*.form",
    "smithable.yml:pages.*.landing.*.button",
    "smithable.yml:pages.*.landing.*.custom",
    "smithable.yml:pages.*.landing.*.text",
    "smithable.yml:pages.*.landing.*.hero",
    "smithable.yml:pages.*.landing.*.features",
    "smithable.yml:pages.*.landing.*.pricing",
    "smithable.yml:pages.*.landing.*.testimonials",
    "smithable.yml:pages.*.landing.*.faq",
    "smithable.yml:pages.*.landing.*.callToAction",
    "smithable.yml:pages.*.landing.*.contact",
    "smithable.yml:pages.*.landing.*.gallery",
    "smithable.yml:pages.*.landing.*.footer",
    "smithable.yml:pages.*.landing.*.mediaText",
    "smithable.yml:pages.*.landing.*.calculator",
    "smithable.yml:pages.*.landing.*.calculator.fields",
    "smithable.yml:pages.*.sections.*.calculator",
    "smithable.yml:pages.*.sections.*.calculator.fields",
    "smithable.yml:pages.*.sections.*.records",
    "smithable.yml:pages.*.sections.*.view",
    "smithable.yml:pages.*.sections.*.starts",
    "smithable.yml:pages.*.sections.*.where",
    "smithable.yml:pages.*.sections.*.form",
    "smithable.yml:pages.*.sections.*.button",
    "smithable.yml:pages.*.sections.*.custom",
    "smithable.yml:pages.*.sections.*.text",
    "smithable.yml:pages.*.sections.*.hero",
    "smithable.yml:pages.*.sections.*.features",
    "smithable.yml:pages.*.sections.*.pricing",
    "smithable.yml:pages.*.sections.*.testimonials",
    "smithable.yml:pages.*.sections.*.faq",
    "smithable.yml:pages.*.sections.*.callToAction",
    "smithable.yml:pages.*.sections.*.contact",
    "smithable.yml:pages.*.sections.*.gallery",
    "smithable.yml:pages.*.sections.*.footer",
    "smithable.yml:pages.*.sections.*.mediaText",
  ],
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
      calculator: {
        type: "object",
        additionalProperties: FIELD_ARG,
        description:
          'A calculator, any name: its fields as a model\'s, the entered ones its inputs and the formula fields its results, e.g. { "price": "money = 300000", "monthly": { "type": "money", "formula": "price / 12" } }.',
      },
      before: refTo(
        { ref: "section", page: "page", label: "Above" },
        { description: "The section it goes above; not with after." },
      ),
      after: refTo(
        { ref: "section", page: "page", label: "Below" },
        { description: "The section it goes below; not with before." },
      ),
    },
  },
  positional: ["page", "section"],
  describe: ({ page, section }) => `Add a ${section} section to the ${page} page`,
  destructive: () => false,
  apply(
    { spec },
    {
      page,
      section,
      records,
      view,
      starts,
      where,
      form,
      button,
      custom,
      text,
      kind,
      calculator,
      before,
      after,
    },
    ir,
  ) {
    const existing = ir.pages.find((p) => p.id === page);
    if (!existing) throw new OperationError(`There is no page named "${page}".`);
    if (existing.sections.some((s) => s.name === section))
      throw new OperationError(`The ${page} page already has a section named "${section}".`);
    if (custom) componentName(custom);
    if ([records, custom, text, kind, calculator].filter(Boolean).length > 1)
      throw new OperationError(
        "A section shows records, or is text, a calculator or custom, or of a kind: one of them.",
      );
    if (before && after)
      throw new OperationError("A section goes above one (before) or below one (after), not both.");
    if (calculator) {
      if (!Object.keys(calculator).length)
        throw new OperationError("A calculator needs at least one field, e.g. price=money.");
      for (const [f, value] of Object.entries(calculator)) checkFieldArg(f, value);
    }
    const named = kind ?? ((KINDS as readonly string[]).includes(section) ? section : undefined);
    if (!records && !custom && !text && !calculator && !named)
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
      ...(calculator ? { calculator: { fields: calculator as Record<string, YamlValue> } } : {}),
    };
    const path = sectionsPath(existing);
    if (spec.has(path) && spec.get(path) != null) spec.add(path, section, options);
    else if (spec.has(path)) spec.set(path, { [section]: options });
    else spec.add(["pages", page], path[2] as string, { [section]: options });
    const other = before ?? after;
    if (other) {
      // Placed where it was asked: among the sections as written.
      const names = Object.keys((spec.get(path) ?? {}) as object);
      if (!names.includes(other) || other === section)
        throw new OperationError(
          `The ${page} page has no section named "${other}" among its sections as written${existing.sections.some((s) => s.name === other) ? " (a page kind's own part is placed with moveSection first)" : ""}.`,
        );
      spec.move(path, section, before ? { before } : { after: other });
      return [];
    }
    // The footer stays the page's last part: a new section goes above it.
    const footer = existing.sections.find((s) => s.kind === "footer" && !s.own);
    if (footer && named !== "footer" && spec.has([...path, footer.name]))
      spec.move(path, section, { before: footer.name });
    return [];
  },
};

const removeSection: Operation<{ page: string; section: string }> = {
  name: "removeSection",
  sets: ["smithable.yml:pages.*.landing.*", "smithable.yml:pages.*.sections.*"],
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
  sets: ["smithable.yml:pages.*.landing.*.where", "smithable.yml:pages.*.sections.*.where"],
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

/**
 * A gallery or media-and-text section whose pictures present the owner's own work (finished jobs,
 * a project), or no longer: the publish review lists such pictures when an image model made them
 * (docs/design/picture-kinds.md §6). Said in the spec, never guessed from a section's name.
 */
const setSectionPictures: Operation<{ page: string; section: string; pictures?: "work" }> = {
  name: "setSectionPictures",
  sets: ["smithable.yml:pages.*.landing.*.pictures", "smithable.yml:pages.*.sections.*.pictures"],
  summary:
    "Say that a gallery's or media-and-text section's pictures present the owner's own work (pictures work), so the publish review asks about generated ones; none takes it off.",
  schema: {
    type: "object",
    required: ["page", "section"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      section: refTo({ ref: "section", page: "page", label: "Section" }),
      pictures: {
        enum: ["work"],
        description: "work: the pictures present the owner's own work; none takes it off.",
      },
    },
  },
  positional: ["page", "section", "pictures"],
  describe: ({ page, section, pictures }) =>
    pictures
      ? `Mark the pictures of the ${section} section of ${page} as the owner's own work`
      : `Stop marking the pictures of the ${section} section of ${page} as the owner's own work`,
  destructive: () => false,
  apply({ spec }, { page, section, pictures }, ir) {
    const existing = ir.pages.find((p) => p.id === page);
    const found = existing ? partSections(existing).find((s) => s.name === section) : undefined;
    if (!existing || !found)
      throw new OperationError(`The ${page} page has no section named "${section}".`);
    if (found.kind !== "gallery" && found.kind !== "mediaText")
      throw new OperationError(
        `Only a gallery or mediaText section's pictures can be the owner's work; ${section} is a ${found.kind} section.`,
      );
    const at = [...sectionsPath(existing), section];
    const path = [...at, "pictures"];
    if (!pictures) {
      if (!spec.has(path))
        throw new OperationError(`The ${section} section's pictures are not marked as work.`);
      spec.remove(path);
    } else if (spec.has(path)) spec.set(path, pictures);
    else if (spec.get(at) == null) spec.set(at, { pictures });
    else spec.add(at, "pictures", pictures);
    return [];
  },
};

const setShortcuts: Operation<{ page: string; pages?: string[] }> = {
  name: "setShortcuts",
  summary:
    "Give a landing page's hero up to four shortcuts to other pages, shown as round icons (no pages removes them).",
  sets: ["smithable.yml:pages.*.landing.*.shortcuts", "smithable.yml:pages.*.sections.*.shortcuts"],
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
  setExport,
  setContact,
  setDocument,
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
  sets: [
    "smithable.yml:pages.*.landing.*.button",
    "smithable.yml:pages.*.landing.*.secondButton",
    "smithable.yml:pages.*.sections.*.button",
    "smithable.yml:pages.*.sections.*.secondButton",
  ],
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
    "Move a page's section above another (before: that section) or below one (after: that section), one of the two: sections show in the order written. A page kind's own part moves once its name is among the sections.",
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
  sets: ["smithable.yml:pages.*", "smithable.yml:pages.*.route", "smithable.yml:pages.*.sections"],
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

/** Writes a key's value, or removes it when the value is undefined; a new key is added to its parent. */
function put(spec: YamlEditor, path: string[], value: YamlValue | undefined): void {
  if (value === undefined) {
    if (spec.has(path)) spec.remove(path);
  } else if (spec.has(path)) spec.set(path, value);
  else spec.add(path.slice(0, -1), path[path.length - 1] as string, value);
}

/**
 * Changes the parts of a page kind written as a model alone or in its long form (calendar,
 * articles, order): each part given is written, an undefined one removed; a long form left with
 * its model alone goes back to the short one when `short` says it has one.
 */
function setParts(
  spec: YamlEditor,
  page: PageIR,
  key: string,
  parts: Record<string, YamlValue | undefined>,
  short: boolean,
): void {
  const path = ["pages", page.id, key];
  const written = spec.get(path);
  const long: Record<string, YamlValue> =
    typeof written === "string"
      ? { model: written }
      : { ...((written ?? {}) as Record<string, YamlValue>) };
  for (const [part, value] of Object.entries(parts)) {
    if (value === undefined) delete long[part];
    else long[part] = value;
  }
  const keys = Object.keys(long);
  if (short && keys.length === 1 && keys[0] === "model") spec.set(path, long.model as YamlValue);
  else if (typeof written === "string" || written == null) spec.set(path, long);
  else for (const [part, value] of Object.entries(parts)) put(spec, [...path, part], value);
}

/** The page of this kind, or a refusal naming the kind. */
function pageOfKind(ir: { pages: PageIR[] }, page: string, kind: string, what: string): PageIR {
  const found = ir.pages.find((p) => p.id === page);
  if (!found) throw new OperationError(`There is no page named "${page}".`);
  if (found.pattern.kind !== kind)
    throw new OperationError(`${page} is a ${found.pattern.kind} page, not ${what}.`);
  return found;
}

/** "" or "none" given for a part that may be removed: undefined (removed), else the value. */
const orRemoved = (value: string | undefined, removes: string[]) =>
  value === undefined ? null : removes.includes(value) ? undefined : value;

/** The parts given (null is "not given"), without those not given. */
function given(parts: Record<string, YamlValue | undefined | null>) {
  return Object.fromEntries(Object.entries(parts).filter(([, v]) => v !== null)) as Record<
    string,
    YamlValue | undefined
  >;
}

const setCalendar: Operation<{
  page: string;
  starts?: string;
  ends?: string;
  duration?: string;
  title?: string;
}> = {
  name: "setCalendar",
  summary:
    "Change what a calendar page reads from its records: the field that places them (starts), the one that ends them (ends) or their length in minutes (duration), and what a block says (title). none removes one, so it is inferred again.",
  sets: [
    "smithable.yml:pages.*.calendar",
    "smithable.yml:pages.*.calendar.model",
    "smithable.yml:pages.*.calendar.starts",
    "smithable.yml:pages.*.calendar.ends",
    "smithable.yml:pages.*.calendar.duration",
    "smithable.yml:pages.*.calendar.title",
  ],
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Calendar page" }),
      starts: { type: "string", description: "The date or date-time field that places a record." },
      ends: {
        type: "string",
        description: "A field of the same kind where a record ends; not with duration.",
      },
      duration: {
        type: "string",
        description:
          "A whole-number field of minutes, or one reference away, e.g. classType.durationMinutes; not with ends.",
      },
      title: {
        type: "string",
        description: "What a block says: a field, or a reference (its record's title).",
      },
    },
  },
  positional: ["page"],
  describe: ({ page }) => `Change what the ${page} calendar reads`,
  destructive: () => false,
  apply({ spec }, { page, starts, ends, duration, title }, ir) {
    const found = pageOfKind(ir, page, "calendar", "a calendar");
    const parts = given({
      starts: orRemoved(starts, ["none", ""]),
      ends: orRemoved(ends, ["none", ""]),
      duration: orRemoved(duration, ["none", ""]),
      title: orRemoved(title, ["none", ""]),
    });
    if (!Object.keys(parts).length)
      throw new OperationError("Say what to change: --starts, --ends, --duration or --title.");
    if (parts.ends && parts.duration)
      throw new OperationError("A record's length is its end or its duration: one of them.");
    // The other way of giving a length goes when one is given.
    if (parts.ends) parts.duration = undefined;
    if (parts.duration) parts.ends = undefined;
    setParts(spec, found, "calendar", parts, true);
    return [];
  },
};

const ARTICLE_PARTS = ["title", "body", "picture", "date", "address", "summary", "author"] as const;

const setArticles: Operation<
  { page: string } & Partial<Record<(typeof ARTICLE_PARTS)[number], string>>
> = {
  name: "setArticles",
  summary:
    "Name the fields an articles page reads, when the inferred ones are not the right ones: title, body, picture, date, address, summary, author. none removes one, so it is inferred again.",
  sets: [
    "smithable.yml:pages.*.articles",
    "smithable.yml:pages.*.articles.model",
    ...ARTICLE_PARTS.map((p) => `smithable.yml:pages.*.articles.${p}`),
  ],
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Articles page" }),
      title: { type: "string", description: "A string field, the article's heading." },
      body: { type: "string", description: "A markdown field, the article itself." },
      picture: { type: "string", description: "A picture field." },
      date: { type: "string", description: "A date or date-time field: newest first." },
      address: {
        type: "string",
        description: "A unique string field, the article's address (/blog/<address>).",
      },
      summary: { type: "string", description: "A text or string field, shown in the list." },
      author: { type: "string", description: "A field that refers to a User." },
    },
  },
  positional: ["page"],
  describe: ({ page }) => `Change what the ${page} articles read`,
  destructive: () => false,
  apply({ spec }, args, ir) {
    const found = pageOfKind(ir, args.page, "articles", "an articles page");
    const parts = given(
      Object.fromEntries(ARTICLE_PARTS.map((p) => [p, orRemoved(args[p], ["none", ""])])),
    );
    if (!Object.keys(parts).length)
      throw new OperationError(
        `Say what to change: ${ARTICLE_PARTS.map((p) => `--${p}`).join(", ")}.`,
      );
    setParts(spec, found, "articles", parts, true);
    return [];
  },
};

const setOrder: Operation<{
  page: string;
  price?: string;
  available?: string;
  quantity?: string;
  hours?: string | Record<string, string | string[]>;
  lead?: number;
}> = {
  name: "setOrder",
  summary:
    "Change an order page: which field of what is chosen is its price and which says it can be ordered (available), which field of a line is how many (quantity), when orders are taken (hours), and the minutes from now to the earliest wanted time (lead).",
  sets: [
    "smithable.yml:pages.*.order.price",
    "smithable.yml:pages.*.order.available",
    "smithable.yml:pages.*.order.quantity",
    "smithable.yml:pages.*.order.hours",
    "smithable.yml:pages.*.order.hours.*",
    "smithable.yml:pages.*.order.hours.*.*",
    "smithable.yml:pages.*.order.lead",
  ],
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Order page" }),
      price: {
        type: "string",
        description: 'The money field of what is chosen that is its price; "" infers it again.',
      },
      available: {
        type: "string",
        description:
          'The yes/no field of what is chosen that says it can be ordered; none for always, "" infers it again.',
      },
      quantity: {
        type: "string",
        description:
          'The whole-number field of a line that is how many; none for one of each, "" infers it again.',
      },
      hours: {
        type: ["string", "object"],
        additionalProperties: { type: ["string", "array"], items: { type: "string" } },
        description:
          'When orders are taken, in the app\'s time zone, e.g. "mon-thu 11:00-20:00, fri-sat 11:00-22:00"; a day not named is closed; none takes orders always.',
      },
      lead: {
        type: "integer",
        minimum: 0,
        maximum: 1440,
        description: "Minutes from now to the earliest wanted time; 0 removes it.",
      },
    },
  },
  positional: ["page"],
  describe: ({ page }) => `Change the ${page} order page`,
  destructive: () => false,
  apply({ spec }, { page, price, available, quantity, hours, lead }, ir) {
    const found = pageOfKind(ir, page, "order", "an order page");
    const parts = given({
      price: orRemoved(price, [""]),
      available: orRemoved(available, [""]),
      quantity: orRemoved(quantity, [""]),
      hours: hours === undefined ? null : hours === "none" ? undefined : hoursArg(hours),
      lead: lead === undefined ? null : lead || undefined,
    });
    if (!Object.keys(parts).length)
      throw new OperationError(
        "Say what to change: --price, --available, --quantity, --hours or --lead.",
      );
    setParts(spec, found, "order", parts, false);
    return [];
  },
};

const addSettingsPage: Operation<{ page: string; model: string }> = {
  name: "addSettingsPage",
  summary:
    "Add a page that edits one record of a model: the viewer's own when its records are private, the app's when they are shared. It goes in the main menu.",
  sets: ["smithable.yml:pages.*", "smithable.yml:pages.*.settings"],
  schema: {
    type: "object",
    required: ["page", "model"],
    additionalProperties: false,
    properties: {
      page: { type: "string", description: "Page name, e.g. settings." },
      model: refTo({ ref: "model", label: "Record of" }),
    },
  },
  positional: ["page", "model"],
  describe: ({ page, model }) => `Add settings page ${page} for ${model}`,
  destructive: () => false,
  apply({ spec }, { page, model }, ir) {
    newPage(ir, page, model);
    spec.add(["pages"], page, { settings: model });
    addToMainMenu(spec, page);
    return [];
  },
};

const addOnboardingPage: Operation<{
  page: string;
  model: string;
  steps: Record<string, string[] | string>;
}> = {
  name: "addOnboardingPage",
  summary:
    "Add an onboarding: a model's settings record filled in steps the first time someone signs in, each step asking for some of its fields. The steps must ask for every required field without a default. Its titles and texts go in smithable.content.yml.",
  sets: [
    "smithable.yml:pages.*",
    "smithable.yml:pages.*.onboarding",
    "smithable.yml:pages.*.onboarding.model",
    "smithable.yml:pages.*.onboarding.steps",
    "smithable.yml:pages.*.onboarding.steps.*",
    "smithable.yml:pages.*.onboarding.steps.*.*",
  ],
  schema: {
    type: "object",
    required: ["page", "model", "steps"],
    additionalProperties: false,
    properties: {
      page: { type: "string", description: "Page name, e.g. welcome." },
      model: refTo({ ref: "model", label: "Record of" }),
      steps: {
        type: "object",
        additionalProperties: { type: ["array", "string"], items: { type: "string" } },
        description:
          'The steps in order, each with the fields it asks for, e.g. { "business": ["businessName", "vatNumber"], "payment": ["iban"] }.',
      },
    },
  },
  positional: ["page", "model"],
  describe: ({ page, model }) => `Add onboarding page ${page} for ${model}`,
  destructive: () => false,
  apply({ spec }, { page, model, steps }, ir) {
    newPage(ir, page, model);
    const written = Object.fromEntries(
      Object.entries(steps).map(([step, fields]) => [
        step,
        Array.isArray(fields) ? fields : fields.split(/[\s,]+/).filter(Boolean),
      ]),
    );
    if (!Object.keys(written).length)
      throw new OperationError(
        'An onboarding needs a step, e.g. { "business": ["businessName"] }.',
      );
    for (const [step, fields] of Object.entries(written)) {
      if (!FIELD_NAME_PATTERN.test(step))
        throw new OperationError(
          `A step is named like business: a small letter, then letters and digits; not "${step}".`,
        );
      if (!fields.length) throw new OperationError(`The ${step} step asks for no field.`);
    }
    spec.add(["pages"], page, { onboarding: { model, steps: written } });
    return [];
  },
};

/** Refuses a name a new page cannot have, or a model there is not. */
function newPage(ir: { pages: PageIR[]; models: { name: string }[] }, page: string, model: string) {
  if (!NAME_PATTERN.test(page)) throw new OperationError(nameRule("page", page));
  if (ir.pages.some((p) => p.id === page))
    throw new OperationError(`Page "${page}" already exists.`);
  if (!ir.models.some((m) => m.name === model))
    throw new OperationError(`There is no model named "${model}".`);
}

const setSectionList: Operation<{
  page: string;
  section: string;
  search?: boolean;
  filters?: string[];
  limit?: number;
}> = {
  name: "setSectionList",
  summary:
    "Change a records section's door to its model's list: a search box (search), chips of its fields (filters, as a crud page's; none removes them) and how many records it shows (limit; 0 removes it).",
  sets: [
    "smithable.yml:pages.*.landing.*.search",
    "smithable.yml:pages.*.landing.*.filters",
    "smithable.yml:pages.*.landing.*.filters.*",
    "smithable.yml:pages.*.landing.*.limit",
    "smithable.yml:pages.*.sections.*.search",
    "smithable.yml:pages.*.sections.*.filters",
    "smithable.yml:pages.*.sections.*.filters.*",
    "smithable.yml:pages.*.sections.*.limit",
  ],
  schema: {
    type: "object",
    required: ["page", "section"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      section: refTo({ ref: "section", page: "page", label: "Section" }),
      search: { type: "boolean", description: "true shows a search box; false removes it." },
      filters: {
        type: "array",
        items: { type: "string" },
        description:
          'Fields of the section\'s model whose chips it shows; [] or ["none"] removes them.',
      },
      limit: {
        type: "integer",
        minimum: 0,
        description: "How many records it shows; 0 removes the limit.",
      },
    },
  },
  positional: ["page", "section"],
  describe: ({ page, section }) => `Change the ${section} section's list on ${page}`,
  destructive: () => false,
  apply({ spec }, { page, section, search, filters, limit }, ir) {
    const existing = ir.pages.find((p) => p.id === page);
    const found = existing?.sections.find((s) => s.name === section);
    if (!existing || !found)
      throw new OperationError(`The ${page} page has no section named "${section}".`);
    if (found.kind !== "records" || isOwnSection(found))
      throw new OperationError(`The ${section} section shows no model's records of its own.`);
    if (search === undefined && filters === undefined && limit === undefined)
      throw new OperationError("Say what to change: --search, --filters or --limit.");
    const at = [...sectionsPath(existing), section];
    if (search !== undefined) put(spec, [...at, "search"], search || undefined);
    if (filters !== undefined) {
      const kept = filters.filter((f) => f !== "none");
      put(spec, [...at, "filters"], kept.length ? kept : undefined);
    }
    if (limit !== undefined) put(spec, [...at, "limit"], limit || undefined);
    return [];
  },
};

/** The options only a records section takes. */
const RECORDS_OPTIONS = ["view", "starts", "search", "filters", "where", "limit"];
/** The options that say what a section is; a change of kind writes its own. */
const KIND_OPTIONS = ["records", "calculator", "custom", "text", ...KINDS];

const changeSectionKind: Operation<{
  page: string;
  section: string;
  kind: string;
  records?: string;
  custom?: string;
  calculator?: Record<string, FieldArg>;
}> = {
  name: "changeSectionKind",
  summary:
    "Make a section another kind, keeping its name, its place and what the new kind also has (its options and texts); the rest goes, and the result says what. records needs --records <Model>, custom --custom <Component>, calculator its fields.",
  sets: ["smithable.yml:pages.*.landing.*", "smithable.yml:pages.*.sections.*"],
  schema: {
    type: "object",
    required: ["page", "section", "kind"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      section: refTo({ ref: "section", page: "page", label: "Section" }),
      kind: {
        type: "string",
        enum: [...KINDS, "records", "text", "custom", "calculator"],
        description: "The new kind.",
      },
      records: refTo(
        { ref: "model", label: "Records of" },
        { description: "For records: the model whose records it shows." },
      ),
      custom: { type: "string", description: "For custom: its component, e.g. RepaymentChart." },
      calculator: {
        type: "object",
        additionalProperties: FIELD_ARG,
        description:
          'For calculator: its fields, e.g. { "price": "money = 300000", "monthly": { "type": "money", "formula": "price / 12" } }.',
      },
    },
  },
  positional: ["page", "section", "kind"],
  describe: ({ page, section, kind }) => `Make the ${section} section of ${page} a ${kind} section`,
  // What the new kind does not have goes: its options, texts or items.
  destructive: () => true,
  apply({ spec, content }, { page, section, kind, records, custom, calculator }, ir) {
    const existing = ir.pages.find((p) => p.id === page);
    const found = existing?.sections.find((s) => s.name === section);
    if (!existing || !found)
      throw new OperationError(`The ${page} page has no section named "${section}".`);
    if (isOwnSection(found))
      throw new OperationError(
        `The ${section} section is the ${page} page's own, as a ${existing.pattern.kind} page; it has no other kind.`,
      );
    const at = [...sectionsPath(existing), section];
    const options = (spec.get(at) ?? {}) as Record<string, YamlValue>;
    const was = found.kind;
    if (was === kind)
      throw new OperationError(`The ${section} section is a ${kind} section already.`);
    if ((kind === "records") !== (records !== undefined))
      throw new OperationError("--records goes with the records kind, and it needs it.");
    if ((kind === "custom") !== (custom !== undefined))
      throw new OperationError("--custom goes with the custom kind, and it needs it.");
    if ((kind === "calculator") !== (calculator !== undefined))
      throw new OperationError("--calculator goes with the calculator kind, and it needs it.");
    if (custom) componentName(custom);
    if (calculator) for (const [f, value] of Object.entries(calculator)) checkFieldArg(f, value);
    if (
      (KINDS as readonly string[]).includes(section) &&
      !(KINDS as readonly string[]).includes(kind)
    )
      throw new OperationError(
        `A section named ${section} is of that kind by its name; a ${kind} section needs another name.`,
      );
    const allows = Object.keys(LANDING_SECTIONS[kind as keyof typeof LANDING_SECTIONS] ?? {});
    const takes = kind === "records" ? [...allows, ...RECORDS_OPTIONS] : allows;
    const dropped: string[] = [];
    const kept: Record<string, YamlValue> = {};
    for (const [key, value] of Object.entries(options)) {
      if (KIND_OPTIONS.includes(key)) {
        // The old kind's own part goes with it: say so when it held something.
        if (key === "calculator") dropped.push("its calculator fields");
        else if (key === "records") dropped.push(`its records of ${value}`);
        else if (key === "custom") dropped.push(`its component ${value}`);
        continue;
      }
      if (takes.includes(key)) kept[key] = value;
      else dropped.push(key);
    }
    const defining: Record<string, YamlValue> =
      kind === "records"
        ? { records: records as string }
        : kind === "custom"
          ? { custom: custom as string }
          : kind === "calculator"
            ? { calculator: { fields: calculator as Record<string, YamlValue> } }
            : kind === "text"
              ? { text: null }
              : kind === section
                ? {}
                : { [kind]: null };
    const written = { ...defining, ...kept };
    spec.set(at, Object.keys(written).length ? written : null);
    // Its texts: those the new kind also has stay.
    const textsAt = ["pages", page, section];
    const texts = content.has(textsAt) ? content.get(textsAt) : undefined;
    if (texts && typeof texts === "object") {
      const after = sectionTextKeys(kind);
      // Items stay when every one of them has only texts the new kind's items have.
      const items = (texts as Record<string, YamlValue>).items;
      const itemsFit =
        after?.items !== undefined &&
        Array.isArray(items) &&
        items.every(
          (item) =>
            item !== null &&
            typeof item === "object" &&
            Object.keys(item).every((k) => after.items?.includes(k)),
        );
      for (const key of Object.keys(texts as object)) {
        const keeps =
          after?.texts.includes(key) ||
          (key === "items" && itemsFit) ||
          (key === "image" && after?.image) ||
          (key === "fields" && after?.fields) ||
          (key === "tiles" && kind === "hero");
        if (!keeps) {
          content.remove([...textsAt, key]);
          dropped.push(key === "items" ? "its items" : `its ${key} text`);
        }
      }
      if (!Object.keys((content.get(textsAt) ?? {}) as object).length)
        content.removeAndPrune(textsAt, 1);
    }
    return dropped.length ? [{ note: `it no longer has ${dropped.join(", ")}` }] : [];
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
  setSectionPictures,
  setShortcuts,
  setHeroButtons,
  setSectionList,
  changeSectionKind,
];
/** Operations of the dashboard pattern. */
export const dashboardOperations: AnyOperation[] = [addTile, setPeriod];
/** Operations of the calendar pattern. */
export const calendarOperations: AnyOperation[] = [addCalendarPage, setCalendar];
export const articlesOperations: AnyOperation[] = [addArticlesPage, setArticles];
/** Operations of the order pattern (docs/design/orders.md §3). */
export const orderOperations: AnyOperation[] = [addOrderPage, setOrder];
export const settingsOperations: AnyOperation[] = [addSettingsPage];
export const onboardingOperations: AnyOperation[] = [addOnboardingPage];
/** Operations of the data pattern. */
export const dataOperations: AnyOperation[] = [addDataPage];
export const reviewOperations: AnyOperation[] = [addReviewPage];
/** Operations of the users pattern. */
export const usersOperations: AnyOperation[] = [addUsersPage];
export const navigationOperations: AnyOperation[] = [setNavigation];
