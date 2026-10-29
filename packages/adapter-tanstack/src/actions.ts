// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import {
  type ActionIR,
  type AuthIR,
  actionAccess,
  type FieldIR,
  humanize,
  kebab,
  type ModelIR,
  type PageIR,
  pascal,
  type QueryIR,
  type SpecIR,
  type StandardActionIR,
  titleField,
  USER_MODEL,
} from "@smithable/core";
import { checksLoaded, hasLocks, textBounds } from "./data.js";
import { formulaCompiler, formulasName } from "./formulas.js";
import { afterCustom, OUTGOING_IMPORT, toldAbout } from "./outgoing.js";
import {
  attr,
  dataKey,
  guard,
  HEADER,
  join,
  literal,
  modelNamed,
  names,
  ownerKey,
  SCHEMA_IMPORT,
  sequenceEntries,
  shownTitleKey,
  type Texts,
} from "./shared.js";

// ── Actions ──────────────────────────────────────────────────────────────────

/** The Zod schema of one input field of an action. */
export function zodFor(field: FieldIR): string {
  let schema: string;
  if (field.type.kind === "choice") schema = `z.enum(${literal(field.type.values)})`;
  else if (field.type.kind === "relation")
    schema =
      field.type.model === USER_MODEL
        ? "z.string()"
        : field.type.many
          ? // The rows picked, each once; a program gives at most a thousand at a time.
            "z.array(z.number().int()).min(1).max(1000).transform((ids) => [...new Set(ids)])"
          : "z.number().int()";
  else {
    switch (field.type.name) {
      case "int":
      case "money":
        schema = "z.number().int()";
        break;
      case "decimal":
        schema = "z.number()";
        break;
      case "bool":
        schema = "z.boolean()";
        break;
      case "datetime":
        schema = "z.date()";
        break;
      case "email":
        schema = "z.email(w.enterValidEmail)";
        break;
      case "url":
        schema = "z.url(w.enterValidUrl)";
        break;
      case "date":
        schema = "z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/, w.enterValidDate)";
        break;
      default:
        schema = `z.string()${["string", "text", "markdown"].includes(field.type.name) ? textBounds(field) : field.required ? ".trim().min(1, w.required)" : ""}`;
    }
  }
  return field.required ? schema : `${schema}.nullish()`;
}

/** The TypeScript type of one output field of an action. */
export function outputType(field: FieldIR): string {
  const base =
    field.type.kind === "choice"
      ? field.type.values.map((v) => JSON.stringify(v)).join(" | ")
      : field.type.kind === "relation"
        ? field.type.model === USER_MODEL
          ? "string"
          : "number"
        : ["int", "decimal", "money"].includes(field.type.name)
          ? "number"
          : field.type.name === "bool"
            ? "boolean"
            : field.type.name === "datetime"
              ? "Date"
              : "string";
  return field.required ? base : `${base} | null`;
}

export function actionNames(action: ActionIR) {
  const type = pascal(action.name);
  return {
    input: `${action.name}Input`,
    inputType: `${type}Input`,
    outputType: `${type}Output`,
    ui: `${action.name}Ui`,
    access: `${action.name}Access`,
    fits: `${action.name}Fits`,
    asks: `${action.name}Asks`,
    runMany: `run${type}Many`,
    many: `${action.name}Many`,
    askUi: `${action.name}AskUi`,
    askOptions: `${action.name}AskOptions`,
    run: `run${type}`,
    /** A custom action's fence (intents.md §6): the type of what its code may reach. */
    touches: `${type}Touches`,
    /** A merge (intents.md §3): which stays, and what merging two would do (the server's, the form's). */
    keep: `${action.name}Keep`,
    preview: `preview${type}`,
    previewFn: `${action.name}Preview`,
    /** A split (intents.md §4): its undo, on the server and as the page calls it. */
    undo: `undo${type}`,
    undoFn: `${action.name}Undo`,
    module: `#/generated/actions/${kebab(action.name)}`,
    custom: `#/custom/actions/${kebab(action.name)}`,
  };
}

/**
 * A custom action's input schema, in a module of its own: only its form and its server function
 * load it, so the validation library is not in every first page (the action's module is shared
 * by several of a page's chunks and may end up in the entry).
 */
export function actionInputModule(action: ActionIR): string {
  const a = actionNames(action);
  return `${HEADER}import { z } from "zod";

/** What the "${action.name}" action needs. */
export const ${a.input} = z.object({
${action.input.map((f) => `  ${f.name}: ${zodFor(f)},`).join("\n")}
});

export type ${a.inputType} = z.infer<typeof ${a.input}>;
`;
}

/**
 * A custom action's fence (docs/design/intents.md §6): the data functions its contract's touches
 * name, by model (reads: get and list; writes: those and create, update, remove, the update
 * narrowed to the fields named); its triggers are words only. The type goes to the action's module,
 * where the code reads it; the value is built in its server module. Undefined without touches.
 */
