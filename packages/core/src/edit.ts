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
  type YAMLSeq,
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
    const [start, stop] = this.blockEntry(pair);
    this.splice(start, stop, "");
  }

  /**
   * Moves the entry `key` of the mapping at `path` before or after another of its entries, with
   * its comment lines; in block style only the entry's lines move, everything else stays as it is.
   */
  move(path: Path, key: string, to: { before?: string; after?: string }): void {
    const other = to.before ?? to.after;
    if (!other || (to.before && to.after)) throw new EditError("Say before or after which key.");
    if (other === key) return;
    const map = this.doc.getIn(path, true) as ParsedNode;
    if (!isMap(map)) throw new EditError(`${path.join(".")} is not a mapping.`);
    const keys = map.items.map((p) => (isScalar(p.key) ? String(p.key.value) : ""));
    for (const k of [key, other])
      if (!keys.includes(k)) throw new EditError(`Nothing at ${[...path, k].join(".")}.`);
    if (map.flow) {
      const value = this.get(path) as Record<string, YamlValue>;
      const order = keys.filter((k) => k !== key);
      order.splice(order.indexOf(other) + (to.after ? 1 : 0), 0, key);
      this.set(path, Object.fromEntries(order.map((k) => [k, value[k] as YamlValue])) as YamlValue);
      return;
    }
    const [start, stop] = this.blockEntry(this.pair([...path, key]));
    const entry = this.source.slice(start, stop);
    this.splice(start, stop, "");
    const [otherStart, otherStop] = this.blockEntry(this.pair([...path, other]));
    const at = to.after ? otherStop : otherStart;
    const lead = at === this.source.length && !this.source.endsWith("\n") ? "\n" : "";
    this.splice(at, at, `${lead}${entry.endsWith("\n") ? entry : `${entry}\n`}`);
  }

  /** The whole lines of a block-style entry: the comment lines right above it, at its indent, are about it and go with it. */
  private blockEntry(pair: Pair<ParsedNode, ParsedNode | null>): [number, number] {
    const key = pair.key as ParsedNode;
    const value = pair.value as ParsedNode | null;
    const end = value ? value.range[1] : key.range[1];
    let start = this.lineStart(key.range[0]);
    const indent = key.range[0] - start;
    while (start > 0) {
      const above = this.lineStart(start - 1);
      const line = this.source.slice(above, start - 1);
      if (!/^\s*#/.test(line) || line.length - line.trimStart().length !== indent) break;
      start = above;
    }
    return [start, Math.min(this.lineEnd(end - 1) + 1, this.source.length)];
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

  /**
   * Adds an item at the end of the list at `path` (the whole document when the path is empty),
   * in block style: a mapping as "- key: value" lines. A list written [ … ] is rewritten as a
   * block list, and an empty document becomes one.
   */
  appendItem(path: Path, value: YamlValue): void {
    const list = path.length ? this.doc.getIn(path, true) : this.doc.contents;
    if (list == null) {
      if (path.length) throw new EditError(`Nothing at ${path.join(".")}.`);
      this.splice(0, this.source.length, listItem(value, ""));
      return;
    }
    if (!isSeq(list)) throw new EditError(`${path.join(".") || "The document"} is not a list.`);
    const seq = list as YAMLSeq.Parsed;
    if (seq.flow) {
      const items = [...(seq.toJSON() as YamlValue[]), value];
      // Under a key, the items go one step in from it; a document's list starts at the margin.
      const indent = path.length ? `${this.indentAt(this.pair(path).key.range[0])}  ` : "";
      const text = items.map((item) => listItem(item, indent)).join("");
      if (path.length === 0) this.splice(0, this.source.length, text);
      else
        this.splice(
          this.source.indexOf(":", this.pair(path).key.range[1]) + 1,
          seq.range[1],
          `\n${text.trimEnd()}`,
        );
      return;
    }
    const last = seq.items[seq.items.length - 1] as ParsedNode;
    const at = Math.min(this.lineEnd(this.itemEnd(last) - 1) + 1, this.source.length);
    const lead = at === this.source.length && !this.source.endsWith("\n") ? "\n" : "";
    this.splice(at, at, `${lead}${listItem(value, this.indentAt(seq.range[0]))}`);
  }

  /** Removes item `index` of the block list at `path` (the whole document when the path is empty), with its lines. */
  removeItem(path: Path, index: number): void {
    const list = path.length ? this.doc.getIn(path, true) : this.doc.contents;
    if (!isSeq(list)) throw new EditError(`${path.join(".") || "The document"} is not a list.`);
    const seq = list as YAMLSeq.Parsed;
    const item = seq.items[index] as ParsedNode | undefined;
    if (!item) throw new EditError(`${path.join(".") || "The document"} has no item ${index + 1}.`);
    if (seq.flow) {
      const items = (seq.toJSON() as YamlValue[]).filter((_, i) => i !== index);
      this.splice(seq.range[0], seq.range[1], flow(items));
      return;
    }
    const start = this.lineStart(item.range[0]);
    this.splice(start, Math.min(this.lineEnd(this.itemEnd(item) - 1) + 1, this.source.length), "");
  }

  /** Where a list item's text ends: a block mapping's range runs on over comments, its last value's does not. */
  private itemEnd(item: ParsedNode): number {
    const last = isMap(item) && !item.flow ? item.items.at(-1) : undefined;
    return last ? ((last.value ?? last.key) as ParsedNode).range[1] : item.range[1];
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

/** A block list's item with its line break: "- scalar", or a mapping as "- key: value" lines. */
function listItem(value: YamlValue, indent: string): string {
  if (!isBlock(value)) return `${indent}-${render(value, indent)}\n`;
  const inner = `${indent}  `;
  const lines = Object.entries(value).map(([k, v]) => `${scalar(k)}:${render(v, inner)}`);
  return `${indent}- ${lines.join(`\n${inner}`)}\n`;
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
