#!/usr/bin/env node
// The stack profile's pins against their packages' own advisory lists on GitHub
// (packages/cli/src/advisories.ts): the databases the scanners read list a new hole days later.
// Run every day by .github/workflows/stack-advisories.yml, and by hand before a release.
// Exit 1 when a pinned version has a published hole or a list could not be read. It also names
// the pins with a newer patch release, for the weekly bump (exit 0 for those).
// GITHUB_TOKEN (any token) lifts GitHub's sixty calls an hour. Node runs the .ts files as they are.
import { STACK_PROFILE } from "../packages/adapter-tanstack/src/stack.ts";
import { affected, newerPatch, readAdvisories } from "../packages/cli/src/advisories.ts";

const pins = {
  ...STACK_PROFILE.dependencies,
  ...STACK_PROFILE.markdown,
  ...STACK_PROFILE.fonts,
  ...STACK_PROFILE.devDependencies,
  ...STACK_PROFILE.overrides,
};
const accepted = STACK_PROFILE.advisories;
const read = await readAdvisories(pins, {
  token: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN,
});
const versions = new Map(Object.entries(pins).map(([name, version]) => [name, [version]]));
const findings = affected(
  versions,
  read.advisories.filter((a) => !(a.id in accepted)),
);
const lines = [
  `Stack profile ${STACK_PROFILE.id}: ${Object.keys(pins).length} pins against ${read.advisories.length} published advisories.`,
  ...findings.map((f) => `✗ ${f}`),
  ...read.unread.map((u) => `✗ ${u}: its list could not be read, so it was not checked`),
  ...read.advisories
    .filter((a) => a.id in accepted)
    .flatMap((a) =>
      affected(versions, [a]).map((f) => `accepted, since ${accepted[a.id]}: ${f.split(";")[0]}`),
    ),
];

// A newer patch release of a pin: often the fix, before anyone has written an advisory.
const behind = (
  await Promise.all(
    Object.entries(pins).map(async ([name, version]) => {
      try {
        const doc = await (
          await fetch(`https://registry.npmjs.org/${name}`, {
            headers: { Accept: "application/vnd.npm.install-v1+json" },
            signal: AbortSignal.timeout(20_000),
          })
        ).json();
        const newer = newerPatch(version, Object.keys(doc.versions ?? {}));
        return newer ? [`behind: ${name} ${version}, ${newer} is out`] : [];
      } catch {
        return [`behind: ${name} could not be looked up`];
      }
    }),
  )
).flat();

console.log([...lines, ...behind.sort()].join("\n"));
const failed = findings.length + read.unread.length;
console.log(
  failed
    ? `\n${failed} to deal with: move the pin to the fixed version (stack.ts), through the gate.`
    : "\nNo pinned version has a published hole.",
);
process.exit(failed ? 1 : 0);