export function touchesParts(action: ActionIR, ir: SpecIR, t: Texts) {
  if (!action.custom || !action.touches) return undefined;
  const a = actionNames(action);
  const touches = action.touches ?? { reads: [], writes: [] };
  // A model written is reached through its write functions; users are only ever read here.
  const reads = touches.reads.filter(
    (m) => m === USER_MODEL || !touches.writes.some((w) => w.model === m),
  );
  if (touches.writes.some((w) => w.model === USER_MODEL) && !reads.includes(USER_MODEL))
    reads.push(USER_MODEL);
  const entries: { key: string; type: string; value: string; module?: string; data?: string }[] =
    [];
  for (const name of reads) {
    if (name === USER_MODEL) {
      entries.push({
        key: "user",
        type: "{ list: typeof listUsers }",
        value: "{ list: listUsers }",
        module: "#/generated/users.server",
        data: "listUsers",
      });
      continue;
    }
    const n = names(modelNamed(ir, name), t);
    entries.push({
      key: camelKey(name),
      type: `Pick<typeof ${n.data}, "get" | "list">`,
      value: `{ get: (...args: Parameters<typeof ${n.data}.get>) => ${n.data}.get(...args), list: (...args: Parameters<typeof ${n.data}.list>) => ${n.data}.list(...args) }`,
      module: `${n.module}.server`,
      data: n.data,
    });
  }
  // People are not written through a data function: who signs in is the users page's.
  for (const write of touches.writes.filter((w) => w.model !== USER_MODEL)) {
    const n = names(modelNamed(ir, write.model), t);
    const model = modelNamed(ir, write.model);
    const keys = write.fields?.map((f) =>
      dataKey(model.fields.find((x) => x.name === f) as FieldIR),
    );
    // Narrowed to the fields named: an update of others does not type-check.
    const update = keys
      ? `(viewer: Viewer | null, id: number, values: Pick<Parameters<typeof ${n.data}.update>[2], ${keys.map((k) => JSON.stringify(k)).join(" | ")}>) => ReturnType<typeof ${n.data}.update>`
      : `typeof ${n.data}.update`;
    entries.push({
      key: camelKey(write.model),
      type: `Pick<typeof ${n.data}, "get" | "list"${keys ? "" : ' | "create" | "remove"'}> & { update: ${update} }`,
      value: `{ get: (...args: Parameters<typeof ${n.data}.get>) => ${n.data}.get(...args), list: (...args: Parameters<typeof ${n.data}.list>) => ${n.data}.list(...args)${keys ? "" : `, create: (...args: Parameters<typeof ${n.data}.create>) => ${n.data}.create(...args), remove: (...args: Parameters<typeof ${n.data}.remove>) => ${n.data}.remove(...args)`}, update: (viewer: Viewer | null, id: number, values: Parameters<typeof ${n.data}.update>[2]) => ${n.data}.update(viewer, id, values) }`,
      module: `${n.module}.server`,
      data: n.data,
    });
  }
  const typeImports = [...new Map(entries.map((e) => [e.data, e.module])).entries()]
    .map(([data, module]) => `import type { ${data} } from "${module}";\n`)
    .join("");
  const type = `/** What the "${action.name}" code may reach (its contract's touches): a fence, not a wall. */
export interface ${a.touches} {
${entries.map((e) => `  ${e.key}: ${e.type};`).join("\n")}
}
`;
  const valueImports = [...new Map(entries.map((e) => [e.data, e.module])).entries()].map(
    ([data, module]) => ({ data: data as string, module: module as string }),
  );
  const value = `{
${entries.map((e) => `      ${e.key}: ${e.value},`).join("\n")}
    }`;
  return { type, typeImports, value, valueImports };
}

/** A model's name as a key of the fence: Invoice → invoice, OrderLine → orderLine. */
const camelKey = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

/**
 * What running a custom action does once the viewer is known, in its own server module: its server
 * function, the API, the assistants' tools and the development door all run it.
 */
function customRun(action: ActionIR, ir: SpecIR, t: Texts) {
  const a = actionNames(action);
  // Records the input refers to: the viewer must be able to read each (not users).
  const records = action.input.filter(
    (f) => f.type.kind === "relation" && f.type.model !== USER_MODEL,
  );
  const readers = records.map((f) => names(modelNamed(ir, (f.type as { model: string }).model), t));
  // On the rows picked in a list (A 171): what it asks besides them, and one Activity line a run.
  const rows = action.custom ? action.rows : undefined;
  const told = afterCustom(ir, action.name).length > 0;
  const fence = touchesParts(action, ir, t);
  // The data functions it reads the input's records with, and its fence's, each imported once.
  const dataImports = new Map<string, string>([
    ...readers.map((n): [string, string] => [n.data, `${n.module.replace(/\.ts$/, "")}.server`]),
    ...(fence?.valueImports ?? []).map((i): [string, string] => [i.data, i.module]),
  ]);
  const runImports = `${rows || told ? 'import { db } from "#/db";\n' : ""}${rows ? 'import { audit } from "#/kit/audit.server";\n' : ""}${told ? 'import { outgoingAfter } from "#/generated/outgoing.server";\nimport { log } from "#/kit/log.server";\n' : ""}import { ${action.name} as implementation } from "${a.custom}";
${[...dataImports].map(([data, module]) => `import { ${data} } from "${module}";\n`).join("")}`;
  const body = `${records
    .map((f, i) =>
      f.type.kind === "relation" && f.type.many
        ? `    if (!${readers[i]?.data}.canReadAll(viewer, data.${f.name})) throw new AccessDenied(true);\n`
        : `    if (data.${f.name} != null && !${readers[i]?.data}.canRead(viewer, data.${f.name})) throw new AccessDenied(true);\n`,
    )
    .join(
      "",
    )}    // The implementation may take the viewer too, e.g. to use the data functions as them.
    const run: (input: ${a.inputType}, viewer: Viewer | null${fence ? `, touched: ${a.touches}` : ""}) => Promise<${a.outputType}> = implementation;${
      fence
        ? `
    // What its contract lets the code reach, and nothing more (intents.md §6).
    const touched: ${a.touches} = ${fence.value};`
        : ""
    }${
      rows || told
        ? `
    const output = await run(data, viewer${fence ? ", touched" : ""});${
      rows
        ? `
    // One line in Activity for the run, with the rows it ran on.
    audit(db, viewer, { action: ${JSON.stringify(action.name)}, model: ${JSON.stringify(rows.model)}, details: { records: data.${rows.field} } });`
        : ""
    }${
      told
        ? `
    // Who is told once it has returned without an error (smithable.yml's outgoing, integrations.md §4.3).
    // The action has run: a mail or call that cannot be queued is logged, never its failure.
    try {
      db.transaction((tx) => outgoingAfter(tx, viewer, ${JSON.stringify(action.name)}, data, output));
    } catch (error) {
      log.error("What ${action.name} tells could not be queued", { error });
    }`
        : ""
    }
    return output;`
        : `
    return run(data, viewer${fence ? ", touched" : ""});`
    }`;
  return { records, rows, runImports, body };
}

