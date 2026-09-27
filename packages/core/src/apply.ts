import { validateAuth } from "./auth.js";
import { validateContent } from "./content.js";
import type { Diagnostic } from "./diagnostics.js";
import { YamlEditor } from "./edit.js";
import { type AnyOperation, type Effect, type OperationArgs, OperationError } from "./operation.js";
import type { SpecPlugin } from "./plugin.js";
import type { JsonSchema } from "./section.js";
import { SECTIONS, validateSpec } from "./spec.js";
import { didYouMean } from "./suggest.js";
import { validateUx } from "./ux.js";

/** Every operation, from all sections. */
export const OPERATIONS: readonly AnyOperation[] = SECTIONS.flatMap((s) => s.operations ?? []);

export interface ProjectFiles {
  spec: string;
  /** smithable.content.yml, when the project has one. */
  content?: string;
  /** smithable.auth.yml; without it, role names in the spec are not checked. */
  auth?: string;
  /** smithable.ux.yml, when the project has one. */
  ux?: string;
  /** The project's plugins, for the sections of smithable.yml they handle. */
  plugins?: SpecPlugin[];
}

export type OperationResult =
  | {
      ok: true;
      files: ProjectFiles;
      description: string;
      destructive: boolean;
      effects: Effect[];
    }
  | { ok: false; message: string; diagnostics: Diagnostic[] };

export function findOperation(name: string): AnyOperation | undefined {
  return OPERATIONS.find((op) => op.name === name);
}

/**
 * Applies an operation to the project's files. Pure: returns the edited texts, or why the
 * operation cannot be applied. The result is always a valid spec and content file.
 */
export function applyOperation(
  files: ProjectFiles,
  name: string,
  args: OperationArgs,
): OperationResult {
  const fail = (message: string, diagnostics: Diagnostic[] = []) => ({
    ok: false as const,
    message,
    diagnostics,
  });
  const op = findOperation(name);
  if (!op) {
    const names = OPERATIONS.map((o) => o.name);
    return fail(
      `Unknown operation "${name}". ${didYouMean(name, names) ?? `Available: ${names.join(", ")}.`}`,
    );
  }
  const argError = checkArgs(op.schema, args);
  if (argError) return fail(`${name}: ${argError}`);

  const auth = (text: string) => validateAuth({ path: "smithable.auth.yml", text });
  const roles =
    files.auth === undefined ? undefined : auth(files.auth).auth?.roles.map((r) => r.name);
  const options = {
    ...(roles ? { roles } : {}),
    ...(files.plugins ? { plugins: files.plugins } : {}),
  };
  const before = validateSpec({ path: "smithable.yml", text: files.spec }, options);
  if (!before.ir)
    return fail(
      "smithable.yml has errors; fix them before applying operations.",
      before.diagnostics,
    );

  const editors = {
    spec: new YamlEditor(files.spec),
    ...(files.content === undefined ? {} : { content: new YamlEditor(files.content) }),
    ...(files.auth === undefined ? {} : { auth: new YamlEditor(files.auth) }),
    ux: new YamlEditor(files.ux ?? `smithableUx: 0.1\n`),
  };
  let effects: Effect[];
  try {
    effects = op.apply(editors, args, before.ir);
  } catch (error) {
    if (error instanceof OperationError) return fail(error.message);
    throw error;
  }

  const after = validateSpec({ path: "smithable.yml", text: editors.spec.text }, options);
  if (!after.ir) return fail(`${name} would make smithable.yml invalid.`, after.diagnostics);
  if (editors.content) {
    const content = validateContent(
      { path: "smithable.content.yml", text: editors.content.text },
      after.ir,
    );
    if (!content.content)
      return fail(`${name} would make smithable.content.yml invalid.`, content.diagnostics);
  }
  // The ux file is written only if the project has one or the operation changed it.
  const uxChanged = editors.ux.text !== (files.ux ?? `smithableUx: 0.1\n`);
  if (files.ux !== undefined || uxChanged) {
    const result = validateUx({ path: "smithable.ux.yml", text: editors.ux.text }, after.ir);
    if (!result.ux) return fail(`${name} would make smithable.ux.yml invalid.`, result.diagnostics);
  }
  if (editors.auth) {
    const result = validateAuth({ path: "smithable.auth.yml", text: editors.auth.text }, after.ir);
    if (!result.auth)
      return fail(`${name} would make smithable.auth.yml invalid.`, result.diagnostics);
  }
  return {
    ok: true,
    files: {
      spec: editors.spec.text,
      ...(editors.content ? { content: editors.content.text } : {}),
      ...(editors.auth ? { auth: editors.auth.text } : {}),
      ...(files.ux !== undefined || uxChanged ? { ux: editors.ux.text } : {}),
    },
    description: op.describe(args, before.ir),
    destructive: op.destructive(args, before.ir),
    effects,
  };
}

/** Turns CLI positional arguments into an operation's arguments, following `positional`. */
export function parseOperationArgs(op: AnyOperation, values: string[]): OperationArgs {
  const properties = (op.schema.properties ?? {}) as Record<string, JsonSchema>;
  const args: OperationArgs = {};
  op.positional.forEach((spec, index) => {
    if (spec.startsWith("...")) {
      const key = spec.slice(3);
      const rest = values.slice(index);
      if (rest.length === 0) return;
      const type = properties[key]?.type;
      if (type === "object") {
        args[key] = Object.fromEntries(
          rest.map((pair) => {
            const eq = pair.indexOf("=");
            return eq === -1 ? [pair, ""] : [pair.slice(0, eq), pair.slice(eq + 1)];
          }),
        );
      } else if (type === "array") {
        args[key] = rest;
      } else {
        args[key] = rest.join(" ");
      }
    } else if (values[index] !== undefined) {
      args[spec] = values[index];
    }
  });
  return args;
}

/** Checks required keys, unknown keys and basic types against an operation's schema. */
function checkArgs(schema: JsonSchema, args: OperationArgs): string | undefined {
  const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
  for (const key of (schema.required ?? []) as string[]) {
    if (args[key] === undefined || args[key] === "") return `"${key}" is missing.`;
  }
  for (const [key, value] of Object.entries(args)) {
    const property = properties[key];
    if (!property) return `Unknown argument "${key}".`;
    const ok =
      property.type === "array"
        ? Array.isArray(value) && value.every((v) => typeof v === "string")
        : property.type === "object"
          ? typeof value === "object" && value !== null && !Array.isArray(value)
          : property.type === "integer"
            ? Number.isInteger(value)
            : typeof value === property.type;
    if (!ok)
      return `"${key}" must be ${property.type === "array" ? "a list" : property.type === "integer" ? "a whole number" : `a ${property.type}`}.`;
  }
  return undefined;
}
