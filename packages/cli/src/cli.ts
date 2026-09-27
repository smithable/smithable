import { parseArgs } from "node:util";
import { SPEC_VERSION } from "@smithable/core";
import { ask } from "./ask.js";
import { backup, restore } from "./backup.js";
import { build } from "./build.js";
import { writeCode } from "./code.js";
import { context } from "./context.js";
import { customize } from "./customize.js";
import { deploy } from "./deploy.js";
import { detach } from "./detach.js";
import { runDev } from "./dev.js";
import { generate } from "./generate.js";
import { inspect, test } from "./inspect.js";
import { type Io, processIo } from "./io.js";
import { mcp } from "./mcp.js";
import { create } from "./new.js";
import { op } from "./op.js";
import { type Level, security, updateSecurity } from "./security.js";
import { studio } from "./studio.js";
import { teach } from "./teach.js";
import { undo } from "./undo.js";
import { upgrade } from "./upgrade.js";
import { validate } from "./validate.js";
import { VERSION } from "./version.js";

export { VERSION } from "./version.js";

const HELP = `Usage: smithable <command> [options]

Commands:
  new <dir>        Create a project from a starter (--starter crm|booking|invoicing, default crm),
                   or --describe "a booking site for a yoga studio": a model adapts the closest
                   starter, and you confirm the result (--yes creates it directly)
  run [dir]        Generate if needed, start the app and open it in the browser (--no-open)
  generate [dir]   Regenerate the app from smithable.yml (--force overwrites hand-edited files)
  validate [path]  Check smithable.yml in a directory (default: current) or a given file
                   (--plugin <name> also loads a plugin that is not declared yet)
  build [dir]      Build the app's container image with Docker
  security [dir]   Check the app: --level fast (type check, tests), normal (+ dependencies,
                   secrets, code; the default) or release (+ the image and the running app).
                   Uses installed scanners, or their pinned images in Docker
  deploy [dir]     Release checks, then run the app: --target docker (default), ssh://user@host
                   (a remote Docker host) or compose (writes compose.yaml); --port, --url
  backup [dir]     Back up the database and uploads --to a folder or s3://bucket/prefix (S3
                   credentials in AWS_* variables); --container <name> for a deployed app
  restore [dir]    Restore the newest backup (or --backup <time>) --from a folder or s3://…,
                   into the project or --container <name>
  upgrade [dir]    Move the app to this Smithable's spec version and stack profile; kept only
                   when the type check and tests pass, and reported where custom code breaks
  update --security [dir]  Bring in this Smithable's security fixes; kept only when the checks pass
  ask "<request>"  A model proposes the change in plain language; it is applied after you
                   confirm (--yes applies it directly). Setting up models: docs/ai.md
  code <concept> "<what>"  Have a model write the custom code of a query, action or custom page,
                   e.g. code query:churnRisk "rank by days since the last order"; only src/custom/
                   may change, and the type check and tests must pass
  teach <section>  Have a model write a project plugin for a section of smithable.yml Smithable
                   does not know (e.g. newsletter:); afterwards it is generated without AI
  op <name> …      Change the app with an operation, e.g. op addField Customer phone phone
                   (run "smithable op" for the list; --yes confirms changes that lose data)
  undo             Undo the last operation, including the dev database
  test [dir]       Run the app's tests and remember the results for rule status
  inspect [c]      Show rules and their status, or one concept: its meaning, rules, files,
                   symbols, routes, tables and tests, e.g. inspect action:mergeCustomers (--json)
  customize page:<p>  Give a page its own component in src/custom/pages/, starting from the generated
                   one (or moving a hand edit of its route there); the route stays generated
  context "<req>"  The smallest context an AI model needs for a request, with its size in tokens
                   (--implementation adds the custom code involved; --json)
  studio [dir]     Open Smithable Studio for the project: Builder and Studio modes, with the
                   app's preview (--port, default 4321)
  mcp [dir]        Serve the project to AI agents (Claude Code, Cursor, …) over MCP on stdin/stdout
  detach [dir]     Turn the project into an ordinary one that no longer uses Smithable

Options:
  -h, --help       Show this help
  -v, --version    Show the Smithable version
  --dir <path>     Project directory for op, undo, inspect and test (default: current)
`;

