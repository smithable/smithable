import type { YamlEditor } from "../edit.js";
import { SECTION_KINDS } from "../ir.js";
import { type AnyOperation, type Operation, OperationError, refTo } from "../operation.js";
import { NAME_PATTERN } from "./names.js";

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
      throw new OperationError(
        `Page name "${page}" must start with a lowercase letter and use only letters, digits and dashes.`,
      );
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
    if (!NAME_PATTERN.test(page))
      throw new OperationError(
        `Page name "${page}" must start with a lowercase letter and use only letters, digits and dashes.`,
      );
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
    if (!NAME_PATTERN.test(page))
      throw new OperationError(
        `Page name "${page}" must start with a lowercase letter and use only letters, digits and dashes.`,
      );
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
    if (!NAME_PATTERN.test(page))
      throw new OperationError(
        `Page name "${page}" must start with a lowercase letter and use only letters, digits and dashes.`,
      );
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
    if (!NAME_PATTERN.test(page))
      throw new OperationError(
        `Page name "${page}" must start with a lowercase letter and use only letters, digits and dashes.`,
      );
    if (ir.pages.some((p) => p.id === page))
      throw new OperationError(`Page "${page}" already exists.`);
    if (!ir.models.some((m) => m.name === model))
      throw new OperationError(`There is no model named "${model}".`);
    spec.add(["pages"], page, { calendar: starts ? { model, starts } : model });
    addToMainMenu(spec, page);
    return [];
  },
};

const addCalculatorPage: Operation<{ page: string; fields: Record<string, string> }> = {
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
        additionalProperties: { type: "string" },
        description:
          'Field name → type shorthand, e.g. { "price": "money = 300000", "years": "int = 25" }; results are added with addField and a formula.',
      },
    },
  },
  positional: ["page", "...fields"],
  describe: ({ page, fields }) =>
    `Add calculator page ${page} with ${Object.keys(fields).join(", ")}`,
  destructive: () => false,
  apply({ spec }, { page, fields }, ir) {
    if (!NAME_PATTERN.test(page))
      throw new OperationError(
        `Page name "${page}" must start with a lowercase letter and use only letters, digits and dashes.`,
      );
    if (ir.pages.some((p) => p.id === page))
      throw new OperationError(`Page "${page}" already exists.`);
    if (!Object.keys(fields).length)
      throw new OperationError("A calculator needs at least one field, e.g. price=money.");
    spec.add(["pages"], page, { calculator: { fields } });
    addToMainMenu(spec, page);
    return [];
  },
};

export const calculatorOperations: AnyOperation[] = [addCalculatorPage];

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
  where?: Record<string, string | boolean>;
  by?: string;
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
      tile: { type: "string", description: "The tile's name, e.g. outstanding." },
      measure: { type: "string", enum: ["count", "sum", "average", "list", "query"] },
      of: {
        type: "string",
        description:
          'A model for count and list ("Invoice"), a number field for sum and average ("Invoice.total"), a query name for query.',
      },
      where: {
        type: "object",
        description: 'Only records with these values, e.g. { "status": "sent" }.',
      },
      by: { type: "string", description: "A date field: one bar per month." },
      limit: { type: "integer", minimum: 1, description: "For a list or query: how many records." },
    },
  },
  positional: ["page", "tile", "measure", "of"],
  describe: ({ page, tile, measure, of }) =>
    `Add tile ${tile} (${measure} of ${of}) to ${page === "dashboard" ? "the dashboard" : `the ${page} dashboard`}`,
  destructive: () => false,
  apply({ spec }, { page, tile, measure, of, where, by, limit }, ir) {
    const value = {
      [measure]: of,
      ...(where && Object.keys(where).length ? { where } : {}),
      ...(by ? { by } : {}),
      ...(limit ? { limit } : {}),
    };
    const existing = ir.pages.find((p) => p.id === page);
    if (!existing) {
      if (!NAME_PATTERN.test(page))
        throw new OperationError(
          `Page name "${page}" must start with a lowercase letter and use only letters, digits and dashes.`,
        );
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

/** A landing page's section kinds other than records, which any name can have. */
const KINDS = SECTION_KINDS.filter((k) => k !== "records");

const addSection: Operation<{
  page: string;
  section: string;
  records?: string;
  form?: string;
  button?: string;
}> = {
  name: "addSection",
  summary: `Add a section to a landing page: one named after its kind (${KINDS.join(", ")}), or any name with records (a model's records as cards). Its texts go in smithable.content.yml.`,
  schema: {
    type: "object",
    required: ["page", "section"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }, { description: "The landing page, e.g. home." }),
      section: {
        type: "string",
        description: `A kind (${KINDS.join(", ")}) or, with records, any name.`,
      },
      records: refTo(
        { ref: "model", label: "Records of" },
        { description: "A model whose records the section shows as cards." },
      ),
      form: refTo(
        { ref: "model", label: "Form for" },
        { description: "A contact section's form: the model visitors add." },
      ),
      button: refTo(
        { ref: "page", label: "Button opens" },
        { description: "The page a hero's or call to action's button opens." },
      ),
    },
  },
  positional: ["page", "section"],
  describe: ({ page, section }) => `Add a ${section} section to the ${page} page`,
  destructive: () => false,
  apply({ spec }, { page, section, records, form, button }, ir) {
    const existing = ir.pages.find((p) => p.id === page);
    if (!existing) throw new OperationError(`There is no page named "${page}".`);
    if (existing.pattern.kind !== "landing")
      throw new OperationError(
        `Page "${page}" is a ${existing.pattern.kind} page, not a landing page.`,
      );
    if (existing.pattern.sections.some((s) => s.name === section))
      throw new OperationError(`The ${page} page already has a section named "${section}".`);
    if (!records && !(KINDS as readonly string[]).includes(section))
      throw new OperationError(
        `There is no section kind "${section}". Kinds: ${KINDS.join(", ")}; or give it records.`,
      );
    const options = {
      ...(records ? { records } : {}),
      ...(form ? { form } : {}),
      ...(button ? { button } : {}),
    };
    spec.add(["pages", page, "landing"], section, options);
    return [];
  },
};

const removeSection: Operation<{ page: string; section: string }> = {
  name: "removeSection",
  summary: "Remove a section from a landing page, with its texts.",
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
    if (
      existing?.pattern.kind !== "landing" ||
      !existing.pattern.sections.some((s) => s.name === section)
    )
      throw new OperationError(`The ${page} page has no section named "${section}".`);
    if (existing.pattern.sections.length === 1)
      throw new OperationError("A landing page needs at least one section.");
    spec.remove(["pages", page, "landing", section]);
    return [{ kind: "remove-section", page, section }];
  },
};

/** Operations on pages of every pattern. */
export const pageOperations: AnyOperation[] = [removePage];
/** Operations of the crud pattern. */
export const crudOperations: AnyOperation[] = [addPage, setSearch];
/** Operations of the landing pattern. */
export const landingOperations: AnyOperation[] = [addLandingPage, addSection, removeSection];
/** Operations of the dashboard pattern. */
export const dashboardOperations: AnyOperation[] = [addTile];
/** Operations of the calendar pattern. */
export const calendarOperations: AnyOperation[] = [addCalendarPage];
/** Operations of the data pattern. */
export const dataOperations: AnyOperation[] = [addDataPage];
/** Operations of the users pattern. */
export const usersOperations: AnyOperation[] = [addUsersPage];
export const navigationOperations: AnyOperation[] = [setNavigation];
