// The version a release publishes, stamped into every package and the CLI's VERSION before the
// build (the publish workflow runs it; nothing is committed): `node scripts/set-version.mjs 0.1.0`.
// The repository stays at 0.0.0, which generated apps record while Smithable is unreleased.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version ?? "")) {
  console.error("Give the version, like 0.1.0.");
  process.exit(2);
}
const repo = new URL("..", import.meta.url).pathname;
for (const name of readdirSync(join(repo, "packages"))) {
  const path = join(repo, "packages", name, "package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  pkg.version = version;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
}
const versionTs = join(repo, "packages", "cli", "src", "version.ts");
writeFileSync(
  versionTs,
  readFileSync(versionTs, "utf8").replace(/"\d+\.\d+\.\d+[^"]*"/, `"${version}"`),
);
console.log(`Every package is at ${version}.`);
