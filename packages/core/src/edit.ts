import {
  type Document,
  isMap,
  isPair,
  isScalar,
  isSeq,
  type Pair,
  type ParsedNode,
  parseDocument,
  stringify,
  type YAMLMap,
} from "yaml";

/** A value an operation writes: a scalar, a flow list, or a block mapping. */
export type YamlValue =
  | string
  | number
  | boolean
  | null
  | YamlValue[]
  | { [key: string]: YamlValue };

type Path = readonly string[];

/**
 * Edits YAML source with minimal text splices at the positions the parser reports, so
 * everything an edit does not touch (comments, alignment, flow style, blank lines)
 * stays byte-for-byte identical. Re-parses after every edit.
 */
/** An edit that does not fit the document (a path that is not a mapping, a missing item). */
export class EditError extends Error {}

export class YamlEditor {
  private source: string;
  private doc!: Document.Parsed;

  constructor(text: string) {
    this.source = text;
    this.reparse();
  }

  get text(): string {
    return this.source;
  }

  /** Replaces the whole text, e.g. with what someone wrote in an editor. */
  replaceAll(text: string): void {
    this.splice(0, this.source.length, text);
  }

  has(path: Path): boolean {
    return this.doc.hasIn(path);
  }

  get(path: Path): unknown {
    const node = this.doc.getIn(path, true) as ParsedNode | undefined;
    return node?.toJSON();
  }

  /** Replaces the value at `path`, which must exist. */
  set(path: Path, value: YamlValue): void {
    const pair = this.pair(path);
    const key = pair.key as ParsedNode;
    const node = pair.value as ParsedNode | null;
    if (this.parentMap(path).flow && node) {
      this.splice(node.range[0], node.range[1], flow(value));
      return;
    }
    const inlineNode = node && (isScalar(node) || isSeq(node) || (isMap(node) && node.flow));
    if (!isBlock(value) && inlineNode) {
      // A scalar in a block mapping keeps its plain form; only inside { … } is it quoted for commas.
      this.splice(node.range[0], node.range[1], Array.isArray(value) ? flow(value) : scalar(value));
      return;
    }
    // Replace everything after "key:" up to the end of the value's last line.
    const colon = this.source.indexOf(":", key.range[1]);
    const end = this.lineEnd((node ? node.range[1] : key.range[1]) - 1);
    const text = isBlock(value) ? render(value, this.indentAt(key.range[0])) : ` ${flow(value)}`;
    this.splice(colon + 1, end, text);
  }

  /** Replaces item `index` of the list at `path`, written on one line (e.g. { id: a, rule: … }). */
  setItem(path: Path, index: number, value: YamlValue): void {
    const list = this.doc.getIn(path, true) as ParsedNode | undefined;
    if (!isSeq(list)) throw new EditError(`${path.join(".")} is not a list.`);
    const item = list.items[index] as ParsedNode | undefined;
    if (!item) throw new EditError(`${path.join(".")} has no item ${index + 1}.`);
    // An item written as "- Name: { … }" is a block map, whose range runs on over a comment and
    // the line break; it ends where its last value does.
    const last = isMap(item) && !item.flow ? item.items.at(-1) : undefined;
    const end = last ? ((last.value ?? last.key) as ParsedNode).range[1] : item.range[1];
    this.splice(item.range[0], end, flow(value));
  }

  /** Renames the key at `path`, keeping its value, position and comments. */
  renameKey(path: Path, name: string): void {
    const key = this.pair(path).key as ParsedNode;
    this.splice(key.range[0], key.range[1], name);
  }

  /**
   * Removes the entry at `path` and then any parent mapping it leaves empty, up to
   * `keepDepth` levels (e.g. 1 keeps the top-level key).
   */
  removeAndPrune(path: Path, keepDepth: number): void {
    this.remove(path);
    for (let depth = path.length - 1; depth > keepDepth; depth--) {
      const parent = path.slice(0, depth);
      const value = this.get(parent);
      const empty =
        value === null || (typeof value === "object" && Object.keys(value as object).length === 0);
      if (!empty) return;
      this.remove(parent);
    }
  }

  /** Removes the entry at `path`, including its whole lines in block style. */
  remove(path: Path): void {
    const pair = this.pair(path);
    const key = pair.key as ParsedNode;
    const value = pair.value as ParsedNode | null;
    const end = value ? value.range[1] : key.range[1];
    if (this.parentMap(path).flow) {
      const after = /^\s*,\s*/.exec(this.source.slice(end));
      if (after) {
        this.splice(key.range[0], end + after[0].length, "");
        return;
      }
      const before = /,\s*$/.exec(this.source.slice(0, key.range[0]));
      this.splice(before ? key.range[0] - before[0].length : key.range[0], end, "");
      return;
    }
    const start = this.lineStart(key.range[0]);
    this.splice(start, Math.min(this.lineEnd(end - 1) + 1, this.source.length), "");
  }

