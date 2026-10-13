// Runs before a package is packed for npm (each package's "prepack"): the repository's LICENSE
// and NOTICE go into the package, and the CLI also takes the built Studio app (apps/studio/dist)
// and theme lab (apps/theme-lab/dist), which it serves from its own folders once installed
// (packages/cli/src/studio.ts, theme-lab.ts).
import { cpSync, existsSync, rmSync } from "node:fs";
import { basename, join } from "node:path";

const repo = new URL("..", import.meta.url).pathname;
const here = process.cwd();
for (const file of ["LICENSE", "NOTICE"]) cpSync(join(repo, file), join(here, file));
if (basename(here) === "cli") {
  for (const app of ["studio", "theme-lab"]) {
    const dist = join(repo, "apps", app, "dist");
    if (!existsSync(join(dist, "index.html"))) {
      console.error(`Build the apps first (pnpm build): apps/${app}/dist is missing.`);
      process.exit(1);
    }
    rmSync(join(here, app), { recursive: true, force: true });
    cpSync(dist, join(here, app), { recursive: true });
  }
}
