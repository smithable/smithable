// Free building paused on the hosted service (T746): the gateway's 402 of its own type is said as
// such, any other 402 stays an ordinary error, and what the rules read still works.
import { type SpecIR, validateSpec } from "@smithable/core";
import { buildContext, buildIndex } from "@smithable/index";
import { afterEach, expect, test, vi } from "vitest";
import { proposeChange } from "./propose.js";
import { openAICompatible, PausedError, pausedOf } from "./provider.js";

const body = (error: Record<string, unknown>) => JSON.stringify({ error });
const until = "2026-11-14T00:00:00.000Z";

test("the gateway's paused refusal is read by its type, and only it", () => {
  expect(
    pausedOf(
      body({
        type: "paused",
        reason: "day",
        until,
        invite: "https://smithable.example/invite-request",
      }),
    ),
  ).toEqual({ reason: "day", until, invite: "https://smithable.example/invite-request" });
  expect(pausedOf(body({ type: "paused", reason: "shared", until }))).toEqual({
    reason: "shared",
    until,
  });
  // Another 402 (an app assistant's limit, the demo's day) is not a pause.
  expect(pausedOf(body({ type: "limit", reason: "day", until }))).toBeUndefined();
  expect(pausedOf(body({ type: "paused", reason: "week", until }))).toBeUndefined();
  expect(pausedOf(body({ type: "paused", reason: "day", until: "soon" }))).toBeUndefined();
  expect(pausedOf("not json")).toBeUndefined();
  // An invite that is not an https address is not shown.
  expect(
    pausedOf(body({ type: "paused", reason: "day", until, invite: "javascript:alert(1)" })),
  ).toEqual({
    reason: "day",
    until,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
const gateway = (status: number, text: string) => {
  vi.stubGlobal("fetch", async () => new Response(text, { status }));
  return openAICompatible({
    name: "smithable",
    baseUrl: "https://gateway.example/v1",
    model: "small",
    tier: "smithable",
    location: "eu",
  });
};

const spec = `smithable: 0.1
app: { name: Shop }
models:
  Customer:
    fields: { name: string! }
pages:
  customers: { crud: Customer }
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const index = buildIndex({ ir, generated: {}, custom: [] });
const ask = (request: string, status: number, text: string) =>
  proposeChange({
    request,
    files: { spec },
    context: buildContext(index, request),
    providers: [gateway(status, text)],
  });

test("a paused model call ends the request as paused; a rule's change still works", async () => {
  const paused = body({ type: "paused", reason: "month", until });
  expect(await ask("Make the customers page friendlier somehow", 402, paused)).toMatchObject({
    kind: "paused",
    paused: { reason: "month", until },
  });
  // Read by rule: no model is called, so the pause does not stand in the way.
  expect((await ask("Add a phone field to customers", 402, paused)).kind).toBe("change");
  // Another 402 is the ordinary failure it always was.
  expect(
    (await ask("Make the customers page friendlier somehow", 402, body({ type: "limit" }))).kind,
  ).toBe("failed");
  expect(new PausedError({ reason: "day", until }).message).toMatch(/paused/);
});
