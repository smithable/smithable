import type { YamlEditor } from "../edit.js";
import { type AnyOperation, type Operation, OperationError, refTo } from "../operation.js";
import { FONTS, ICONS, THEME_PRESETS, TONES } from "../ux.js";

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
      const ux = editors.ux;
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
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      columns: refTo({ ref: "field", page: "page", label: "Columns" }, {}, true),
    },
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
    put(editors.ux, ["pages", page, "table", "columns"], columns);
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
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      fields: refTo({ ref: "field", page: "page", label: "Fields" }, {}, true),
    },
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
    put(editors.ux, ["pages", page, "form", "fieldOrder"], fields);
    return [];
  },
};

const setTone: Operation<{ model: string; field: string; value: string; tone: string }> = {
  name: "setTone",
  summary:
    "Give a choice value a colour by meaning, e.g. paid: success, overdue: warning (neutral: the default).",
  schema: {
    type: "object",
    required: ["model", "field", "value", "tone"],
    additionalProperties: false,
    properties: {
      model: refTo({ ref: "model", label: "Kind of record" }),
      field: refTo({ ref: "field", model: "model", label: "Field" }),
      value: refTo({ ref: "choiceValue", model: "model", field: "field", label: "Value" }),
      tone: { type: "string", enum: [...TONES] },
    },
  },
  positional: ["model", "field", "value", "tone"],
  describe: ({ model, field, value, tone }) => `Show ${model}.${field} ${value} as ${tone}`,
  destructive: () => false,
  apply(editors, { model, field, value, tone }, ir) {
    const type = ir.models
      .find((m) => m.name === model)
      ?.fields.find((f) => f.name === field)?.type;
    if (type?.kind !== "choice")
      throw new OperationError(`${model}.${field} is not a choice field.`);
    if (!type.values.includes(value))
      throw new OperationError(`${model}.${field} has no value "${value}".`);
    put(editors.ux, ["tones", `${model}.${field}`, value], tone === "neutral" ? undefined : tone);
    return [];
  },
};

const setIcon: Operation<{ page: string; icon: string }> = {
  name: "setIcon",
  summary: 'Choose the icon a page has in navigation ("auto": chosen from its model\'s name).',
  schema: {
    type: "object",
    required: ["page", "icon"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      icon: { type: "string", enum: [...ICONS, "auto"] },
    },
  },
  positional: ["page", "icon"],
  describe: ({ page, icon }) => `Show the ${page} page with the ${icon} icon`,
  destructive: () => false,
  apply(editors, { page, icon }, ir) {
    if (!ir.pages.some((p) => p.id === page))
      throw new OperationError(`There is no page named "${page}".`);
    put(editors.ux, ["pages", page, "icon"], icon === "auto" ? undefined : icon);
    return [];
  },
};

const setBelow: Operation<{ page: string; column: string; field: string }> = {
  name: "setBelow",
  summary:
    'Show a second field under a table column\'s value, e.g. phone under email ("none" removes it).',
  schema: {
    type: "object",
    required: ["page", "column", "field"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      column: refTo({ ref: "field", page: "page", label: "Column" }),
      field: refTo({ ref: "field", page: "page", label: "Under it" }),
    },
  },
  positional: ["page", "column", "field"],
  describe: ({ page, column, field }) =>
    field === "none"
      ? `Show nothing under ${column} in the ${page} table`
      : `Show ${field} under ${column} in the ${page} table`,
  destructive: () => false,
  apply(editors, { page, column, field }, ir) {
    if (!ir.pages.some((p) => p.id === page))
      throw new OperationError(`There is no page named "${page}".`);
    put(
      editors.ux,
      ["pages", page, "table", "below", column],
      field === "none" ? undefined : field,
    );
    return [];
  },
};

export const uxOperations: AnyOperation[] = [
  setTheme,
  setColumns,
  setFieldOrder,
  setTone,
  setIcon,
  setBelow,
];
