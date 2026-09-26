import { parseArgs } from "node:util";
import { SPEC_VERSION } from "@smithable/core";
import { build } from "./build.js";
import { detach } from "./detach.js";
import { runDev } from "./dev.js";
import { generate } from "./generate.js";
import { inspect, test } from "./inspect.js";
import { type Io, processIo } from "./io.js";
import { create } from "./new.js";
import { op } from "./op.js";
import { undo } from "./undo.js";
import { validate } from "./validate.js";
import { VERSION } from "./version.js";

export { VERSION } from "./version.js";

const HELP = `Usage: smithable <command> [options]

Commands:
  new <dir>        Create a project from a starter (--starter crm|booking|invoicing, default crm)
  run [dir]        Generate if needed, start the app and open it in the browser (--no-open)
  generate [dir]   Regenerate the app from smithable.yml (--force overwrites hand-edited files)
  validate [path]  Check smithable.yml in a directory (default: current) or a given file
  build [dir]      Build the app's container image with Docker
  op <name> …      Change the app with an operation, e.g. op addField Customer phone phone
                   (run "smithable op" for the list; --yes confirms changes that lose data)
  undo             Undo the last operation, including the dev database
  test [dir]       Run the app's tests and remember the results for rule status
  inspect [c]      Show rules and their status, or one concept: its meaning, rules, files,
                   symbols, routes, tables and tests, e.g. inspect action:mergeCustomers (--json)
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
  if (command === "inspect") return inspect(values.dir ?? ".", io, args[0], values.json === true);
  if (args.length > 1) {
    io.err(`${command} takes at most one path.\n\n${HELP}`);
    return 2;
  }
  const dir = args[0] ?? ".";
  switch (command) {
    case "validate":
      return validate(dir, io);
    case "generate":
      return generate(dir, io, { tools: true, force: values.force === true });
    case "new":
      if (args[0] === undefined) {
        io.err(`new needs a directory, like: smithable new my-app\n`);
        return 2;
      }
      return create(dir, io, values.starter ?? "crm");
    case "run":
      return runDev(dir, io, values.open !== false);
    case "build":
      return build(dir, io);
    case "test":
      return test(values.dir ?? dir);
    case "detach":
      return detach(values.dir ?? dir, io);
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
      yes: { type: "boolean" },
      dir: { type: "string" },
      json: { type: "boolean" },
    },
  });
}
