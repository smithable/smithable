import { isMap, isScalar, isSeq, type LineCounter, type ParsedNode, type Scalar } from "yaml";
import type { Diagnostic, Fix, Severity } from "./diagnostics.js";
import { didYouMean } from "./suggest.js";

/** A key in a YAML mapping together with its value. */
export interface Entry {
  key: string;
  keyNode: Scalar.Parsed;
  value: ParsedNode | null;
}

/** Something a diagnostic can point at: a YAML node, or nothing (start of file). */
export type At = ParsedNode | Scalar.Parsed | null | undefined;

export type SymbolKind = "model" | "page" | "action" | "query" | "role" | "incoming";

interface Reference {
  kind: SymbolKind;
  name: string;
  at: At;
}

/** Shared state while parsing one spec file: diagnostics and cross-section symbols. */
/** For text that YAML split: a ", " inside { … } or a ": " anywhere starts a new entry. */
const QUOTE_HINT = `A ", " inside { … } or a ": " inside a text starts a new entry: put the whole text in quotes.`;

export class ParseContext {
  readonly diagnostics: Diagnostic[] = [];
  private readonly symbols = new Map<SymbolKind, Set<string>>();
  private readonly references: Reference[] = [];
  private readonly marks = new Map<string, At>();

  constructor(
    readonly file: string,
    private readonly lines: LineCounter,
  ) {}

  error(at: At, code: string, message: string, hint?: string): void {
    this.report("error", at, code, message, hint);
  }

  warning(at: At, code: string, message: string, hint?: string): void {
    this.report("warning", at, code, message, hint);
  }

  /** Advice, with the operation that does it (docs/design/advice.md): the app is fine without. */
  note(at: At, code: string, message: string, fix: Fix, hint?: string): void {
    this.report("note", at, code, message, hint);
    const last = this.diagnostics[this.diagnostics.length - 1];
    if (last) last.fix = fix;
  }

  /** Reports at a character offset, for YAML syntax errors that have no node. */
  errorAtOffset(offset: number, code: string, message: string): void {
    const pos = this.lines.linePos(offset);
    // "description: Works with contacts: deals" is the usual cause.
    const colon = /Nested mappings are not allowed|Implicit keys need to be on a single line/.test(
      message,
    );
    this.diagnostics.push({
      severity: "error",
      code,
      message,
      ...(colon ? { hint: QUOTE_HINT } : {}),
      file: this.file,
      line: pos.line,
      column: pos.col,
    });
  }

  /** Records that a model, page, … with this name exists. */
  define(kind: SymbolKind, name: string): void {
    let names = this.symbols.get(kind);
    if (!names) {
      names = new Set();
      this.symbols.set(kind, names);
    }
    names.add(name);
  }

  /** Records a reference, checked by `checkReferences` once every section is parsed. */
  reference(kind: SymbolKind, name: string, at: At): void {
    this.references.push({ kind, name, at });
  }

  /** Remembers where something was written, for checks that run after parsing. */
  mark(key: string, at: At): void {
    this.marks.set(key, at);
  }

  at(key: string): At {
    return this.marks.get(key);
  }

  /** Reports references to undefined symbols, except those of the `unchecked` kinds. */
  checkReferences(unchecked: SymbolKind[] = []): void {
    for (const { kind, name, at } of this.references) {
      if (unchecked.includes(kind)) continue;
      const names = this.symbols.get(kind) ?? new Set<string>();
      if (!names.has(name)) {
        this.error(
          at,
          `unknown-${kind}`,
          `There is no ${kind} named "${name}".`,
          didYouMean(name, names),
        );
      }
    }
  }

  private report(severity: Severity, at: At, code: string, message: string, hint?: string): void {
    const pos = at?.range ? this.lines.linePos(at.range[0]) : { line: 1, col: 1 };
    this.diagnostics.push({
      severity,
      code,
      message,
      ...(hint === undefined ? {} : { hint }),
      file: this.file,
      line: pos.line,
      column: pos.col,
    });
  }
}

