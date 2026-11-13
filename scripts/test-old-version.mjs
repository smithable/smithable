// An old version as a copy (docs/design/old-version-preview.md §5), end to end on a real app:
// opens the version before the newest change, checks it is the app as it was (and its data then),
// signs in to it as a role in a browser (its development sign-in) and opens a signed-in page, checks
// its session is not one localhost (the preview) shares, closes it, and checks the project's data,
// worktrees and folders are as before. Prints how long opening took.
//   node scripts/test-old-version.mjs <app made by smithable new, with sign-in and two changes>
// Not part of check: it installs packages and starts a dev server and a browser.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { repo } from "./dev-app.mjs";

const { openOldVersion, closeOldVersion, openVersion } = await import(
  join(repo, "packages/cli/dist/old-version.js")
);
const dir = process.argv[2];
if (!dir) throw new Error("Name an app folder with at least two changes.");
const data = () => {
  const hash = createHash("sha256");
  hash.update(readFileSync(join(dir, "data", "db", "app.db")));
  const snapshots = join(dir, "data", ".smithable", "snapshots");
  for (const f of existsSync(snapshots) ? readdirSync(snapshots).sort() : [])
    hash.update(readFileSync(join(snapshots, f)));
  return hash.digest("hex");
};
const worktrees = () => execFileSync("git", ["worktree", "list"], { cwd: dir }).toString();
const before = { data: data(), worktrees: worktrees() };
const started = Date.now();
const open = await openOldVersion(dir, "HEAD~1", { log: () => {} });
console.log(
  `opened ${open.commit.slice(0, 8)} with ${open.data === "then" ? "the data from then" : "samples"} in ${Math.round((Date.now() - started) / 1000)} s`,
);
let page;
for (let i = 0; i < 120 && !page; i++) {
  try {
    const answer = await fetch(`${open.url}/`, {
      signal: AbortSignal.timeout(30000),
    });
    if (answer.status < 500) page = answer.status;
  } catch {}
  if (!page) await new Promise((r) => setTimeout(r, 1000));
}
if (!page) throw new Error("the old version did not answer");
console.log(`the old version answers ${page} at ${open.url}`);
if (!open.url.startsWith("http://127.0.0.1:"))
  throw new Error("the copy is not on its own host name");
// Signed in as the first role the sign-in page offers, then a page that needs signing in.
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const tab = await context.newPage();
  let signedIn = false;
  for (let attempt = 1; attempt <= 3 && !signedIn; attempt++) {
    await tab.goto(`${open.url}/sign-in`, { waitUntil: "networkidle" });
    const as = tab.getByRole("button", { name: /^Sign in as / }).first();
    const role = (await as.textContent())?.replace(/^Sign in as /, "");
    await as.click();
    try {
      await tab.waitForURL((url) => url.pathname !== "/sign-in", { timeout: 15000 });
      signedIn = true;
      console.log(`signed in to the copy as ${role}`);
    } catch {}
  }
  if (!signedIn) throw new Error("signing in to the copy failed");
  // The page signing in led to, opened again: a session that was not kept sends one back to sign in.
  const landed = tab.url();
  await tab.goto(landed, { waitUntil: "networkidle" });
  if (new URL(tab.url()).pathname === "/sign-in") throw new Error("the copy forgot the session");
  console.log("a signed-in page opens in the copy");
  // Its cookies belong to 127.0.0.1: localhost (the preview, on any port) never gets them.
  const shared = await context.cookies(`http://localhost:${open.port}`);
  if (shared.length)
    throw new Error(`localhost shares the copy's cookies: ${shared.map((c) => c.name)}`);
  if (!(await context.cookies(open.url)).length) throw new Error("the copy set no cookie");
  console.log("its session is not localhost's, so the preview keeps its own");
} finally {
  await browser.close();
}
closeOldVersion(dir);
await new Promise((r) => setTimeout(r, 3000));
if (openVersion(dir)) throw new Error("the record is still there");
if (existsSync(open.folder) || existsSync(open.home))
  throw new Error("the copy's folders are still there");
if (data() !== before.data) throw new Error("the project's data changed");
if (worktrees() !== before.worktrees) throw new Error("Git lists another worktree");
console.log("closed: the project's data, worktrees and folders are as before");
process.exit(0);
