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
export type YamlValue = string | number | boolean | string[] | { [key: string]: YamlValue };

type Path = readonly string[];

/**
 * Edits YAML source with minimal text splices at the positions the parser reports, so
 * everything an edit does not touch (comments, alignment, flow style, blank lines)
 * stays byte-for-byte identical. Re-parses after every edit.
 */
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
      this.splice(node.range[0], node.range[1], flow(value));
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
    if (!isSeq(list)) throw new Error(`${path.join(".")} is not a list.`);
    const item = list.items[index] as ParsedNode | undefined;
    if (!item) throw new Error(`${path.join(".")} has no item ${index + 1}.`);
    this.splice(item.range[0], item.range[1], flow(value));
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
      if (path.length === 0) throw new Error("The document has no root mapping.");
      this.add(path.slice(0, -1), path[path.length - 1] as string, { [key]: value });
      return;
    }
    const map = this.doc.getIn(path, true) as ParsedNode;
    if (!isMap(map)) throw new Error(`${path.join(".")} is not a mapping.`);
    if (map.flow) {
      const close = this.source.lastIndexOf("}", map.range[1]);
      const inner = this.source.slice(map.range[0] + 1, close);
      const sep = inner.trim() === "" ? " " : inner.trimEnd().endsWith(",") ? " " : ", ";
      const trimmedClose = map.range[0] + 1 + inner.trimEnd().length;
      this.splice(trimmedClose, close, `${sep}${key}: ${flow(value)} `);
      return;
    }
    const last = map.items[map.items.length - 1] as Pair<ParsedNode, ParsedNode | null>;
    const indent = this.indentAt(last.key.range[0]);
    const end = last.value ? last.value.range[1] : last.key.range[1];
    const at = Math.min(this.lineEnd(end - 1) + 1, this.source.length);
    const lead = at === this.source.length && !this.source.endsWith("\n") ? "\n" : "";
    this.splice(at, at, `${lead}${indent}${key}:${render(value, indent)}\n`);
  }

  private pair(path: Path): Pair<ParsedNode, ParsedNode | null> {
    const key = path[path.length - 1];
    const found = this.parentMap(path).items.find((p) => isScalar(p.key) && p.key.value === key);
    if (!found || !isPair(found)) throw new Error(`Nothing at ${path.join(".")}.`);
    return found as Pair<ParsedNode, ParsedNode | null>;
  }

  private parentMap(path: Path): YAMLMap.Parsed {
    const parent = path.length === 1 ? this.doc.contents : this.doc.getIn(path.slice(0, -1), true);
    if (!isMap(parent))
      throw new Error(`${path.slice(0, -1).join(".") || "The document"} is not a mapping.`);
    return parent as YAMLMap.Parsed;
  }

  private splice(start: number, end: number, insert: string): void {
    this.source = this.source.slice(0, start) + insert + this.source.slice(end);
    this.reparse();
  }

  private reparse(): void {
    this.doc = parseDocument(this.source);
    if (this.doc.errors.length > 0)
      throw new Error(`Edit produced invalid YAML: ${this.doc.errors[0]?.message}`);
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
  return typeof value === "object" && !Array.isArray(value);
}

/** A value on one line: a scalar, [a, b] or { k: v }. */
function flow(value: YamlValue): string {
  if (Array.isArray(value)) return `[${value.map(scalar).join(", ")}]`;
  if (isBlock(value)) {
    return `{ ${Object.entries(value)
      .map(([k, v]) => `${k}: ${flow(v)}`)
      .join(", ")} }`;
  }
  return scalar(value);
}

/** Text after "key:" for a value: " scalar", " [a, b]", or a newline and an indented block. */
function render(value: YamlValue, indent: string): string {
  if (Array.isArray(value)) return ` ${flow(value)}`;
  if (isBlock(value)) {
    const inner = `${indent}  `;
    return Object.entries(value)
      .map(([k, v]) => `\n${inner}${k}:${render(v, inner)}`)
      .join("");
  }
  return ` ${scalar(value)}`;
}

function scalar(value: string | number | boolean): string {
  return stringify(value).trimEnd();
}
