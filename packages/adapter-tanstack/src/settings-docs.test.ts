import { expect, test } from "vitest";
import selfHost from "../../../docs/site/self-host.md?raw";

// Every setting the app kit and the generated code read from the environment is in self-host.md's
// table (docs review 2026-11-11, 3.4): a setting added without a line there fails here.
const all: Record<string, string> = {
  ...import.meta.glob("../templates/**/*.{ts,tsx,js,jsx,mjs,cjs}", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  // The generator writes reads into generated code (process.env.HOST_PAGE_URL in a page).
  ...import.meta.glob("./**/*.{ts,tsx,js,mjs}", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
};
const sources = Object.fromEntries(
  Object.entries(all).filter(([path]) => !/\.(test|gen)\./.test(path)),
);

/**
 * The names read: process.env.X, process.env["X"], { X, Y } = process.env, env.X where env is it.
 * A name made in a template literal (process.env.INCOMING_${…}_ADDRESS) is read as INCOMING_<>_ADDRESS.
 */
function readNames(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)(\$\{[^}]*\}([A-Z0-9_]*))?/g))
    names.add(m[2] ? `${m[1]}<>${m[3]}` : (m[1] ?? ""));
  for (const m of text.matchAll(/process\.env\[\s*["'`]([A-Z][A-Z0-9_]*)["'`]\s*\]/g))
    names.add(m[1] ?? "");
  for (const m of text.matchAll(/\{([^{}]*)\}\s*=\s*process\.env\b/g))
    for (const k of (m[1] ?? "").matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) names.add(k[1] ?? "");
  if (/\benv[^=\n]*=\s*process\.env\b/.test(text))
    for (const m of text.matchAll(/(?<![\w.])env\.([A-Z][A-Z0-9_]*)/g)) names.add(m[1] ?? "");
  return [...names];
}

/** The table's settings, a row's name with <NAME> as <> (INCOMING_<NAME>_SECRET is INCOMING_<>_SECRET). */
const documented = [...selfHost.matchAll(/^\| (`[^|]+`) \|/gm)].flatMap((m) =>
  [...(m[1] ?? "").matchAll(/`([A-Z][A-Z0-9_]*(?:<[A-Z]+>[A-Z0-9_]*)?)`/g)].map((n) =>
    (n[1] ?? "").replace(/<[A-Z]+>/, "<>"),
  ),
);
const read = () => new Set(Object.values(sources).flatMap(readNames));

test("every setting the app reads has a line in self-host.md's settings table", () => {
  const names = read();
  expect(names.size).toBeGreaterThan(30);
  expect([...names].filter((n) => !documented.includes(n)).sort()).toEqual([]);
});

test("the table lists no setting the app no longer reads", () => {
  const names = read();
  // Names the code builds before it reads them, which the reads above cannot see: the sign-in
  // providers' (a map in auth.ts), an incoming entry's secret (incomingSecret in incoming.ts) and
  // an outgoing target's (targetSettings in the kit's outgoing.ts).
  const built = /^(GOOGLE|FACEBOOK)_CLIENT_|^INCOMING_<>_SECRET$|^OUTGOING_<>/;
  expect(documented.filter((d) => !built.test(d) && !names.has(d))).toEqual([]);
});