export function actionModule(action: ActionIR, ir: SpecIR, auth: AuthIR, t: Texts): string {
  const a = actionNames(action);
  const output = action.output?.length
    ? `{ ${action.output.map((f) => `${f.name}: ${outputType(f)}`).join("; ")} }`
    : "void";
  const ui = {
    label: t.action(action),
    pluralLabel: t.action(action),
    titleField: "id",
    columns: [],
    fields: action.input.map((field) => ({
      name: field.name,
      label: humanize(field.name),
      kind:
        field.type.kind === "scalar"
          ? field.type.name
          : field.type.kind === "relation" && field.type.model === USER_MODEL
            ? "user"
            : field.type.kind,
      required: field.required,
      ...(field.type.kind === "choice"
        ? { choices: field.type.values.map((value) => ({ value, label: humanize(value) })) }
        : {}),
      ...(field.type.kind === "relation"
        ? { relation: { key: field.name, titleField: shownTitleKey(ir, field.type.model) } }
        : {}),
    })),
  };
  const rows = action.custom ? action.rows : undefined;
  const asksMore = Boolean(rows && action.input.length > 1);
  const fence = touchesParts(action, ir, t);
  return `${HEADER}${fence ? `${fence.typeImports}${fence.type.includes("viewer: Viewer") ? 'import type { Viewer } from "#/kit/access";\n' : ""}` : ""}import { createServerFn } from "@tanstack/react-start";
import { w } from "#/kit/words";
import { check, type Rule } from "#/kit/access";
import { writeAllowed } from "#/kit/limit";
import type { ModelUi } from "#/kit/model";
import { currentViewer } from "#/lib/viewer.server";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { ${a.input} } from "./${kebab(action.name)}.input";
import { ${a.run} } from "./${kebab(action.name)}.server";

export type { ${a.inputType} } from "./${kebab(action.name)}.input";

/** Who may run the "${action.name}" action. */
export const ${a.access}: Rule = ${literal(actionAccess(action, auth))};

/** What the "${action.name}" action returns. */
export type ${a.outputType} = ${output};
${fence ? `\n${fence.type}` : ""}

export const ${a.ui}: ModelUi = ${literal(ui)};
${
  rows && asksMore
    ? `
/** What a run on the rows picked asks for besides them, once for all of them (the selection bar). */
export const ${a.askUi}: ModelUi = { ...${a.ui}, fields: ${a.ui}.fields.filter((f) => f.name !== "${rows.field}") };
export const ${a.asks} = ${a.input}.omit({ ${rows.field}: true });
`
    : ""
}
export const ${action.name} = createServerFn({ method: "POST" })
  .validator(${a.input})
  .handler(async ({ data }) => {
    const viewer = await currentViewer();
    check(${a.access}, viewer);
    // A custom action changes things like any form: limited per person and address.
    writeAllowed(viewer, getRequestHeaders());
    return ${a.run}(viewer, data);
  });
`;
}

/**
 * A custom action, run as a viewer: its server function, the API's route for one on rows (A 171),
 * the assistants' tools and the development door all run it, so each checks and records it alike.
 */
export function customActionServer(action: ActionIR, ir: SpecIR, t: Texts): string {
  const a = actionNames(action);
  const { runImports, body } = customRun(action, ir, t);
  return `${HEADER}${runImports}import { AccessDenied, check, type Viewer } from "#/kit/access";
import { ${a.access}, type ${a.outputType}${touchesParts(action, ir, t) ? `, type ${a.touches}` : ""} } from "./${kebab(action.name)}";
import type { ${a.inputType} } from "./${kebab(action.name)}.input";

/** Runs "${action.name}" as \`viewer\`: its rule, the records it names, the run, what it records and tells. */
export async function ${a.run}(viewer: Viewer | null, data: ${a.inputType}): Promise<${a.outputType}> {
  check(${a.access}, viewer);
${body.replace(/^ {2}/gm, "")}
}
`;
}

/** The stored keys an action's condition reads (a reference by its key, assigneeId). */
export function whenKeys(action: StandardActionIR, ir: SpecIR): string[] {
  const model = modelNamed(ir, action.on);
  return Object.keys(action.when ?? {}).map((field) => {
    const f = model.fields.find((x) => x.name === field);
    return f ? dataKey(f) : field;
  });
}

/** Whether the condition names the person signed in (ME() or not ME()), so fits needs the viewer. */
export const whenNamesViewer = (action: StandardActionIR): boolean =>
  Object.values(action.when ?? {}).some((w) => w === "ME()" || w === "not ME()");

/** Whether a standard action's condition fits a record, as code on the stored row and the viewer. */
export function fitsCode(action: StandardActionIR, ir: SpecIR): string {
  const model = modelNamed(ir, action.on);
  const tests = Object.entries(action.when ?? {}).map(([field, wanted]) => {
    const f = model.fields.find((x) => x.name === field);
    if (f?.type.kind === "relation") {
      // A reference: empty, set, the viewer's own, or anyone's but the viewer's (also empty).
      const key = dataKey(f);
      if (wanted === "none") return `row.${key} == null`;
      if (wanted === "any") return `row.${key} != null`;
      if (wanted === "ME()") return `viewer != null && row.${key} === viewer.id`;
      return `(viewer == null || row.${key} !== viewer.id)`;
    }
    return typeof wanted === "boolean"
      ? // A boolean either way: true only when it is yes; no (or empty) when it is not.
        wanted
        ? `row.${field} === true`
        : `!row.${field}`
      : Array.isArray(wanted)
        ? `${JSON.stringify(wanted)}.includes(String(row.${field}))`
        : `row.${field} === ${JSON.stringify(wanted)}`;
  });
  return tests.length ? tests.join(" && ") : "true";
}

/**
 * A standard action (docs/design/actions.md): it loads the record through the model's data
 * functions (so access and the public condition apply), checks its condition, works out the new
 * values on the record as it was and saves them with the same update the edit form uses.
 */
