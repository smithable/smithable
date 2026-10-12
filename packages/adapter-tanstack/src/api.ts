// Part of the TanStack adapter's generator: the API (docs/design/integrations.md §2). For each
// model the auth file's `api` block offers: list (pages of at most 100), get, create, change and
// delete under /api/v1/<models>, its standard actions on a record, and an OpenAPI description.
// Every call is a key's, through the model's data functions, so a key may do what its role may.
import {
  type AssistantCaller,
  type AuthIR,
  apiOffers,
  asksWith,
  assistantOffer,
  type ContentIR,
  FILES_MAX,
  type FieldIR,
  isFiles,
  isPictures,
  isUpload,
  kebab,
  type ModelIR,
  PICTURES_MAX,
  plural,
  type SpecIR,
  type StandardActionIR,
  storesFiles,
  type Voice,
} from "@smithable/core";
import { actionNames, askedFields } from "./actions.js";
import {
  dataKey,
  HEADER,
  literal,
  modelNamed,
  names,
  ownerKey,
  relatedTitle,
  type Texts,
  titleField,
} from "./shared.js";

/**
 * The fields a program reads and writes as JSON: everything but pictures and documents (sent and
 * fetched at their own address, /api/v1/<models>/<id>/<field>) and the lists of related records,
 * which are reached from the other side (their own model's route).
 */
export const apiFields = (model: ModelIR) =>
  model.fields.filter((f) => !isUpload(f) && !(f.type.kind === "relation" && f.type.many));
const entered = (model: ModelIR) =>
  apiFields(model).filter((f) => !f.formula && !(f.type.kind === "relation" && f.type.many));
const kind = (f: FieldIR) => (f.type.kind === "scalar" ? f.type.name : f.type.kind);

/** The models and actions offered, with what generating them needs. */
export function apiParts(ir: SpecIR, auth: AuthIR, t: Texts) {
  const offered = apiOffers(auth, ir);
  return {
    models: offered.models.map((name) => {
      const model = modelNamed(ir, name);
      return { model, n: names(model, t), path: kebab(plural(name)) };
    }),
    actions: ir.actions.filter(
      (a): a is StandardActionIR => !a.custom && offered.actions.includes(a.name),
    ),
    /** What a call without a key may do (api-only.md §3.4): read and add, never more. */
    visitors: offered.visitors,
  };
}

/** A value as the API gives it, from a record's (code on `row`). */
export function readCode(f: FieldIR): string {
  if (f.type.kind === "relation") return `row.${f.name}Id ?? null`;
  switch (kind(f)) {
    case "money":
      return `row.${f.name} == null ? null : (Number(row.${f.name}) / 100).toFixed(2)`;
    case "datetime":
      return `row.${f.name} instanceof Date ? row.${f.name}.toISOString() : (row.${f.name} ?? null)`;
    default:
      return `row.${f.name} ?? null`;
  }
}

/** A value as the data functions take it, from the API's (code on `v`), or a refusal. */
function writeCode(f: FieldIR): string {
  if (f.type.kind === "relation")
    return `values.${f.name}Id = v === null ? null : whole(v, "${f.name}");`;
  switch (kind(f)) {
    case "money":
      return `values.${f.name} = v === null ? null : Math.round(amount(v, "${f.name}") * 100);`;
    case "datetime":
      return `values.${f.name} = v === null ? null : moment(v, "${f.name}");`;
    default:
      return `values.${f.name} = v;`;
  }
}

/** An OpenAPI schema for a field's value. */
function fieldSchema(f: FieldIR): Record<string, unknown> {
  if (f.type.kind === "relation")
    return { type: "integer", description: `The id of a ${f.type.model}` };
  if (f.type.kind === "choice") return { type: "string", enum: f.type.values };
  switch (kind(f)) {
    case "int":
      return { type: "integer" };
    case "decimal":
      return { type: "number" };
    case "money":
      return { type: "string", description: "An amount as a decimal text, e.g. 12.50" };
    case "bool":
      return { type: "boolean" };
    case "date":
      return { type: "string", format: "date" };
    case "datetime":
      return { type: "string", format: "date-time" };
    case "email":
      return { type: "string", format: "email" };
    case "url":
      return { type: "string", format: "uri" };
    default:
      return { type: "string" };
  }
}

