import type { YamlEditor } from "../edit.js";
import { type AnyOperation, type Operation, OperationError } from "../operation.js";
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
      model: { type: "string" },
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
      page: { type: "string", description: "The dashboard page, e.g. overview." },
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
      menu: { type: "string", description: 'Usually "main".' },
      pages: { type: "array", items: { type: "string" } },
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
      page: { type: "string" },
      fields: {
        type: "array",
        items: { type: "string" },
        description: "Text, email, phone, web address or choice fields of the page's model.",
      },
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
    properties: { page: { type: "string" } },
  },
  positional: ["page"],
  describe: ({ page }) => `Remove page ${page}`,
  destructive: () => false,
  apply({ spec, content, ux }, { page }, ir) {
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
    // Its texts and presentation go with it.
    for (const editor of [content, ux])
      if (editor?.has(["pages", page])) editor.removeAndPrune(["pages", page], 0);
    return [];
  },
};

export const pageOperations: AnyOperation[] = [addPage, setSearch, addTile, removePage];
export const navigationOperations: AnyOperation[] = [setNavigation];
