import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { expect, test } from "vitest";

const source = stripTypeScriptTypes(
  readFileSync(
    new URL("../../adapter-tanstack/templates/src/kit/bounded-body.ts", import.meta.url),
    "utf8",
  ).replace(/\bexport /g, ""),
);
const { boundedBody, bodySize, BodyLimit } = new Function(
  `${source}; return {boundedBody,bodySize,BodyLimit};`,
)() as {
  boundedBody: (request: Request, maximum: number, milliseconds?: number) => Promise<Uint8Array>;
  bodySize: (request: Request, maximum: number) => number;
  BodyLimit: new () => Error;
};
function request(stream: ReadableStream<Uint8Array>, headers = {}, signal?: AbortSignal) {
  return new Request("http://localhost/upload", {
    method: "POST",
    body: stream,
    headers,
    signal,
    duplex: "half",
  } as RequestInit);
}
test("missing length reserves the maximum and an oversized chunked body is cancelled", async () => {
  let reads = 0,
    cancelled = false;
  const req = request(
    new ReadableStream(
      {
        pull(c) {
          reads++;
          c.enqueue(new Uint8Array(4));
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 },
    ),
  );
  expect(bodySize(req, 6)).toBe(6);
  await expect(boundedBody(req, 6)).rejects.toBeInstanceOf(BodyLimit);
  expect(reads).toBe(2);
  expect(cancelled).toBe(true);
});
test("false low declarations cannot buffer beyond the reservation", async () => {
  const req = request(
    new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array(5));
        c.close();
      },
    }),
    { "content-length": "1" },
  );
  await expect(boundedBody(req, 10)).rejects.toBeInstanceOf(BodyLimit);
});
test("malformed and oversized lengths fail before reading; zero is explicit", async () => {
  for (const value of ["-1", "NaN", "", "1.5", "100", "9007199254740993"]) {
    let reads = 0;
    const req = request(
      new ReadableStream(
        {
          pull() {
            reads++;
          },
        },
        { highWaterMark: 0 },
      ),
      { "content-length": value },
    );
    await expect(boundedBody(req, 10)).rejects.toBeInstanceOf(BodyLimit);
    expect(reads).toBe(0);
  }
  expect(
    bodySize(new Request("http://localhost", { headers: { "content-length": "0" } }), 10),
  ).toBe(0);
});
test("bounded multi-chunk contents are copied exactly", async () => {
  const req = request(
    new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array([1, 2]));
        c.enqueue(new Uint8Array([3]));
        c.close();
      },
    }),
  );
  expect(await boundedBody(req, 3)).toEqual(new Uint8Array([1, 2, 3]));
});
test("stalled and aborted bodies cancel their readers", async () => {
  let cancellations = 0;
  const stream = () =>
    new ReadableStream<Uint8Array>({
      cancel() {
        cancellations++;
      },
    });
  await expect(boundedBody(request(stream()), 10, 10)).rejects.toBeInstanceOf(BodyLimit);
  const controller = new AbortController();
  const pending = boundedBody(request(stream(), {}, controller.signal), 10);
  controller.abort();
  await expect(pending).rejects.toBeInstanceOf(BodyLimit);
  expect(cancellations).toBe(2);
});

test("the generated API reader rejects overflow before draining the request", async () => {
  const api = readFileSync(
    new URL("../../adapter-tanstack/templates/src/kit/api.server.ts", import.meta.url),
    "utf8",
  );
  const method = /export async function bytesOf\([\s\S]*?^}/m.exec(api)?.[0];
  expect(method).toBeTruthy();
  const bytesOf = new Function(
    "boundedBody",
    "BodyLimit",
    "TooLarge",
    `${stripTypeScriptTypes((method ?? "").replace("export ", ""))};return bytesOf;`,
  )(boundedBody, BodyLimit, Error);
  let reads = 0;
  const req = request(
    new ReadableStream(
      {
        pull(c) {
          reads++;
          c.enqueue(new Uint8Array(4));
          if (reads === 3) c.close();
        },
      },
      { highWaterMark: 0 },
    ),
  );
  await expect(bytesOf(req, 6)).rejects.toThrow("larger");
  expect(reads).toBe(2);
});

test("a tiny unknown-length body never preallocates its maximum", async () => {
  const allocations: number[] = [];
  class TrackedBytes extends Uint8Array {
    constructor(length: number) {
      super(length);
      allocations.push(length);
    }
  }
  const reader = new Function("Uint8Array", `${source};return boundedBody;`)(TrackedBytes);
  const req = request(
    new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array(100));
        c.close();
      },
    }),
  );
  expect((await reader(req, 135_000_000)).length).toBe(100);
  expect(Math.max(...allocations)).toBeLessThanOrEqual(65536);
});
