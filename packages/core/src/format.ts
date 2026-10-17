// The spec files as Studio shows them (docs/design/studio-v3.md §7): one way of writing objects,
// so that formatting is never a change. An object written in flow style, `{ crud: Customer }`,
// becomes a block mapping, and a list of objects a block list; a list of scalars stays as it is
// written, `[a, b]`. The operations edit in place and keep what a person typed, so a `{}` lives
// until the editor formats the file. Only those parts are rewritten, by splicing the text:
// comments, blank lines, key order, indentation and scalar styles everywhere else stay exactly
// as they are, which also makes formatting stable (formatting a formatted file changes nothing).
import { isMap, isPair, isSeq, type Node, parse, parseDocument, stringify, visit } from "yaml";

type Value = string | number | boolean | null | Value[] | { [key: string]: Value };

export function formatSpec(text: string): string {
  const doc = parseDocument(text);
  // Text that is not YAML is left alone: the editor shows its problems instead.
  if (doc.errors.length > 0) return text;
  // Every flow collection that holds an object, outermost first, with where it sits.
  const found: { node: Node; parent: unknown }[] = [];
  visit(doc, (_key, node, path) => {
    if (!(isMap(node) || isSeq(node)) || !node.flow) return undefined;
    if (isSeq(node) && !node.items.some((item) => isMap(item) || isSeq(item))) return undefined;
    found.push({ node, parent: path[path.length - 1] });
    return visit.SKIP;
  });
  let out = text;
  // From the end, so earlier offsets stay right.
  for (const { node, parent } of found.sort((a, b) => b.node.range![0] - a.node.range![0])) {
    const [start, end] = node.range as [number, number, number];
    const lineStart = out.lastIndexOf("\n", start - 1) + 1;
    const before = out.slice(lineStart, start);
    const value = node.toJSON() as Value;
    // A trailing comment on the value's line moves to the line the block starts on.
    const rest = /^[ \t]*(#[^\n]*)?/.exec(out.slice(end)) as RegExpExecArray;
    const comment = rest[1] ? ` ${rest[1]}` : "";
    const after = end + rest[0].length;
    let replacement: string;
    if (isPair(parent)) {
      // `key: { … }` becomes `key:` and the block under it, indented one step from the key.
      const indent = /^[ \t]*(?:- )*/.exec(before)?.[0].replace(/-/g, " ") ?? "";
      replacement = `${comment}${block(value, `${indent}  `)}`;
    } else {
      // `- { … }`: the block starts on the item's line, its lines indented under it.
      const indent = " ".repeat(before.length);
      replacement = `${block(value, indent).slice(indent.length + 1)}${comment}`;
    }
    out =
      out.slice(0, start).replace(/[ \t]+$/, isPair(parent) ? "" : " ") +
      replacement +
      out.slice(after);
  }
  return out;
}

/** A value as block YAML, each line starting with `indent`, beginning with a line break. */
function block(value: Value, indent: string): string {
  if (Array.isArray(value)) {
    if (value.every((item) => !isObject(item) && !Array.isArray(item)))
      return ` [${value.map(flowScalar).join(", ")}]`;
    return value
      .map((item) =>
        isObject(item) || Array.isArray(item)
          ? `\n${indent}-${block(item, `${indent}  `).replace(/^\n[ \t]*/, " ")}`
          : `\n${indent}- ${scalar(item)}`,
      )
      .join("");
  }
  if (isObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return " {}";
    return entries.map(([k, v]) => `\n${indent}${scalar(k)}:${block(v, `${indent}  `)}`).join("");
  }
  return value === null ? "" : ` ${scalar(value)}`;
}

const isObject = (value: Value): value is { [key: string]: Value } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A scalar on one line, quoted only when it has to be. */
function scalar(value: string | number | boolean | null): string {
  if (value === null) return "null";
  if (typeof value === "string" && /[\r\n]/.test(value)) return JSON.stringify(value);
  return stringify(value, { lineWidth: 0 }).trimEnd();
}

/** A scalar inside `[ … ]`, where a comma or a bracket would end it. */
function flowScalar(value: Value): string {
  const text = scalar(value as string | number | boolean | null);
  return typeof value === "string" && /[,[\]{}]/.test(value) && !/^["']/.test(text)
    ? JSON.stringify(value)
    : text;
}

/**
 * Whether two texts say the same thing as YAML (formatting, whitespace or comments apart), so an
 * edit that only formats is no change. Texts that are not YAML compare as texts.
 */
export function sameContent(a: string, b: string): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(parse(a)) === JSON.stringify(parse(b));
  } catch {
    return false;
  }
}