/** The values a standard action asks for: the record's own, then each added record's (`Model.field`). */
export function askedFields(
  action: StandardActionIR,
): { model: string; field: string; key: string }[] {
  return [
    ...[...action.set, ...(action.copy ?? [])]
      .filter((v) => "asked" in v)
      .map((v) => ({ model: action.on, field: v.field, key: v.field })),
    // What the change makes required (record-rules.md §3), asked as the action's own fields are.
    ...(action.asksRequired ?? []).map((field) => ({ model: action.on, field, key: field })),
    ...(action.add ?? []).flatMap((a) =>
      a.values
        .filter((v) => "asked" in v)
        .map((v) => ({ model: a.model, field: v.field, key: `${a.model}.${v.field}` })),
    ),
  ];
}

/**
 * The asked values under the keys their forms and schemas use: a reference's is its stored key
 * (assigneeId), a plain field's its name; an added record's keeps its model in front.
 */
export function askedKeys(action: StandardActionIR, ir: SpecIR) {
  return askedFields(action).map((x) => {
    const field = modelNamed(ir, x.model).fields.find((f) => f.name === x.field) as FieldIR;
    const stored = dataKey(field);
    return { ...x, field: stored, key: x.key === x.field ? stored : `${x.model}.${stored}` };
  });
}

/**
 * The choices for the references an action asks for (a record's combobox, the people chooser),
 * loaded when its dialog opens: imports and the entries, or none when it asks for no reference.
 */
export function askOptions(action: StandardActionIR, ir: SpecIR, t: Texts) {
  const imports = new Map<string, string>();
  const entries = askedKeys(action, ir).flatMap((x) => {
    const field = modelNamed(ir, x.model).fields.find((f) => dataKey(f) === x.field);
    if (field?.type.kind !== "relation") return [];
    if (field.type.model === USER_MODEL) {
      imports.set("userOptions", "#/generated/users");
      return [`${JSON.stringify(x.key)}: await userOptions()`];
    }
    const target = names(modelNamed(ir, field.type.model), t);
    imports.set(target.options, target.module);
    return [`${JSON.stringify(x.key)}: await ${target.options}()`];
  });
  return entries.length ? { imports, entries } : undefined;
}

export function standardActionModule(
  action: StandardActionIR,
  ir: SpecIR,
  auth: AuthIR,
  t: Texts,
): string {
  const a = actionNames(action);
  const n = names(modelNamed(ir, action.on), t);
  const when = whenKeys(action, ir);
  const asked = askedKeys(action, ir);
  const models = [...new Set(asked.map((x) => x.model))].map((m) => names(modelNamed(ir, m), t));
  const named = (m: string) => names(modelNamed(ir, m), t);
  const choices = askOptions(action, ir, t);
  // What the change makes required is required in its dialog, whatever the record is now.
  const required = new Set(
    (action.asksRequired ?? []).map((name) =>
      dataKey(modelNamed(ir, action.on).fields.find((f) => f.name === name) as FieldIR),
    ),
  );
  const asks = asked.length
    ? `
/** What the "${action.name}" action asks for when its button is pressed. */
export const ${a.asks} = z.object({
${asked.map((x) => `  ${JSON.stringify(x.key)}: ${named(x.model).schema}.shape.${x.field},`).join("\n")}
});

/** The dialog's fields: the ${n.label.toLowerCase()}'s own, then each added record's under its heading. */
export const ${a.askUi}: ModelUi = {
  label: ${JSON.stringify(t.action(action))},
  pluralLabel: ${JSON.stringify(t.action(action))},
  titleField: "id",
  columns: [],
  fields: [
${asked.map((x) => `    ...${named(x.model).ui}.fields.filter((f) => f.name === ${JSON.stringify(x.field)})${x.key === x.field ? "" : `.map((f) => ({ ...f, name: ${JSON.stringify(x.key)} }))`}${required.has(x.key) ? ".map((f) => ({ ...f, required: true }))" : ""},`).join("\n")}
  ],
  sections: ${literal(
    [...new Set(asked.filter((x) => x.key !== x.field).map((x) => x.model))].map((m) => ({
      name: m,
      title: named(m).label,
      fields: asked.filter((x) => x.model === m && x.key !== x.field).map((x) => x.key),
    })),
  )},
};
${
  choices
    ? `
/** The choices of the references it asks for, loaded when its dialog opens. */
export async function ${a.askOptions}() {
  return { ${choices.entries.join(", ")} };
}
`
    : ""
}`
    : "";
  return `${HEADER}import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
${models.map((m) => `import { ${m.ui} } from "${m.module}";\nimport { ${m.schema} } from "${m.module}.schema";\n`).join("")}import type { Rule } from "#/kit/access";
import { w } from "#/kit/words";
import { getRequestHeaders } from "@tanstack/react-start/server";
${asked.length ? 'import type { ModelUi } from "#/kit/model";\n' : ""}${choices ? [...choices.imports].map(([fn, module]) => `import { ${fn} } from "${module}";\n`).join("") : ""}import { writeAllowed } from "#/kit/limit";
import { currentViewer } from "#/lib/viewer.server";
import { ${a.run}${action.copy ? "" : `, ${a.runMany}`} } from "./${kebab(action.name)}.server";

/** Who may run the "${action.name}" action: whoever may edit the ${n.label.toLowerCase()}${action.add ? ", and may create what it adds" : ""}. */
export const ${a.access}: Rule = ${literal(actionAccess(action, auth, ir.models))};

/** Whether the "${action.name}" action fits the ${n.label.toLowerCase()}: it is offered and allowed only then. */
export function ${a.fits}(${when.length ? "row" : "_row"}: { ${when.map((f) => `${f}?: unknown`).join("; ")}${when.length ? " " : ""}}, ${whenNamesViewer(action) ? "viewer" : "_viewer"}: { id: string } | null): boolean {
  return ${fitsCode(action, ir)};
}
${asks}
/** The viewer about to run it, counted against how often one may write (see src/kit/limit.ts). */
async function writer() {
  const viewer = await currentViewer();
  writeAllowed(viewer, getRequestHeaders());
  return viewer;
}

export const ${action.name} = createServerFn({ method: "POST" })
  .validator(${asked.length ? `z.object({ id: z.number().int(), values: ${a.asks} })` : "z.number().int()"})
  .handler(async ({ data }) => ${a.run}(await writer(), ${asked.length ? "data.id, data.values" : "data"}));
${
  action.copy
    ? ""
    : `
/** The "${action.name}" action on the chosen ${n.pluralLabel.toLowerCase()} (at most 1,000 at once). */
export const ${a.many} = createServerFn({ method: "POST" })
  .validator(z.object({ ids: z.array(z.number().int()).max(1000)${asked.length ? `, values: ${a.asks}` : ""} }))
  .handler(async ({ data }) => ${a.runMany}(await writer(), data.ids${asked.length ? ", data.values" : ""}));
`
}`;
}

