import { parseArgs } from "node:util";
import { STARTER_TEXTS } from "@smithable/ai";
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
import { readPageCommand } from "./from-page.js";
import { generate } from "./generate.js";
import { commandHelp, help, operationHelp } from "./help.js";
import { inspect, test } from "./inspect.js";
import { type Io, processIo } from "./io.js";
import { mcp } from "./mcp.js";
import { clarify, create } from "./new.js";
import { op } from "./op.js";
import { backupContinuous, restoreAt } from "./pitr.js";
import { loadPlugins } from "./plugins.js";
import { redo } from "./redo.js";
import { report } from "./report.js";
import { type Level, security, updateSecurity } from "./security.js";
import { studio } from "./studio.js";
import { teach } from "./teach.js";
import { themeFrom } from "./theme-from.js";
import { themeLab } from "./theme-lab.js";
import { themes } from "./themes.js";
import { translate } from "./translate.js";
import { undo, undoChange } from "./undo.js";
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
      ...(values.setup ? { setup: true } : {}),
    });
  if (command === "undo")
    return values.change
      ? undoChange(values.dir ?? ".", io, values.change, {
          check: values.check === true,
          yes: values.yes === true,
        })
      : undo(values.dir ?? ".", io);
  if (command === "redo") return redo(values.dir ?? ".", io);
  if (command === "report")
    return report(values.dir ?? ".", io, {
      send: values.send === true,
      always: values.always === true,
      never: values.never === true,
      ask: values.ask === true,
    });
  if (command === "teach") return teach(values.dir ?? ".", io, args[0]);
  if (command === "code")
    return writeCode(values.dir ?? ".", io, args[0] ?? "", args.slice(1).join(" "));
  if (command === "ask")
    return ask(values.dir ?? ".", io, args.join(" ") || undefined, { yes: values.yes === true });
  if (command === "translate") return translate(values.dir ?? ".", io, args[0]);
  if (command === "inspect") return inspect(values.dir ?? ".", io, args[0], values.json === true);
  if (command === "customize") return customize(values.dir ?? ".", io, args[0]);
  if (command === "themes") return themes(args[0] ?? values.dir ?? ".", io);
  if (command === "theme" && args[0] === "lab")
    return themeLab(io, Number(values.port ?? 4330), {
      ...(values.project ? { project: values.project } : {}),
      ...(values.app ? { app: values.app } : {}),
    });
  if (command === "theme") {
    if (!values.from) {
      io.err("theme needs a site to read, like: smithable theme --from https://example.com\n");
      return 2;
    }
    return themeFrom(values.dir ?? ".", io, values.from, {
      ...(values.name ? { name: values.name } : {}),
      use: values.use === true,
    });
  }
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
      return validate(
        dir,
        io,
        values.plugin ? [values.plugin] : [],
        values.json === true,
        values.explain === true,
      );
    case "generate":
      return generate(dir, io, { tools: true, force: values.force === true });
    case "read-page":
      return readPageCommand(args[0], values.url, io);
    case "new":
      if (args[0] === undefined) {
        io.err(`new needs a directory, like: smithable new my-app\n`);
        return 2;
      }
      return create(dir, io, values.starter, {
        ...(values.describe ? { describe: values.describe } : {}),
        ...(values.answers ? { answers: values.answers } : {}),
        ...(values.from ? { from: values.from } : {}),
        ...(values.name ? { name: values.name } : {}),
        ...(values.admin ? { admin: values.admin } : {}),
        withPictures: values["with-pictures"] === true,
        yes: values.yes === true,
        sampleData: values["no-sample-data"] !== true,
      });
    case "clarify":
      if (!args.length) {
        io.err(
          'clarify needs a description, like: smithable clarify "a booking site for a yoga studio"\n',
        );
        return 2;
      }
      return clarify(io, args.join(" "), values.json === true);
    case "starters": {
      // Each starter with its own description (packages/ai starter-descriptions.ts): the text a
      // start page shows for it, and that builds it without a model.
      const starters = Object.entries(STARTER_TEXTS).map(([name, { text }]) => ({
        name,
        description: text,
      }));
      io.out(
        values.json === true
          ? `${JSON.stringify(starters)}\n`
          : starters.map((s) => `${s.name}\n  ${s.description}\n`).join(""),
      );
      return 0;
    }
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
      if (values.continuous && values.to)
        return backupContinuous(values.dir ?? dir, io, {
          to: values.to,
          ...(values.data ? { data: values.data } : {}),
        });
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
      if (values.at) {
        const list = (v?: string) =>
          v
            ? v
                .split(",")
                .map((m) => m.trim())
                .filter(Boolean)
            : undefined;
        const bringBack = list(values["bring-back"]);
        const undoChanges = list(values["undo-changes"]);
        return restoreAt(values.dir ?? dir, io, {
          at: values.at,
          from: values.from,
          ...(values.data ? { data: values.data } : {}),
          ...(bringBack ? { bringBack } : {}),
          ...(undoChanges ? { undoChanges } : {}),
          ...(values.yes ? { yes: true } : {}),
        });
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
        ...(values.replaceable ? { replaceable: true } : {}),
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
    "no-sample-data": { type: "boolean" },
    name: { type: "string" },
    admin: { type: "string" },
    use: { type: "boolean" },
    "with-pictures": { type: "boolean" },
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
    continuous: { type: "boolean" },
    at: { type: "string" },
    data: { type: "string" },
    "bring-back": { type: "string" },
    "undo-changes": { type: "string" },
    container: { type: "string" },
    url: { type: "string" },
    yes: { type: "boolean" },
    setup: { type: "boolean" },
    change: { type: "string" },
    check: { type: "boolean" },
    dir: { type: "string" },
    json: { type: "boolean" },
    explain: { type: "boolean" },
    implementation: { type: "boolean" },
    port: { type: "string" },
    project: { type: "string" },
    /** The app the theme lab shows instead of making its own (the tests' app). */
    app: { type: "string" },
    host: { type: "string" },
    "preview-url": { type: "string" },
    insecure: { type: "boolean" },
    replaceable: { type: "boolean" },
    home: { type: "string" },
    send: { type: "boolean" },
    always: { type: "boolean" },
    never: { type: "boolean" },
    ask: { type: "boolean" },
  },
} as const;

function parse(argv: string[]) {
  // An operation's own arguments may be given by name (--output, --intent): `op` takes them as
  // words, so its options are not refused here (operationWords picks them out).
  const loose = parseArgs({ ...CONFIG, args: argv, strict: false });
  return (
    loose.positionals[0] === "op" ? loose : parseArgs({ ...CONFIG, args: argv })
  ) as ReturnType<typeof parseArgs<typeof CONFIG>>;
}

/** The words after `op`, without the options every command has (--yes, --setup, --dir, --help). */
function operationWords(argv: string[]): string[] {
  const words: string[] = [];
  for (let i = argv.indexOf("op") + 1; i < argv.length; i++) {
    const word = argv[i] as string;
    if (word === "--dir") i++;
    else if (!/^(--yes|--setup|--help|-h|--dir=.*)$/.test(word)) words.push(word);
  }
  return words;
}
