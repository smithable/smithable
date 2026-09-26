import { parseArgs } from "node:util";
import { SPEC_VERSION } from "@smithable/core";
import { validate } from "./validate.js";

export const VERSION = "0.0.0";

const HELP = `Usage: smithable <command> [options]

Commands:
  validate [path]  Check smithable.yml in a directory (default: current) or a given file

Options:
  -h, --help     Show this help
  -v, --version  Show the Smithable version
`;

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function run(argv: string[]): CliResult {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (error) {
    return { code: 2, stdout: "", stderr: `${(error as Error).message}\n\n${HELP}` };
  }
  const { values, positionals } = parsed;

  if (values.version) {
    return { code: 0, stdout: `smithable ${VERSION} (spec ${SPEC_VERSION})\n`, stderr: "" };
  }
  if (values.help || positionals.length === 0) {
    return { code: 0, stdout: HELP, stderr: "" };
  }
  const [command, ...args] = positionals;
  if (command === "validate") {
    if (args.length > 1)
      return { code: 2, stdout: "", stderr: `validate takes at most one path.\n\n${HELP}` };
    return validate(args[0] ?? ".");
  }
  return { code: 2, stdout: "", stderr: `Unknown command: ${command}\n\n${HELP}` };
}

function parse(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
}
