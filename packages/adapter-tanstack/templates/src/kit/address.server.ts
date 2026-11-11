// Smithable app kit: who a request comes from, the same for every limit in the app.
import { isIPv4, isIPv6 } from "node:net";
import { getRequestIP } from "@tanstack/react-start/server";

/** An IPv6 address (checked by isIPv6) as its eight groups, a dotted IPv4 tail made two of them. */
function ipv6Groups(address: string): number[] {
  let s = address.toLowerCase();
  const dotted = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(s);
  if (dotted) {
    const [a, b, c, d] = dotted.slice(1).map(Number) as [number, number, number, number];
    s = `${s.slice(0, dotted.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head = "", tail] = s.split("::");
  const front = head ? head.split(":") : [];
  const back = tail === undefined ? [] : tail ? tail.split(":") : [];
  const groups =
    tail === undefined
      ? front
      : [...front, ...Array<string>(8 - front.length - back.length).fill("0"), ...back];
  return groups.map((g) => Number.parseInt(g, 16));
}

/**
 * An address as written plainly: without a port, brackets or a zone, and an IPv4-mapped IPv6
 * address (::ffff:a.b.c.d, as a dual-stack server reports IPv4 visitors) as the IPv4 address.
 */
export function plainAddress(address: string): string {
  const unbracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(address.trim())?.[1] ?? address.trim();
  const bare =
    (/^(\d+\.\d+\.\d+\.\d+):\d+$/.exec(unbracketed)?.[1] ?? unbracketed).split("%")[0] ?? "";
  if (!isIPv6(bare)) return bare;
  const g = ipv6Groups(bare);
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff)
    return [(g[6] ?? 0) >> 8, (g[6] ?? 0) & 255, (g[7] ?? 0) >> 8, (g[7] ?? 0) & 255].join(".");
  return bare;
}

/**
 * An address as the limits count it: IPv4 as it is, IPv6 by its /64, which is what one
 * subscriber is given, so one person cannot be a new address for every request. Anything else
 * (no address at all) as it is.
 */
export function addressKey(address: string): string {
  const plain = plainAddress(address);
  if (isIPv4(plain) || !isIPv6(plain)) return plain;
  const g = ipv6Groups(plain);
  return `${g
    .slice(0, 4)
    .map((x) => x.toString(16))
    .join(":")}::/64`;
}

/**
 * The visitor's address: behind a proxy that says who the visitor is (TRUST_PROXY=1, e.g. the
 * hosted service) the last hop of X-Forwarded-For, the one that proxy added; otherwise the
 * connection's own, since anyone could send a new X-Forwarded-For with every request. As in
 * server.mjs. A limit counts it by addressKey.
 */
export function visitorAddress(request: Request): string | undefined {
  return (
    (process.env.TRUST_PROXY === "1"
      ? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
      : undefined) || getRequestIP()
  );
}

/**
 * The header Better Auth's own limits read the address from; set here, never by the visitor. It
 * must be a plain address (Better Auth counts an IPv6 one by its /64 itself, and refuses a key).
 */
export const ADDRESS_HEADER = "x-visitor-address";

/** The request with the visitor's address in ADDRESS_HEADER, whatever the visitor sent there. */
export function withAddress(request: Request): Request {
  const headers = new Headers(request.headers);
  headers.set(ADDRESS_HEADER, plainAddress(visitorAddress(request) ?? ""));
  // From its parts: the server's own Request is not one the standard constructor can copy.
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : request.body;
  return new Request(request.url, {
    method: request.method,
    headers,
    body,
    signal: request.signal,
    ...(body ? { duplex: "half" } : {}),
  } as RequestInit);
}