/**
 * What a standard action does, on the server: loads the record through the model's data
 * functions (so access and the public condition apply), checks the condition, works out the new
 * values on the record as it was (the asked ones as given) and saves them: with the edit's
 * update, or, when it adds related records, in one transaction with their inserts.
 */
export function standardActionServer(
  action: StandardActionIR,
  ir: SpecIR,
  auth: AuthIR,
  t: Texts,
): string {
  const a = actionNames(action);
  const model = modelNamed(ir, action.on);
  const n = names(model, t);
  const { compile, stored, imports } = formulaCompiler(model, ir);
  // A value as code: a literal or a formula on the record ("row"), or what was asked.
  const valueCode = (target: ModelIR, v: StandardActionIR["set"][number], key: string) => {
    const field = target.fields.find((f) => f.name === v.field) as FieldIR;
    const scalar = field.type.kind === "scalar" ? field.type.name : field.type.kind;
    if ("asked" in v) {
      const stored = dataKey(field);
      return `${stored}: asked[${JSON.stringify(key === v.field ? stored : `${target.name}.${stored}`)}],`;
    }
    // ME(): the signed-in person who pressed the button (an action is never a visitor's).
    if ("me" in v) return `${field.name}Id: personOf(viewer),`;
    const code =
      "formula" in v
        ? stored(field, compile(v.formula, model, "row"))
        : scalar === "money"
          ? String(Math.round(Number(v.value) * 100))
          : JSON.stringify(v.value);
    // A date and time is stored as a Date; formulas and literals give its ISO text.
    return `${field.name}: ${scalar === "datetime" ? `new Date(${code})` : code},`;
  };
  if (action.copy) return copyActionServer(action, ir, auth, t, valueCode, imports);
  const values = [
    ...action.set.map((v) => valueCode(model, v, v.field)),
    // What the change makes required, as the person gave it in the dialog (record-rules.md §3).
    ...(action.asksRequired ?? []).map((name) =>
      valueCode(model, { field: name, asked: true }, name),
    ),
  ];
  const adds = (action.add ?? []).map((add) => {
    const target = modelNamed(ir, add.model);
    return {
      add,
      target,
      tn: names(target, t),
      values: add.values.map((v) => valueCode(target, v, `${add.model}.${v.field}`)),
    };
  });
  const all = [...values, ...adds.flatMap((x) => x.values)];
  const usesF = all.some((v) => v.includes("F."));
  const asked = askedFields(action).length > 0;
  const askedParam = asked ? `, asked: z.output<typeof ${a.asks}>` : "";
  const askedArg = asked ? ", asked" : "";
  const label = n.label.toLowerCase();
  const title = titleField(model);
  // The writes of one record's plan, inside a transaction ("tx"), each with its audit line,
  // returning what was written.
  const setFields = JSON.stringify([
    ...action.set.map((v) => v.field),
    ...(action.asksRequired ?? []),
  ]);
  // Who is told (outgoing mail, integrations.md §4.1b), in the same transaction.
  const tell = (m: string, what: string, record: string, before = "") =>
    toldAbout(ir, m)
      ? `\n      outgoing(tx, viewer, ${JSON.stringify(m)}, ${what}, ${record}${before && `, ${before}`});`
      : "";
  // The columns the action may change although locked: the fields its set gives a value, never
  // one it asks the person for (docs/design/actions.md, Access).
  const frees = action.set
    .filter((v) => !("asked" in v))
    .map((v) => dataKey(model.fields.find((f) => f.name === v.field) as FieldIR));
  // A record an action adds gets its numbers counting up as a create does (orders.md §4).
  const numbered = (m: ModelIR, table: string) =>
    sequenceEntries(m, auth, table, "personOf(viewer)")
      .map((e) => `, ${e}`)
      .join("");
  const sequenced = adds.map(({ target, tn }) => numbered(target, tn.table)).join("");
  // The record as it was, its change checked as update() checks one (A 153), the action's own
  // set freeing what it may change although locked; access is the action's, checked before.
  const writes = (p: string) => `{
      const before = tx.select().from(${n.table}).where(eq(${n.table}.id, ${p}.id)).get();
      if (!before) throw new AccessDenied(viewer !== null);
      const checked = ${n.data}.checkUpdate(tx, viewer, ${p}.id, ${p}.values, before${checksLoaded(model) ? `, ${p}.loaded` : ""}${hasLocks(model) ? `, ${JSON.stringify(action.name)}, ${JSON.stringify(frees)}` : ""});
      const changed = tx.update(${n.table}).set(checked).where(eq(${n.table}.id, ${p}.id)).returning().get();
      audit(tx, viewer, { action: ${JSON.stringify(action.name)}, model: ${JSON.stringify(model.name)}, record: changed.id, fields: ${setFields} });${tell(model.name, JSON.stringify(action.name), "changed", "before")}
      const inserted = [
${adds.map(({ target, tn }, i) => `        tx.insert(${tn.table}).values({ ...${tn.data}.checkCreate(tx, viewer, ${p}.added${i}), ${ownerKey(target)}: personOf(viewer)${numbered(target, tn.table)} }).returning().get(),`).join("\n")}
      ] as const;
${adds.map(({ target }, i) => `      audit(tx, viewer, { action: "created", model: ${JSON.stringify(target.name)}, record: inserted[${i}].id, details: { by: ${JSON.stringify(action.name)} } });${tell(target.name, '"created"', `inserted[${i}]`)}`).join("\n")}
      return { changed, inserted };
    }`;
  const hooks = (w: string) =>
    `  await afterChange("afterUpdate", ${JSON.stringify(model.name)}, ${w}.changed, viewer);
${adds.map(({ target }, i) => `  await afterChange("afterCreate", ${JSON.stringify(target.name)}, ${w}.inserted[${i}], viewer);`).join("\n")}`;
  return `${HEADER}import { eq${sequenced ? ", max" : ""} } from "drizzle-orm";
import { db } from "#/db";
${SCHEMA_IMPORT}
import { AccessDenied, allows, check, ${adds.length || all.some((v) => v.includes("personOf")) ? "personOf, " : ""}type Viewer } from "#/kit/access";
import { audit } from "#/kit/audit.server";
${sequenced ? 'import { nextInSequence } from "#/kit/sequence.server";\n' : ""}${[model.name, ...adds.map((x) => x.target.name)].some((m) => toldAbout(ir, m)) ? `${OUTGOING_IMPORT}\n` : ""}${usesF ? 'import { F } from "#/kit/formula";\n' : ""}${[...imports].map((m) => `import { ${formulasName(m)} } from "#/generated/${kebab(m.name)}.formulas";\n`).join("")}import { afterChange } from "#/generated/hooks";
import { ${n.settable} } from "${n.module}.schema";
import { ${n.data} } from "${n.module}.server";
${[...new Map(adds.map(({ target, tn }) => [target.name, tn])).values()].map((tn) => `import { ${tn.settable} } from "${tn.module}.schema";\n${tn.data === n.data ? `import { ${tn.access} } from "${tn.module}.server";` : `import { ${tn.access}, ${tn.data} } from "${tn.module}.server";`}\n`).join("")}import { ${a.access}, ${a.fits}${asked ? `, type ${a.asks}` : ""} } from "./${kebab(action.name)}";
${asked ? 'import type { z } from "zod";\n' : ""}
type Row = NonNullable<Awaited<ReturnType<typeof ${n.data}.get>>>;

/** The ${label}'s new values (only the fields the action sets${asked ? " and asks for" : ""})${adds.length ? " and the records it adds" : ""}, worked out on it as it was. */
function plan(${all.some((v) => v.includes("viewer")) ? "viewer" : "_viewer"}: Viewer | null, row: Row${askedParam}) {
  return {
    id: row.id,${checksLoaded(model) ? "\n    // As the page loads it, its formulas worked out: what a rule on a computed field reads.\n    loaded: row as Record<string, unknown>," : ""}
    values: ${n.settable}.partial().parse({
${values.map((v) => `      ${v}`).join("\n")}
    }),
${adds
  .map(
    ({ add }, i) => `    added${i}: ${adds[i]?.tn.settable}.parse({
      ${dataKeyOf(add.reference)}: row.id,
${adds[i]?.values.map((v) => `      ${v}`).join("\n")}
    }),`,
  )
  .join("\n")}
  };
}

/** Runs the "${action.name}" action on the ${label} as the viewer${asked ? ", with what was asked" : ""}. */
export async function ${a.run}(viewer: Viewer | null, id: number${askedParam}) {
  const row = await ${n.data}.get(viewer, id);
  if (!row) throw new AccessDenied(viewer !== null);
  check(${a.access}, viewer, row.${ownerKey(model)});
  if (!${a.fits}(row, viewer)) throw new Error("This cannot be done now.");
${adds.map(({ tn }) => `  check(${tn.access}.create, viewer);\n`).join("")}  const one = plan(viewer, row${askedArg});
${
  adds.length
    ? `  // One transaction: the change and the records it adds, or nothing.
  const written = db.transaction((tx) => ${writes("one")});
${hooks("written")}
  return written.changed;`
    : `  return ${n.data}.update(viewer, id, one.values, ${JSON.stringify(action.name)}, ${JSON.stringify(frees)});`
}
}

/**
 * Runs the "${action.name}" action on each chosen ${label} it fits and the viewer may run it on
 * (docs/design/actions.md §9); the others are skipped. All or none: one that is refused stops
 * them all, and is named.
 */
export async function ${a.runMany}(viewer: Viewer | null, ids: number[]${askedParam}) {
${adds.map(({ tn }) => `  check(${tn.access}.create, viewer);\n`).join("")}  const plans: ReturnType<typeof plan>[] = [];
  // An id given twice is one record, run once.
  const unique = [...new Set(ids)];
  for (const id of unique) {
    const row = await ${n.data}.get(viewer, id);
    if (!row || !allows(${a.access}, viewer, row.${ownerKey(model)}) || !${a.fits}(row, viewer)) continue;
    try {
      plans.push(plan(viewer, row${askedArg}));
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);
      throw new Error(\`${n.label} "\${String(row.${title} ?? row.id)}": \${why}\`);
    }
  }
  const written = db.transaction((tx) => plans.map((p) => ${writes("p")}));
  for (const w of written) {
${hooks("w").replace(/^ {2}/gm, "    ")}
  }
  return { changed: plans.length, skipped: unique.length - plans.length };
}
`;
}

