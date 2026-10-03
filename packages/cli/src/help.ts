// The CLI's commands, in one table: the global help, each command's own help (`smithable
// <command> --help`), an operation's help (`smithable op <name> --help`) and the shell
// completion (completion.ts) are all rendered from it, so they cannot drift apart.
import type { AnyOperation, JsonSchema } from "@smithable/core";

export interface Command {
  name: string;
  /** How it is called, after "smithable ". */
  usage: string;
  /** What it does, one or more lines. */
  text: string[];
  /** Its options, without the leading dashes, for completion and the command's help. */
  options?: string[];
}

export const COMMANDS: Command[] = [
  {
    name: "read-page",
    usage: "read-page <file.html> --url <address>",
    text: [
      "Print the description new --from would draft from, for a page saved elsewhere;",
      "fails when the page shows too little without JavaScript",
    ],
    options: ["url"],
  },
  {
    name: "new",
    usage: "new <dir>",
    text: [
      "Create a project from a starter (--starter crm|booking|invoicing|marketplace|records|status, default crm),",
      'or --describe "a booking site for a yoga studio": a model may ask up to three questions,',
      'picks the starter to adapt, drafts the app, and you confirm the result. --answers "a; b"',
      "answers the questions in order; --yes asks nothing and creates the app directly;",
      "--no-sample-data starts with an empty database (no samples/ folder, nothing seeded).",
      "--from <url> starts from a page: its text, menu and forms describe the app (needs a model);",
      "--with-pictures also takes its pictures as sample pictures, after asking;",
      "--name \"Pulse API Status\" names the app, over the starter's or the draft's own name",
    ],
    options: [
      "starter",
      "describe",
      "answers",
      "yes",
      "no-sample-data",
      "from",
      "with-pictures",
      "name",
    ],
  },
  {
    name: "clarify",
    usage: 'clarify "<description>"',
    text: [
      "The questions a model would ask about a description before drafting an app, and the",
      "starter it picks (--json for programs; no model, or a failed answer, means no questions)",
    ],
    options: ["json"],
  },
  {
    name: "run",
    usage: "run [dir]",
    text: ["Generate if needed, start the app and open it in the browser (--no-open)"],
    options: ["no-open"],
  },
  {
    name: "generate",
    usage: "generate [dir]",
    text: ["Regenerate the app from smithable.yml (--force overwrites hand-edited files)"],
    options: ["force"],
  },
  {
    name: "validate",
    usage: "validate [path]",
    text: [
      "Check smithable.yml in a directory (default: current) or a given file",
      "(--plugin <name> also loads a plugin that is not declared yet)",
    ],
    options: ["plugin"],
  },
  {
    name: "theme",
    usage: "theme --from <url>",
    text: [
      "A theme from a site: its colors, corners and font, read in a browser (needs Playwright),",
      "made readable and added as themes/<name>.yml; --name names it, --use makes it the app's",
    ],
    options: ["from", "name", "use"],
  },
  {
    name: "themes",
    usage: "themes [dir]",
    text: [
      "List the themes the ux file may name: the built-in ones and the project's themes/*.yml",
    ],
  },
  { name: "build", usage: "build [dir]", text: ["Build the app's container image with Docker"] },
  {
    name: "security",
    usage: "security [dir]",
    text: [
      "Check the app: --level fast (type check, tests), normal (+ dependencies,",
      "secrets, code; the default) or release (+ the image and the running app).",
      "Uses installed scanners, or their pinned images in Docker",
    ],
    options: ["level"],
  },
  {
    name: "deploy",
    usage: "deploy [dir]",
    text: [
      "Release checks, then run the app: --target docker (default), ssh://user@host",
      "(a remote Docker host) or compose (writes compose.yaml); --port, --url",
    ],
    options: ["target", "port", "url"],
  },
  {
    name: "backup",
    usage: "backup [dir]",
    text: [
      "Back up the database and uploads --to a folder or s3://bucket/prefix (S3",
      "credentials in AWS_* variables); --container <name> for a deployed app.",
      "--continuous streams every change with Litestream (installed separately),",
      "so restore --at can reach any second of the last 30 days; --data <dir>",
    ],
    options: ["to", "container", "continuous", "data"],
  },
  {
    name: "restore",
    usage: "restore [dir]",
    text: [
      "Restore the newest backup (or --backup <time>) --from a folder or s3://…,",
      "into the project or --container <name>. With --at <time> and a continuous",
      "backup: what is new, changed and removed since; --bring-back and",
      "--undo-changes <Model,…> --yes write those records back (stop the app first)",
    ],
    options: ["from", "backup", "container", "at", "data", "bring-back", "undo-changes", "yes"],
  },
  {
    name: "upgrade",
    usage: "upgrade [dir]",
    text: [
      "Move the app to this Smithable's spec version and stack profile; kept only",
      "when the type check and tests pass, and reported where custom code breaks",
    ],
  },
  {
    name: "update",
    usage: "update --security [dir]",
    text: ["Bring in this Smithable's security fixes; kept only when the checks pass"],
    options: ["security"],
  },
  {
    name: "ask",
    usage: 'ask "<request>"',
    text: [
      "A model proposes the change in plain language; it is applied after you",
      "confirm (--yes applies it directly). Setting up models: docs/ai.md",
    ],
    options: ["yes", "dir"],
  },
  {
    name: "code",
    usage: 'code <concept> "<what>"',
    text: [
      "Have a model write the custom code of a query, action, custom page or the hooks,",
      'e.g. code query:churnRisk "rank by days since the last order" or code hooks',
      '"email the customer when an order ships"; only src/custom/ may change, and the',
      "type check and tests must pass",
    ],
    options: ["dir"],
  },
  {
    name: "teach",
    usage: "teach <section>",
    text: [
      "Have a model write a project plugin for a section of smithable.yml Smithable",
      "does not know (e.g. newsletter:); afterwards it is generated without AI",
    ],
    options: ["dir"],
  },
  {
    name: "op",
    usage: "op <name> …",
    text: [
      "Change the app with an operation, e.g. op addField Customer phone phone",
      '(run "smithable op" for the list, "smithable op <name> --help" for its arguments;',
      "a word @path gives a file's text, e.g. op addTheme forest --text @forest.yml;",
      "--yes confirms changes that lose data)",
    ],
    options: ["yes", "dir"],
  },
  {
    name: "undo",
    usage: "undo",
    text: ["Undo the last operation, including the dev database"],
    options: ["dir"],
  },
  {
    name: "report",
    usage: "report [--send] [--always | --never | --ask]",
    text: [
      "Show the report of the last failure: the operation, the error, the log and the spec",
      "files (never records, uploads or custom code); --send sends it, --always and --never",
      "are remembered for you, --ask asks again",
    ],
    options: ["send", "always", "never", "ask", "dir"],
  },
  {
    name: "test",
    usage: "test [dir]",
    text: ["Run the app's tests and remember the results for rule status"],
  },
  {
    name: "inspect",
    usage: "inspect [c]",
    text: [
      "Show rules and their status, or one concept: its meaning, rules, files,",
      "symbols, routes, tables and tests, e.g. inspect action:mergeCustomers (--json)",
    ],
    options: ["json", "dir"],
  },
  {
    name: "customize",
    usage: "customize page:<p>",
    text: [
      "Give a page its own component in src/custom/pages/, starting from the generated",
      "one (or moving a hand edit of its route there); the route stays generated",
    ],
    options: ["dir"],
  },
  {
    name: "context",
    usage: 'context "<req>"',
    text: [
      "The smallest context an AI model needs for a request, with its size in tokens",
      "(--implementation adds the custom code involved; --json)",
    ],
    options: ["implementation", "json", "dir"],
  },
  {
    name: "studio",
    usage: "studio [dir]",
    text: [
      "Open Smithable Studio for the project: Builder and Studio modes, with the",
      "app's preview (--port, default 4321). Behind a proxy (the hosted service):",
      "--host 0.0.0.0, --preview-url (the preview's public address) and --home",
      "(a link back to the service's page for the project); with --host it needs",
      "SMITHABLE_STUDIO_TOKEN, or --insecure to run open to the network",
    ],
    options: ["port", "host", "preview-url", "home", "insecure"],
  },
  {
    name: "mcp",
    usage: "mcp [dir]",
    text: ["Serve the project to AI agents (Claude Code, Cursor, …) over MCP on stdin/stdout"],
  },
  {
    name: "detach",
    usage: "detach [dir]",
    text: ["Turn the project into an ordinary one that no longer uses Smithable"],
  },
  {
    name: "completion",
    usage: "completion bash|zsh|fish",
    text: [
      "Print the shell's completion script for smithable: commands, options, operations",
      "and their arguments (model, field and page names from the project). E.g.",
      'eval "$(smithable completion bash)" in .bashrc',
    ],
  },
];

