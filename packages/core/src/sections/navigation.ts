import { isSeq } from "yaml";
import { mapEntries, type ParseContext, readNameList } from "../context.js";
import type { MenuIR } from "../ir.js";
import type { SpecSection } from "../section.js";
import { NAME_PATTERN } from "./names.js";

const pageList = { type: "array", items: { type: "string" }, uniqueItems: true };

export const navigationSection: SpecSection<"navigation"> = {
  key: "navigation",
  required: false,
  schema: {
    description:
      "Menus: a list of pages (the main menu), or named menus. Defaults to all pages in order.",
    oneOf: [
      pageList,
      {
        type: "object",
        propertyNames: { pattern: NAME_PATTERN.source },
        additionalProperties: pageList,
      },
    ],
  },
  parse(ctx, node, parsed) {
    if (node === undefined) return [{ name: "main", pages: (parsed.pages ?? []).map((p) => p.id) }];
    if (isSeq(node)) return [readMenu(ctx, "main", node)];
    const menus: MenuIR[] = [];
    for (const { key, keyNode, value } of mapEntries(ctx, node, `"navigation"`) ?? []) {
      if (!NAME_PATTERN.test(key)) {
        ctx.error(
          keyNode,
          "invalid-name",
          `Menu name "${key}" must start with a lowercase letter and use only letters, digits and dashes.`,
        );
        continue;
      }
      menus.push(readMenu(ctx, key, value));
    }
    return menus;
  },
};

function readMenu(
  ctx: ParseContext,
  name: string,
  node: Parameters<typeof readNameList>[1],
): MenuIR {
  const pages: string[] = [];
  for (const { name: page, at } of readNameList(ctx, node, `menu "${name}"`)) {
    ctx.reference("page", page, at);
    if (pages.includes(page)) {
      ctx.warning(at, "duplicate-menu-item", `Page "${page}" appears twice in menu "${name}".`);
    } else {
      pages.push(page);
    }
  }
  return { name, pages };
}
