import type { JsonSchema } from "./section.js";
import { SECTIONS, SPEC_VERSION } from "./spec.js";

/** The published JSON Schema for smithable.yml, composed from the registered sections. */
export function buildJsonSchema(): JsonSchema {
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: `https://smithable.ax/schema/smithable-${SPEC_VERSION}.json`,
    title: "smithable.yml",
    description: "Describes what a Smithable application does. See docs/spec.",
    type: "object",
    required: ["smithable", ...SECTIONS.filter((s) => s.required).map((s) => s.key)],
    additionalProperties: false,
    properties: {
      smithable: {
        description: "The spec format version.",
        enum: [Number(SPEC_VERSION), SPEC_VERSION],
      },
      ...Object.fromEntries(SECTIONS.map((s) => [s.key, s.schema])),
    },
  };
}
