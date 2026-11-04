import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

test("release review shows unknown, passed, stale, widening, loss and unavailable evidence", {
  timeout: 240000,
}, async () => {
  const repo = resolve(import.meta.dirname, "..");
  const root = mkdtempSync(join(tmpdir(), "smithable-release-review-")),
    dir = join(root, "app"),
    cli = join(repo, "packages/cli/dist/bin.js");
  const run = (command, args, cwd = repo) =>
    execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      timeout: 120000,
      maxBuffer: 16 * 1024 * 1024,
    });
  const socket = createServer();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const base = `http://localhost:${port}`;
  let server,
    browser,
    log = "";
  try {
    run(process.execPath, [cli, "new", dir, "--starter", "crm"]);
    run(process.execPath, [cli, "op", "addField", "Customer", "releaseMemo", "text", "--dir", dir]);
    const env = { ...process.env };
    for (const key of Object.keys(env))
      if (/^(SMITHABLE_|ANTHROPIC_|OPENAI_|GOOGLE_|GEMINI_|MISTRAL_|AZURE_|AWS_)/.test(key))
        delete env[key];
    server = spawn(process.execPath, [cli, "studio", dir, "--port", String(port)], {
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (const stream of [server.stdout, server.stderr])
      stream.on("data", (chunk) => {
        log = (log + chunk).slice(-15000);
      });
    const deadline = Date.now() + 60000;
    for (;;) {
      try {
        if ((await fetch(`${base}/api/project`, { signal: AbortSignal.timeout(1000) })).ok) break;
      } catch {}
      if (server.exitCode !== null || Date.now() > deadline)
        throw Error(`Studio failed to start: ${log}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${base}/?guide=off`);
    const open = async () => {
      await page.getByRole("button", { name: "Release review", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Release review", exact: true });
      await dialog.getByRole("heading", { name: "Recovery", exact: true }).waitFor();
      return dialog;
    };
    const close = async (dialog) => {
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
    };
    let dialog = await open();
    await dialog
      .getByText(
        "No valid local deployment baseline is recorded. Review the current access map before publishing.",
        { exact: true },
      )
      .waitFor();
    await dialog
      .getByText("Release checks are not verified for the current project files.", { exact: true })
      .waitFor();
    assert.match(await dialog.innerText(), /Last verified restore: none recorded/);
    await dialog.getByRole("heading", { name: "Maintenance", exact: true }).waitFor();
    assert.match(
      await dialog.innerText(),
      /Deployed apps keep their generated code until updated and released/,
    );
    for (const name of ["Editor undo", "Code rollback", "Data restore"])
      await dialog.getByText(name, { exact: true }).waitFor();
    assert.match(
      await dialog.innerText(),
      /Records and uploads added after that snapshot may be lost/,
    );
    await close(dialog);
    // Exercise real local fast checks; they must not be presented as Release coverage.
    run(process.execPath, [cli, "security", dir, "--level", "fast"]);
    dialog = await open();
    await dialog.getByText("Type check: passed", { exact: true }).waitFor();
    await dialog.getByText("Tests: passed", { exact: true }).waitFor();
    await dialog
      .getByText("Release checks are not verified for the current project files.", { exact: true })
      .waitFor();
    await close(dialog);
    const module = pathToFileURL(join(repo, "packages/cli/dist/release-review.js")).href;
    const metadata = (code) =>
      run(process.execPath, [
        "--input-type=module",
        "-e",
        `import {recordDeployment,recordChecks,projectRevision} from ${JSON.stringify(module)};const dir=${JSON.stringify(dir)};${code}`,
      ]);
    metadata(
      'recordDeployment(dir);recordChecks(dir,"release",[{what:"Synthetic fixture check",by:"fixture",ok:true,findings:[]}],projectRevision(dir));',
    );
    dialog = await open();
    await dialog
      .getByText("Release checks passed for the current project files.", { exact: true })
      .waitFor();
    await close(dialog);
    metadata(
      'const fs=await import("node:fs");fs.writeFileSync(dir+"/data/.smithable/release-review/writer.lock","interrupted fixture");',
    );
    dialog = await open();
    await dialog
      .getByText("Release checks are not verified for the current project files.", { exact: true })
      .waitFor();
    assert.match(await dialog.innerText(), /writer was interrupted/);
    await close(dialog);
    metadata(
      'const fs=await import("node:fs");fs.unlinkSync(dir+"/data/.smithable/release-review/writer.lock");',
    );
    run(process.execPath, [
      cli,
      "op",
      "setPublic",
      "--pages",
      "customers",
      "--read",
      "Customer",
      "--dir",
      dir,
    ]);
    run(process.execPath, [
      cli,
      "op",
      "removeField",
      "Customer",
      "releaseMemo",
      "--yes",
      "--dir",
      dir,
    ]);
    dialog = await open();
    await dialog.getByText("Customer read: public access added", { exact: true }).waitFor();
    await dialog
      .getByText("Removed stored field Customer.releaseMemo; its values may be lost.", {
        exact: true,
      })
      .waitFor();
    await dialog
      .getByText("Release checks are not verified for the current project files.", { exact: true })
      .waitFor();
    await close(dialog);
    metadata(
      'recordChecks(dir,"release",[{what:"Incomplete fixture check",by:"fixture",ok:true,checked:false,findings:[]}],projectRevision(dir));',
    );
    dialog = await open();
    await dialog.getByText("Incomplete fixture check: not checked", { exact: true }).waitFor();
    assert.equal(
      await dialog
        .getByText("Release checks passed for the current project files.", { exact: true })
        .count(),
      0,
    );
    await close(dialog);
    await page.route("**/api/release-review", (route) =>
      route.fulfill({ status: 500, body: "fixture unavailable" }),
    );
    await page.getByRole("button", { name: "Release review", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "The release review could not be read" })
      .waitFor();
    assert.equal(
      await page
        .getByText("Release checks passed for the current project files.", { exact: true })
        .count(),
      0,
    );
    console.log(
      "PASS synthetic release evidence and real Studio UI states; no actual release checks or deployment claimed",
    );
  } finally {
    await browser?.close();
    if (server?.pid) {
      const exited = new Promise((resolve) => server.once("exit", resolve));
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {}
      if (server.exitCode === null)
        await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
      try {
        process.kill(-server.pid, "SIGKILL");
      } catch {}
    }
    rmSync(root, { recursive: true, force: true });
  }
});
