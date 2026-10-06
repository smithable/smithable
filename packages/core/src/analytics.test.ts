import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { analyticsOf, validateContext } from "./context-file.js";

const context = (body: string) => ({
  path: "smithable.context.yml",
  text: `smithableContext: 0.1\n${body}`,
});

test("analytics names one provider with an id that looks like the provider's", () => {
  expect(validateContext(context("analytics: { plausible: shop.example.com }\n"))).toEqual([]);
  expect(validateContext(context("analytics: { google: G-ABC123XYZ }\n"))).toEqual([]);
  const bad = validateContext(context("analytics: { google: UA-12345 }\n"));
  expect(bad[0]?.message).toMatch(/analytics\.google/);
  // Two would count every visit twice.
  const two = validateContext(
    context("analytics: { plausible: shop.example.com, fathom: ABCDEFGH }\n"),
  );
  expect(two[0]?.message).toMatch(/names one of plausible, umami, fathom, google/);
  expect(analyticsOf("smithableContext: 0.1\nanalytics: { fathom: ABCDEFGH }\n")).toEqual({
    provider: "fathom",
    id: "ABCDEFGH",
  });
  expect(analyticsOf("smithableContext: 0.1\n")).toBeUndefined();
});

test("setAnalytics sets, replaces and removes the one provider", () => {
  const files = {
    spec: "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Item:\n    fields: { name: string! }\npages:\n  items: { crud: Item }\n",
    context: "smithableContext: 0.1\n",
  };
  const set = applyOperation(files, "setAnalytics", {
    provider: "plausible",
    id: "shop.example.com",
  });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.context).toContain("analytics:");
  expect(analyticsOf(set.files.context)).toEqual({ provider: "plausible", id: "shop.example.com" });
  const google = applyOperation({ ...files, context: set.files.context }, "setAnalytics", {
    provider: "google",
    id: "G-ABC123XYZ",
  });
  if (!google.ok) throw new Error(google.message);
  expect(analyticsOf(google.files.context)).toEqual({ provider: "google", id: "G-ABC123XYZ" });
  expect(applyOperation(files, "setAnalytics", { provider: "google", id: "UA-1" })).toMatchObject({
    ok: false,
    message: expect.stringContaining("G-XXXXXXXXXX"),
  });
  const none = applyOperation({ ...files, context: google.files.context }, "setAnalytics", {
    provider: "none",
  });
  if (!none.ok) throw new Error(none.message);
  expect(analyticsOf(none.files.context)).toBeUndefined();
});