/** A reference's key in a record, e.g. incidentId. */
const dataKeyOf = (reference: string) => `${reference}Id`;

/** The type of a query's result: records as the returned model's data functions give them. */
export function queryContract(query: QueryIR, ir: SpecIR, t: Texts): string {
  const n = names(modelNamed(ir, query.returns), t);
  return `${HEADER}import type { ${n.data} } from "#/generated/${kebab(query.returns)}.server";

/** What the "${query.name}" query returns: ${n.pluralLabel.toLowerCase()}, in its order. */
export type ${pascal(query.name)}Rows = Awaited<ReturnType<typeof ${n.data}.list>>;
`;
}

/**
 * The one-time stub of a query: it returns every record the viewer may read, so pages using
 * it work at once, with the query's intent and rules as the guide for the real code.
 */
export function queryStub(query: QueryIR, ir: SpecIR, t: Texts): string {
  const n = names(modelNamed(ir, query.returns), t);
  const doc = [
    ...(query.intent ? [query.intent] : query.description ? [query.description] : []),
    ...(query.rules?.length
      ? ["", "Rules (from smithable.yml):", ...query.rules.map((rule) => `- ${rule.text}`)]
      : []),
  ];
  return `// Your implementation of the "${query.name}" query in smithable.yml. Smithable created this file
// once and never changes it. Start from the records the viewer may read (the data functions in
// src/generated/*.server.ts check access), then choose and order them.
import { ${n.data} } from "#/generated/${kebab(query.returns)}.server";
import type { ${pascal(query.name)}Rows } from "#/generated/queries/${kebab(query.name)}";
import type { Viewer } from "#/kit/access";

${doc.length ? `/**\n${doc.map((l) => ` *${l ? ` ${l}` : ""}`).join("\n")}\n */\n` : ""}export async function ${query.name}(viewer: Viewer | null): Promise<${pascal(query.name)}Rows> {
  // Not written yet: every ${n.label.toLowerCase()} the viewer may read, newest first.
  return ${n.data}.list(viewer);
}
`;
}

