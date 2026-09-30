import { parseArgs } from "node:util";
import { findOperation, SPEC_VERSION } from "@smithable/core";
import { ask } from "./ask.js";
import { backup, restore } from "./backup.js";
import { build } from "./build.js";
import { writeCode } from "./code.js";
import { complete, script } from "./completion.js";
import { context } from "./context.js";
import { customize } from "./customize.js";
import { deploy } from "./deploy.js";
import { detach } from "./detach.js";
import { runDev } from "./dev.js";
import { generate } from "./generate.js";
import { commandHelp, help, operationHelp } from "./help.js";
import { inspect, test } from "./inspect.js";
import { type Io, processIo } from "./io.js";
import { mcp } from "./mcp.js";
import { create } from "./new.js";
import { op } from "./op.js";
import { loadPlugins } from "./plugins.js";
import { type Level, security, updateSecurity } from "./security.js";
import { studio } from "./studio.js";
import { teach } from "./teach.js";
import { undo } from "./undo.js";
import { upgrade } from "./upgrade.js";
import { validate } from "./validate.js";
import { VERSION } from "./version.js";

export { VERSION } from "./version.js";

export async function run(argv: string[], io: Io = processIo): Promise<number> {
  // The shells' completion asks here; the words may hold options this parser does not know.
  if (argv[0] === "__complete") {
    const at = argv.lastIndexOf("--");
    const words = argv.slice(argv.indexOf("--") + 1, at);
    io.out(
      complete(words, argv[at + 1] ?? "", process.cwd())
        .map((c) => `${c}\n`)
        .join(""),
    );
    return 0;
  }
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${help()}`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.version) {
    io.out(`smithable ${VERSION} (spec ${SPEC_VERSION})\n`);
    return 0;
  }
  const [command, ...args] = positionals;
  if (command === undefined) {
    io.out(help());
    return 0;
  }
  if (values.help) {
    // An operation's help comes from its schema; a command's from the command table.
    if (command === "op" && args[0]) {
      let plugins: ReturnType<typeof loadPlugins> = [];
      try {
        plugins = loadPlugins(values.dir ?? ".");
      } catch {}
      const operation = findOperation(args[0], plugins);
      if (!operation) {
        io.err(`Unknown operation "${args[0]}". Run "smithable op" for the list.\n`);
        return 2;
      }
      io.out(operationHelp(operation));
      return 0;
    }
    const text = commandHelp(command);
    if (text === undefined) {
      io.err(`Unknown command: ${command}\n\n${help()}`);
      return 2;
    }
    io.out(text);
    return 0;
  }
  if (command === "completion") {
    const text = script(args[0] ?? "");
    if (text === undefined) {
      io.err("completion takes the shell: smithable completion bash|zsh|fish\n");
      return 2;
    }
    io.out(text);
    return 0;
  }
  if (command === "op")
    return op(values.dir ?? ".", io, args[0], operationWords(argv).slice(1), {
      yes: values.yes === true,
    });
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
    io.err(`${command} takes at most one path.\n\n${help()}`);
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
        ...(values.answers ? { answers: values.answers } : {}),
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
      return studio(values.dir ?? dir, io, Number(values.port ?? 4321), {
        ...(values.host ? { host: values.host } : {}),
        ...(values["preview-url"] ? { previewUrl: values["preview-url"] } : {}),
        ...(values.home ? { home: values.home } : {}),
        ...(values.insecure ? { insecure: true } : {}),
      });
    default:
      io.err(`Unknown command: ${command}\n\n${help()}`);
      return 2;
  }
}

const CONFIG = {
  allowPositionals: true,
  allowNegative: true,
  options: {
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
    force: { type: "boolean" },
    open: { type: "boolean" },
    starter: { type: "string" },
    describe: { type: "string" },
    answers: { type: "string" },
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
    host: { type: "string" },
    "preview-url": { type: "string" },
    insecure: { type: "boolean" },
    home: { type: "string" },
  },
} as const;

function parse(argv: string[]) {
  // An operation's own arguments may be given by name (--output, --allow): `op` takes them as
  // words, so its options are not refused here (operationWords picks them out).
  const loose = parseArgs({ ...CONFIG, args: argv, strict: false });
  return (
    loose.positionals[0] === "op" ? loose : parseArgs({ ...CONFIG, args: argv })
  ) as ReturnType<typeof parseArgs<typeof CONFIG>>;
}

/** The words after `op`, without the options every command has (--yes, --dir, --help). */
function operationWords(argv: string[]): string[] {
  const words: string[] = [];
  for (let i = argv.indexOf("op") + 1; i < argv.length; i++) {
    const word = argv[i] as string;
    if (word === "--dir") i++;
    else if (!/^(--yes|--help|-h|--dir=.*)$/.test(word)) words.push(word);
  }
  return words;
}
