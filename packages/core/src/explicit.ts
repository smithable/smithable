import type { AuthIR } from "./auth.js";
import { YamlEditor, type YamlValue } from "./edit.js";
import type { SpecIR } from "./ir.js";
import { pageModel } from "./patterns.js";
import { titleFieldByRule } from "./samples.js";
import { threadBindings } from "./thread.js";
import { writeUniqueScopes } from "./unique-scopes.js";
import type { UxIR } from "./ux.js";

/**
 * Writes out what the rules settled (docs/design/inference.md §3), so the spec says it all and
 * no later change of its shape moves anything: each model's title (`namedBy`), where its unique
 * values are unique, what a conversation reads from it (`thread`), an articles or calendar page's
 * parts in the long form, an order page's price, quantity and available. What is written already
 * stays as it is. Returns the text unchanged when nothing was implicit.
 */
export function writeExplicit(
  text: string,
  ir: SpecIR,
  auth: AuthIR,
  ux?: UxIR,
): { text: string; written: string[] } {
  const scoped = writeUniqueScopes(text, ir, auth);
  const spec = new YamlEditor(scoped.text);
  const written = [...scoped.written];
  const map = (value: unknown): Record<string, YamlValue> | undefined =>
    value && typeof value === "object" && !Array.isArray(value)
      ? { ...(value as Record<string, YamlValue>) }
      : undefined;
  for (const model of ir.models) {
    const path = ["models", model.name];
    if (!spec.has(path)) continue;
    if (!model.namedBy) {
      const by = titleFieldByRule(model);
      if (by !== "id") {
        spec.add(path, "namedBy", by);
        written.push(`${model.name}: namedBy ${by}`);
      }
    }
    if (shownAsThread(ir, ux, model.name)) {
      const b = threadBindings(model);
      const thread = map(spec.get([...path, "thread"])) ?? {};
      const parts: string[] = [];
      if (b.body && thread.body === undefined) {
        thread.body = b.body.name;
        parts.push(`body ${b.body.name}`);
      }
      if (b.author && thread.author === undefined) {
        thread.author = b.author.name;
        parts.push(`author ${b.author.name}`);
      }
      if (b.side && thread.side === undefined) {
        thread.side = { field: b.side.field.name, ours: b.side.ours };
        parts.push(`side ${b.side.field.name} (${b.side.ours} ours)`);
      }
      if (parts.length) {
        if (spec.has([...path, "thread"])) spec.set([...path, "thread"], thread);
        else spec.add(path, "thread", thread);
        written.push(`${model.name}: thread ${parts.join(", ")}`);
      }
    }
  }
  for (const page of ir.pages) {
    const p = page.pattern;
    const path = ["pages", page.id];
    if (p.kind === "articles" || p.kind === "calendar") {
      const key = p.kind;
      const current = spec.get([...path, key]);
      const long = map(current) ?? (typeof current === "string" ? { model: current } : undefined);
      if (!long) continue;
      const keys =
        p.kind === "articles"
          ? (["title", "body", "picture", "date", "address", "summary", "author"] as const)
          : (["starts", "ends", "duration", "title"] as const);
      const parts: string[] = [];
      for (const k of keys) {
        const value = (p as Record<string, unknown>)[k];
        if (typeof value === "string" && value && long[k] === undefined) {
          long[k] = value;
          parts.push(`${k} ${value}`);
        }
      }
      if (parts.length) {
        spec.set([...path, key], long);
        written.push(`${page.id}: ${key} ${parts.join(", ")}`);
      }
    }
    if (p.kind === "order") {
      const long = map(spec.get([...path, "order"]));
      if (!long) continue;
      const parts: string[] = [];
      for (const k of ["price", "quantity", "available"] as const) {
        const value = p[k];
        if (value && long[k] === undefined) {
          long[k] = value;
          parts.push(`${k} ${value}`);
        }
      }
      if (parts.length) {
        spec.set([...path, "order"], long);
        written.push(`${page.id}: order ${parts.join(", ")}`);
      }
    }
  }
  return { text: written.length ? spec.text : text, written };
}

/** Whether a page's record view shows this model's records as a conversation (ux record.lists). */
function shownAsThread(ir: SpecIR, ux: UxIR | undefined, model: string): boolean {
  return ir.pages.some((p) =>
    Object.entries(ux?.pages[p.id]?.lists ?? {}).some(
      ([name, look]) =>
        look === "thread" &&
        ir.models
          .find((m) => m.name === pageModel(p))
          ?.fields.some(
            (f) => f.name === name && f.type.kind === "relation" && f.type.model === model,
          ),
    ),
  );
}
