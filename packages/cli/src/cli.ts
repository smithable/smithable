import { parseArgs } from "node:util";
import { MANIFEST_VERSION } from "@smithable/core";

export const VERSION = "0.0.0";

const HELP = `Usage: smithable <command> [options]

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
    return { code: 0, stdout: `smithable ${VERSION} (manifest ${MANIFEST_VERSION})\n`, stderr: "" };
  }
  if (values.help || positionals.length === 0) {
    return { code: 0, stdout: HELP, stderr: "" };
  }
  return { code: 2, stdout: "", stderr: `Unknown command: ${positionals[0]}\n\n${HELP}` };
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
