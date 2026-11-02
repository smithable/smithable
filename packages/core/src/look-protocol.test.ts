import { expect, test } from "vitest";
import {
  currentLookReply,
  LOOK_CSS_LIMIT,
  parseLookCommand,
  parseLookReply,
} from "./look-protocol.js";

const current = {
  session: "session-one",
  project: "project-one",
  document: "document-one",
  page: "/tasks/47",
  generation: "boot:source",
  revision: 7,
};
const reply = { ...current, version: 1, source: "smithable-preview", type: "look-applied" };
test("only the current frame document, session, generation, page and exact revision may acknowledge", () => {
  expect(parseLookReply(reply)).toEqual(reply);
  expect(currentLookReply(parseLookReply(reply)!, current)).toBe(true);
  for (const key of ["session", "project", "document", "page", "generation"] as const) {
    const older = parseLookReply({ ...reply, [key]: `${current[key]}-other` })!;
    expect(currentLookReply(older, current)).toBe(false);
  }
  for (const revision of [6, 8])
    expect(currentLookReply(parseLookReply({ ...reply, revision })!, current)).toBe(false);
  for (const malformed of [
    null,
    [],
    { ...reply, version: 2 },
    { ...reply, revision: -1 },
    { ...reply, revision: 1.2 },
    { ...reply, source: "other" },
    { ...reply, error: "a".repeat(501) },
  ])
    expect(parseLookReply(malformed)).toBeUndefined();
});
test("bounded commands and explicit current-viewer states have a finite protocol", () => {
  const command = {
    ...current,
    version: 1,
    type: "look-style",
    css: ":root{--radius:5px}",
    mode: "dark",
  };
  expect(parseLookCommand(command)).toEqual(command);
  for (const change of [
    { css: "x".repeat(LOOK_CSS_LIMIT + 1) },
    { mode: "system" },
    { page: "//external.test" },
    { type: "look-delete-data" },
  ])
    expect(parseLookCommand({ ...command, ...change })).toBeUndefined();
  expect(
    parseLookCommand({ ...current, version: 1, type: "look-reset", reason: "discard" }),
  ).toBeTruthy();
  expect(
    parseLookCommand({ ...current, version: 1, type: "look-reset", reason: "unrecognized" }),
  ).toBeUndefined();
  for (const status of ["ready", "sign-in", "denied", "unavailable", "error"])
    expect(
      parseLookReply({
        ...current,
        version: 1,
        source: "smithable-preview",
        type: "look-ready",
        challenge: "challenge-one",
        navigation: 1,
        status,
      }),
    ).toBeTruthy();
});

test("the emitted iframe validator runs the same bounded command contract", async () => {
  const { lookCommandRuntime } = await import("./look-protocol.js");
  const parse = new Function(`${lookCommandRuntime()};return parseLookCommand;`)();
  const command = { ...current, version: 1, type: "look-style", css: "", mode: "light" };
  expect(parse(command)).toEqual(parseLookCommand(command));
  expect(parse({ ...command, revision: -1 })).toBeUndefined();
});

test("readiness from a previous load or earlier SPA navigation cannot replace the current document", async () => {
  const { currentLookReady } = await import("./look-protocol.js");
  const ready = {
    type: "look-ready",
    version: 1,
    source: "smithable-preview",
    project: "project-one",
    document: "document-one",
    page: "/tasks",
    generation: "boot:source",
    status: "ready",
    challenge: "challenge-two",
    navigation: 3,
  } as const;
  expect(currentLookReady(ready, "challenge-two")).toBe(true);
  expect(currentLookReady({ ...ready, challenge: "challenge-one" }, "challenge-two")).toBe(false);
  expect(currentLookReady(ready, "challenge-two", ready)).toBe(false);
  expect(currentLookReady({ ...ready, navigation: 2 }, "challenge-two", ready)).toBe(false);
  expect(
    currentLookReady({ ...ready, navigation: 4, page: "/tasks/47" }, "challenge-two", ready),
  ).toBe(true);
});

test("rapid history input is ordered within its binding even while the next style is in flight", async () => {
  const { currentLookHistory } = await import("./look-protocol.js");
  const history = parseLookReply({
    ...reply,
    type: "look-history",
    direction: "redo",
    revision: 6,
    input: 2,
  });
  if (!history) throw new Error("Invalid history fixture");
  expect(currentLookHistory(history, current, 1)).toBe(true);
  expect(currentLookHistory(history, current, 2)).toBe(false);
  expect(currentLookHistory(history, { ...current, session: "other-session" }, 1)).toBe(false);
  expect(currentLookHistory(history, { ...current, revision: 5 }, 1)).toBe(false);
  expect(
    parseLookReply({ ...reply, type: "look-history", direction: "undo", input: 0 }),
  ).toBeUndefined();
});
