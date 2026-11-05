import type { JsonSchema } from "./section.js";
import { SECTIONS, SPEC_VERSION } from "./spec.js";

/**
 * The published JSON Schema for smithable.yml, composed from the registered sections.
 *
 * Beside the standard keywords the schemas carry a few of their own, for the forms Studio builds
 * from them (docs/design/studio-v3.md §5); validators ignore unknown keywords:
 * - `title`: the key's plain label where its name or description is technical ("Currency");
 *   `description` is then the tooltip.
 * - `x-hidden`: not shown in a form (the spec format version).
 * - `x-suggest`: a text field that offers values as it is typed in: `time-zones`.
 * - `x-examples`: a choice's values as they read, by value ("Thu 5 Nov 2026"), shown beside each;
 *   `x-unset` what leaving it unset means (the default and why).
 * - `x-semantic`: a text a model reads (what something is for, the rules): the forms gather
 *   them in one place. `x-docs` is the docs page that explains such a key.
 * `examples` (standard) gives a form its placeholder.
 */
export function buildJsonSchema(): JsonSchema {
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: `https://docs.smithable.ai/schema/smithable-${SPEC_VERSION}.json`,
    title: "smithable.yml",
    description: "Describes what a Smithable application does. See docs/spec.",
    type: "object",
    required: ["smithable", ...SECTIONS.filter((s) => s.required).map((s) => s.key)],
    additionalProperties: false,
    properties: {
      smithable: {
        title: "Spec format version",
        description: "The spec format version this file is written in.",
        "x-hidden": true,
        enum: [Number(SPEC_VERSION), SPEC_VERSION],
      },
      ...Object.fromEntries(SECTIONS.map((s) => [s.key, s.schema])),
    },
  };
}
