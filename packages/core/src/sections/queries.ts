import { checkKeys, mapEntries, readBoolean, readString } from "../context.js";
import type { QueryIR } from "../ir.js";
import { type Operation, OperationError } from "../operation.js";
import type { SpecSection } from "../section.js";
import { FIELD_NAME_PATTERN } from "./names.js";
import { readSemanticText, TEXT_KEYS } from "./text.js";
import { textSchema } from "./text-schema.js";

/**
 * Queries: records chosen or ordered by code, for what a filter cannot say (the customers
 * most likely to churn). The spec names the query and what it returns; its implementation
 * is src/custom/queries/<query>.ts, created once as a stub that returns every readable record.
 */
const addQuery: Operation<{ query: string; returns: string; intent?: string }> = {
  name: "addQuery",
  summary:
    "Add a custom query: records of a model chosen or ordered by code (e.g. customers most likely to churn). Its code is written afterwards, in src/custom/queries/.",
  schema: {
    type: "object",
    required: ["query", "returns"],
    additionalProperties: false,
    properties: {
      query: { type: "string", description: "camelCase name, e.g. churnRisk." },
      returns: {
        type: "string",
        description: "The model whose records it returns, e.g. Customer.",
      },
      intent: { type: "string", description: "What it finds and in which order, in one sentence." },
    },
  },
  positional: ["query", "returns"],
  describe: ({ query, returns }) => `Add query ${query} (${returns} records chosen by code)`,
  destructive: () => false,
  apply({ spec }, { query, returns, intent }, ir) {
    if (!FIELD_NAME_PATTERN.test(query))
      throw new OperationError(`Query name "${query}" must be camelCase, like "churnRisk".`);
    if (ir.queries.some((q) => q.name === query))
      throw new OperationError(`Query "${query}" already exists.`);
    const model = returns.replace(/\[\]$/, "");
    if (!ir.models.some((m) => m.name === model))
      throw new OperationError(`There is no model named "${model}".`);
    const value = { custom: true, returns: `${model}[]`, ...(intent ? { intent } : {}) };
    if (spec.has(["queries"])) spec.add(["queries"], query, value);
    else spec.add([], "queries", { [query]: value });
    return [];
  },
};

export const queriesSection: SpecSection<"queries"> = {
  key: "queries",
  required: false,
  operations: [addQuery],
  schema: {
    type: "object",
    description: "Records chosen or ordered by code in src/custom/queries/.",
    propertyNames: { pattern: FIELD_NAME_PATTERN.source },
    additionalProperties: {
      type: "object",
      required: ["custom", "returns"],
      additionalProperties: false,
      properties: {
        custom: { const: true, description: "Implemented in src/custom/queries/." },
        returns: {
          type: "string",
          pattern: "^[A-Z][A-Za-z0-9]*\\[\\]$",
          description: 'The records it returns, e.g. "Customer[]".',
        },
        ...textSchema,
      },
    },
  },
  parse(ctx, node) {
    if (node === undefined) return [];
    const queries: QueryIR[] = [];
    for (const { key, keyNode, value } of mapEntries(ctx, node, `"queries"`) ?? []) {
      if (!FIELD_NAME_PATTERN.test(key)) {
        ctx.error(
          keyNode,
          "invalid-name",
          `Query name "${key}" must start with a lowercase letter and use only letters and digits, like "churnRisk".`,
        );
        continue;
      }
      ctx.define("query", key);
      const where = `query "${key}"`;
      const known = checkKeys(ctx, mapEntries(ctx, value, where) ?? [], where, {
        allowed: ["custom", "returns", ...TEXT_KEYS],
        later: ["input", "sql", "where"],
        content: ["label", "title"],
      });
      const byKey = new Map(known.map((e) => [e.key, e]));
      const custom = byKey.get("custom");
      if (!custom || readBoolean(ctx, custom.value, `"custom"`) !== true) {
        ctx.error(custom?.value ?? keyNode, "missing-key", `Query "${key}" needs "custom: true".`);
        continue;
      }
      const returns = byKey.get("returns");
      const text = returns ? readString(ctx, returns.value, `"returns" of ${where}`) : undefined;
      const model = /^([A-Z][A-Za-z0-9]*)\[\]$/.exec(text ?? "")?.[1];
      if (!model) {
        ctx.error(
          returns?.value ?? keyNode,
          "invalid-query",
          `${where.charAt(0).toUpperCase()}${where.slice(1)} needs "returns: <Model>[]", the records it returns.`,
        );
        continue;
      }
      ctx.reference("model", model, returns?.value ?? keyNode);
      queries.push({ name: key, custom: true, returns: model, ...readSemanticText(ctx, known) });
    }
    return queries;
  },
};
