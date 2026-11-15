import { expect, test, vi } from "vitest";
import { modelUsage, readModelUsage } from "./model-usage.js";

const figures = () => ({
  window: {
    used: 0.2,
    allowed: 1,
    remaining: 0.8,
    resetsAt: "2026-11-16T10:00:00.000Z",
    currency: "EUR",
  },
  paused: { is: false, reason: null },
  recent: [{ at: "2026-11-15T10:00:00.000Z", kind: "change", cost: 0.0021 }],
});
const env = {
  SMITHABLE_HOSTED_LEVEL: "normal",
  SMITHABLE_MODEL_URL: "http://cloud:8081/v1",
  SMITHABLE_MODEL_KEY: "fixture-model-token",
};

test("only a hosted daemon fetches from its configured gateway with its existing credential", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(figures()));
  expect(await modelUsage({}, request)).toBeUndefined();
  expect(await modelUsage({ ...env, SMITHABLE_HOSTED_LEVEL: "" }, request)).toBeUndefined();
  expect(await modelUsage({ ...env, SMITHABLE_MODEL_KEY: "" }, request)).toBeUndefined();
  expect(request).not.toHaveBeenCalled();
  expect(await modelUsage(env, request)).toEqual(figures());
  const [url, options] = request.mock.calls[0]!;
  expect(String(url)).toBe("http://cloud:8081/v1/usage");
  expect(options?.headers).toEqual({ authorization: "Bearer fixture-model-token" });
  expect(options?.redirect).toBe("error");
  expect(options?.signal).toBeInstanceOf(AbortSignal);
});

test("the browser receives a strict copy of the contract, never extra service or credential fields", () => {
  const value = figures();
  const input = {
    ...value,
    token: "secret",
    model: "private-model",
    window: { ...value.window, userId: 77 },
    recent: [{ ...value.recent[0], projectId: "private-project", prompt: "private-prompt" }],
  };
  expect(readModelUsage(input)).toEqual(value);
  expect(JSON.stringify(readModelUsage(input))).not.toMatch(/secret|private|userId|projectId/);
  for (const bad of [
    {},
    null,
    { ...value, window: { ...value.window, used: -1 } },
    { ...value, window: { ...value.window, used: Infinity } },
    { ...value, recent: Array(21).fill(value.recent[0]) },
    { ...value, recent: [{ ...value.recent[0], kind: "private-kind" }] },
    { ...value, paused: { is: true, reason: "private-reason" } },
  ])
    expect(readModelUsage(bad)).toBeUndefined();
});

test("a missing endpoint, failure or unsafe configured URL produces no figures", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response("Not found", { status: 404 }));
  expect(await modelUsage(env, request)).toBeUndefined();
  request.mockRejectedValue(Error("unavailable"));
  expect(await modelUsage(env, request)).toBeUndefined();
  request.mockClear();
  for (const url of [
    "file:///v1",
    "https://user:pass@example.invalid/v1",
    "https://example.invalid/v1?token=x",
    "https://example.invalid/v1#fragment",
  ])
    expect(await modelUsage({ ...env, SMITHABLE_MODEL_URL: url }, request)).toBeUndefined();
  expect(request).not.toHaveBeenCalled();
});