/** src/generated/api.server.ts: each offered model's conversions, and the OpenAPI description. */
export function apiModule(ir: SpecIR, auth: AuthIR, t: Texts): string {
  const { models, actions } = apiParts(ir, auth, t);
  const paths: Record<string, unknown> = {};
  const schemas: Record<string, unknown> = {};
  const problem = {
    description: "Refused, with the app's own words",
    content: { "application/problem+json": { schema: { $ref: "#/components/schemas/Problem" } } },
  };
  for (const { model, n, path } of models) {
    const fields = apiFields(model);
    schemas[model.name] = {
      type: "object",
      properties: {
        id: { type: "integer", readOnly: true },
        ...Object.fromEntries(
          fields.map((f) => [
            f.name,
            { ...fieldSchema(f), ...(f.formula ? { readOnly: true } : {}) },
          ]),
        ),
        createdAt: { type: "string", format: "date-time", readOnly: true },
        updatedAt: { type: "string", format: "date-time", readOnly: true },
      },
      required: entered(model)
        .filter((f) => f.required)
        .map((f) => f.name),
    };
    const one = {
      content: { "application/json": { schema: { $ref: `#/components/schemas/${model.name}` } } },
    };
    paths[`/api/v1/${path}`] = {
      get: {
        summary: `${n.pluralLabel} the key's role may read`,
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          ...(model.trash
            ? [
                {
                  name: "trashed",
                  in: "query",
                  description: "true: the records in the trash the key's role may delete",
                  schema: { type: "boolean" },
                },
              ]
            : []),
        ],
        responses: {
          200: { description: `A page of ${n.pluralLabel.toLowerCase()}` },
          401: problem,
        },
      },
      post: {
        summary: `Add a ${n.label.toLowerCase()}`,
        requestBody: one,
        responses: {
          201: { description: "Added", ...one },
          401: problem,
          403: problem,
          422: problem,
        },
      },
    };
    paths[`/api/v1/${path}/{id}`] = {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
      get: {
        summary: `One ${n.label.toLowerCase()}`,
        responses: {
          200: { description: "The record", ...one },
          404: problem,
          ...(model.trash
            ? {
                410: {
                  ...problem,
                  description: "In the trash: deletedAt, deletedBy, removedOn, restore",
                },
              }
            : {}),
        },
      },
      patch: {
        summary: `Change a ${n.label.toLowerCase()} (the fields given)`,
        requestBody: one,
        responses: {
          200: { description: "Changed", ...one },
          403: problem,
          404: problem,
          422: problem,
        },
      },
      delete: {
        summary: model.trash
          ? `Move a ${n.label.toLowerCase()} to the trash; with permanent=true, remove one in the trash for good`
          : `Delete a ${n.label.toLowerCase()}`,
        description: `A ${n.label.toLowerCase()} that other records point to with a required reference is refused with 409 and the facts: what points to it, by kind and count (with), what would show no ${n.label.toLowerCase()} (loose), and whether they can go to the trash together.${
          model.trash
            ? " With together=true they are moved to the trash with it, and restored with it."
            : ""
        }`,
        ...(model.trash
          ? {
              parameters: [
                { name: "permanent", in: "query", schema: { type: "boolean" } },
                { name: "together", in: "query", schema: { type: "boolean" } },
              ],
            }
          : {}),
        responses: { 204: { description: "Deleted" }, 403: problem, 404: problem, 409: problem },
      },
    };
    if (model.trash)
      paths[`/api/v1/${path}/{id}/restore`] = {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        post: {
          summary: `Take a ${n.label.toLowerCase()} out of the trash`,
          responses: { 200: { description: "Restored", ...one }, 401: problem, 404: problem },
        },
      };
  }
  for (const action of actions) {
    const path = models.find((m) => m.model.name === action.on)?.path;
    paths[`/api/v1/${path}/{id}/actions/${action.name}`] = {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
      post: {
        summary: action.intent ?? action.name,
        ...(askedFields(action).length
          ? {
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      description: `What the action asks for: ${askedFields(action)
                        .map((x) => x.key)
                        .join(", ")}`,
                    },
                  },
                },
              },
            }
          : {}),
        responses: {
          200: { description: "Done: the record as it is now" },
          403: problem,
          404: problem,
          409: problem,
        },
      },
    };
  }
  schemas.Problem = {
    type: "object",
    properties: {
      status: { type: "integer" },
      title: { type: "string" },
      errors: { type: "array", items: { type: "object" } },
    },
  };
  const openapi = {
    openapi: "3.1.0",
    info: { title: ir.app.name, version: "1", description: ir.app.description ?? "" },
    paths,
    components: {
      schemas,
      securitySchemes: {
        key: { type: "http", scheme: "bearer", description: "A key made on the users page" },
      },
    },
    security: [{ key: [] }],
  };
  // What a stranger is shown (api-only.md §3.4): the reading and adding anyone may do, no key.
  const { visitors } = apiParts(ir, auth, t);
  const visitorPaths: Record<string, unknown> = {};
  for (const { model, n, path } of models) {
    const list = paths[`/api/v1/${path}`] as Record<string, unknown>;
    const one = paths[`/api/v1/${path}/{id}`] as Record<string, unknown>;
    const read = visitors.read.includes(model.name);
    const add = visitors.create.includes(model.name);
    if (read || add)
      visitorPaths[`/api/v1/${path}`] = {
        ...(read
          ? { get: { ...(list.get as object), summary: `${n.pluralLabel} anyone may read` } }
          : {}),
        ...(add ? { post: list.post } : {}),
      };
    if (read) visitorPaths[`/api/v1/${path}/{id}`] = { parameters: one.parameters, get: one.get };
  }
  // Only the visitors' models' schemas: a closed app names no model or field to a stranger.
  const shown = [...visitors.read, ...visitors.create, "Problem"];
  const visitorApi = {
    openapi: openapi.openapi,
    info: openapi.info,
    paths: visitorPaths,
    components: {
      schemas: Object.fromEntries(Object.entries(schemas).filter(([k]) => shown.includes(k))),
    },
  };
  return `${HEADER}// The API's conversions (docs/design/integrations.md §2): records as programs read them (the
// spec's field names, amounts as decimal texts, times as ISO texts) and their values back, checked
// by each model's own schema, as a form's are.
import { BadInput } from "#/kit/api.server";
${conversionsCode(models)}

/** The whole API in the OpenAPI format, for tools and agents. */
export const OPENAPI = ${JSON.stringify(openapi, null, 2)};

/** What a stranger is shown: the reading and adding anyone may do; nothing in a closed app. */
export const VISITOR_OPENAPI = ${JSON.stringify(visitorApi, null, 2)};
`;
}

/**
 * Records as programs and assistants read them (the spec's field names, amounts as decimal texts,
 * times as ISO texts) and their values back, checked by each model's own schema: the
 * `<model>ToApi` and `<model>FromApi` functions, with only the helpers some field needs. The
 * caller imports BadInput.
 */
