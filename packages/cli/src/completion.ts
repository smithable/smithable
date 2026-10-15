// Shell completion (`smithable completion bash|zsh|fish`): the scripts ask
// `smithable __complete -- <words>` for candidates, so every shell shares one source: the
// command table (help.ts), the project's operations and the names in its spec.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type AnyOperation,
  type ArgRef,
  type JsonSchema,
  namesFor,
  operationsFor,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { COMMANDS } from "./help.js";
import { loadPlugins } from "./plugins.js";

const OPTIONS = ["help", "version", "dir"];

/** Candidates for the word being typed, given the words before it. */
export function complete(words: string[], current: string, dir = "."): string[] {
  const positionals = words.filter((w) => !w.startsWith("-"));
  const [command, ...args] = positionals;
  const command_ = COMMANDS.find((c) => c.name === command);
  if (current.startsWith("-")) {
    const options = [...OPTIONS, ...(command_?.options ?? [])].map((o) => `--${o}`);
    return options.filter((o) => o.startsWith(current));
  }
  if (!command) return COMMANDS.map((c) => c.name).filter((n) => n.startsWith(current));
  if (command === "completion") return ["bash", "zsh", "fish"].filter((s) => s.startsWith(current));
  if (command === "new" && words.at(-1) === "--starter")
    return [
      "crm",
      "booking",
      "invoicing",
      "marketplace",
      "records",
      "status",
      "api",
      "support",
      "kiosk",
    ];
  if (command === "security" && words.at(-1) === "--level") return ["fast", "normal", "release"];
  if (command === "deploy" && words.at(-1) === "--target") return ["docker", "compose"];
  const project = readProject(dir);
  if (command === "op") {
    let operations: AnyOperation[];
    try {
      operations = operationsFor(loadPlugins(dir));
    } catch {
      operations = operationsFor();
    }
    if (args.length === 0)
      return operations.map((o) => o.name).filter((n) => n.startsWith(current));
    const op = operations.find((o) => o.name === args[0]);
    if (!op) return [];
    const index = args.length - 1;
    const spec = op.positional[Math.min(index, op.positional.length - 1)] ?? "";
    const rest = spec.startsWith("...");
    if (index >= op.positional.length && !rest) return [];
    const key = spec.replace(/^\.\.\./, "");
    const property = ((op.schema.properties ?? {}) as Record<string, JsonSchema>)[key];
    return named(property, args.slice(1), op, project, current);
  }
  if (command === "inspect" || command === "code" || command === "customize") {
    const kinds =
      command === "customize" ? ["page"] : ["model", "field", "action", "query", "page"];
    return [
      ...(command === "code" ? ["hooks"] : []),
      ...project.concepts.filter((c) => kinds.includes(c.split(":")[0] ?? "")),
    ].filter((c) => c.startsWith(current));
  }
  return [];
}

interface Names {
  /** The spec, for what an argument names (namesFor); absent outside a project. */
  ir?: SpecIR;
  models: string[];
  fields: Record<string, string[]>;
  pages: string[];
  roles: string[];
  concepts: string[];
}

/** The names in the project's spec, for completing an operation's arguments; empty outside one. */
function readProject(dir: string): Names {
  const none: Names = { models: [], fields: {}, pages: [], roles: [], concepts: [] };
  const specPath = join(dir, "smithable.yml");
  if (!existsSync(specPath)) return none;
  const authPath = join(dir, "smithable.auth.yml");
  const roles = existsSync(authPath)
    ? (validateAuth({ path: authPath, text: readFileSync(authPath, "utf8") }).auth?.roles.map(
        (r) => r.name,
      ) ?? [])
    : [];
  let plugins: ReturnType<typeof loadPlugins> = [];
  try {
    plugins = loadPlugins(dir);
  } catch {}
  const ir = validateSpec(
    { path: specPath, text: readFileSync(specPath, "utf8") },
    { roles, plugins },
  ).ir;
  if (!ir) return none;
  return {
    ir,
    models: ir.models.map((m) => m.name),
    fields: Object.fromEntries(ir.models.map((m) => [m.name, m.fields.map((f) => f.name)])),
    pages: ir.pages.map((p) => p.id),
    roles,
    concepts: [
      ...ir.models.flatMap((m) => [
        `model:${m.name}`,
        ...m.fields.map((f) => `field:${m.name}.${f.name}`),
      ]),
      ...ir.actions.map((a) => `action:${a.name}`),
      ...ir.queries.map((q) => `query:${q.name}`),
      ...ir.pages.map((p) => `page:${p.id}`),
    ],
  };
}

/** What an argument names in the spec (its x-smithable ref), as candidates. */
function named(
  property: JsonSchema | undefined,
  given: string[],
  op: AnyOperation,
  project: Names,
  current: string,
): string[] {
  const ref = property?.["x-smithable"] as ArgRef | undefined;
  // The arguments given so far, by name, for a field's model or a value's field.
  const args = Object.fromEntries(op.positional.map((p, i) => [p.replace("...", ""), given[i]]));
  const candidates = property?.enum
    ? (property.enum as unknown[]).map(String)
    : ref && project.ir
      ? namesFor(ref, args, project.ir, project.roles).map(([value]) => value)
      : [];
  return [...new Set(candidates)].filter((c) => c.startsWith(current));
}

/** The completion script for a shell. */
export function script(shell: string): string | undefined {
  if (shell === "bash")
    return `_smithable() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local words=("\${COMP_WORDS[@]:1:COMP_CWORD-1}")
  COMPREPLY=( $(smithable __complete -- "\${words[@]}" -- "$cur" 2>/dev/null) )
}
complete -F _smithable smithable
`;
  if (shell === "zsh")
    return `#compdef smithable
_smithable() {
  local -a candidates
  candidates=("\${(@f)$(smithable __complete -- "\${words[@]:1:CURRENT-2}" -- "\${words[CURRENT]}" 2>/dev/null)}")
  compadd -a candidates
}
compdef _smithable smithable
`;
  if (shell === "fish")
    return `complete -c smithable -f -a '(smithable __complete -- (commandline -opc)[2..] -- (commandline -ct))'
`;
  return undefined;
}