  /** Adds `key: value` to the mapping at `path`, creating missing mappings on the way. */
  add(path: Path, key: string, value: YamlValue): void {
    if (!this.has(path)) {
      if (path.length === 0) throw new EditError("The document has no root mapping.");
      this.add(path.slice(0, -1), path[path.length - 1] as string, { [key]: value });
      return;
    }
    const map = this.doc.getIn(path, true) as ParsedNode;
    if (!isMap(map)) throw new EditError(`${path.join(".")} is not a mapping.`);
    if (map.flow) {
      const close = this.source.lastIndexOf("}", map.range[1]);
      const inner = this.source.slice(map.range[0] + 1, close);
      const sep = inner.trim() === "" ? " " : inner.trimEnd().endsWith(",") ? " " : ", ";
      const trimmedClose = map.range[0] + 1 + inner.trimEnd().length;
      this.splice(trimmedClose, close, `${sep}${scalar(key)}: ${flow(value)} `);
      return;
    }
    const last = map.items[map.items.length - 1] as Pair<ParsedNode, ParsedNode | null>;
    const indent = this.indentAt(last.key.range[0]);
    const end = last.value ? last.value.range[1] : last.key.range[1];
    const at = Math.min(this.lineEnd(end - 1) + 1, this.source.length);
    const lead = at === this.source.length && !this.source.endsWith("\n") ? "\n" : "";
    this.splice(at, at, `${lead}${indent}${scalar(key)}:${render(value, indent)}\n`);
  }

  private pair(path: Path): Pair<ParsedNode, ParsedNode | null> {
    const key = path[path.length - 1];
    const found = this.parentMap(path).items.find((p) => isScalar(p.key) && p.key.value === key);
    if (!found || !isPair(found)) throw new EditError(`Nothing at ${path.join(".")}.`);
    return found as Pair<ParsedNode, ParsedNode | null>;
  }

  private parentMap(path: Path): YAMLMap.Parsed {
    const parent = path.length === 1 ? this.doc.contents : this.doc.getIn(path.slice(0, -1), true);
    if (!isMap(parent))
      throw new EditError(`${path.slice(0, -1).join(".") || "The document"} is not a mapping.`);
    return parent as YAMLMap.Parsed;
  }

  private splice(start: number, end: number, insert: string): void {
    this.source = this.source.slice(0, start) + insert + this.source.slice(end);
    this.reparse();
  }

  private reparse(): void {
    this.doc = parseDocument(this.source);
    if (this.doc.errors.length > 0)
      throw new EditError(`Edit produced invalid YAML: ${this.doc.errors[0]?.message}`);
  }

  private lineStart(offset: number): number {
    return this.source.lastIndexOf("\n", offset - 1) + 1;
  }

  private lineEnd(offset: number): number {
    const end = this.source.indexOf("\n", offset);
    return end === -1 ? this.source.length : end;
  }

  private indentAt(offset: number): string {
    return " ".repeat(offset - this.lineStart(offset));
  }
}

function isBlock(value: YamlValue): value is { [key: string]: YamlValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A value on one line: a scalar, [a, b] or { k: v }. */
function flow(value: YamlValue): string {
  if (Array.isArray(value)) return `[${value.map(flow).join(", ")}]`;
  if (isBlock(value)) {
    return `{ ${Object.entries(value)
      .map(([k, v]) => `${scalar(k)}: ${flow(v)}`)
      .join(", ")} }`;
  }
  // Inside { … } or [ … ] a comma or a bracket ends the value: such a text is quoted.
  return typeof value === "string" && /[,[\]{}]/.test(value) && !/^["']/.test(scalar(value))
    ? JSON.stringify(value)
    : scalar(value);
}

/** Text after "key:" for a value: " scalar", " [a, b]", or a newline and an indented block. */
function render(value: YamlValue, indent: string): string {
  if (Array.isArray(value)) return ` ${flow(value)}`;
  if (isBlock(value)) {
    const inner = `${indent}  `;
    return Object.entries(value)
      .map(([k, v]) => `\n${inner}${scalar(k)}:${render(v, inner)}`)
      .join("");
  }
  // Nothing, as an asked value is written: "cancelReason:".
  return value === null ? "" : ` ${scalar(value)}`;
}

/**
 * A key or scalar value as YAML: quoted only when it has to be (e.g. "@scope/package"), and on
 * one line however long or with line breaks, since it goes after "key:" where anything spanning
 * lines would break.
 */
function scalar(value: string | number | boolean | null): string {
  if (value === null) return "null";
  // A line break would make a block scalar ("|-"), which cannot follow "key:" on its line or
  // start a list item: such a text is double-quoted, which JSON writes as valid YAML.
  if (typeof value === "string" && /[\r\n]/.test(value)) return JSON.stringify(value);
  return stringify(value, { lineWidth: 0 }).trimEnd();
}
