import type { YamlEditor } from "../edit.js";
import { type AnyOperation, type Operation, OperationError } from "../operation.js";

/**
 * Sets one visible text in smithable.content.yml, e.g. a page's subtitle or a field's label,
 * as clicking a text in the preview and retyping it does. An empty text removes it, so the
 * text Smithable derives from names comes back. Which paths exist is the content file's own
 * validation, run after every operation.
 */
const setText: Operation<{ path: string[]; text: string }> = {
  name: "setText",
  summary:
    'Change a visible text, e.g. path [pages, customers, subtitle] or [models, Customer, fields, email, label] ("" restores the default).',
  schema: {
    type: "object",
    required: ["path", "text"],
    additionalProperties: false,
    properties: {
      path: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        description: "Where in smithable.content.yml, e.g. [pages, customers, title].",
      },
      text: { type: "string", description: 'The new text; "" restores the default.' },
    },
  },
  positional: ["text", "...path"],
  describe: ({ path, text }) =>
    text ? `Change the text ${path.join(".")} to "${text}"` : `Restore the text ${path.join(".")}`,
  destructive: () => false,
  apply(editors, { path, text }) {
    const content = editors.content as YamlEditor;
    if (text === "") {
      if (!content.has(path)) throw new OperationError(`${path.join(".")} has no text of its own.`);
      content.removeAndPrune(path, 0);
    } else if (content.has(path)) content.set(path, text);
    // Missing parents (e.g. a page with no texts yet) are created.
    else content.add(path.slice(0, -1), path[path.length - 1] as string, text);
    return [];
  },
};

export const contentOperations: AnyOperation[] = [setText];