/** The one-time stub of an action's implementation, with its intent and rules as a guide. */
export function actionStub(action: ActionIR): string {
  const a = actionNames(action);
  const doc = [
    ...(action.intent ? [action.intent] : action.description ? [action.description] : []),
    ...(action.rules?.length
      ? ["", "Rules (from smithable.yml):", ...action.rules.map((rule) => `- ${rule.text}`)]
      : []),
  ];
  return `// Your implementation of the "${action.name}" action in smithable.yml. Smithable created this file
// once and never changes it. The input and output types are generated from the spec, so a change
// to the action's input or output shows up here as a type error.
// \`viewer\` is the signed-in user (null for a visitor). The records the input refers to are ones
// they may read; the data functions in src/generated/*.server.ts check access for them.
import type { ${a.inputType}, ${a.outputType}${action.custom && action.touches ? `, ${a.touches}` : ""} } from "${a.module}";
import type { Viewer } from "#/kit/access";

${doc.length ? `/**\n${doc.map((l) => ` *${l ? ` ${l}` : ""}`).join("\n")}\n */\n` : ""}export async function ${action.name}(input: ${a.inputType}, _viewer: Viewer | null${action.custom && action.touches ? `, _touched: ${a.touches}` : ""}): Promise<${a.outputType}> {
  throw new Error(\`${action.name} is not implemented yet (input: \${JSON.stringify(input)}).\`);
}
`;
}

/** A page with a form for an action's input. */
export function actionRoute(page: PageIR, action: ActionIR, ir: SpecIR, t: Texts): string {
  const a = actionNames(action);
  const component = `${pascal(action.name)}Page`;
  const relations = action.input.filter((f) => f.type.kind === "relation");
  const optionFns = new Map<string, string>();
  const optionsFn = (f: FieldIR) => {
    const model = (f.type as { model: string }).model;
    if (model === USER_MODEL) return ["userOptions", "#/generated/users"];
    const target = names(modelNamed(ir, model), t);
    return [target.options, target.module];
  };
  for (const f of relations) {
    const [fn, module] = optionsFn(f) as [string, string];
    optionFns.set(fn, module);
  }
  const options = relations.map((f) => `${f.name}: await ${optionsFn(f)[0]}()`);
  const route = join(page.route, `actions/${kebab(action.name)}`);
  return `${HEADER}import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { app } from "#/generated/app";
import { ${action.name}, ${a.access}, ${a.ui} } from "${a.module}";
import { ${a.input} } from "${a.module}.input";
${[...optionFns].map(([fn, module]) => `import { ${fn} } from "${module}";`).join("\n")}${optionFns.size ? "\n" : ""}import { guardPage } from "#/kit/access";
import { PageHeader } from "#/kit/AppShell";
import { ModelForm } from "#/kit/ModelForm";

export const Route = createFileRoute(${JSON.stringify(route)})({
${guard(a.access)}${options.length ? `  loader: async () => ({ options: { ${options.join(", ")} } }),\n` : ""}  component: ${component},
});

function ${component}() {
${options.length ? "  const { options } = Route.useLoaderData();\n" : ""}  const navigate = useNavigate();
  const back = () => navigate({ to: ${JSON.stringify(page.route)} });
  return (
    <>
      <PageHeader title=${attr(t.action(action))}${t.actionHelp(action) ? ` subtitle=${attr(t.actionHelp(action) as string)}` : ""} />
      <ModelForm
        ui={${a.ui}}
        app={app}
        schema={${a.input}}
${options.length ? "        options={options}\n" : ""}        submitLabel=${attr(t.action(action))}
        onSubmit={async (values) => {
          await ${action.name}({ data: values });
          await back();
        }}
        onCancel={back}
      />
    </>
  );
}
`;
}

/** What a copy carries over: stored fields, not computed, unique, counting up, pictures or lists (§8). */
function copied(model: ModelIR, except: string[] = []): string[] {
  return model.fields
    .filter(
      (f) =>
        !f.formula &&
        !f.unique &&
        !f.sequence &&
        !(f.type.kind === "scalar" && (f.type.name === "picture" || f.type.name === "pictures")) &&
        !(f.type.kind === "relation" && f.type.many) &&
        !except.includes(f.name),
    )
    .map((f) => (f.type.kind === "relation" ? `${f.name}Id` : f.name));
}

/**
 * A copy (§8): the record's stored fields with what the action says differs, and the records of
 * the lists it names pointing at the new record, created in one transaction and owned by whoever
 * pressed the button. Returns the new record's id, whose page the person lands on.
 */