function conversionsCode(models: { model: ModelIR; n: ReturnType<typeof names> }[]): string {
  const uses = (k: string) => models.some(({ model }) => entered(model).some((f) => kind(f) === k));
  return `${models.map(({ n }) => `import { ${n.schema} } from "${n.module}.schema";`).join("\n")}

${
  uses("relation")
    ? `const whole = (v: unknown, field: string) => {
  if (Number.isInteger(v)) return v as number;
  throw new BadInput(\`"\${field}" must be a record's id, a whole number.\`);
};
`
    : ""
}${
  uses("money")
    ? `const amount = (v: unknown, field: string) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.trim()) : Number.NaN;
  if (Number.isFinite(n)) return n;
  throw new BadInput(\`"\${field}" must be an amount, like "12.50".\`);
};
`
    : ""
}${
  uses("datetime")
    ? `const moment = (v: unknown, field: string) => {
  const d = typeof v === "string" ? new Date(v) : undefined;
  if (d && !Number.isNaN(d.getTime())) return d;
  throw new BadInput(\`"\${field}" must be a date and time, like "2026-10-04T09:30:00Z".\`);
};
`
    : ""
}
/** The body as an object of known fields, or a refusal naming the first unknown one. */
function fieldsOf(body: unknown, known: readonly string[]): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new BadInput("The body must be a JSON object.");
  const unknown = Object.keys(body).find((k) => !known.includes(k));
  if (unknown) throw new BadInput(\`There is no field "\${unknown}" to set. Fields: \${known.join(", ")}.\`);
  return body as Record<string, unknown>;
}
${models
  .map(({ model, n }) => {
    const fields = apiFields(model);
    const writable = entered(model);
    const camelName = model.name[0]?.toLowerCase() + model.name.slice(1);
    return `
/** A ${n.label.toLowerCase()} as the API gives it. */
export function ${camelName}ToApi(row: Record<string, any>) {
  return {
    id: row.id as number,
${fields.map((f) => `    ${f.name}: ${readCode(f)},`).join("\n")}
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

/** A ${n.label.toLowerCase()}'s values from a body: all of them, or a change to \`current\`. */
export function ${camelName}FromApi(body: unknown, current?: Record<string, unknown>) {
  const given = fieldsOf(body, ${literal(writable.map((f) => f.name))});
  const values: Record<string, unknown> = { ...current };
  for (const [key, v] of Object.entries(given))
    switch (key) {
${writable.map((f) => `      case ${JSON.stringify(f.name)}:\n        ${writeCode(f)}\n        break;`).join("\n")}
    }
  return ${n.schema}.parse(values);
}`;
  })
  .join("\n")}`;
}

/** The routes: list and add, one record, its actions, and the description. */
export function apiRoutes(ir: SpecIR, auth: AuthIR, t: Texts): Record<string, string> {
  const { models, actions, visitors } = apiParts(ir, auth, t);
  const users = ir.pages.find((p) => p.pattern.kind === "users");
  const files: Record<string, string> = {
    "src/routes/api/v1/openapi[.]json.ts": `${HEADER}// The API's description in the OpenAPI format, with no key needed to read it: with a key, or
// signed in as someone who may open the users page (its download), all a program may call; otherwise what anyone may read
// or add, which in an app with nothing public is nothing (no model or field names to a stranger).
import { createFileRoute } from "@tanstack/react-router";
import { OPENAPI, VISITOR_OPENAPI } from "#/generated/api.server";
${users ? 'import { pageAccess } from "#/generated/pages";\nimport { allows } from "#/kit/access";\n' : ""}import { callerOf } from "#/kit/api.server";
import { currentViewer } from "#/lib/viewer.server";

export const Route = createFileRoute("/api/v1/openapi.json")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // A key; or signed in as someone who may open the users page, where keys are made.
        const session = await currentViewer();
        const whole = callerOf(request).viewer || ${users ? `(session && allows(pageAccess[${JSON.stringify(users.id)}], session))` : "session"};
        return Response.json(whole ? OPENAPI : VISITOR_OPENAPI);
      },
    },
  },
});
`,
  };
  for (const { model, n, path } of models) {
    const camelName = model.name[0]?.toLowerCase() + model.name.slice(1);
    const own = actions.filter((a) => a.on === model.name);
    // What anyone may read or add takes a call without a key too, as the visitor.
    const reads = visitors.read.includes(model.name) ? "openApiCall" : "apiCall";
    const adds = visitors.create.includes(model.name) ? "openApiCall" : "apiCall";
    files[`src/routes/api/v1/${path}/index.ts`] =
      `${HEADER}// ${n.pluralLabel} for programs with a key (docs/design/integrations.md §2): what the key's role may read, a page at a time, and adding one.
import { createFileRoute } from "@tanstack/react-router";
import { ${camelName}FromApi, ${camelName}ToApi } from "#/generated/api.server";
import { ${n.data} } from "#/generated/${kebab(model.name)}.server";
import { ${[...new Set([reads, adds])].sort().join(", ")} } from "#/kit/api.server";
import { whereFromQuery } from "#/kit/where";

export const Route = createFileRoute("/api/v1/${path}/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        ${reads}(request, async (viewer) => {
          const query = new URL(request.url).searchParams;${
            model.trash
              ? `
          // ?trashed=true: the trash, what this key may delete in it (docs/design/trash.md).
          if (query.get("trashed") === "true") {
            const rows = await ${n.data}.trash(viewer);
            const items = rows.map((row) => ({ ...${camelName}ToApi(row), deletedAt: row.deletedAt instanceof Date ? row.deletedAt.toISOString() : row.deletedAt }));
            return { items, page: 1, pages: 1, total: items.length };
          }`
              : ""
          }
          const limit = Math.min(100, Math.max(1, Number(query.get("limit")) || 100));
          const page = Math.max(1, Number(query.get("page")) || 1);
          // Filters as fields (?status=sent, a list as a,b, a range as from..to, mine=true), search, sort.
          const where = whereFromQuery(query, ["limit", "page", "search", "sort", "sum"]);
          const search = query.get("search") ?? undefined;
          const { items, total } = await ${n.data}.find(viewer, {
            where,
            search,
            sort: query.get("sort") ?? undefined,
            limit,
            offset: (page - 1) * limit,
          });
          // ?sum=total adds up a number field over every record that fits, not only this page.
          const sums = query.get("sum")?.split(",").filter(Boolean);
          return {
            items: items.map(${camelName}ToApi),
            page,
            pages: Math.max(1, Math.ceil(total / limit)),
            total,
            ...(sums?.length
              ? { sums: Object.fromEntries(await Promise.all(sums.map(async (field) => [field, await ${n.data}.measure(viewer, "sum", { field, where, search })]))) }
              : {}),
          };
        }),
      POST: ({ request }) =>
        ${adds}(request, async (viewer, body) => ${camelName}ToApi(await ${n.data}.create(viewer, ${camelName}FromApi(body) as never)), 201),
    },
  },
});
`;
    // The same list as CSV, for a spreadsheet: every record that fits, at most 10,000.
    files[`src/routes/api/v1/${path}[.]csv.ts`] =
      `${HEADER}// ${n.pluralLabel} as CSV for programs with a key: the same filters, search and sort as the JSON list.
import { createFileRoute } from "@tanstack/react-router";
import { ${n.ui} } from "${n.module}";
import { ${n.data} } from "#/generated/${kebab(model.name)}.server";
import { ${reads} } from "#/kit/api.server";
import { csvOf } from "#/kit/csv";
import { whereFromQuery } from "#/kit/where";

export const Route = createFileRoute("/api/v1/${path}.csv")({
  server: {
    handlers: {
      GET: ({ request }) =>
        ${reads}(request, async (viewer) => {
          const query = new URL(request.url).searchParams;
          const { items } = await ${n.data}.find(viewer, {
            where: whereFromQuery(query, ["search", "sort"]),
            search: query.get("search") ?? undefined,
            sort: query.get("sort") ?? undefined,
            limit: 10_000,
          });
          return new Response(csvOf(${n.ui}, items as never), {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": 'attachment; filename="${path}.csv"',
            },
          });
        }),
    },
  },
});
`;
    files[`src/routes/api/v1/${path}/$id.ts`] =
      `${HEADER}// One ${n.label.toLowerCase()} for programs with a key: read, change (the fields given) or delete it.
import { createFileRoute } from "@tanstack/react-router";
import { ${camelName}FromApi, ${camelName}ToApi } from "#/generated/api.server";
import { ${n.data} } from "#/generated/${kebab(model.name)}.server";
import { ${[...(reads === "openApiCall" ? ["apiCall", "openApiCall"] : ["apiCall"]), ...(model.trash ? ["Gone"] : []), "NotFound"].sort().join(", ")} } from "#/kit/api.server";

const found = async (viewer: Parameters<typeof ${n.data}.get>[0], id: string) => {
  const row = await ${n.data}.get(viewer, Number(id));${
    model.trash
      ? `
  // In the trash (docs/design/trash.md): gone, with when, by whom and how to restore it.
  const gone = row ? null : await ${n.data}.trashed(viewer, Number(id));
  if (gone)
    throw new Gone("This ${n.label.toLowerCase()} is in the trash.", {
      deletedAt: gone.deletedAt.toISOString(),
      deletedBy: gone.by,
      removedOn: gone.until.toISOString(),
      restore: \`/api/v1/${path}/\${id}/restore\`,
    });`
      : ""
  }
  if (!row) throw new NotFound("No such ${n.label.toLowerCase()}, or not one this key may read.");
  return row;
};

export const Route = createFileRoute("/api/v1/${path}/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) => ${reads}(request, async (viewer) => ${camelName}ToApi(await found(viewer, params.id))),
      PATCH: ({ request, params }) =>
        apiCall(request, async (viewer, body) => {
          const row = await found(viewer, params.id);
          return ${camelName}ToApi(await ${n.data}.update(viewer, row.id, ${camelName}FromApi(body, row) as never));
        }),
      DELETE: ({ request, params }) =>
        apiCall(request, async (viewer) => {${
          model.trash
            ? `
          // ?permanent=true removes a record in the trash for good; otherwise it goes to the trash.
          if (new URL(request.url).searchParams.get("permanent") === "true") {
            if (!${n.data}.removeForGood(viewer, [Number(params.id)]).deleted)
              throw new NotFound("No such ${n.label.toLowerCase()} in the trash, or not one this key may delete.");
            return;
          }`
            : ""
        }
          const row = await found(viewer, params.id);
          // ?together=true takes the records that point to it along (docs/design/delete-together.md).
          await ${n.data}.remove(viewer, row.id, new URL(request.url).searchParams.get("together") === "true");
        }),
    },
  },
});
`;
    // Out of the trash (docs/design/trash.md): the record restored, as GET gives it.
    if (model.trash)
      files[`src/routes/api/v1/${path}/$id.restore.ts`] =
        `${HEADER}// A ${n.label.toLowerCase()} taken out of the trash, by a key whose role may delete it.
import { createFileRoute } from "@tanstack/react-router";
import { ${camelName}ToApi } from "#/generated/api.server";
import { ${n.data} } from "#/generated/${kebab(model.name)}.server";
import { apiCall, NotFound } from "#/kit/api.server";

export const Route = createFileRoute("/api/v1/${path}/$id/restore")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        apiCall(request, async (viewer) => {
          const id = Number(params.id);
          if (!${n.data}.restore(viewer, [id]).restored)
            throw new NotFound("No such ${n.label.toLowerCase()} in the trash, or not one this key may restore.");
          const row = await ${n.data}.get(viewer, id);
          if (!row) throw new NotFound("No such ${n.label.toLowerCase()}, or not one this key may read.");
          return ${camelName}ToApi(row);
        }),
    },
  },
});
`;
    // Its pictures and documents: fetched, and sent as the body (docs/design/attachments.md §2).
    const uploads = model.fields.filter(isUpload);
    if (uploads.length)
      files[`src/routes/api/v1/${path}/$id.$field.ts`] =
        `${HEADER}// A ${n.label.toLowerCase()}'s pictures and documents, for programs with a key: GET one (?n= for the n-th of
