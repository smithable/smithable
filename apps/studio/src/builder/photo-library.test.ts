import { expect, test } from "vitest";
import {
  deleteFile,
  grantFile,
  readLibrary,
  storedFile,
  untilReady,
  uploadFile,
} from "./photo-library";

const ID = "m_01hz8k3q4r5s6t7v8w9x0y1z2a";
const reply = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { "content-type": "application/json" },
  });

test("hosted: the service's library, each file checked; a stray entry is left out", async () => {
  const seen: string[] = [];
  const library = await readLibrary(async (url) => {
    seen.push(url);
    return reply(200, {
      assets: [
        { id: ID, name: "roof.jpg", kind: "image", state: "ready", here: true },
        { id: "../x", name: "x", kind: "image", state: "ready" },
        { id: ID, kind: "image", state: "unknown" },
      ],
      more: true,
    });
  });
  expect(library).toEqual({
    hosted: true,
    files: [{ id: ID, name: "roof.jpg", kind: "image", state: "ready", here: true }],
    more: true,
  });
  expect(seen).toEqual(["/_smithable/media"]);
});

test("local: no JSON from the service's address, so the project's pictures, names checked", async () => {
  const library = await readLibrary(async (url) =>
    url === "/api/photos"
      ? reply(200, { photos: ["images/a.webp", "images/../b.png", "images/c.svg", "images/d.JPG"] })
      : new Response("<html>", { headers: { "content-type": "text/html" } }),
  );
  expect(library).toEqual({ hosted: false, files: ["images/a.webp", "images/d.JPG"] });
  expect(await readLibrary(async () => Promise.reject(new Error("down")))).toHaveProperty("why");
});

test("upload: 202 gives the id; a refusal gives the service's own sentence", async () => {
  const file = { name: "my roof.jpg", type: "image/jpeg", size: 3 };
  let headers: HeadersInit | undefined;
  expect(
    await uploadFile(file, "abc", async (_url, init) => {
      headers = init?.headers;
      return reply(202, { id: ID, state: "processing" });
    }),
  ).toEqual({ id: ID });
  expect(headers).toMatchObject({ "x-file-name": "my%20roof.jpg", "content-type": "image/jpeg" });
  expect(
    await uploadFile(file, "abc", async () =>
      reply(413, { error: "A picture may be up to 20 MB.", reason: "file-too-large" }),
    ),
  ).toEqual({ why: "A picture may be up to 20 MB." });
  expect(await uploadFile(file, "abc", async () => reply(202, { id: "nope" }))).toHaveProperty(
    "why",
  );
});

test("a new file is asked for until it is ready, failed, or the wait is over", async () => {
  const states = ["processing", "processing", "ready"];
  const ready = await untilReady(ID, {
    wait: async () => {},
    fetcher: async () => reply(200, { id: ID, kind: "image", state: states.shift() }),
  });
  expect(ready).toMatchObject({ id: ID, state: "ready" });
  const failed = await untilReady(ID, {
    wait: async () => {},
    fetcher: async () =>
      reply(200, { id: ID, kind: "image", state: "failed", error: "Not a picture." }),
  });
  expect(failed).toEqual({ why: "Not a picture." });
  let asked = 0;
  const late = await untilReady(ID, {
    every: 10,
    within: 30,
    wait: async () => {},
    fetcher: async () => {
      asked++;
      return reply(200, { id: ID, kind: "image", state: "processing" });
    },
  });
  expect(late).toHaveProperty("why");
  expect(asked).toBe(4);
});

test("delete is 204 only, and never for a name that is not an id", async () => {
  expect(await deleteFile(ID, async () => reply(204))).toBe(true);
  expect(await deleteFile(ID, async () => reply(404))).toBe(false);
  let called = false;
  expect(
    await deleteFile("../x", async () => {
      called = true;
      return reply(204);
    }),
  ).toBe(false);
  expect(called).toBe(false);
  expect(storedFile({ id: ID, kind: "video", state: "ready" })).toMatchObject({
    name: ID,
    here: false,
  });
});

test("a file is granted to the project by its /use, 204 only", async () => {
  const seen: string[] = [];
  expect(
    await grantFile(ID, async (url, init) => {
      seen.push(`${init?.method} ${url}`);
      return reply(204);
    }),
  ).toBe(true);
  expect(seen).toEqual([`POST /_smithable/media/${ID}/use`]);
  expect(await grantFile(ID, async () => reply(404))).toBe(false);
  expect(await grantFile("../x", async () => reply(204))).toBe(false);
});
