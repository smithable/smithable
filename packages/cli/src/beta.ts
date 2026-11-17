import { readFileSync } from "node:fs";
import { join } from "node:path";
import { git } from "./git.js";

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

/**
 * The hosted service's saved release flow (Review, Staging, Production; the service's release page
 * is the authority, this is display only). `changed`: the project's HEAD is no longer the commit the
 * person reviewed, so the flow starts again from the review.
 */
export interface ReleaseProgress {
  url: string;
  reviewed: string | null;
  staging: "locked" | "todo" | "building" | "failed" | "ready" | "confirmed" | "replaced";
  production: "locked" | "todo" | "live";
  changed: boolean;
}
const STAGING = ["locked", "todo", "building", "failed", "ready", "confirmed", "replaced"] as const;
const PRODUCTION = ["locked", "todo", "live"] as const;

/** The release progress as the service writes it, checked field by field; none when not that shape. */
export function releaseOf(value: unknown, head: string | undefined): ReleaseProgress | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.url !== "string" || URL.parse(v.url)?.protocol !== "https:") return undefined;
  const reviewed =
    v.reviewed === null
      ? null
      : typeof v.reviewed === "string" && /^[0-9a-f]{40}$/.test(v.reviewed)
        ? v.reviewed
        : undefined;
  if (reviewed === undefined) return undefined;
  if (!STAGING.includes(v.staging as never) || !PRODUCTION.includes(v.production as never))
    return undefined;
  return {
    url: v.url,
    reviewed,
    staging: v.staging as ReleaseProgress["staging"],
    production: v.production as ReleaseProgress["production"],
    changed: reviewed !== null && head !== reviewed,
  };
}

export function readBeta(dir: string):
  | {
      until?: string;
      invite?: string;
      guide?: string;
      data?: "test" | "live";
      aup?: string;
      limit?: Limit;
      release?: ReleaseProgress;
    }
  | undefined {
  try {
    const value = JSON.parse(readFileSync(join(dir, BETA), "utf8")) as Record<string, unknown>;
    const text = (key: string) =>
      typeof value[key] === "string" ? { [key]: value[key] as string } : {};
    const data =
      value.data === "test" || value.data === "live" ? { data: value.data as "test" | "live" } : {};
    const limit = limitOf(value.limit);
    const head = value.release ? git(dir, ["rev-parse", "HEAD"]) : undefined;
    const release = releaseOf(value.release, head?.ok ? head.out.trim() : undefined);
    return {
      ...text("until"),
      ...text("invite"),
      ...text("guide"),
      ...data,
      ...text("aup"),
      ...(limit ? { limit } : {}),
      ...(release ? { release } : {}),
    };
  } catch {
    return undefined;
  }
}