export async function run(argv: string[], io: Io = processIo): Promise<number> {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${HELP}`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.version) {
    io.out(`smithable ${VERSION} (spec ${SPEC_VERSION})\n`);
    return 0;
  }
  const [command, ...args] = positionals;
  if (values.help || command === undefined) {
    io.out(HELP);
    return 0;
  }
  if (command === "op")
    return op(values.dir ?? ".", io, args[0], args.slice(1), { yes: values.yes === true });
  if (command === "undo") return undo(values.dir ?? ".", io);
  if (command === "teach") return teach(values.dir ?? ".", io, args[0]);
  if (command === "code")
    return writeCode(values.dir ?? ".", io, args[0] ?? "", args.slice(1).join(" "));
  if (command === "ask")
    return ask(values.dir ?? ".", io, args.join(" ") || undefined, { yes: values.yes === true });
  if (command === "inspect") return inspect(values.dir ?? ".", io, args[0], values.json === true);
  if (command === "customize") return customize(values.dir ?? ".", io, args[0]);
  if (command === "context")
    return context(values.dir ?? ".", io, args.join(" ") || undefined, {
      implementation: values.implementation === true,
      json: values.json === true,
    });
  if (args.length > 1) {
    io.err(`${command} takes at most one path.\n\n${HELP}`);
    return 2;
  }
  const dir = args[0] ?? ".";
  switch (command) {
    case "validate":
      return validate(dir, io, values.plugin ? [values.plugin] : []);
    case "generate":
      return generate(dir, io, { tools: true, force: values.force === true });
    case "new":
      if (args[0] === undefined) {
        io.err(`new needs a directory, like: smithable new my-app\n`);
        return 2;
      }
      return create(dir, io, values.starter, {
        ...(values.describe ? { describe: values.describe } : {}),
        yes: values.yes === true,
      });
    case "run":
      return runDev(dir, io, values.open !== false);
    case "build":
      return build(dir, io);
    case "test":
      return test(values.dir ?? dir);
    case "security": {
      const level = values.level ?? "normal";
      if (!["fast", "normal", "release"].includes(level)) {
        io.err(`--level is fast, normal or release.\n`);
        return 2;
      }
      return security(values.dir ?? dir, io, level as Level);
    }
    case "deploy":
      return deploy(values.dir ?? dir, io, {
        target: values.target ?? "docker",
        port: Number(values.port ?? 3000),
        ...(values.url ? { url: values.url } : {}),
      });
    case "backup":
      if (!values.to) {
        io.err("backup needs --to <folder or s3://bucket/prefix>\n");
        return 2;
      }
      return backup(values.dir ?? dir, io, {
        to: values.to,
        ...(values.container ? { container: values.container } : {}),
      });
    case "restore":
      if (!values.from) {
        io.err("restore needs --from <folder or s3://bucket/prefix>\n");
        return 2;
      }
      return restore(values.dir ?? dir, io, {
        from: values.from,
        ...(values.backup ? { backup: values.backup } : {}),
        ...(values.container ? { container: values.container } : {}),
      });
    case "upgrade":
      return upgrade(values.dir ?? dir, io);
    case "update":
      if (values.security !== true) {
        io.err("update takes --security: smithable update --security [dir]\n");
        return 2;
      }
      return updateSecurity(values.dir ?? dir, io);
    case "detach":
      return detach(values.dir ?? dir, io);
    case "mcp":
      return mcp(values.dir ?? dir);
    case "studio":
      return studio(values.dir ?? dir, io, Number(values.port ?? 4321));
    default:
      io.err(`Unknown command: ${command}\n\n${HELP}`);
      return 2;
  }
}

function parse(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    allowNegative: true,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      force: { type: "boolean" },
      open: { type: "boolean" },
      starter: { type: "string" },
      describe: { type: "string" },
      plugin: { type: "string" },
      level: { type: "string" },
      security: { type: "boolean" },
      target: { type: "string" },
      to: { type: "string" },
      from: { type: "string" },
      backup: { type: "string" },
      container: { type: "string" },
      url: { type: "string" },
      yes: { type: "boolean" },
      dir: { type: "string" },
      json: { type: "boolean" },
      implementation: { type: "boolean" },
      port: { type: "string" },
    },
  });
}
