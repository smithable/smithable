import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The beta's facts, written by the hosted service (smith-first.md §8): `{ until?, invite, guide }`,
 * `until` when the project is a sandbox; and the service's state (legal-1.0 item 1.11), `data`:
 * "test" while only fictional data may be used (the service refuses mail and mailbox ingestion,
 * and an import refuses records from a file),
 * "live" once real data is allowed within the Acceptable Use Policy at `aup`. Read on every poll;
 * without it Smith says nothing of a beta. `limit`, when the account is at a limit of its level
 * (T761/T762): which one, the service's own words for it, the projects in the way and the address
 * of the account's apps overview, in the shape of the service's refusal.
 */
export const BETA = "data/.smithable/beta.json";

/** The beta file's facts, or none when it is missing or unreadable. */
export interface Limit {
  limit: "projects" | "published";
  message: string;
  blocking: { id: string; name: string }[];
  /** The account's apps overview: an absolute https address. */
  apps: string;
}

/** A limit as the service writes it, or none when it is not one in that shape. */
export function limitOf(value: unknown): Limit | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  if (v.limit !== "projects" && v.limit !== "published") return undefined;
  if (typeof v.message !== "string" || !v.message.trim() || v.message.length > 1000)
    return undefined;
  if (typeof v.apps !== "string" || URL.parse(v.apps)?.protocol !== "https:") return undefined;
  const blocking = Array.isArray(v.blocking)
    ? v.blocking.flatMap((b) =>
        b && typeof b.id === "string" && typeof b.name === "string"
          ? [{ id: b.id, name: b.name.slice(0, 200) }]
          : [],
      )
    : [];
  return { limit: v.limit, message: v.message.trim(), blocking, apps: v.apps };
}

export function readBeta(dir: string):
  | {
      until?: string;
      invite?: string;
      guide?: string;
      data?: "test" | "live";
      aup?: string;
      limit?: Limit;
    }
  | undefined {
  try {
    const value = JSON.parse(readFileSync(join(dir, BETA), "utf8")) as Record<string, unknown>;
    const text = (key: string) =>
      typeof value[key] === "string" ? { [key]: value[key] as string } : {};
    const data =
      value.data === "test" || value.data === "live" ? { data: value.data as "test" | "live" } : {};
    const limit = limitOf(value.limit);
    return {
      ...text("until"),
      ...text("invite"),
      ...text("guide"),
      ...data,
      ...text("aup"),
      ...(limit ? { limit } : {}),
    };
  } catch {
    return undefined;
  }
}
