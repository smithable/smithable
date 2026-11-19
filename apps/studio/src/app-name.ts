// The app's name on a shared domain (smithable-cloud app-names.md §2; T771). Hosted Studio asks
// the service at its own address (/_smithable/name, the service's answer before the workspace),
// so the owner's Studio session and the same-origin rule cover it. The service decides every
// rule: Studio keeps no list of names and shows each refusal in the service's own sentence.

export const NAME_PATH = "/_smithable/name";

/** What the service offers here: its shared domains, the one chosen first, and the name in use. */
export type NameOffer = { offer: string[]; default: string; current: string | null };
export type NameCheck = { free: true; address: string } | { why: string };
export type NameSaved = { address: string } | { removed: true } | { why: string };

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const COULD_NOT = "The address could not be reached. Try again in a moment.";

/** The service's JSON, or undefined for anything else (local Studio, a sign-in page, an outage). */
async function answer(response: Response): Promise<Record<string, unknown> | undefined> {
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) return;
  const body: unknown = await response.json().catch(() => undefined);
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : undefined;
}

const why = (body: Record<string, unknown> | undefined) =>
  typeof body?.why === "string" && body.why ? body.why : undefined;

/** The offer, or undefined when nothing is to be shown: no service here, or no domain served. */
export async function readOffer(fetcher: Fetch = fetch): Promise<NameOffer | undefined> {
  try {
    const body = await answer(
      await fetcher(NAME_PATH, { headers: { accept: "application/json" } }),
    );
    const offer = Array.isArray(body?.offer)
      ? body.offer.filter((d): d is string => typeof d === "string" && d !== "")
      : [];
    if (!body || offer.length === 0) return;
    const first = typeof body.default === "string" && offer.includes(body.default);
    return {
      offer,
      default: first ? (body.default as string) : offer[0],
      current: typeof body.current === "string" && body.current ? body.current : null,
    };
  } catch {
    return;
  }
}

/** The one check call: free with its address, or the service's reason. */
export async function checkName(name: string, domain: string, fetcher: Fetch = fetch) {
  const query = new URLSearchParams({ name, domain });
  try {
    const body = await answer(
      await fetcher(`${NAME_PATH}?${query}`, { headers: { accept: "application/json" } }),
    );
    if (body?.free === true && typeof body.address === "string")
      return { free: true, address: body.address } satisfies NameCheck;
    return { why: why(body) ?? COULD_NOT } satisfies NameCheck;
  } catch {
    return { why: COULD_NOT } satisfies NameCheck;
  }
}

/** Set or change the name, or remove it. */
export async function saveName(
  change: { name: string; domain: string } | { remove: true },
  fetcher: Fetch = fetch,
): Promise<NameSaved> {
  const form = new URLSearchParams("remove" in change ? { remove: "1" } : change);
  try {
    const body = await answer(
      await fetcher(NAME_PATH, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      }),
    );
    if ("remove" in change && body?.removed === true) return { removed: true };
    if (!("remove" in change) && typeof body?.address === "string")
      return { address: body.address };
    return { why: why(body) ?? COULD_NOT };
  } catch {
    return { why: COULD_NOT };
  }
}

/** The name and domain of the address in use, when its domain is one offered here. */
export function splitAddress(address: string | null, offer: string[]) {
  if (!address) return;
  let host: string;
  try {
    host = new URL(address).hostname;
  } catch {
    return;
  }
  const domain = [...offer].sort((a, b) => b.length - a.length).find((d) => host.endsWith(`.${d}`));
  const name = domain ? host.slice(0, -domain.length - 1) : "";
  return domain && name && !name.includes(".") ? { name, domain } : undefined;
}
