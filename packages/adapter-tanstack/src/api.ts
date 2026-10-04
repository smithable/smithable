// Part of the TanStack adapter's generator: the API (docs/design/integrations.md §2). For each
// model the auth file's `api` block offers: list (pages of at most 100), get, create, change and
// delete under /api/v1/<models>, its standard actions on a record, and an OpenAPI description.
// Every call is a key's, through the model's data functions, so a key may do what its role may.
import {
  type AuthIR,
  apiOffers,
  type FieldIR,
  humanize,
  kebab,
  type ModelIR,
  plural,
  type SpecIR,
  type StandardActionIR,
  storesPictures,
} from "@smithable/core";
import { actionNames, askedFields } from "./actions.js";
import { HEADER, literal, modelNamed, names, type Texts } from "./shared.js";

/**
 * The fields a program reads and writes: everything but pictures (not in the API yet) and the
 * lists of related records, which are reached from the other side (their own model's route).
 */
const apiFields = (model: ModelIR) =>
  model.fields.filter((f) => !storesPictures(f) && !(f.type.kind === "relation" && f.type.many));
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
function readCode(f: FieldIR): string {
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
        responses: { 200: { description: "The record", ...one }, 404: problem },
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
        summary: `Delete a ${n.label.toLowerCase()}`,
        responses: { 204: { description: "Deleted" }, 403: problem, 404: problem, 409: problem },
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
  for (const { model, path } of models) {
    const list = paths[`/api/v1/${path}`] as Record<string, unknown>;
    const one = paths[`/api/v1/${path}/{id}`] as Record<string, unknown>;
    const read = visitors.read.includes(model.name);
    const add = visitors.create.includes(model.name);
    if (read || add)
      visitorPaths[`/api/v1/${path}`] = {
        ...(read ? { get: list.get } : {}),
        ...(add ? { post: list.post } : {}),
      };
    if (read) visitorPaths[`/api/v1/${path}/{id}`] = { parameters: one.parameters, get: one.get };
  }
  const visitorApi = { ...openapi, paths: visitorPaths, security: [] };
  // Only the helpers some offered field needs.
  const uses = (k: string) => models.some(({ model }) => entered(model).some((f) => kind(f) === k));
  return `${HEADER}// The API's conversions (docs/design/integrations.md §2): records as programs read them (the
// spec's field names, amounts as decimal texts, times as ISO texts) and their values back, checked
// by each model's own schema, as a form's are.
import { BadInput } from "#/kit/api.server";
${models.map(({ n }) => `import { ${n.schema} } from "${n.module}";`).join("\n")}

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
  .join("\n")}

/** The whole API in the OpenAPI format, for tools and agents. */
export const OPENAPI = ${JSON.stringify(openapi, null, 2)};
${
  Object.keys(visitorPaths).length
    ? `
/** What a call without a key may do: the reading and adding anyone may do. */
export const VISITOR_OPENAPI = ${JSON.stringify(visitorApi, null, 2)};
`
    : ""
}`;
}

