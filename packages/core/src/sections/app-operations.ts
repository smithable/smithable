import type { YamlEditor } from "../edit.js";
import { type AnyOperation, type Operation, OperationError } from "../operation.js";

/** Sets `value` under `app`, adding the key when it is new; "none" removes an optional key. */
function put(spec: YamlEditor, key: string, value: string | undefined): void {
  if (value === undefined) return;
  const path = ["app", key];
  if (value === "none") {
    if (key === "name") throw new OperationError("An app needs a name.");
    if (spec.has(path)) spec.removeAndPrune(path, 1);
  } else if (spec.has(path)) spec.set(path, value);
  else spec.add(["app"], key, value);
}

const setApp: Operation<{
  name?: string;
  description?: string;
  currency?: string;
  timezone?: string;
}> = {
  name: "setApp",
  summary:
    'Set what the app is: its name, a one-sentence description, its currency (ISO 4217) or time zone ("none" removes the currency or time zone).',
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", description: "The app's name, e.g. Stillwater Yoga." },
      description: { type: "string", description: "One sentence on what the app is for." },
      currency: { type: "string", description: 'ISO 4217 code, e.g. EUR, or "none".' },
      timezone: {
        type: "string",
        description: 'IANA time zone, e.g. Europe/Mariehamn, or "none".',
      },
    },
  },
  positional: [],
  describe: (args) =>
    `Set the app: ${Object.entries(args)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")}`,
  destructive: () => false,
  apply({ spec }, args) {
    if (Object.keys(args).length === 0)
      throw new OperationError("Say what to set: name, description, currency or timezone.");
    // One line each: a line break in a name or description would not fit the file.
    for (const key of ["name", "description", "currency", "timezone"] as const)
      put(spec, key, args[key]?.replace(/\s+/g, " ").trim());
    return [];
  },
};

export const appOperations: AnyOperation[] = [setApp];
