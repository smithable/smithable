import type { YamlEditor } from "../edit.js";
import { type AnyOperation, type Operation, OperationError } from "../operation.js";
import { FONTS, THEME_PRESETS } from "../ux.js";

/** Sets `value` at `path` in smithable.ux.yml, creating what is missing, or removes it. */
function put(ux: YamlEditor, path: string[], value: string | string[] | undefined): void {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) {
    if (ux.has(path)) ux.removeAndPrune(path, 0);
  } else if (ux.has(path)) {
    ux.set(path, value);
  } else {
    ux.add(path.slice(0, -1), path[path.length - 1] as string, value);
  }
}

function uxEditor(editors: { ux?: YamlEditor }): YamlEditor {
  if (!editors.ux) throw new OperationError("This project has no smithable.ux.yml editor.");
  return editors.ux;
}

const setTheme: Operation<{ preset?: string; primary?: string; font?: string; density?: string }> =
  {
    name: "setTheme",
    summary:
      'Choose the theme preset, brand colour, font or density ("none" removes the brand colour or font).',
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        preset: { type: "string", enum: [...THEME_PRESETS] },
        primary: { type: "string", description: 'A colour like "#2563eb", or "none".' },
        font: { type: "string", description: `${FONTS.join(", ")}, or "none".` },
        density: { type: "string", enum: ["comfortable", "compact"] },
      },
    },
    positional: [],
    describe: (args) =>
      `Set the theme: ${Object.entries(args)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ")}`,
    destructive: () => false,
    apply(editors, args) {
      const ux = uxEditor(editors);
      if (Object.keys(args).length === 0)
        throw new OperationError("Say what to set: preset, primary, font or density.");
      if (args.preset !== undefined) put(ux, ["theme", "preset"], args.preset);
      if (args.density !== undefined) put(ux, ["theme", "density"], args.density);
      for (const key of ["primary", "font"] as const) {
        const value = args[key];
        if (value !== undefined)
          put(ux, ["theme", "brand", key], value === "none" ? undefined : value);
      }
      return [];
    },
  };

const setColumns: Operation<{ page: string; columns?: string[] }> = {
  name: "setColumns",
  summary: "Choose which fields a page's table shows, in order (none: back to the default).",
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: { page: { type: "string" }, columns: { type: "array", items: { type: "string" } } },
  },
  positional: ["page", "...columns"],
  describe: ({ page, columns }) =>
    columns?.length
      ? `Show ${columns.join(", ")} in the ${page} table`
      : `Show the default columns in the ${page} table`,
  destructive: () => false,
  apply(editors, { page, columns }, ir) {
    if (!ir.pages.some((p) => p.id === page))
      throw new OperationError(`There is no page named "${page}".`);
    put(uxEditor(editors), ["pages", page, "table", "columns"], columns);
    return [];
  },
};

const setFieldOrder: Operation<{ page: string; fields?: string[] }> = {
  name: "setFieldOrder",
  summary: "Order the fields of a page's form; fields not listed follow (none: the spec's order).",
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: { page: { type: "string" }, fields: { type: "array", items: { type: "string" } } },
  },
  positional: ["page", "...fields"],
  describe: ({ page, fields }) =>
    fields?.length
      ? `Order the ${page} form: ${fields.join(", ")}`
      : `Use the spec's field order in the ${page} form`,
  destructive: () => false,
  apply(editors, { page, fields }, ir) {
    if (!ir.pages.some((p) => p.id === page))
      throw new OperationError(`There is no page named "${page}".`);
    put(uxEditor(editors), ["pages", page, "form", "fieldOrder"], fields);
    return [];
  },
};

export const uxOperations: AnyOperation[] = [setTheme, setColumns, setFieldOrder];
