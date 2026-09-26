import { parseDocument } from "yaml";
import { type SpecIR, storageOf } from "../ir.js";
import { type AnyOperation, type Effect, type Operation, OperationError } from "../operation.js";
import { validateSpec } from "../spec.js";

/** Stored fields the edited text no longer has: their data would be lost. */
function removedFields(before: SpecIR, text: string): Effect[] {
  const after = validateSpec({ path: "smithable.yml", text }).ir;
  if (!after) return [];
  return before.models.flatMap((model) =>
    model.fields
      .filter((f) => storageOf(f) !== "none")
      .filter(
        (f) =>
          !after.models.find((m) => m.name === model.name)?.fields.some((g) => g.name === f.name),
      )
      .map(
        (f) =>
          ({
            kind: "remove-field",
            model: model.name,
            field: f.name,
            storage: storageOf(f),
          }) as const,
      ),
  );
}

/**
 * Studio's spec editor: the edited smithable.yml replaces the current one, through the same
 * checks, migrations, checkpoint and undo as every operation. The specific operations stay
 * better for agents: a renamed field shows here as a removed and an added one.
 */
const editSpec: Operation<{ text: string }> = {
  name: "editSpec",
  summary: "Replace smithable.yml with an edited version, as a whole.",
  schema: {
    type: "object",
    required: ["text"],
    additionalProperties: false,
    properties: { text: { type: "string", description: "The complete new smithable.yml." } },
  },
  positional: ["text"],
  describe: () => "Edit smithable.yml",
  destructive: ({ text }, ir) => removedFields(ir, text).length > 0,
  apply({ spec }, { text }, ir) {
    const doc = parseDocument(text);
    if (doc.errors.length)
      throw new OperationError(`The YAML is not valid: ${doc.errors[0]?.message.split("\n")[0]}`);
    spec.replaceAll(text);
    return removedFields(ir, text);
  },
};

export const specOperations: AnyOperation[] = [editSpec];