/** The routes: list and add, one record, its actions, and the description. */
export function apiRoutes(ir: SpecIR, auth: AuthIR, t: Texts): Record<string, string> {
  const { models, actions, visitors } = apiParts(ir, auth, t);
  const open = visitors.read.length + visitors.create.length > 0;
  const files: Record<string, string> = {
    "src/routes/api/v1/openapi[.]json.ts": open
      ? `${HEADER}// The API's description in the OpenAPI format, with no key needed to read it: with a key, or
// signed in (the users page's download), all a program may call; otherwise what anyone may read
// or add.
import { createFileRoute } from "@tanstack/react-router";
import { OPENAPI, VISITOR_OPENAPI } from "#/generated/api.server";
import { callerOf } from "#/kit/api.server";
import { currentViewer } from "#/lib/viewer.server";

export const Route = createFileRoute("/api/v1/openapi.json")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        Response.json(callerOf(request).viewer || (await currentViewer()) ? OPENAPI : VISITOR_OPENAPI),
    },
  },
});
`
      : `${HEADER}// The API's description in the OpenAPI format: what a program may call, with no key needed to read it.
import { createFileRoute } from "@tanstack/react-router";
import { OPENAPI } from "#/generated/api.server";

export const Route = createFileRoute("/api/v1/openapi.json")({
  server: { handlers: { GET: () => Response.json(OPENAPI) } },
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

export const Route = createFileRoute("/api/v1/${path}/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        ${reads}(request, async (viewer) => {
          const query = new URL(request.url).searchParams;
          const limit = Math.min(100, Math.max(1, Number(query.get("limit")) || 100));
          const page = Math.max(1, Number(query.get("page")) || 1);
          const { items, total } = await ${n.data}.page(viewer, limit, (page - 1) * limit);
          return { items: items.map(${camelName}ToApi), page, pages: Math.max(1, Math.ceil(total / limit)), total };
        }),
      POST: ({ request }) =>
        ${adds}(request, async (viewer, body) => ${camelName}ToApi(await ${n.data}.create(viewer, ${camelName}FromApi(body) as never)), 201),
    },
  },
});
`;
    files[`src/routes/api/v1/${path}/$id.ts`] =
      `${HEADER}// One ${n.label.toLowerCase()} for programs with a key: read, change (the fields given) or delete it.
import { createFileRoute } from "@tanstack/react-router";
import { ${camelName}FromApi, ${camelName}ToApi } from "#/generated/api.server";
import { ${n.data} } from "#/generated/${kebab(model.name)}.server";
import { ${reads === "openApiCall" ? "apiCall, NotFound, openApiCall" : "apiCall, NotFound"} } from "#/kit/api.server";

const found = async (viewer: Parameters<typeof ${n.data}.get>[0], id: string) => {
  const row = await ${n.data}.get(viewer, Number(id));
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
        apiCall(request, async (viewer) => {
          const row = await found(viewer, params.id);
          await ${n.data}.remove(viewer, row.id);
        }),
    },
  },
});
`;
    if (own.length)
      files[`src/routes/api/v1/${path}/$id.actions.$action.ts`] =
        `${HEADER}// The standard actions offered on a ${n.label.toLowerCase()}, for programs with a key.
import { createFileRoute } from "@tanstack/react-router";
import { ${camelName}ToApi } from "#/generated/api.server";
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
  .map(
    (a) => `            case ${JSON.stringify(a.name)}:
              return ${camelName}ToApi(await ${actionNames(a).run}(viewer, id${askedFields(a).length ? `, ${actionNames(a).asks}.parse(body)` : ""}));`,
  )
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

/** The tools an assistant gets (docs/design/integrations.md §5b), with what each says it does. */
function mcpTools(ir: SpecIR, auth: AuthIR, t: Texts) {
  const { models, actions } = apiParts(ir, auth, t);
  const deletes = auth.api?.assistants?.delete === true;
  const tools: { name: string; description: string; inputSchema: Record<string, unknown> }[] = [];
  const id = { id: { type: "integer", description: "The record's id" } };
  for (const { model, n, path } of models) {
    const fields = Object.fromEntries(
      entered(model).map((f) => {
        return [f.name, { ...fieldSchema(f), description: humanize(f.name) }];
      }),
    );
    const what = n.pluralLabel.toLowerCase();
    const snake = path.replace(/-/g, "_");
    const one = kebab(model.name).replace(/-/g, "_");
    tools.push(
      {
        name: `find_${snake}`,
        description: `List ${what} this key may read, 100 at a time (page 1, 2, …).`,
        inputSchema: { type: "object", properties: { page: { type: "integer", minimum: 1 } } },
      },
      {
        name: `read_${one}`,
        description: `One ${n.label.toLowerCase()}, by its id.`,
        inputSchema: { type: "object", properties: id, required: ["id"] },
      },
      {
        name: `add_${one}`,
        description: `Add a ${n.label.toLowerCase()}. Amounts as decimal texts ("12.50"), times as ISO texts.`,
        inputSchema: {
          type: "object",
          properties: fields,
          required: entered(model)
            .filter((f) => f.required)
            .map((f) => f.name),
        },
      },
      {
        name: `change_${one}`,
        description: `Change a ${n.label.toLowerCase()}: only the fields given.`,
        inputSchema: { type: "object", properties: { ...id, ...fields }, required: ["id"] },
      },
      ...(deletes
        ? [
            {
              name: `delete_${one}`,
              description: `Delete a ${n.label.toLowerCase()}. It cannot be undone.`,
              inputSchema: { type: "object", properties: id, required: ["id"] },
            },
          ]
        : []),
    );
  }
  for (const action of actions) {
    const model = modelNamed(ir, action.on);
    const asked = askedFields(action);
    tools.push({
      name: action.name,
      description: [
        action.intent ?? `${action.name} on a ${names(model, t).label.toLowerCase()}`,
        ...(action.rules ?? []).map((r) => r.text),
      ].join(" "),
      inputSchema: {
        type: "object",
        properties: {
          ...id,
          ...(asked.length
            ? {
                values: {
                  type: "object",
                  description: `What it asks for: ${asked.map((x) => x.key).join(", ")}`,
                },
              }
            : {}),
        },
        required: asked.length ? ["id", "values"] : ["id"],
      },
    });
  }
  // A visitor's tools: finding and reading what anyone may read, adding what anyone may add.
  const { visitors } = apiParts(ir, auth, t);
  const visitorTools = models.flatMap(({ model, path }) => {
    const snake = path.replace(/-/g, "_");
    const one = kebab(model.name).replace(/-/g, "_");
    const names = [
      ...(visitors.read.includes(model.name) ? [`find_${snake}`, `read_${one}`] : []),
      ...(visitors.create.includes(model.name) ? [`add_${one}`] : []),
    ];
    return tools
      .filter((tool) => names.includes(tool.name))
      .map((tool) => ({
        ...tool,
        description: tool.description.replace("this key may read", "anyone may read"),
      }));
  });
  return { tools, visitorTools, models, actions, deletes };
}

/** src/generated/mcp.server.ts: the tools, and each call through the data functions. */
export function mcpModule(ir: SpecIR, auth: AuthIR, t: Texts): string {
  const { tools, visitorTools, models, actions, deletes } = mcpTools(ir, auth, t);
  const cases: string[] = [];
  for (const { model, n, path } of models) {
    const c = model.name[0]?.toLowerCase() + model.name.slice(1);
    const snake = path.replace(/-/g, "_");
    const one = kebab(model.name).replace(/-/g, "_");
    cases.push(`    case "find_${snake}": {
      const page = Math.max(1, Number(args.page) || 1);
      const { items, total } = await ${n.data}.page(viewer, 100, (page - 1) * 100);
      return { items: items.map(${c}ToApi), page, pages: Math.max(1, Math.ceil(total / 100)), total };
    }
    case "read_${one}":
      return ${c}ToApi(await found(${n.data}, viewer, args.id, ${JSON.stringify(n.label.toLowerCase())}));
    case "add_${one}":
      return ${c}ToApi(await ${n.data}.create(viewer, ${c}FromApi(args) as never));
    case "change_${one}": {
      const { id, ...fields } = args;
      const row = await found(${n.data}, viewer, id, ${JSON.stringify(n.label.toLowerCase())});
      return ${c}ToApi(await ${n.data}.update(viewer, row.id, ${c}FromApi(fields, row) as never));
    }${
      deletes
        ? `
    case "delete_${one}": {
      const row = await found(${n.data}, viewer, args.id, ${JSON.stringify(n.label.toLowerCase())});
      await ${n.data}.remove(viewer, row.id);
      return { deleted: row.id };
    }`
        : ""
    }`);
  }
  for (const action of actions) {
    const model = modelNamed(ir, action.on);
    const c = model.name[0]?.toLowerCase() + model.name.slice(1);
    const asked = askedFields(action).length > 0;
    cases.push(`    case ${JSON.stringify(action.name)}:
      return ${c}ToApi(await ${actionNames(action).run}(keyed(viewer), Number(args.id)${asked ? `, ${actionNames(action).asks}.parse(args.values)` : ""}));`);
  }
  return `${HEADER}// The app's records and actions as tools for AI assistants (docs/design/integrations.md §5b):
// what the auth file's \`api\` block offers, with the spec's own words as the descriptions, called
// as the key's role through the data functions, exactly as the API is.
${actions.length ? 'import { AccessDenied, type Viewer } from "#/kit/access";' : 'import type { Viewer } from "#/kit/access";'}
import { NotFound } from "#/kit/api.server";
import type { Tool } from "#/kit/mcp.server";
import { ${models
    .flatMap(({ model }) => {
      const c = model.name[0]?.toLowerCase() + model.name.slice(1);
      return [`${c}FromApi`, `${c}ToApi`];
    })
    .sort()
    .join(", ")} } from "./api.server";
${models.map(({ model, n }) => `import { ${n.data} } from "./${kebab(model.name)}.server";`).join("\n")}
${actions.map((a) => `import { ${actionNames(a).run} } from "./actions/${kebab(a.name)}.server";${askedFields(a).length ? `\nimport { ${actionNames(a).asks} } from "./actions/${kebab(a.name)}";` : ""}`).join("\n")}

export const TOOLS: Tool[] = ${JSON.stringify(tools, null, 2)};

/** What a visitor without a key gets: finding and reading what anyone may read, adding what anyone may add. */
export const VISITOR_TOOLS: Tool[] = ${JSON.stringify(visitorTools, null, 2)};

/** A record the key may read, or a refusal that says so. */
async function found<R extends { id: number }>(
  data: { get: (viewer: Viewer | null, id: number) => Promise<R | null | undefined> },
  viewer: Viewer | null,
  id: unknown,
  label: string,
): Promise<R> {
  const row = Number.isInteger(id) ? await data.get(viewer, id as number) : null;
  if (!row) throw new NotFound(\`No such \${label}, or not one this key may read.\`);
  return row;
}

${
  actions.length
    ? `/** An action is a key's: a visitor is never offered one (VISITOR_TOOLS), and is refused here too. */
const keyed = (viewer: Viewer | null): Viewer => {
  if (!viewer) throw new AccessDenied(false);
  return viewer;
};

`
    : ""
}/** Calls one tool as the key, or as a visitor without one. */
export async function callTool(viewer: Viewer | null, name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
${cases.join("\n")}
    default:
      throw new NotFound(\`There is no tool "\${name}".\`);
  }
}
`;
}

/** src/routes/mcp.ts: the endpoint assistants connect to. */
export function mcpRoute(ir: SpecIR): string {
  return `${HEADER}// The app's tools for AI assistants (docs/design/integrations.md §5b), at /mcp: connect an
// assistant here with a key made on the users page, as Authorization: Bearer <key>.
import { createFileRoute } from "@tanstack/react-router";
import { callTool, TOOLS, VISITOR_TOOLS } from "#/generated/mcp.server";
import { handleMcp } from "#/kit/mcp.server";
import { problem } from "#/kit/api.server";

export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      POST: ({ request }) => handleMcp(request, { name: ${JSON.stringify(ir.app.name)}, tools: TOOLS, visitorTools: VISITOR_TOOLS, call: callTool }),
      GET: () => problem(405, "This server answers POST requests only (no event stream)."),
    },
  },
});
`;
}
