// The kit's outgoing call (adapter-tanstack/templates/src/kit/call.server.ts): connected only to an address the
// guard checked. Here 127.0.0.1 stands for a public address and 127.0.0.2 for a private one, each
// with a receiver, so the test needs no network.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, expect, test } from "vitest";

// As the generated apps get it (a path the build does not follow).
const path: string = "../../adapter-tanstack/templates/src/kit/call.server.ts";
const kit = (await import(path)) as {
  guardedLookup(refused: (ip: string) => boolean, resolve: unknown): unknown;
  post(
    url: string,
    headers: Record<string, string>,
    body: string,
    lookup?: unknown,
  ): Promise<number>;
};

const reached: string[] = [];
const servers: Server[] = [];
let port = 0;
beforeAll(async () => {
  for (const host of ["127.0.0.1", "127.0.0.2"]) {
    const server = createServer((request, answer) => {
      reached.push(`${host} ${request.headers.host}`);
      answer.end();
    });
    await new Promise<void>((done) => server.listen(port, host, done));
    port = (server.address() as AddressInfo).port;
    servers.push(server);
  }
});
afterAll(() => {
  for (const server of servers) server.close();
});

const isPrivate = (ip: string) => ip === "127.0.0.2" || ip === "::1";
/** A name whose answers change between lookups: the first, then the next, and so on. */
function changing(...answers: { address: string; family: number }[][]) {
  let n = 0;
  const resolve = (_name: string, _options: unknown, callback: (e: null, a: unknown) => void) =>
    callback(null, answers[Math.min(n++, answers.length - 1)]);
  return { resolve, lookups: () => n };
}

test("the address checked is the one connected to: a name that answers public, then private, reaches the public one", async () => {
  reached.length = 0;
  const name = changing(
    [{ address: "127.0.0.1", family: 4 }],
    [{ address: "127.0.0.2", family: 4 }],
  );
  const lookup = kit.guardedLookup(isPrivate, name.resolve);
  expect(await kit.post(`http://hook.example:${port}/in`, {}, "{}", lookup)).toBe(200);
  expect(name.lookups()).toBe(1);
  expect(reached).toEqual([`127.0.0.1 hook.example:${port}`]);
  // A retry looks the name up again, and is checked again.
  await expect(kit.post(`http://hook.example:${port}/in`, {}, "{}", lookup)).rejects.toThrow(
    /private or local/,
  );
  expect(reached).toHaveLength(1);
});

test("a name with any private address among its answers is refused, IPv6 too, and nothing is reached", async () => {
  reached.length = 0;
  const both = changing([
    { address: "127.0.0.1", family: 4 },
    { address: "127.0.0.2", family: 4 },
  ]);
  await expect(
    kit.post(
      `http://hook.example:${port}/in`,
      {},
      "{}",
      kit.guardedLookup(isPrivate, both.resolve),
    ),
  ).rejects.toThrow(/127\.0\.0\.2/);
  const six = changing([{ address: "::1", family: 6 }]);
  await expect(
    kit.post(`http://hook.example:${port}/in`, {}, "{}", kit.guardedLookup(isPrivate, six.resolve)),
  ).rejects.toThrow(/::1/);
  expect(reached).toEqual([]);
});
