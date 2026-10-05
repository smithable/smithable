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
  type FieldIR,
  kebab,
  type ModelIR,
  plural,
  type SpecIR,
  type StandardActionIR,
  storesPictures,
} from "@smithable/core";
import { actionNames, askedFields } from "./actions.js";
import {
  HEADER,
  literal,
  modelNamed,
  names,
  relatedTitle,
  type Texts,
  titleField,
} from "./shared.js";

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
  return `${models.map(({ n }) => `import { ${n.schema} } from "${n.module}";`).join("\n")}

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
          const query = new URL(request.url).searchParams;
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
export function askModule(ir: SpecIR, auth: AuthIR, t: Texts, content?: ContentIR): string {
  return toolsModule(ir, auth, t, content, "app");
}

function toolsModule(
  ir: SpecIR,
  auth: AuthIR,
  t: Texts,
  content: ContentIR | undefined,
  scope: "api" | "app",
): string {
  const app = scope === "app";
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
    return `  ${model.name}: { data: ${n.data}, toApi: ${c}ToApi, fromApi: ${c}FromApi, title: ${JSON.stringify(titleField(model))}, refs: ${JSON.stringify(Object.fromEntries(refs))}, searched: ${JSON.stringify(searched)}, label: ${JSON.stringify(n.label.toLowerCase())}${named} },`;
  });
  const runs = actions.map((action) => {
    const model = modelNamed(ir, action.on);
    const c = model.name[0]?.toLowerCase() + model.name.slice(1);
    const asked = askedFields(action).length > 0;
    // The record by its id or its title, as the other tools take it.
    return `    case ${JSON.stringify(action.name)}: {
      const row = await found(KINDS.${model.name}, viewer, args.id, "change");
      return ${c}ToApi(await ${actionNames(action).run}(keyed(viewer), row.id${asked ? `, ${actionNames(action).asks}.parse(args.input ?? {})` : ""}));
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
${actions.length || app ? 'import { AccessDenied, type Viewer } from "#/kit/access";' : 'import type { Viewer } from "#/kit/access";'}
${app ? 'import type { AskKind } from "#/kit/ask";\nimport { type Answer, answer, hostModel } from "#/kit/assistant.server";\n' : ""}import { BadInput, NotFound } from "#/kit/refusal";
import type { Offer } from "#/kit/tools";
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
${models.map(({ model, n }) => `import { ${n.data} } from "./${kebab(model.name)}.server";`).join("\n")}
${actions.map((a) => `import { ${actionNames(a).run} } from "./actions/${kebab(a.name)}.server";${askedFields(a).length ? `\nimport { ${actionNames(a).asks} } from "./actions/${kebab(a.name)}";` : ""}`).join("\n")}
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
  if (title && related && typeof related === "object") return { id: related.id, title: related[title] };
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
      const kind = kindOf(args);
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
      await kind.data.remove(viewer, row.id);
      return { deleted: row.id };
    }
    case "describe":
      kindOf(args);
      return { description: offerFor(viewer).describe[args.kind as string] };
    case "run":
      switch (args.action) {
${runs.join("\n")}
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
    unread: viewer
      ? "The app could not read this question by itself, and no AI is set up to answer it here."
      : 'The app answers questions it can read by itself, like "how many … are there?" or "show the … that …".',
  });
}
`
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
