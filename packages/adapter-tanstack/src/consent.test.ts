import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { beforeEach, expect, test, vi } from "vitest";
import { generateApp } from "./generate.js";

// The kit's consent.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../templates/src/kit/consent.ts";

type Kit = {
  afterConsent(run: () => void): void;
  choose(choice: "yes" | "no"): void;
  consentAsked(): boolean;
  reopenConsent(): void;
};

let stored: Record<string, string>;

/** A fresh kit in a "browser" with its own storage. */
async function kit(): Promise<Kit> {
  vi.resetModules();
  return (await import(path)) as Kit;
}

beforeEach(() => {
  stored = {};
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => stored[k] ?? null,
    setItem: (k: string, v: string) => {
      stored[k] = v;
    },
  });
});

test("afterConsent waits for a yes, and a kept yes runs at once on the next page", async () => {
  const first = await kit();
  const run = vi.fn();
  expect(first.consentAsked()).toBe(false);
  first.afterConsent(run);
  expect(first.consentAsked()).toBe(true);
  expect(run).not.toHaveBeenCalled();
  first.choose("yes");
  expect(run).toHaveBeenCalledOnce();
  expect(first.consentAsked()).toBe(false);

  const next = await kit();
  const again = vi.fn();
  next.afterConsent(again);
  expect(again).toHaveBeenCalledOnce();
  expect(next.consentAsked()).toBe(false);
});

test("a no runs nothing and is kept; Cookie settings asks again; a year later it is asked again", async () => {
  const first = await kit();
  const run = vi.fn();
  first.afterConsent(run);
  first.choose("no");
  expect(run).not.toHaveBeenCalled();
  expect(first.consentAsked()).toBe(false);
  first.reopenConsent();
  expect(first.consentAsked()).toBe(true);

  const next = await kit();
  next.afterConsent(run);
  expect(run).not.toHaveBeenCalled();
  expect(next.consentAsked()).toBe(false);

  stored.consent = JSON.stringify({ choice: "no", at: "2000-01-01T00:00:00Z" });
  const later = await kit();
  later.afterConsent(run);
  expect(later.consentAsked()).toBe(true);
});

const spec = `smithable: 0.1
app: { name: Shop }
models:
  Customer:
    fields:
      name: string!
`;

function root(analytics?: { provider: "plausible" | "google"; id: string }) {
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
  const auth = validateAuth(
    { path: "smithable.auth.yml", text: "smithableAuth: 0.1\nsignIn: none\n" },
    ir,
  ).auth as AuthIR;
  const files = generateApp(ir, {
    smithableVersion: "0.0.0",
    auth,
    content: emptyContent(),
    ...(analytics ? { analytics } : {}),
  });
  return files.find((f) => f.path === "src/routes/__root.tsx")?.content ?? "";
}

test("the root route loads the named counter and allows only its addresses", () => {
  const none = root();
  expect(none).toContain("<Consent />");
  expect(none).not.toContain("startAnalytics");
  expect(none).toContain("pageHeaders(ssr?.nonce)");

  const plausible = root({ provider: "plausible", id: "shop.example.com" });
  expect(plausible).toContain('"src":"https://plausible.io/js/script.js"');
  expect(plausible).toContain('"data":{"domain":"shop.example.com"},"consent":false');
  expect(plausible).toContain("pageHeaders(ssr?.nonce, analyticsAllow)");
  expect(plausible).toContain("useEffect(() => startAnalytics(analytics), []);");

  const google = root({ provider: "google", id: "G-ABC123" });
  expect(google).toContain('"consent":true,"gtag":"G-ABC123"');
  expect(google).toContain("https://*.google-analytics.com");
});