// several), PUT one as the body (a document's name in X-File-Name, a picture's description in
// X-Alt); a field of several gets it added.
import { createFileRoute } from "@tanstack/react-router";
import { ${n.data} } from "#/generated/${kebab(model.name)}.server";
import { BadInput, bytesOf, fileCall, NotFound } from "#/kit/api.server";
import { receiptFor } from "#/kit/receipts.server";
import {
  BadFile,
  BadPicture,
  FILE_MAX_BYTES,
  PICTURE_MAX_BYTES,
  saveFile,
  savePicture,
  scanned,
  uploadResponse,
} from "#/kit/uploads";

const FIELDS: Record<string, { kind: "picture" | "file"; key: string; many: boolean; max: number }> = {
${uploads.map((f) => `  ${JSON.stringify(f.name)}: { kind: "${storesFiles(f) ? "file" : "picture"}", key: ${JSON.stringify(dataKey(f))}, many: ${isFiles(f) || isPictures(f)}, max: ${isFiles(f) ? FILES_MAX : (f.max ?? PICTURES_MAX)} },`).join("\n")}
};

async function target(viewer: Parameters<typeof ${n.data}.get>[0], id: string, name: string) {
  const field = FIELDS[name];
  if (!field) throw new NotFound("This ${n.label.toLowerCase()} has no picture or document by that name.");
  const row = await ${n.data}.get(viewer, Number(id));
  if (!row) throw new NotFound("No such ${n.label.toLowerCase()}, or not one this key may read.");
  return { field, row, value: (row as Record<string, unknown>)[field.key] };
}

