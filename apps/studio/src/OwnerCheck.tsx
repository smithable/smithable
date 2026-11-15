// The guide's one question about who the app is for (reports.md §3): the owner's address goes into
// `admins`, beside or instead of the builder's. Asked once per project in this browser.
import { parse } from "yaml";

/** The administrators an auth file names, without a starter's sample addresses. */
export function adminsOf(auth: string | undefined): string[] {
  let read: unknown;
  try {
    read = parse(auth ?? "");
  } catch {
    return [];
  }
  const admins = (read as { admins?: unknown } | null)?.admins;
  return Array.isArray(admins)
    ? admins.filter((a): a is string => typeof a === "string" && !a.endsWith(".example"))
    : [];
}
