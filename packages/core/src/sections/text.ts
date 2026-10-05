import { isMap, isScalar, isSeq, type ParsedNode } from "yaml";
import { type Entry, mapEntries, type ParseContext, readString } from "../context.js";
import type { Rule, SemanticText } from "../ir.js";
import { NAME_PATTERN, nameRule } from "./names.js";

/** Keys for semantic free text, allowed on every concept. */
export const TEXT_KEYS = ["description", "intent", "rules"] as const;

/** Reads the semantic free-text keys among `entries` into a SemanticText. */
export function readSemanticText(ctx: ParseContext, entries: Entry[]): SemanticText {
  const text: SemanticText = {};
  for (const { key, value } of entries) {
    if (key === "description" || key === "intent") {
      const s = readString(ctx, value, `"${key}"`);
      if (s !== undefined) text[key] = s.trim();
    } else if (key === "rules") {
      text.rules = readRules(ctx, value);
    }
  }
  return text;
}

function readRules(ctx: ParseContext, node: ParsedNode | null): Rule[] {
  if (!isSeq(node)) {
    ctx.error(node, "expected-list", `"rules" must be a list of sentences.`);
    return [];
  }
  const rules: Rule[] = [];
  const ids = new Set<string>();
  for (const item of node.items as ParsedNode[]) {
    if (isScalar(item)) {
      const text = readString(ctx, item, "A rule");
      if (text !== undefined) rules.push({ text: text.trim() });
    } else if (isMap(item)) {
      const rule = readRuleWithId(ctx, item, ids);
      if (rule) rules.push(rule);
    } else {
      ctx.error(item, "invalid-rule", "A rule must be a sentence, or { id: …, rule: … }.");
    }
  }
  return rules;
}

function readRuleWithId(ctx: ParseContext, node: ParsedNode, ids: Set<string>): Rule | undefined {
  const entries = mapEntries(ctx, node, "a rule") ?? [];
  let id: string | undefined;
  let text: string | undefined;
  for (const { key, keyNode, value } of entries) {
    if (key === "id") {
      id = readString(ctx, value, "A rule id");
      if (id !== undefined && !NAME_PATTERN.test(id)) {
        ctx.error(value, "invalid-name", nameRule("rule", id));
      } else if (id !== undefined && ids.has(id)) {
        ctx.error(value, "duplicate-rule-id", `Rule id "${id}" is used twice.`);
      }
      if (id !== undefined) ids.add(id);
    } else if (key === "rule") {
      text = readString(ctx, value, "A rule");
    } else {
      ctx.error(keyNode, "unknown-key", `Unknown key "${key}" in a rule. Use "id" and "rule".`);
    }
  }
  if (text === undefined) {
    ctx.error(node, "missing-key", `A rule with an id also needs "rule": the sentence itself.`);
    return undefined;
  }
  return id === undefined ? { text: text.trim() } : { id, text: text.trim() };
}
