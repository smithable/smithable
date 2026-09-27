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
    // Without a "navigation" key every page is in the main menu already.
    const navigation = spec.get(["navigation"]);
    if (Array.isArray(navigation)) spec.set(["navigation"], [...navigation, page]);
    else if (spec.has(["navigation", "main"])) {
      spec.set(["navigation", "main"], [...(spec.get(["navigation", "main"]) as string[]), page]);
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

export const pageOperations: AnyOperation[] = [addPage, setSearch];
export const navigationOperations: AnyOperation[] = [setNavigation];
