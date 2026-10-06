// smithable.context.yml (ARCHITECTURE §3.4): how the app is built. Checked against its JSON
// Schema like the other companions; the CLI reads its plugins and packages.
import { isMap, LineCounter, parseDocument } from "yaml";
import { ParseContext } from "./context.js";
import type { Diagnostic } from "./diagnostics.js";
import { checkJson } from "./plugin.js";
import type { JsonSchema } from "./section.js";

const strings: JsonSchema = { type: "array", items: { type: "string" } };

/**
 * The analytics an app may name (docs/design/analytics.md), with what its id looks like. The
 * cookie-free counters need no consent; Google does, and turns on the consent bar.
 */
export const ANALYTICS = {
  plausible: { id: "^[a-z0-9.-]+\\.[a-z]{2,}$", consent: false, example: "shop.example.com" },
  umami: {
    id: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    consent: false,
    example: "4f2a1c3e-…",
  },
  fathom: { id: "^[A-Z0-9]{8}$", consent: false, example: "ABCDEFGH" },
  google: { id: "^G-[A-Z0-9]{4,12}$", consent: true, example: "G-XXXXXXXXXX" },
} as const;

export type AnalyticsProvider = keyof typeof ANALYTICS;

/** The analytics smithable.context.yml names, if any. */
export interface AnalyticsSetting {
  provider: AnalyticsProvider;
  id: string;
}

export const CONTEXT_SCHEMA: JsonSchema = {
  type: "object",
  required: ["smithableContext"],
  additionalProperties: false,
  properties: {
    smithableContext: { enum: [0.1] },
    adapter: { type: "string" },
    database: { type: "string" },
    conventions: strings,
    guidance: { type: "string" },
    plugins: strings,
    packages: { type: "object", additionalProperties: { type: ["string", "number"] } },
    analytics: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        Object.entries(ANALYTICS).map(([name, a]) => [name, { type: "string", pattern: a.id }]),
      ),
    },
    ai: {
      type: "object",
      additionalProperties: false,
      properties: {
        policy: { enum: ["local-only", "eu-only", "best-available", "custom"] },
        allow: strings,
      },
    },
  },
};

/** Checks smithable.context.yml; each problem is placed on the top-level key it is under. */
export function validateContext(file: { path: string; text: string }): Diagnostic[] {
  const lines = new LineCounter();
  const doc = parseDocument(file.text, {
    lineCounter: lines,
    uniqueKeys: true,
    prettyErrors: false,
  });
  const ctx = new ParseContext(file.path, lines);
  for (const error of doc.errors)
    ctx.errorAtOffset(error.pos[0], "yaml-syntax", error.message.split("\n")[0] ?? "");
  if (doc.errors.length) return ctx.diagnostics;
  const keys = isMap(doc.contents) ? doc.contents.items : [];
  for (const problem of checkJson(CONTEXT_SCHEMA, doc.toJSON() ?? {}, "")) {
    const key = /^"?([^".[]+)/.exec(problem.replace(/^Unknown key /, ""))?.[1];
    const node = keys.find((p) => (p.key as { value?: unknown }).value === key)?.key as
      | { range?: [number, number] }
      | undefined;
    ctx.errorAtOffset(
      node?.range?.[0] ?? 0,
      "invalid-context",
      `smithable.context.yml: ${problem}`,
    );
  }
  // One counter at a time: two would count every visit twice.
  const analytics = doc.toJSON()?.analytics;
  if (analytics && typeof analytics === "object" && Object.keys(analytics).length !== 1) {
    const node = keys.find((p) => (p.key as { value?: unknown }).value === "analytics")?.key as
      | { range?: [number, number] }
      | undefined;
    ctx.errorAtOffset(
      node?.range?.[0] ?? 0,
      "invalid-context",
      `smithable.context.yml: "analytics" names one of ${Object.keys(ANALYTICS).join(", ")}, with its id.`,
    );
  }
  return ctx.diagnostics;
}

/** The analytics a valid smithable.context.yml names, if any. */
export function analyticsOf(text: string | undefined): AnalyticsSetting | undefined {
  if (!text) return undefined;
  const analytics = parseDocument(text).toJSON()?.analytics as Record<string, unknown> | undefined;
  const [provider, id] = Object.entries(analytics ?? {})[0] ?? [];
  return provider && provider in ANALYTICS && typeof id === "string"
    ? { provider: provider as AnalyticsProvider, id }
    : undefined;
}