function copyActionServer(
  action: StandardActionIR,
  ir: SpecIR,
  auth: AuthIR,
  t: Texts,
  valueCode: (target: ModelIR, v: StandardActionIR["set"][number], key: string) => string,
  imports: Set<ModelIR>,
): string {
  const a = actionNames(action);
  const model = modelNamed(ir, action.on);
  const n = names(model, t);
  const values = (action.copy ?? []).map((v) => valueCode(model, v, v.field));
  const lists = (action.with ?? []).map((name) => {
    const field = model.fields.find((f) => f.name === name) as FieldIR;
    const listed = modelNamed(ir, (field.type as { model: string }).model);
    const back = listed.fields.find(
      (f) => f.type.kind === "relation" && !f.type.many && f.type.model === model.name,
    ) as FieldIR;
    return { name, listed, back, ln: names(listed, t) };
  });
  const asked = askedFields(action).length > 0;
  const usesF = values.some((v) => v.includes("F."));
  const pick = (from: string, keys: string[]) => keys.map((k) => `${k}: ${from}.${k}`).join(", ");
  // The copy, and its lists' copies, get their own numbers counting up (orders.md §4).
  const numbered = (m: ModelIR, table: string) =>
    sequenceEntries(m, auth, table, "personOf(viewer)")
      .map((e) => `, ${e}`)
      .join("");
  const sequenced = [
    numbered(model, n.table),
    ...lists.map((l) => numbered(l.listed, l.ln.table)),
  ].join("");
  const orm = [...(sequenced.includes("eq(") ? ["eq"] : []), ...(sequenced ? ["max"] : [])];
  return `${HEADER}${orm.length ? `import { ${orm.join(", ")} } from "drizzle-orm";\n` : ""}import { db } from "#/db";
${SCHEMA_IMPORT}
import { AccessDenied, check, personOf, type Viewer } from "#/kit/access";
import { audit } from "#/kit/audit.server";
${sequenced ? 'import { nextInSequence } from "#/kit/sequence.server";\n' : ""}${[model.name, ...lists.map((l) => l.listed.name)].some((m) => toldAbout(ir, m)) ? `${OUTGOING_IMPORT}\n` : ""}${usesF ? 'import { F } from "#/kit/formula";\n' : ""}${[...imports].map((m) => `import { ${formulasName(m)} } from "#/generated/${kebab(m.name)}.formulas";\n`).join("")}import { afterChange } from "#/generated/hooks";
import { ${n.schema} } from "${n.module}.schema";
import { ${n.data} } from "${n.module}.server";
${lists.map((l) => `import { ${l.ln.schema} } from "${l.ln.module}.schema";\n${l.ln.data === n.data ? "" : `import { ${l.ln.data} } from "${l.ln.module}.server";\n`}`).join("")}import { ${a.access}, ${a.fits}${asked ? `, type ${a.asks}` : ""} } from "./${kebab(action.name)}";
${asked ? 'import type { z } from "zod";\n' : ""}
/** Makes a copy of the ${n.label.toLowerCase()} as the viewer${asked ? ", with what was asked" : ""}; returns the copy's id. */
export async function ${a.run}(viewer: Viewer | null, id: number${asked ? `, asked: z.output<typeof ${a.asks}>` : ""}): Promise<number> {
  const row = await ${n.data}.get(viewer, id);
  if (!row) throw new AccessDenied(viewer !== null);
  check(${a.access}, viewer);
  if (!${a.fits}(row, viewer)) throw new Error("This cannot be done now.");
  // Its stored fields, then what the copy says differs (worked out on the original).
  const values = ${n.schema}.parse({
    ${pick(
      "row",
      copied(
        model,
        (action.copy ?? []).map((v) => v.field),
      ),
    )},
${values.map((v) => `    ${v}`).join("\n")}
  });
${lists
  .map(
    (l) => `  const ${l.name} = row.${l.name}.map((item) =>
    ${l.ln.schema}.parse({ ${pick("item", copied(l.listed, [l.back.name]))}, ${l.back.name}Id: 0 }),
  );`,
  )
  .join("\n")}
  // One transaction: the copy and its lists' records, or nothing.
  const { created${lists.map((l) => `, ${l.name}Copies`).join("")} } = db.transaction((tx) => {
    // A copy is checked as a new record is (A 153): its rules, capacity and time.
    const created = tx.insert(${n.table}).values({ ...${n.data}.checkCreate(tx, viewer, values), ${ownerKey(model)}: personOf(viewer)${numbered(model, n.table)} }).returning().get();
    audit(tx, viewer, { action: "copied", model: ${JSON.stringify(model.name)}, record: created.id, details: { from: row.id, by: ${JSON.stringify(action.name)} } });${toldAbout(ir, model.name) ? `\n    outgoing(tx, viewer, ${JSON.stringify(model.name)}, "created", created);\n    outgoing(tx, viewer, ${JSON.stringify(model.name)}, ${JSON.stringify(action.name)}, created);` : ""}
${lists
  .map(
    (l) => `    const ${l.name}Copies = ${l.name}.map((item) => {
      const copy = tx.insert(${l.ln.table}).values({ ...${l.ln.data}.checkCreate(tx, viewer, { ...item, ${l.back.name}Id: created.id }), ${ownerKey(l.listed)}: personOf(viewer)${numbered(l.listed, l.ln.table)} }).returning().get();
      audit(tx, viewer, { action: "created", model: ${JSON.stringify(l.listed.name)}, record: copy.id, details: { by: ${JSON.stringify(action.name)} } });${toldAbout(ir, l.listed.name) ? `\n      outgoing(tx, viewer, ${JSON.stringify(l.listed.name)}, "created", copy);` : ""}
      return copy;
    });`,
  )
  .join("\n")}
    return { created${lists.map((l) => `, ${l.name}Copies`).join("")} };
  });
  await afterChange("afterCreate", ${JSON.stringify(model.name)}, created, viewer);
${lists.map((l) => `  for (const item of ${l.name}Copies) await afterChange("afterCreate", ${JSON.stringify(l.listed.name)}, item, viewer);`).join("\n")}
  return created.id;
}
`;
}
