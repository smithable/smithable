import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The beta's facts, written by the hosted service (smith-first.md §8): `{ until?, invite, guide }`,
 * `until` when the project is a sandbox; and the service's state (legal-1.0 item 1.11), `data`:
 * "test" while only fictional data may be used (the service refuses mail and mailbox ingestion,
 * and an import refuses records from a file),
 * "live" once real data is allowed within the Acceptable Use Policy at `aup`. Read on every poll;
 * without it Smith says nothing of a beta.
 */
export const BETA = "data/.smithable/beta.json";

/** The beta file's facts, or none when it is missing or unreadable. */
export function readBeta(
  dir: string,
):
  | { until?: string; invite?: string; guide?: string; data?: "test" | "live"; aup?: string }
  | undefined {
  try {
    const value = JSON.parse(readFileSync(join(dir, BETA), "utf8")) as Record<string, unknown>;
    const text = (key: string) =>
      typeof value[key] === "string" ? { [key]: value[key] as string } : {};
    const data =
      value.data === "test" || value.data === "live" ? { data: value.data as "test" | "live" } : {};
    return { ...text("until"), ...text("invite"), ...text("guide"), ...data, ...text("aup") };
  } catch {
    return undefined;
  }
}
