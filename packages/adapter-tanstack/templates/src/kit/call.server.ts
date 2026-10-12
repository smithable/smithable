// Smithable app kit: an outgoing call to another service, connected only to an address the guard
// checked. The name is looked up once for the connection itself and every address it gives is
// checked, so no second lookup can answer with the app's own machine or its neighbours (a name
// whose answers change between a check and the call). TLS still checks the certificate against
// the name, and the Host header is the name.
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

/** Posts the body to the address, connected only through `lookup`; resolves to the answer's status. A redirect is an answer, not followed. */
export function post(
  url: string,
  headers: Record<string, string>,
  body: string,
  lookup: LookupFunction = guardedLookup(import.meta.env.DEV ? () => false : privateAddress),
): Promise<number> {
  const target = new URL(url);
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
