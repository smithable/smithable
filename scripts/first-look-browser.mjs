// A focused real-daemon check, also included in test-studio.mjs. No model is configured.
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { checkFirstLook } from "./first-look-checks.mjs";
import { checkPorts } from "./ports.mjs";
import { checkStudioSelection } from "./studio-selection-checks.mjs";
import { checkStudioSmoke } from "./studio-smoke-checks.mjs";

const repo = resolve(import.meta.dirname, "..");
const smoke = process.argv.includes("--smoke");
const selection = process.argv.includes("--selection");
const root = mkdtempSync(
  join(tmpdir(), smoke ? "smithable-studio-smoke-" : "smithable-first-look-"),
);
const dir = join(root, "crm");
const cli = join(repo, "packages/cli/dist/bin.js");
const port = Number(process.env.TEST_STUDIO_PORT ?? 5820);
checkPorts(smoke ? "Studio smoke test" : "First look browser test", [port, port + 1]);
const base = `http://localhost:${port}`;
const env = { ...process.env, XDG_CONFIG_HOME: join(root, "config") };
for (const key of Object.keys(env))
  if (/^(SMITHABLE_|ANTHROPIC_|OPENAI_|GOOGLE_|GEMINI_|MISTRAL_|AZURE_|AWS_|SMTP_|MAIL_)/.test(key))
    delete env[key];
let server,
  browser,
  log = "";
try {
  execFileSync(
    process.execPath,
    [
      cli,
      "new",
      dir,
      "--starter",
      selection ? "booking" : "crm",
      "--admin",
      "studio-test@example.invalid",
    ],
    { cwd: repo, env, stdio: "pipe", timeout: 120000 },
  );
  server = spawn(process.execPath, [cli, "studio", dir, "--port", String(port)], {
    cwd: repo,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (data) => {
      log = (log + data).slice(-30000);
    });
  const until = Date.now() + 120000;
  let ready = false;
  while (Date.now() < until) {
    try {
      if ((await fetch(`${base}/api/project`, { signal: AbortSignal.timeout(1000) })).ok) {
        ready = true;
        break;
      }
    } catch {}
    if (server.exitCode !== null) throw new Error(log);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error(`Studio startup timeout: ${log}`);
  browser = await chromium.launch();
  // The picker opens only for an app as made (T1163): each smoke run after the first starts from
  // the app's history as it was when Studio was ready.
  const made = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const asMade = () => {
    execFileSync("git", ["-C", dir, "reset", "-q", "--hard", made]);
    execFileSync("git", ["-C", dir, "clean", "-fdq"]);
  };
  if (smoke) await checkStudioSmoke(browser, base, root, asMade);
  else if (selection) await checkStudioSelection(browser, base);
  else await checkFirstLook(browser, base);
} catch (error) {
  if (smoke) {
    writeFileSync(join(root, "server.log"), log);
    // What the preview said: its dev server's and its tools' lines, which Studio keeps.
    try {
      const logs = await (
        await fetch(`${base}/api/logs`, { signal: AbortSignal.timeout(5000) })
      ).json();
      writeFileSync(
        join(root, "server.log"),
        `${log}\n--- preview ---\n${JSON.stringify(logs, null, 1)}`,
      );
    } catch {}
    // The app's routes as the dev server sees them (a preview that answers 404 everywhere).
    try {
      const routes = execFileSync("ls", ["-la", join(dir, "src", "routes")], { encoding: "utf8" });
      const tree = execFileSync("grep", ["-c", "health", join(dir, "src", "routeTree.gen.ts")], {
        encoding: "utf8",
      });
      const status = execFileSync("git", ["-C", dir, "status", "--short"], { encoding: "utf8" });
      appendFileSync(
        join(root, "server.log"),
        `${routes}\nhealth in routeTree: ${tree}\n${status}`,
      );
    } catch (e) {
      appendFileSync(join(root, "server.log"), String(e));
    }
    console.error(`Studio smoke evidence: ${root}`);
  }
  throw error;
} finally {
  await browser?.close();
  if (server?.pid && server.exitCode === null) {
    const ended = new Promise((resolve) => server.once("exit", resolve));
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {}
    await Promise.race([ended, new Promise((resolve) => setTimeout(resolve, 5000))]);
    try {
      process.kill(-server.pid, "SIGKILL");
    } catch {}
  }
  if (process.env.FIRST_LOOK_EVIDENCE) {
    mkdirSync(process.env.FIRST_LOOK_EVIDENCE, { recursive: true });
    writeFileSync(join(process.env.FIRST_LOOK_EVIDENCE, "server.log"), log);
  }
}
