// Runs before a package is packed for npm (each package's "prepack"): the repository's LICENSE
// and NOTICE go into the package, and the CLI also takes the built Studio app (apps/studio/dist),
// which it serves from its own folder once installed (packages/cli/src/studio.ts).
import { cpSync, existsSync, rmSync } from "node:fs";
import { basename, join } from "node:path";

const repo = new URL("..", import.meta.url).pathname;
const here = process.cwd();
for (const file of ["LICENSE", "NOTICE"]) cpSync(join(repo, file), join(here, file));
if (basename(here) === "cli") {
  const studio = join(repo, "apps", "studio", "dist");
  if (!existsSync(join(studio, "index.html"))) {
    console.error("Build Studio first (pnpm build): apps/studio/dist is missing.");
    process.exit(1);
  }
  rmSync(join(here, "studio"), { recursive: true, force: true });
  cpSync(studio, join(here, "studio"), { recursive: true });
}