const GLOBAL_OPTIONS = [
  "-h, --help       Show this help (after a command: that command's help)",
  "-v, --version    Show the Smithable version",
  "--dir <path>     Project directory for op, undo, report, inspect and test (default: current)",
];

/** The global help: every command in the table. */
export function help(): string {
  const rows = COMMANDS.map(({ usage, text }) => {
    const [first = "", ...rest] = text;
    const head = usage.length > 16 ? `  ${usage}  ${first}` : `  ${usage.padEnd(16)} ${first}`;
    return [head, ...rest.map((line) => `${" ".repeat(19)}${line}`)].join("\n");
  });
  return `Usage: smithable <command> [options]\n\nCommands:\n${rows.join("\n")}\n\nOptions:\n${GLOBAL_OPTIONS.map((o) => `  ${o}`).join("\n")}\n`;
}

/** One command's help, or undefined for an unknown one. */
export function commandHelp(name: string): string | undefined {
  const command = COMMANDS.find((c) => c.name === name);
  if (!command) return undefined;
  const options = (command.options ?? []).map((o) => `--${o}`).join(", ");
  return `Usage: smithable ${command.usage}\n\n${command.text.join("\n")}\n${options ? `\nOptions: ${options}, --help\n` : ""}`;
}

/** An operation's arguments, from its schema: name, whether required, type and what it names. */
export function operationHelp(op: AnyOperation): string {
  const properties = (op.schema.properties ?? {}) as Record<string, JsonSchema>;
  const required = (op.schema.required as string[] | undefined) ?? [];
  const lines = op.positional.map((spec) => {
    const key = spec.replace(/^\.\.\./, "");
    const p = properties[key] ?? {};
    const ref = (p["x-smithable"] as { ref?: string; label?: string } | undefined) ?? {};
    const type = p.enum
      ? (p.enum as unknown[]).map((v) => JSON.stringify(v)).join(" | ")
      : p.type === "array"
        ? "list"
        : p.type === "object"
          ? "key=value pairs"
          : String(p.type ?? "text");
    const names = {
      model: "a model's name",
      field: "a field's name",
      page: "a page's name",
      role: "a role",
      choiceValue: "a choice value",
      section: "a landing section",
    }[ref.ref ?? ""];
    const notes = [
      names ?? type,
      required.includes(key) ? undefined : "optional",
      spec.startsWith("...") ? "the rest of the line" : undefined,
    ].filter(Boolean);
    const description = p.description ? `${String(p.description)} ` : "";
    return `  <${key}>${" ".repeat(Math.max(1, 14 - key.length))}${description}(${notes.join(", ")})`;
  });
  return `Usage: smithable op ${op.name} ${op.positional.map((p) => `<${p.replace(/^\.\.\./, "")}>`).join(" ")}\n\n${op.summary}\n\nArguments:\n${lines.join("\n")}\n`;
}
