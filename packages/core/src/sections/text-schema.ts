import type { JsonSchema } from "../section.js";

/** JSON Schema for the semantic free-text keys, shared by every concept. */
export const textSchema: Record<"description" | "intent" | "rules", JsonSchema> = {
  description: {
    type: "string",
    title: "What it is for",
    description:
      "What this is, in a sentence. Read by the models that draft and change the app and by its assistants, and the app's own description is the landing page's and the API's; not shown to visitors otherwise.",
    "x-semantic": true,
    "x-docs": "https://docs.smithable.ai/spec.html#semantic-text",
  },
  intent: {
    type: "string",
    title: "What it should achieve",
    description:
      "The outcome or experience this should achieve, in a sentence: it guides the models that change the app, and it is the summary's sentence for this part.",
    "x-semantic": true,
    "x-docs": "https://docs.smithable.ai/spec.html#semantic-text",
  },
  rules: {
    type: "array",
    title: "Rules",
    description:
      "Domain rules in plain language. A rule does nothing by itself until something implements it: the models read them when drafting and changing the app, and the advice notes point at them.",
    examples: [["An order over 1000 needs a manager's approval before it ships."]],
    "x-semantic": true,
    "x-docs": "https://docs.smithable.ai/spec.html#semantic-text",
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
