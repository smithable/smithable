// A refused change in Builder's words: what the files say (a file's line and column, an
// operation's name, the rule for writing a name) is for Code mode and the command line.
import { humanize } from "@smithable/core";

const KINDS: Record<string, string> = {
  Model: "a kind of record",
  Field: "a field",
  Page: "a page",
  Action: "a button",
  Role: "a role",
  Menu: "a menu",
  Query: "a query",
};

/** One line of a refusal, in plain words; empty when it says nothing for the person. */
function line(text: string): string {
  // "removeField would make smithable.yml invalid.": the problems that follow say why.
  if (/^\w+ would make \S+ invalid\.$/.test(text)) return "";
  // "smithable.yml:39:18  error  …" and its hint: the message alone.
  const diagnostic = /^\S+:\d+:\d+\s+(error|warning|info)\s+(.*)$/.exec(text);
  if (diagnostic) return diagnostic[1] === "error" ? (diagnostic[2] ?? "") : "";
  const hint = /^\s+hint: (.*)$/.exec(text);
  if (hint) return hint[1] ?? "";
  // "addField: …": the operation's name.
  const plain = text.replace(/^[a-z]+[A-Z]\w*: /, "");
  const missing = /^"(\w+)" is missing\.$/.exec(plain);
  if (missing) return `Fill in “${humanize(missing[1] ?? "")}”.`;
  const name = /^(\w+) name "([^"]*)" must start with .*$/.exec(plain);
  if (name)
    return `“${name[2]}” cannot be the name of ${KINDS[name[1] ?? ""] ?? "this"}: use letters, digits and spaces, starting with a letter.`;
  const value = /^Choice value "([^"]*)" must start with .*$/.exec(plain);
  if (value)
    return `“${value[1]}” cannot be a choice: use letters, digits and spaces, starting with a letter.`;
  return plain;
}

/** The tool's refusal as Builder shows it. */
export function plainRefusal(output: string): string {
  const lines = output
    .split("\n")
    .map(line)
    .filter((l) => l.trim());
  return lines.length ? [...new Set(lines)].join("\n") : output;
}
