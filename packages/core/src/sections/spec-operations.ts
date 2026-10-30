import { parseDocument } from "yaml";
import { COMPANIONS } from "../companion.js";
import type { YamlValue } from "../edit.js";
import { type SpecIR, storageOf } from "../ir.js";
import { type AnyOperation, type Effect, type Operation, OperationError } from "../operation.js";
import { validateSpec } from "../spec.js";

/**
 * Stored fields the edited text no longer has: their data would be lost. `validated` is the
 * edited spec as read with the project's plugins, when the caller has it.
 */
function removedFields(before: SpecIR, text: string, validated?: SpecIR): Effect[] {
  const after = validated ?? validateSpec({ path: "smithable.yml", text }).ir;
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

/** The files an edited text may replace, by the editor that holds each. */
export const EDITABLE_FILES = {
  "smithable.yml": "spec",
  "smithable.auth.yml": "auth",
  "smithable.ux.yml": "ux",
  "smithable.content.yml": "content",
  "smithable.context.yml": "context",
} as const;
export type EditableFile = keyof typeof EDITABLE_FILES;

/** A companion file as it begins when the project has none yet; none for the auth file. */
export const emptyFile = (file: EditableFile): string | undefined =>
  COMPANIONS.find((c) => c.file === file)?.empty;

/**
 * Studio's editor: the edited smithable.yml, or one of its companion files, replaces the current
 * one, through the same checks, migrations, checkpoint and undo as every operation. The specific
 * operations stay better for agents: a renamed field shows here as a removed and an added one.
 * With `path`, only that part of the file is set to `value` (null takes it away): what a form of
 * the spec writes where no operation of its own covers the key (docs/design/what-it-does.md §2).
 */
const editSpec: Operation<{
  text?: string;
  file?: EditableFile;
  path?: (string | number)[];
  value?: unknown;
}> = {
  name: "editSpec",
  summary:
    "Replace smithable.yml, or one of its companion files, with an edited version, as a whole.",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      text: { type: "string", description: "The complete new file (without path)." },
      path: {
        type: "array",
        items: { type: ["string", "integer"] },
        minItems: 1,
        description:
          "Only this part of the file, e.g. [app, timezone] or [pages, menu, order, lead].",
      },
      value: {
        description: "The part's new value with path; null takes the part away.",
      },
      file: {
        enum: Object.keys(EDITABLE_FILES),
        description: "Which file; smithable.yml when not said.",
      },
    },
  },
  positional: ["text"],
  describe: ({ file, path }) =>
    path
      ? `Set ${path.join(".")} in ${file ?? "smithable.yml"}`
      : `Edit ${file ?? "smithable.yml"}`,
  destructive: ({ text, file, path, value }, ir, after) =>
    (file ?? "smithable.yml") === "smithable.yml" &&
    // A stored field lost either way, the whole text or one part (a model's fields set anew),
    // asks for confirmation.
    (path
      ? after
        ? removedFields(ir, "", after).length > 0
        : path[0] === "models" && value === null
      : text !== undefined && removedFields(ir, text, after).length > 0),
  apply(editors, { text, file = "smithable.yml", path, value }, ir) {
    if (path) {
      // A form that forgot the value must not delete: null says so.
      if (value === undefined)
        throw new OperationError("path needs value; null takes the part away.");
      // A list's item by its place, as the YAML library reads a key: "0", "1", …
      const at = path.map(String);
      const editor = editors[EDITABLE_FILES[file]];
      if (!editor)
        throw new OperationError(`The project has no ${file}; set up sign-in first (setSignUp).`);
      if (value === null) {
        if (!editor.has(at)) throw new OperationError(`${path.join(".")} is not in ${file}.`);
        editor.remove(at);
      } else if (editor.has(at)) editor.set(at, value as YamlValue);
      else {
        // A key the part does not have yet is added under its parent, which must be a mapping
        // there is (a form writing a merge's fields or a split's move for the first time), so the
        // entry's comments and its neighbours stay as they are. The first missing part of the
        // path is named; a list takes no item by path, and a scalar takes no key.
        const parent = at.slice(0, -1);
        for (let i = 1; i <= parent.length; i++)
          if (!editor.has(parent.slice(0, i)))
            throw new OperationError(`${parent.slice(0, i).join(".")} is not in ${file}.`);
        const node = parent.length ? editor.get(parent) : editor.get([]);
        const key = path[path.length - 1];
        if (typeof key !== "string" || Array.isArray(node))
          throw new OperationError(
            `${parent.join(".") || file} is a list; a path adds no item to it.`,
          );
        if (node === null || typeof node !== "object")
          throw new OperationError(`${parent.join(".")} is a value, not a part with keys.`);
        editor.add(parent, key, value as YamlValue);
      }
      // A stored field lost with the part is a migration's, as with the whole text.
      return file === "smithable.yml" ? removedFields(ir, editors.spec.text) : [];
    }
    if (text === undefined)
      throw new OperationError("editSpec needs the file's text, or a path and its value.");
    const doc = parseDocument(text);
    if (doc.errors.length)
      throw new OperationError(`The YAML is not valid: ${doc.errors[0]?.message.split("\n")[0]}`);
    if (file === "smithable.yml") {
      editors.spec.replaceAll(text);
      return removedFields(ir, text);
    }
    const editor = editors[EDITABLE_FILES[file]];
    if (!editor)
      throw new OperationError(`The project has no ${file}; set up sign-in first (setSignUp).`);
    editor.replaceAll(text);
    return [];
  },
};

export const specOperations: AnyOperation[] = [editSpec];