/** Entries of a mapping, or an error if `node` is not one. Keys must be plain strings. */
export function mapEntries(ctx: ParseContext, node: At, what: string): Entry[] | undefined {
  if (!isMap(node)) {
    ctx.error(node, "expected-mapping", `${what} must be a mapping of keys to values.`);
    return undefined;
  }
  const entries: Entry[] = [];
  for (const pair of node.items) {
    const keyNode = pair.key as ParsedNode | null;
    if (!isScalar(keyNode) || typeof keyNode.value !== "string") {
      ctx.error(keyNode, "invalid-key", `Keys in ${what} must be plain names.`);
      continue;
    }
    entries.push({ key: keyNode.value, keyNode, value: pair.value as ParsedNode | null });
  }
  return entries;
}

export interface KeyRules {
  /** Keys allowed in this spec version. */
  allowed: readonly string[];
  /** Keys planned for later spec versions: reported as "not available yet" rather than typos. */
  later?: readonly string[];
  /** Keys holding visible text, which belongs in smithable.content.yml. */
  content?: readonly string[];
  /** Keys that moved to another file: key → where it is said now. */
  moved?: Readonly<Record<string, string>>;
}

/** Reports keys that are not allowed, with a tailored message. Returns the allowed entries. */
export function checkKeys(ctx: ParseContext, entries: Entry[], where: string, rules: KeyRules) {
  const allowed = entries.filter((entry) => rules.allowed.includes(entry.key));
  for (const { key, keyNode } of entries) {
    if (rules.allowed.includes(key)) continue;
    if (rules.later?.includes(key)) {
      ctx.error(
        keyNode,
        "not-yet-supported",
        `"${key}" in ${where} is not available in spec version 0.1 yet.`,
      );
    } else if (rules.moved && key in rules.moved) {
      ctx.error(
        keyNode,
        "moved-key",
        `"${key}" in ${where} is not in smithable.yml any more: ${rules.moved[key]}`,
      );
    } else if (rules.content?.includes(key)) {
      ctx.error(
        keyNode,
        "text-in-spec",
        `"${key}" in ${where} is visible text, which does not belong in smithable.yml.`,
        "Put visible text in smithable.content.yml. Smithable derives default texts from names.",
      );
    } else {
      ctx.error(
        keyNode,
        "unknown-key",
        `Unknown key "${key}" in ${where}.`,
        // "{ description: Contacts, deals }" makes "deals" a key.
        /\s/.test(key) ? QUOTE_HINT : didYouMean(key, rules.allowed),
      );
    }
  }
  return allowed;
}

export function readString(ctx: ParseContext, node: At, what: string): string | undefined {
  if (isScalar(node) && typeof node.value === "string" && node.value.trim() !== "")
    return node.value;
  ctx.error(node, "expected-text", `${what} must be a non-empty text.`);
  return undefined;
}

export function readBoolean(ctx: ParseContext, node: At, what: string): boolean | undefined {
  if (isScalar(node) && typeof node.value === "boolean") return node.value;
  ctx.error(node, "expected-boolean", `${what} must be true or false.`);
  return undefined;
}

export function readNumber(ctx: ParseContext, node: At, what: string): number | undefined {
  if (isScalar(node) && typeof node.value === "number") return node.value;
  ctx.error(node, "expected-number", `${what} must be a number.`);
  return undefined;
}

/** A list of plain names, each reported with its own node for precise positions. */
export function readNameList(
  ctx: ParseContext,
  node: At,
  what: string,
): { name: string; at: At }[] {
  if (!isSeq(node)) {
    ctx.error(node, "expected-list", `${what} must be a list, like [a, b].`);
    return [];
  }
  const names: { name: string; at: At }[] = [];
  for (const item of node.items as ParsedNode[]) {
    const name = readString(ctx, item, `Each item in ${what}`);
    if (name !== undefined) names.push({ name, at: item });
  }
  return names;
}

/**
 * A list of roles from smithable.auth.yml, checked once every section is parsed. "owner"
 * (the record's owner) is accepted only where a record is involved.
 */
export function readRoleList(
  ctx: ParseContext,
  node: At,
  what: string,
  allowOwner: boolean,
): string[] {
  return readNameList(ctx, node, what).flatMap(({ name, at }) => {
    if (name === "owner" && !allowOwner) {
      ctx.error(
        at,
        "invalid-role",
        `"owner" does not apply to ${what}: no single record is involved.`,
      );
      return [];
    }
    if (name !== "owner") ctx.reference("role", name, at);
    return [name];
  });
}
