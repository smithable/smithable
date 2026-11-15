import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

test("review and publish keeps quiet states closed and exposes first-release, changed and unavailable evidence", {
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
      await page.locator("[data-review-launch]").click();
      const dialog = page.getByRole("dialog", { name: "Review and publish", exact: true });
      await dialog.locator('[data-review-part="access"]').waitFor();
      const count = Number((await dialog.locator("[data-review-count]").innerText()).split(" ")[0]);
      assert.equal(
        await page.locator("[data-review-launch]").innerText(),
        `Review and publish (${count})`,
      );
      return dialog;
    };
    const close = async (dialog) => {
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
    };
    const expand = async (dialog, id) => {
      const part = dialog.locator(`[data-review-part="${id}"]`);
      if ((await part.getAttribute("open")) === null)
        await part.locator(":scope > summary").click();
      return part;
    };
    let dialog = await open();
    await dialog.locator("[data-first-release]").waitFor();
    assert.equal(await dialog.locator("[data-review-count]").innerText(), "3 need a look");
    await dialog
      .getByRole("heading", { name: "Who can use the current app", exact: true })
      .waitFor();
    assert.match(await dialog.innerText(), /People sign in/);
    const comparison = dialog.locator('[data-review-part="migrations"]');
    assert.equal(await comparison.getAttribute("data-review-state"), "not-applicable");
    assert.equal(await comparison.getAttribute("open"), null);
    await comparison.locator(":scope > summary").focus();
    await page.keyboard.press("Enter");
    assert.notEqual(await comparison.getAttribute("open"), null);
    // Refreshing unchanged evidence preserves manual expansion and keyboard focus.
    let releaseReply;
    const held = new Promise((resolve) => {
      releaseReply = resolve;
    });
    let heldOnce = false;
    const hold = async (route) => {
      const first = !heldOnce;
      heldOnce = true;
      const response = await route.fetch();
      if (!first) return route.fulfill({ response });
      const previous = await response.json();
      await held;
      await route.fulfill({ json: { ...previous, currentAccess: ["STALE REVIEW RESPONSE"] } });
    };
    await page.route("**/api/release-review", hold);
    try {
      await comparison.locator(":scope > summary").focus();
      await Promise.all([
        page.waitForRequest((request) => new URL(request.url()).pathname === "/api/release-review"),
        page.evaluate(() => window.dispatchEvent(new Event("focus"))),
      ]);
      await dialog.getByRole("status").filter({ hasText: "Refreshing release evidence" }).waitFor();
      assert.notEqual(await comparison.getAttribute("open"), null);
      assert.equal(
        await comparison
          .locator(":scope > summary")
          .evaluate((node) => node === document.activeElement),
        true,
      );

      // A second, newer response wins even when the older focus refresh arrives last.
      await Promise.all([
        page.waitForResponse(
          (response) => new URL(response.url()).pathname === "/api/release-review",
        ),
        page.evaluate(() => window.dispatchEvent(new Event("focus"))),
      ]);
      await page.waitForFunction(
        () =>
          document
            .querySelector('dialog[aria-label="Review and publish"]')
            ?.getAttribute("aria-busy") !== "true",
      );
      const late = page.waitForResponse(
        (response) => new URL(response.url()).pathname === "/api/release-review",
      );
      releaseReply();
      await late;
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      assert.equal(await dialog.getByText("STALE REVIEW RESPONSE", { exact: true }).count(), 0);
    } finally {
      releaseReply();
      await page.unroute("**/api/release-review", hold);
    }
    await page.waitForFunction(
      () =>
        document
          .querySelector('dialog[aria-label="Review and publish"]')
          ?.getAttribute("aria-busy") !== "true",
    );
    assert.equal(
      await dialog.getByRole("link", { name: "Publish on your own server" }).getAttribute("href"),
      "https://docs.smithable.ai/self-host.html",
    );
    assert.equal(
      await page.getByRole("button", { name: "Release review", exact: true }).count(),
      0,
    );
    assert.equal(
      await page.getByRole("link", { name: "Publish and share", exact: true }).count(),
      0,
    );
    await expand(dialog, "recovery");
    await expand(dialog, "maintenance");
    await dialog
      .getByText("Release checks are not verified for the current project files.", { exact: true })
      .waitFor();
    assert.match(await dialog.innerText(), /Last verified restore: none recorded/);
    await dialog.locator('[data-review-part="maintenance"] > summary').waitFor();
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
        `import {beginDeployment,recordDeployment,recordChecks,projectRevision} from ${JSON.stringify(module)};const dir=${JSON.stringify(dir)};${code}`,
      ]);
    metadata(
      'recordDeployment(dir);recordChecks(dir,"release",[{what:"Synthetic fixture check",by:"fixture",ok:true,findings:[]}],projectRevision(dir));',
    );
    dialog = await open();
    for (const [id, state] of [
      ["access", "unchanged"],
      ["migrations", "unchanged"],
      ["checks", "fine"],
    ]) {
      const part = dialog.locator(`[data-review-part="${id}"]`);
      assert.equal(await part.getAttribute("data-review-state"), state);
      assert.equal(await part.getAttribute("open"), null);
      assert.match(await part.getAttribute("class"), /text-muted/);
    }
    assert.equal(await dialog.locator("[data-review-count]").innerText(), "2 need a look");
    await expand(dialog, "checks");
    await dialog
      .getByText("Release checks passed for the current project files.", { exact: true })
      .waitFor();
    await close(dialog);
    metadata("beginDeployment(dir);");
    dialog = await open();
    assert.equal(await dialog.locator("[data-first-release]").count(), 0);
    for (const id of ["access", "migrations"]) {
      const part = dialog.locator(`[data-review-part="${id}"]`);
      assert.equal(await part.getAttribute("data-review-state"), "needs-look");
      assert.notEqual(await part.getAttribute("open"), null);
    }
    await close(dialog);
    metadata("recordDeployment(dir);");
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
    for (const id of ["access", "migrations", "checks"]) {
      const part = dialog.locator(`[data-review-part="${id}"]`);
      assert.equal(await part.getAttribute("data-review-state"), "needs-look");
      assert.notEqual(await part.getAttribute("open"), null);
    }
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
    await page.locator("[data-review-launch]").click();
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
    await close(page.getByRole("dialog", { name: "Review and publish", exact: true }));
    await page.unroute("**/api/release-review");
    // Only the hosted link is a fixture; publishing is never called or represented as enforced.
    await page.route("**/api/project", async (route) => {
      const response = await route.fetch();
      const project = await response.json();
      await route.fulfill({
        json: { ...project, home: "https://example.invalid/projects/review-fixture" },
      });
    });
    await page.reload();
    dialog = await open();
    assert.equal(
      await dialog
        .getByRole("link", { name: "Continue to publishing", exact: true })
        .getAttribute("href"),
      "https://example.invalid/projects/review-fixture",
    );
    assert.equal(
      await dialog.getByRole("link", { name: "Publish on your own server", exact: true }).count(),
      0,
    );
    assert.equal(await dialog.getByRole("tab", { name: /staging|production/i }).count(), 0);
    console.log(
      "PASS quiet/fine/unchanged/first-release/needs-look states, count, keyboard expansion and hosted/local continuation; existing stale/refusal checks preserved; no actual release or enforced publishing sequence claimed",
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
