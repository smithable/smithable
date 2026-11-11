import { expect, test } from "vitest";
import selfHost from "../../../docs/site/self-host.md?raw";

// Every setting the app kit and the generated code read from the environment is in self-host.md's
// table (docs review 2026-11-11, 3.4): a setting added without a line there fails here.
const all: Record<string, string> = {
  ...import.meta.glob("../templates/**/*.{ts,tsx,mjs}", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  // The generator writes reads into generated code (process.env.HOST_PAGE_URL in a page).
  ...import.meta.glob("./**/*.ts", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
};
const sources = Object.fromEntries(
  Object.entries(all).filter(([path]) => !/\.(test|gen)\./.test(path)),
);

/** The names read: process.env.X, process.env["X"], { X, Y } = process.env, env.X where env is it. */
function readNames(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) names.add(m[1] ?? "");
  for (const m of text.matchAll(/process\.env\[\s*["'`]([A-Z][A-Z0-9_]*)["'`]\s*\]/g))
    names.add(m[1] ?? "");
  for (const m of text.matchAll(/\{([^{}]*)\}\s*=\s*process\.env\b/g))
    for (const k of (m[1] ?? "").matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) names.add(k[1] ?? "");
  if (/\benv[^=\n]*=\s*process\.env\b/.test(text))
    for (const m of text.matchAll(/(?<![\w.])env\.([A-Z][A-Z0-9_]*)/g)) names.add(m[1] ?? "");
  return [...names];
}

/** The table's settings; a name with <NAME> stands for its prefix (INCOMING_<NAME>_SECRET). */
const documented = [...selfHost.matchAll(/^\| (`[^|]+`) \|/gm)].flatMap((m) =>
  [...(m[1] ?? "").matchAll(/`([A-Z][A-Z0-9_]*(?:<[A-Z]+>[A-Z0-9_]*)?)`/g)].map((n) => n[1] ?? ""),
);
const listed = (name: string) =>
  documented.some((d) =>
    d.includes("<") ? name.startsWith(d.slice(0, d.indexOf("<"))) : d === name,
  );

test("every setting the app reads has a line in self-host.md's settings table", () => {
  const read = new Set(Object.values(sources).flatMap(readNames));
  expect(read.size).toBeGreaterThan(30);
  expect([...read].filter((n) => !listed(n)).sort()).toEqual([]);
});

test("the table lists no setting the app no longer reads", () => {
  const read = [...new Set(Object.values(sources).flatMap(readNames))];
  // Read by name in code the test cannot see as a read: the sign-in providers' settings (a map in
  // auth.ts), the outgoing targets' (built from the target's name in the kit).
  const other = /^(GOOGLE|FACEBOOK)_CLIENT_|^OUTGOING_</;
  const stale = documented.filter(
    (d) =>
      !other.test(d) &&
      !read.some((n) => (d.includes("<") ? n.startsWith(d.slice(0, d.indexOf("<"))) : n === d)),
  );
  expect(stale).toEqual([]);
});
