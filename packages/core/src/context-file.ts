// smithable.context.yml (ARCHITECTURE §3.4): how the app is built. Checked against its JSON
// Schema like the other companions; the CLI reads its plugins and packages.
import { isMap, LineCounter, parseDocument } from "yaml";
import { ParseContext } from "./context.js";
import type { Diagnostic } from "./diagnostics.js";
import type { SpecIR } from "./ir.js";
import { checkJson } from "./plugin.js";
import type { JsonSchema } from "./section.js";
import { rejectYamlFeatures } from "./spec.js";

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

/**
 * The payment providers an app may name (docs/design/payments.md §3.5, §5): one per app. `fake`
 * is the app's own page, for development, tests and previews.
 */
export const PAYMENT_PROVIDERS = ["stripe", "mollie", "fake"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

/** An exact version like 4.4.1 (a prerelease tag allowed); what `packages` may hold. */
export const EXACT_VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

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
    // Exact versions only (as setPackage insists), so a hand edit cannot ask for "latest",
    // "^1" or a git address: a build is then the same every time.
    packages: {
      type: "object",
      additionalProperties: {
        type: "string",
        pattern: EXACT_VERSION.source,
        "x-expected": "an exact version like 4.4.1",
      },
    },
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
    payments: {
      type: "object",
      description:
        "Who takes the payments of the spec's payments section; its keys are settings, never in a file.",
      required: ["provider"],
      additionalProperties: false,
      properties: {
        provider: {
          enum: [...PAYMENT_PROVIDERS],
          description: "stripe, mollie, or fake (the app's own page, for development and tests).",
        },
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
  // An alias would make the file unreadable as data (one with no anchor throws): refused, as in the spec.
  rejectYamlFeatures(ctx, doc);
  if (ctx.diagnostics.length) return ctx.diagnostics;
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
  return provider && Object.hasOwn(ANALYTICS, provider) && typeof id === "string"
    ? { provider: provider as AnalyticsProvider, id }
    : undefined;
}

/** The payment provider a valid smithable.context.yml names, if any. */
export function paymentProviderOf(text: string | undefined): PaymentProvider | undefined {
  if (!text) return undefined;
  const provider = (parseDocument(text).toJSON()?.payments as { provider?: unknown } | undefined)
    ?.provider;
  return PAYMENT_PROVIDERS.find((p) => p === provider);
}

/**
 * A note, never an error, when the spec takes payments and the context file names no provider
 * (payments.md §3.5): the app works with `fake` until a release, which needs a real one.
 */
export function paymentsProviderNote(
  ir: Pick<SpecIR, "payments">,
  context: { path: string; text?: string },
): Diagnostic | undefined {
  if (!ir.payments.length || paymentProviderOf(context.text)) return undefined;
  return {
    severity: "note",
    code: "payments-no-provider",
    message:
      "The app takes payments and smithable.context.yml names no provider: development and preview use fake; a release needs a provider.",
    hint: "smithable op setPaymentProvider stripe (or mollie).",
    file: context.path,
    line: 1,
    column: 1,
  };
}
