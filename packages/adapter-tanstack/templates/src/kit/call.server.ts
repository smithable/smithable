// Smithable app kit: an outgoing call to another service, connected only to an address the guard
// checked. The name is looked up once for the connection itself and every address it gives is
// checked, so no second lookup can answer with the app's own machine or its neighbours (a name
// whose answers change between a check and the call). TLS still checks the certificate against
// the name, and the Host header is the name. Behind an egress proxy (HTTPS_PROXY, as the hosted
// service starts every app) the call goes through the proxy instead: it checks the destination and
// resolves the name inside its own connection, and nothing else can leave the app.
import { lookup as dnsLookup, type LookupAddress, type LookupAllOptions } from "node:dns";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";
import { privateAddress } from "./outgoing";

type Resolve = (
  hostname: string,
  options: LookupAllOptions,
  callback: (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
) => void;

/** A lookup for a connection that refuses a name with any address `refused` names (a private or local network). */
export function guardedLookup(
  refused: (ip: string) => boolean = privateAddress,
  resolve: Resolve = dnsLookup as unknown as Resolve,
): LookupFunction {
  return (hostname, options, callback) => {
    resolve(hostname, { all: true, family: options.family }, (error, addresses) => {
      const done = callback as (
        error: Error | null,
        address: string | LookupAddress[],
        family?: number,
      ) => void;
      if (error) return done(error, "");
      if (!addresses.length) return done(new Error("it does not resolve"), "");
      const bad = addresses.find((a) => refused(a.address));
      if (bad)
        return done(new Error(`${hostname} is on a private or local network (${bad.address})`), "");
      if (options.all) return done(null, addresses);
      const [first] = addresses as [LookupAddress];
      return done(null, first.address, first.family);
    });
  };
}

/** Whether an egress proxy carries calls to this address: HTTPS_PROXY or HTTP_PROXY set, and NO_PROXY not naming its host. */
export function proxied(
  target: URL,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const proxy =
    target.protocol === "https:"
      ? (env.HTTPS_PROXY ?? env.https_proxy)
      : (env.HTTP_PROXY ?? env.http_proxy);
  if (!proxy) return false;
  const host = target.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return !(env.NO_PROXY ?? env.no_proxy ?? "")
    .split(",")
    .map((n) =>
      n
        .trim()
        .toLowerCase()
        .replace(/^\*?\./, ""),
    )
    .some((n) => n === "*" || host === n || host.endsWith(`.${n}`));
}

/**
 * Posts the body to the address; resolves to the answer's status. A redirect is an answer, not
 * followed. Without a proxy the connection goes only through `lookup`, to a checked address;
 * behind one, through it (`fetch` with NODE_USE_ENV_PROXY), which checks the address itself.
 */
export async function post(
  url: string,
  headers: Record<string, string>,
  body: string,
  lookup: LookupFunction = guardedLookup(import.meta.env.DEV ? () => false : privateAddress),
  viaProxy: typeof fetch = fetch,
): Promise<number> {
  const target = new URL(url);
  if (proxied(target)) {
    const answer = await viaProxy(url, {
      method: "POST",
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    return answer.status;
  }
  const send = target.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const request = send(
      target,
      // Its own connection each time (no kept-alive one): each try is looked up and checked anew.
      {
        method: "POST",
        headers: { ...headers, "Content-Length": String(Buffer.byteLength(body)) },
        lookup,
        agent: false,
        timeout: 10_000,
      },
      (answer) => {
        answer.resume();
        resolve(answer.statusCode ?? 0);
      },
    );
    request.on("timeout", () => request.destroy(new Error("no answer within 10 seconds")));
    request.on("error", reject);
    request.end(body);
  });
}

/**
 * The egress proxy's refusal of a call, from the error fetch throws when the proxy will not open
 * the tunnel ("Proxy response (403) !== 200 when HTTP Tunneling"): its status, or nothing.
 */
export function proxyRefusal(error: unknown): number | undefined {
  let e: unknown = error;
  for (let depth = 0; e && depth < 5; depth++) {
    const found = /Proxy response \((\d{3})\)/.exec(
      String((e as { message?: unknown }).message ?? ""),
    );
    if (found) return Number(found[1]);
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}