export const Route = createFileRoute("/api/v1/${path}/$id/$field")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        fileCall(request, async (viewer) => {
          const { field, value } = await target(viewer, params.id, params.field);
          const n = Number(new URL(request.url).searchParams.get("n") ?? 0);
          return uploadResponse(request, field.kind, field.many ? (Array.isArray(value) ? value[n] : undefined) : value, false);
        }${reads === "openApiCall" ? ", true" : ""}),
      PUT: ({ request, params }) =>
        fileCall(request, async (viewer) => {
          const { field, row, value } = await target(viewer, params.id, params.field);
          const list = Array.isArray(value) ? value : [];
          if (field.many && list.length >= field.max) throw new BadInput(\`At most \${field.max} here.\`);
          const bytes = await bytesOf(request, field.kind === "file" ? FILE_MAX_BYTES : PICTURE_MAX_BYTES);
          let stored: unknown;
          try {
            await scanned(bytes);
          } catch (error) {
            if (error instanceof BadFile) throw new BadInput(error.message);
            throw error;
          }
          const named = (header: string) => decodeURIComponent(request.headers.get(header) ?? "");
          try {
            stored = field.kind === "file" ? saveFile(${JSON.stringify(kebab(model.name))}, bytes, named("x-file-name")) : savePicture(${JSON.stringify(kebab(model.name))}, bytes, named("x-alt"));
          } catch (error) {
            if (error instanceof BadFile || error instanceof BadPicture) throw new BadInput(error.message);
            throw error;
          }
          const sent = { ...(stored as { file: string }), receipt: receiptFor(viewer?.id ?? null, ${JSON.stringify(kebab(model.name))}, params.field, (stored as { file: string }).file) };
          await ${n.data}.update(viewer, row.id, { [field.key]: field.many ? [...list, sent] : sent } as never);
          return stored;
        }),
    },
  },
});
`;
    if (own.length)
      files[`src/routes/api/v1/${path}/$id.actions.$action.ts`] =
        `${HEADER}// The standard actions offered on a ${n.label.toLowerCase()}, for programs with a key.
import { createFileRoute } from "@tanstack/react-router";
import { ${camelName}ToApi } from "#/generated/api.server";${own.some((a) => a.copy) ? `\nimport { ${n.data} } from "#/generated/${kebab(model.name)}.server";` : ""}
${own.map((a) => `import { ${actionNames(a).run} } from "#/generated/actions/${kebab(a.name)}.server";${askedFields(a).length ? `\nimport { ${actionNames(a).asks} } from "#/generated/actions/${kebab(a.name)}";` : ""}`).join("\n")}
import { apiCall, NotFound } from "#/kit/api.server";

export const Route = createFileRoute("/api/v1/${path}/$id/actions/$action")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        apiCall(request, async (viewer${own.some((a) => askedFields(a).length) ? ", body" : ""}) => {
          const id = Number(params.id);
          switch (params.action) {
${own
  .map((a) => {
    const ran = `await ${actionNames(a).run}(viewer, id${askedFields(a).length ? `, ${actionNames(a).asks}.parse(body)` : ""})`;
    // A copy gives the new record's id: the answer is that record.
    return `            case ${JSON.stringify(a.name)}:
              return ${camelName}ToApi(${a.copy ? `(await ${n.data}.get(viewer, ${ran})) as Record<string, any>` : ran});`;
  })
  .join("\n")}
            default:
              throw new NotFound(\`There is no action "\${params.action}" here.\`);
          }
        }),
    },
  },
});
`;
  }
  return files;
}

/**
 * src/generated/mcp.server.ts: the tools for assistants (docs/design/assistant.md §3): seven, the
 * same for every app, described by core per caller (each role, and a visitor without a key), and
 * one dispatcher that runs them through each model's data module.
 */
export function mcpModule(ir: SpecIR, auth: AuthIR, t: Texts, content?: ContentIR): string {
  return toolsModule(ir, auth, t, content, "api");
}

/**
 * src/generated/ask.server.ts: "Ask" in the app (docs/design/assistant.md §6): the same seven tools
 * over everything the person may read in the app, offered to the callers the auth file's
 * assistant block names, and `ask`, which answers a question as the signed-in person (visitors
 * by the wording rules only).
 */
export function askModule(
  ir: SpecIR,
  auth: AuthIR,
  t: Texts,
  content?: ContentIR,
  voice: Voice = "plain",
): string {
  return toolsModule(ir, auth, t, content, "app", voice);
}

function toolsModule(
  ir: SpecIR,
  auth: AuthIR,
  t: Texts,
  content: ContentIR | undefined,
  scope: "api" | "app",
  voice: Voice = "plain",
): string {
  const app = scope === "app";
  // Ask may change things (each confirmed by the person) only when the block says so.
  const confirms = app && auth.assistant?.may === "change";
  const { models, actions } = app
    ? {
        models: ir.models.map((model) => ({ model, n: names(model, t) })),
        actions: ir.actions.filter((a): a is StandardActionIR => !a.custom),
      }
    : apiParts(ir, auth, t);
  const callers: AssistantCaller[] = [
    ...auth.roles.map((r) => ({ role: r.name })),
    "visitor" as const,
  ].filter((c) => !app || asksWith(auth, c) !== "nothing");
  const offers = Object.fromEntries(
    callers.map((caller) => {
      const offer = assistantOffer(ir, auth, caller, { scope, content });
      return [
        caller === "visitor" ? "visitor" : caller.role,
        {
          summary: offer.summary,
          tools: offer.tools,
          describe: Object.fromEntries(offer.kinds.map((k) => [k.model, k.description])),
        },
      ];
    }),
  );
  const entries = models.map(({ model, n }) => {
    const c = model.name[0]?.toLowerCase() + model.name.slice(1);
    const refs = model.fields
      .filter((f) => f.type.kind === "relation" && !f.type.many)
      .map((f) => [f.name, relatedTitle(ir, (f.type as { model: string }).model)]);
    const searched = model.fields
      .filter(
        (f) =>
          !f.formula &&
          f.type.kind === "scalar" &&
          ["string", "text", "markdown", "email", "phone", "url"].includes(f.type.name),
      )
      .map((f) => f.name);
    const named =
      titleField(model) === "id"
        ? ", named: undefined"
        : `, named: (viewer: Viewer | null, text: string) => ${n.data}.named(viewer, text)`;
    return `  ${model.name}: { data: ${n.data}, toApi: ${c}ToApi, fromApi: ${c}FromApi, title: ${JSON.stringify(titleField(model))}, refs: ${JSON.stringify(Object.fromEntries(refs))}, searched: ${JSON.stringify(searched)}, label: ${JSON.stringify(n.label.toLowerCase())}${named}${confirms ? `, access: ${n.access}, owner: ${JSON.stringify(ownerKey(model))}, targets: ${JSON.stringify(Object.fromEntries(model.fields.filter((f) => f.type.kind === "relation" && !f.type.many && models.some((m) => m.model.name === (f.type as { model: string }).model)).map((f) => [f.name, (f.type as { model: string }).model])))} as Record<string, string>` : ""} },`;
  });
  // For a proposed action: the kind it runs on, who may run it and when, and its name in words.
  const proposals = actions.map((action) => {
    const a = actionNames(action);
    const words = action.name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
    const asks = askedFields(action).length ? `, asks: ${a.asks}` : "";
    return `  ${JSON.stringify(action.name)}: { kind: ${JSON.stringify(action.on)}, access: ${a.access}, fits: ${a.fits} as (row: never) => boolean, label: ${JSON.stringify(words[0]?.toUpperCase() + words.slice(1))}${asks} },`;
  });
  // Out of the trash, as a built-in action per kind with a trash (docs/design/trash.md).
  const restores = models
    .filter(({ model }) => model.trash)
    .map(({ model, n }) => {
      const c = model.name[0]?.toLowerCase() + model.name.slice(1);
      return `    case ${JSON.stringify(`restore${model.name}`)}: {
      const id = Number(args.id);
      if (!${n.data}.restore(viewer, [id]).restored)
        throw new NotFound(\`No ${n.label.toLowerCase()} \${id} in the trash that you may restore.\`);
      return ${c}ToApi((await ${n.data}.get(viewer, id)) as Record<string, any>);
    }`;
    });
  const runs = actions.map((action) => {
    const model = modelNamed(ir, action.on);
    const c = model.name[0]?.toLowerCase() + model.name.slice(1);
    const asked = askedFields(action).length > 0;
    // The record by its id or its title, as the other tools take it.
    const ran = `await ${actionNames(action).run}(keyed(viewer), row.id${asked ? `, ${actionNames(action).asks}.parse(args.input ?? {})` : ""})`;
    // A copy gives the new record's id: the answer is that record.
    return `    case ${JSON.stringify(action.name)}: {
      const row = await found(KINDS.${model.name}, viewer, args.id, "change");
      return ${c}ToApi(${action.copy ? `(await KINDS.${model.name}.data.get(keyed(viewer), ${ran})) as Record<string, any>` : ran});
    }`;
  });
  // Each caller's kinds of record in the words people use, for the wording rules (only what they read).
  const words = Object.fromEntries(
    callers.map((caller) => [
      caller === "visitor" ? "visitor" : caller.role,
      assistantOffer(ir, auth, caller, { scope, content }).kinds.map((k) => ({
        model: k.model,
        label: k.label,
        pluralLabel: k.pluralLabel,
        fields: k.fields,
        filters: k.filters,
        numbers: k.numbers,
        by: k.by,
      })),
    ]),
  );
  const asks = Object.fromEntries(
    callers.map((caller) => [
      caller === "visitor" ? "visitor" : caller.role,
      asksWith(auth, caller),
    ]),
  );
  return `${HEADER}${
    app
      ? `// "Ask" in the app (docs/design/assistant.md §6): the seven tools over everything the person
// may read, as core describes them for each role the assistant block names, and ask(), which
// answers a question as the signed-in person: the wording rules first, then the host's model
// (visitors: the rules only). Every call goes through the data functions, as a page's do.`
      : `// The app's records and actions as tools for AI assistants (docs/design/assistant.md §3): seven
// tools whatever the app's size, and the app's summary as the server's instructions, both as core
// describes them for each caller; every call goes through the data functions, as the API's do.`
  }
${actions.length || app ? `import { AccessDenied, ${confirms ? "allows, type Rule, " : ""}type Viewer } from "#/kit/access";` : 'import type { Viewer } from "#/kit/access";'}
${app ? `import type { AskKind } from "#/kit/ask";\nimport { type Answer, answer, ${confirms ? "type Card, " : ""}hostModel${confirms ? ", type Json" : ""} } from "#/kit/assistant.server";\n` : ""}${confirms ? 'import { writeAllowed } from "#/kit/limit";\n' : ""}import { BadInput, NotFound } from "#/kit/refusal";
${confirms ? 'import { type Offer, offered } from "#/kit/tools";\nimport { traceThrough } from "#/kit/trace.server";' : 'import type { Offer } from "#/kit/tools";'}
${
  app
    ? ""
    : `import { ${models
        .flatMap(({ model }) => {
          const c = model.name[0]?.toLowerCase() + model.name.slice(1);
          return [`${c}FromApi`, `${c}ToApi`];
        })
        .sort()
        .join(", ")} } from "./api.server";`
}
${models.map(({ model, n }) => `import { ${confirms ? `${n.access}, ` : ""}${n.data} } from "./${kebab(model.name)}.server";`).join("\n")}
${actions
  .map((a) => {
    const fromModule = [
      ...(confirms ? [actionNames(a).access] : []),
      ...(askedFields(a).length ? [actionNames(a).asks] : []),
      ...(confirms ? [actionNames(a).fits] : []),
    ];
    return `import { ${actionNames(a).run} } from "./actions/${kebab(a.name)}.server";${fromModule.length ? `\nimport { ${fromModule.join(", ")} } from "./actions/${kebab(a.name)}";` : ""}`;
  })
  .join("\n")}
${app ? conversionsCode(models) : ""}

/**
 * What each caller is offered (by the key's role, and for a visitor without a key): the tools,
 * the summary, and what describe answers per kind, as that caller may use it.
 */
const OFFERS: Record<string, Offer & { describe: Record<string, string> }> = ${JSON.stringify(offers, null, 2)};

/** The offer for a caller; a role the app does not know gets nothing. */
export function offerFor(viewer: Viewer | null): Offer & { describe: Record<string, string> } {
  const caller = viewer?.role ?? "visitor";
  return Object.hasOwn(OFFERS, caller) ? OFFERS[caller] : { summary: "", tools: [], describe: {} };
}

/** Each kind's data functions and conversions, its title field, and its references' titles. */
const KINDS = {
${entries.join("\n")}
};
type Kind = (typeof KINDS)[keyof typeof KINDS];

const kindOf = (args: Record<string, unknown>): Kind => {
  const kind = KINDS[args.kind as keyof typeof KINDS];
  if (!kind) throw new BadInput(\`There is no kind "\${String(args.kind)}". Kinds: \${Object.keys(KINDS).join(", ")}.\`);
  return kind;
};

/**
 * A record the caller may use, by its id or by its title (an invoice's number): one that fits,
 * never a guess; "not there" and "not yours" are the same answer.
 */
async function found(kind: Kind, viewer: Viewer | null, id: unknown, verb = "read") {
  let key = Number.isInteger(id) ? (id as number) : /^\\d+$/.test(String(id)) ? Number(id) : undefined;
  if (key === undefined && typeof id === "string" && kind.named) {
    const fits = kind.named(viewer, id);
    const exact = fits.filter((r) => r.title.toLowerCase() === id.toLowerCase());
    const pick = exact.length === 1 ? exact : fits;
    if (pick.length > 1)
      throw new BadInput(\`"\${id}" fits several: \${pick.slice(0, 5).map((r) => \`\${r.title} (\${r.id})\`).join(", ")}. Give its whole \${kind.title} or its id.\`);
    key = pick[0]?.id;
  }
  const row = key === undefined ? null : await kind.data.get(viewer, key);
  if (!row) throw new NotFound(\`No \${kind.label} \${String(id)} that you may \${verb}; find it first.\`);
  return row;
}

/** A field's value in a row: a reference as its id and title, nothing else changed. */
function shown(kind: Kind, row: Record<string, unknown>, api: Record<string, unknown>, field: string): unknown {
  const title = (kind.refs as Record<string, string>)[field];
  const related = row[field] as Record<string, unknown> | null | undefined;
  if (title && related && typeof related === "object")
    return related.deletedAt ? { id: related.id, inTrash: true } : { id: related.id, title: related[title] };
  if (!(field in api)) throw new BadInput(\`There is no field "\${field}". Fields: \${Object.keys(api).join(", ")}.\${field === "title" ? \` The title field is \${kind.title}.\` : ""}\`);
  return api[field];
}

/** "count", "sum total", "average total", "min …", "max …" as measure's own words. */
function measureOf(of: unknown): { how: "count" | "sum" | "average" | "smallest" | "largest"; field?: string } {
  const [word = "count", field] = String(of ?? "count").trim().split(/\\s+/);
  const how = ({ count: "count", sum: "sum", average: "average", min: "smallest", max: "largest" } as const)[word as "count"];
  if (!how) throw new BadInput('"of" is count, or sum, average, min or max with a number field, e.g. "sum total".');
  return { how, field };
}
${
  actions.length
    ? `
/** An action is a key's: a visitor is never offered one, and is refused here too. */
const keyed = (viewer: Viewer | null): Viewer => {
  if (!viewer) throw new AccessDenied(false);
  return viewer;
};
`
    : ""
}
/** Calls one tool as the key's role, or as a visitor without a key. */
export async function callTool(viewer: Viewer | null, name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "find": {
      const kind = kindOf(args);${
        models.some(({ model }) => model.trash)
          ? `
      // The trash: what the caller may delete in it, with when it was deleted.
      if (args.trashed === true) {
        if (!("trash" in kind.data)) throw new BadInput("This kind of record has no trash.");
        const trashed = await kind.data.trash(viewer);
        return {
          columns: ["id", kind.title, "deletedAt"],
          rows: trashed.map((row) => [row.id, (row as Record<string, unknown>)[kind.title] ?? null, row.deletedAt]),
          total: trashed.length,
        };
      }`
          : ""
      }
      const limit = Math.min(50, Math.max(1, Number(args.limit) || 10));
      const page = Math.max(1, Number(args.page) || 1);
      const { items, total } = await kind.data.find(viewer, {
        where: args.where,
        search: typeof args.search === "string" ? args.search : undefined,
        sort: typeof args.sort === "string" ? args.sort : undefined,
        limit,
        offset: (page - 1) * limit,
      });
      const asked = Array.isArray(args.fields) ? args.fields.map(String) : [];
      const columns = [...new Set(["id", kind.title, ...asked])];
      const rows = items.map((row) => {
        const api = kind.toApi(row as Record<string, any>) as Record<string, unknown>;
        return columns.map((field) => shown(kind, row as Record<string, unknown>, api, field));
      });
      // Nothing found by a search: say where it looked, and how a reference is matched instead.
      const refs = Object.keys(kind.refs);
      if (!total && typeof args.search === "string")
        return {
          columns,
          rows,
          total,
          note: \`Nothing has every word of "\${args.search}" in \${kind.searched.join(", ") || "the texts"}.\${refs.length ? \` A \${refs[0]} is matched with where, e.g. {"\${refs[0]}": "…"}.\` : ""}\`,
        };
      return { columns, rows, total };
    }
    case "measure": {
      const kind = kindOf(args);
      const { how, field } = measureOf(args.of);
      const options = { field, where: args.where, search: typeof args.search === "string" ? args.search : undefined };
      if (typeof args.by === "string") return { by: args.by, rows: await kind.data.measureBy(viewer, how, args.by, options) };
      const value = await kind.data.measure(viewer, how, options);
      // The smallest or largest: which record holds it.
      if ((how === "smallest" || how === "largest") && value !== null)
        return { [how]: value, of: await kind.data.holder(viewer, how, options) };
      return { [how === "count" ? "total" : how]: value };
    }
    case "read": {
      const kind = kindOf(args);
      return kind.toApi((await found(kind, viewer, args.id)) as Record<string, any>);
    }
    case "add": {
      const kind = kindOf(args);
      return kind.toApi(await kind.data.create(viewer, kind.fromApi(args.values ?? {}) as never));
    }
    case "change": {
      const kind = kindOf(args);
      const row = await found(kind, viewer, args.id, "change");
      return kind.toApi(await kind.data.update(viewer, row.id, kind.fromApi(args.values ?? {}, row as Record<string, unknown>) as never));
    }
    case "delete": {
      const kind = kindOf(args);
      const row = await found(kind, viewer, args.id, "delete");
      await kind.data.remove(viewer, row.id, args.together === true);
      return { deleted: row.id };
    }
    case "describe":
      kindOf(args);
      return { description: offerFor(viewer).describe[args.kind as string] };
    case "run":
      switch (args.action) {
${[...runs, ...restores].join("\n")}
        default:
          throw new NotFound(\`There is no action "\${String(args.action)}".\`);
      }
    default:
      throw new NotFound(\`There is no tool "\${name}".\`);
  }
}
${
  app
    ? `
/** How each caller is answered: the rules, then the host's model; a visitor by the rules only. */
const ASKS: Record<string, string> = ${JSON.stringify(asks)};

/** Each caller's kinds of record in the words people use, for the wording rules. */
const WORDS: Record<string, AskKind[]> = ${JSON.stringify(words)};

/** Whether the viewer gets "Ask": a role the assistant block names, or a visitor when it says anyone. */
export function asks(viewer: Viewer | null): boolean {
  return Object.hasOwn(ASKS, viewer?.role ?? "visitor");
}

/** A question answered as the person asking (or a visitor), with what they may read and do. */
export async function ask(viewer: Viewer | null, question: string): Promise<Answer> {
  const caller = viewer?.role ?? "visitor";
  if (!Object.hasOwn(ASKS, caller)) throw new AccessDenied(viewer !== null);
  return answer(question, {
    offer: offerFor(viewer),
    kinds: WORDS[caller],
    call: (tool, args) => callTool(viewer, tool, args),
    model: viewer && ASKS[caller] === "model" ? hostModel(viewer.id) : undefined,
    // A visitor is never answered by a model; a person signed in is told in the kit's words.
    unread: viewer
      ? undefined
      : 'The app answers questions it can read by itself, like "how many … are there?" or "show the … that …".',
    voice: ${JSON.stringify(voice)},${content?.assistant?.about ? `\n    about: ${JSON.stringify(content.assistant.about)},` : ""}${confirms ? "\n    propose: viewer ? (tool, args) => propose(viewer, tool, args) : undefined," : ""}
  });
}
${
  confirms
    ? `
/** Each action Ask may propose: the kind it runs on, its rule, when it fits, its name in words. */
const RUNS: Record<string, { kind: keyof typeof KINDS; access: Rule; fits: (row: never) => boolean; label: string; asks?: { parse: (input: unknown) => unknown } }> = {
${proposals.join("\n")}
};

/**
 * Proposed changes kept for the person to confirm: the call as it was checked, for ten minutes
 * and once; a person keeps a handful at a time (the oldest go).
 */
const PENDING = new Map<string, { person: string; tool: string; args: Record<string, unknown>; at: number }>();
const KEPT_MS = 10 * 60_000;
const KEPT_EACH = 5;

/** A field's label in the person's words, for a card. */
function labelOf(viewer: Viewer, kind: string, field: string): string {
  return WORDS[viewer.role]?.find((k) => k.model === kind)?.fields.find((f) => f.name === field)?.label ?? field;
}

/** A value as a card shows it: a referenced record by its title. */
function cardValue(value: unknown): Json {
  if (value && typeof value === "object" && "title" in value) return String((value as { title: unknown }).title);
  return (value ?? null) as Json;
}

/**
 * Checks a change the model proposed as the person would make it and keeps it for them to
 * confirm: the record resolved by id or title, their right to make it, the values the schema
 * takes; a refusal in the app's words otherwise. The card says what it would do.
 */
async function propose(viewer: Viewer, tool: string, args: Record<string, unknown>): Promise<{ id: string; card: Card }> {
  let kept = args;
  let card: Card;
  if (tool === "run") {
    const run = Object.hasOwn(RUNS, String(args.action)) ? RUNS[String(args.action)] : undefined;
    if (!run) throw new NotFound(\`There is no action "\${String(args.action)}".\`);
    const kind = KINDS[run.kind];
    const row = (await found(kind, viewer, args.id, "change")) as Record<string, any>;
    if (!allows(run.access, viewer, row[kind.owner])) throw new AccessDenied(true);
    if (!run.fits(row as never)) throw new BadInput("This cannot be done now.");
    // What the action asks for, checked now: a missing or wrong value is said here, not at Confirm.
    if (run.asks) {
      try {
        run.asks.parse(args.input ?? {});
      } catch (error) {
        const issues = (error as { issues?: { path: unknown[]; message: string }[] }).issues ?? [];
        throw new BadInput(\`\${run.label} needs: \${issues.map((i) => \`\${i.path.join(".")} (\${i.message})\`).join(", ") || "other values"}.\`);
      }
    }
    kept = { ...args, id: row.id };
    card = { title: \`\${run.label} \${kind.label} \${String(row[kind.title] ?? row.id)}\`, changes: [] };
  } else {
    const kind = kindOf(args);
    const values = { ...((args.values ?? {}) as Record<string, unknown>) };
    const label = (field: string) => labelOf(viewer, String(args.kind), field);
    // A record referred to by id or title: found now among those the person may read, kept by
    // its id, and shown by its title.
    const titles: Record<string, string> = {};
    for (const [field, target] of Object.entries(kind.targets)) {
      const given = values[field];
      if (given === undefined || given === null || given === "") continue;
      const other = KINDS[target as keyof typeof KINDS];
      const row = (await found(other, viewer, given)) as Record<string, any>;
      values[field] = row.id;
      titles[field] = String(row[other.title] ?? row.id);
    }
    const shownTo = (field: string, value: unknown) => (field in titles ? titles[field] : cardValue(value));
    args = { ...args, values };
    if (tool === "add") {
      if (!allows(kind.access.create, viewer)) throw new AccessDenied(true);
      kind.fromApi(values);
      kept = args;
      card = { title: \`Add a \${kind.label}\`, changes: Object.entries(values).map(([k, v]) => ({ label: label(k), to: shownTo(k, v) })) };
    } else if (tool === "change") {
      const row = (await found(kind, viewer, args.id, "change")) as Record<string, any>;
      if (!allows(kind.access.write, viewer, row[kind.owner])) throw new AccessDenied(true);
      kind.fromApi(values, row);
      const now = kind.toApi(row) as Record<string, unknown>;
      kept = { ...args, id: row.id };
      card = {
        title: \`Change \${kind.label} \${String(row[kind.title] ?? row.id)}\`,
        changes: Object.entries(values).map(([k, v]) => ({ label: label(k), from: cardValue(shown(kind, row, now, k)), to: shownTo(k, v) })),
      };
    } else throw new BadInput("Ask never deletes.");
  }
  const at = Date.now();
  for (const [id, p] of PENDING) if (at - p.at > KEPT_MS) PENDING.delete(id);
  const mine = [...PENDING].filter(([, p]) => p.person === viewer.id);
  for (const [id] of mine.slice(0, Math.max(0, mine.length - KEPT_EACH + 1))) PENDING.delete(id);
  const id = crypto.randomUUID();
  PENDING.set(id, { person: viewer.id, tool, args: kept, at });
  return { id, card };
}

/**
 * A proposed change, made once the person confirms it: theirs alone, once, within ten minutes,
 * as them through the same tool and its checks, counted like any change and logged as through Ask.
 */
export async function confirm(viewer: Viewer | null, id: string, headers: Headers): Promise<unknown> {
  if (!viewer || !Object.hasOwn(ASKS, viewer.role)) throw new AccessDenied(viewer !== null);
  const kept = PENDING.get(id);
  if (!kept || kept.person !== viewer.id || Date.now() - kept.at > KEPT_MS)
    throw new NotFound("That suggestion is no longer there; ask again.");
  PENDING.delete(id);
  writeAllowed(viewer, headers);
  offered(offerFor(viewer), kept.tool, kept.args);
  traceThrough("Ask");
  return callTool(viewer, kept.tool, kept.args);
}
`
    : ""
}`
    : ""
}`;
}

/** src/routes/mcp.ts: the endpoint assistants connect to. */
export function mcpRoute(ir: SpecIR): string {
  return `${HEADER}// The app's tools for AI assistants (docs/design/integrations.md §5b), at /mcp: connect an
// assistant here with a key made on the users page, as Authorization: Bearer <key>.
import { createFileRoute } from "@tanstack/react-router";
import { callTool, offerFor } from "#/generated/mcp.server";
import { handleMcp } from "#/kit/mcp.server";
import { problem } from "#/kit/api.server";

export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      POST: ({ request }) => handleMcp(request, { name: ${JSON.stringify(ir.app.name)}, offerFor, call: callTool }),
      GET: () => problem(405, "This server answers POST requests only (no event stream)."),
    },
  },
});
`;
}
