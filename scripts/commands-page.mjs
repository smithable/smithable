// The command reference for docs.smithable.ai, generated from the CLI's own command table (cli's
// help.ts, the one `smithable --help`, each command's --help and the shell completion are made
// from), so a command can neither go missing from it nor stay on it after it is gone. Used by
// build-docs.mjs.
import { COMMANDS, GLOBAL_OPTIONS } from "../packages/cli/dist/help.js";

/** Help text as Markdown prose: its own words, its <placeholders> shown, not taken for HTML. */
const prose = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function commandsPage() {
  const entry = (c) =>
    [
      `## ${c.name}`,
      "",
      "```sh",
      `smithable ${c.usage}`,
      "```",
      "",
      // Its lines as the help breaks them: some read on only with their break.
      c.text.map((line) => prose(line.trim())).join("  \n"),
      ...(c.options?.length
        ? ["", `Options: ${c.options.map((o) => `\`--${o}\``).join(", ")}, \`--help\`.`]
        : []),
    ].join("\n");
  return `# Commands

Every \`smithable\` command, from the command line's own help (${COMMANDS.length} of them): \`smithable --help\` lists the same, and \`smithable <command> --help\` shows one. This page is generated from the command line itself, so it matches the Smithable it was built with. Changes to an app go through [operations](operations.md), run with \`smithable op\`.

${COMMANDS.map(entry).join("\n\n")}

## Options for every command

${GLOBAL_OPTIONS.map((o) => `- ${prose(o)}`).join("\n")}
`;
}
