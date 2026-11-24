import { afterEach, expect, test, vi } from "vitest";
import { api, StudioRequestError } from "./api";

const answer = (status: number, body: unknown) =>
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

test("a try-on refused before anything ran (400) comes back as a refusal, not an uncertain write", async () => {
  answer(400, { ok: false, output: "Sound: it has a sound track." });
  expect(await api.lookChange("setSectionFilm", {}, "r1", "p")).toEqual({
    ok: false,
    output: "Sound: it has a sound track.",
  });
  answer(409, { ok: false, output: "The app changed." });
  await expect(api.lookChange("setSectionFilm", {}, "r1", "p")).rejects.toBeInstanceOf(
    StudioRequestError,
  );
});
