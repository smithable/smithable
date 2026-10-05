import type { JsonSchema } from "../section.js";

/** JSON Schema for the semantic free-text keys, shared by every concept. */
export const textSchema: Record<"description" | "intent" | "rules", JsonSchema> = {
  description: {
    type: "string",
    description: "What this is. Meaning for AI and developers; not shown to visitors.",
  },
  intent: { type: "string", description: "The outcome or experience this should achieve." },
  rules: {
    type: "array",
    description:
      "Domain rules in plain language. A rule does nothing by itself until something implements it.",
    items: {
      oneOf: [
        { type: "string" },
        {
          type: "object",
          required: ["rule"],
          additionalProperties: false,
          properties: {
            id: { type: "string", description: "A short name to refer to the rule by." },
            rule: { type: "string", description: "The rule, in plain language." },
          },
        },
      ],
    },
  },
};
