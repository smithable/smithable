// Real daemon + operation pipeline against a versioned local image library. No model calls.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { checkPorts } from "./ports.mjs";

const repo = resolve(import.meta.dirname, "..");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function pictureLibrary() {
  const imageFiles = [
    "working",
    "proud",
    "excited",
    "impatient",
    "pointing",
    "angry",
    "sad",
    "happy",
  ];
  const bytes = imageFiles.map((name) =>
    readFileSync(join(repo, `apps/studio/src/brand/smith/smith-${name}.webp`)),
  );
  const files = new Map();
  let latest = "v1",
    offline = false;
  const versions = {};
  const server = createServer((req, res) => {
    const path = new URL(req.url, "http://fixture").pathname;
    if (path === "/images/latest.json")
      return void res.end(JSON.stringify({ version: latest, index: `versions/${latest}.json` }));
    const version = path.match(/^\/images\/versions\/(v[12])\.json$/)?.[1];
    if (version) return void res.end(JSON.stringify(versions[version]));
    if (path === "/images/index.json")
      return void res.end(JSON.stringify(versions[latest].entries));
    const file = path.match(/^\/images\/files\/([a-f0-9]{64})\.webp$/)?.[1];
    if (file && files.has(file) && !offline) {
      res.setHeader("content-type", "image/webp");
      return void res.end(files.get(file));
    }
    res.writeHead(503);
    res.end("Fixture unavailable");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/images`;
  for (const [v, offset] of [
    ["v1", 0],
    ["v2", 2],
  ]) {
    const entries = [];
    for (const [index, subject] of ["cafe", "bicycle", "lamp"].entries()) {
      for (const [styleIndex, style] of ["lifelike", "pastel", "ink-wash"].entries()) {
        if (style === "ink-wash" && subject === "lamp") continue;
        const content = bytes[(index + styleIndex * 3 + offset) % bytes.length];
        const sha256 = hash(content);
        files.set(sha256, content);
        entries.push({
          id: `${subject}-${style}`,
          subject,
          style,
          kind: index === 0 ? "hero" : "sample",
          generated: true,
          sha256,
          url: `${base}/files/${sha256}.webp`,
          tags: [subject, "marketplace"],
          alt: `Fixture ${subject}`,
        });
      }
    }
    versions[v] = {
      version: v,
      entries,
      styles: ["lifelike", "pastel", "ink-wash"].map((id) => ({
        id,
        generated: true,
        words: {
          en: {
            name: id === "ink-wash" ? "Ink wash" : id === "pastel" ? "Pastel" : "Lifelike",
            line: `${id} fixture pictures`,
          },
        },
      })),
    };
  }
  return {
    base,
    versions,
    files,
    advance: () => {
      latest = "v2";
    },
    offline: (value) => {
      offline = value;
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

export async function checkPicturePicker(port = 5840) {
  checkPorts("Picture picker test", [port, port + 1]);
  const library = await pictureLibrary();
  const root = mkdtempSync(join(tmpdir(), "smithable-picture-picker-"));
  const dir = join(root, "app");
  const cli = join(repo, "packages/cli/dist/bin.js");
  const env = {
    ...process.env,
    XDG_CONFIG_HOME: join(root, "config"),
    XDG_CACHE_HOME: join(root, "cache"),
  };
  for (const key of Object.keys(env))
    if (
      /^(SMITHABLE_|ANTHROPIC_|OPENAI_|GOOGLE_|GEMINI_|MISTRAL_|AZURE_|AWS_|SMTP_|MAIL_)/.test(key)
    )
      delete env[key];
  env.SMITHABLE_IMAGE_LIBRARY = library.base;
  let server,
    browser,
    page,
    log = "";
  const paths = ["hero.webp", "samples/0.webp", "samples/1.webp"];
  const images = join(dir, "public/images");
  const expected = (version, style, at) =>
    library.versions[version].entries.find(
      (entry) => entry.subject === ["cafe", "bicycle", "lamp"][at] && entry.style === style,
    );
  try {
    execFileSync(
      process.execPath,
      [cli, "new", dir, "--starter", "marketplace", "--admin", "style-test@example.invalid"],
      { cwd: repo, env, stdio: "pipe", timeout: 120000 },
    );
    rmSync(images, { recursive: true, force: true });
    mkdirSync(join(images, "samples"), { recursive: true });
    const records = {};
    for (const [i, file] of paths.entries()) {
      const entry = expected("v1", "lifelike", i);
      writeFileSync(join(images, file), library.files.get(entry.sha256));
      records[file] = {
        entry: entry.id,
        style: entry.style,
        version: "v1",
        role: entry.kind,
        generated: true,
        sha256: entry.sha256,
      };
    }
    writeFileSync(join(images, "samples/owner.webp"), "Owner's own bytes");
    writeFileSync(join(images, "pictures.json"), JSON.stringify(records));
    for (const args of [
      ["config", "user.name", "Fixture"],
      ["config", "user.email", "fixture@example.invalid"],
      ["add", "-A"],
      ["commit", "-qm", "Fixture pictures"],
    ])
      execFileSync("git", args, { cwd: dir });
    const openingUx = readFileSync(join(dir, "smithable.ux.yml"), "utf8");
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
    const base = `http://localhost:${port}`;
    let ready = false;
    const until = Date.now() + 120000;
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
    if (!ready) throw new Error(log);
    browser = await chromium.launch();
    const open = async (automatic) => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      page = await context.newPage();
      await page.goto(automatic ? base : `${base}/?guide=off`);
      if (!automatic) await page.getByRole("button", { name: "Look", exact: true }).click();
      const picker = page.getByRole("dialog", { name: "Choose a look", exact: true });
      await picker.getByRole("button", { name: "Next: Pictures", exact: true }).waitFor();
      return { context, page, picker };
    };
    const requests = [];
    // Automatic: choices are only staged and Skip restores the opening theme.
    let opened = await open(true);
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/op") requests.push(request.postDataJSON());
    });
    const theme = opened.picker.locator('button[aria-pressed="false"]').first();
    const applied = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/op",
    );
    await theme.click();
    assert.ok((await (await applied).json()).ok);
    await page.waitForFunction(() => document.querySelector('.first-look[aria-busy="false"]'));
    await opened.picker.getByRole("button", { name: "Next: Pictures", exact: true }).click();
    const pastel = opened.picker.getByRole("button", { name: "Use Pastel pictures", exact: true });
    assert.equal(await pastel.locator("img").count(), 3);
    // The previews come through Studio (T951), so they load for a hosted owner too.
    await page.waitForFunction(() =>
      [...document.querySelectorAll('button[aria-label="Use Pastel pictures"] img')].every(
        (img) =>
          img.complete && img.naturalWidth > 0 && new URL(img.src).origin === location.origin,
      ),
    );
    assert.equal(
      await opened.picker
        .getByRole("button", { name: "Use Ink wash pictures", exact: true })
        .count(),
      0,
    );
    await pastel.getByText("1 of your own picture stays.", { exact: true }).waitFor();
    await pastel.click();
    assert.equal(requests.filter((r) => r.name === "setPictureStyle").length, 0);
    await opened.picker.getByRole("button", { name: "Skip", exact: true }).click();
    await opened.picker.waitFor({ state: "detached" });
    assert.equal(readFileSync(join(dir, "smithable.ux.yml"), "utf8"), openingUx);
    await opened.context.close();
    // The library advances after cards were read. Keep must use the shown v1 pictures once.
    opened = await open(true);
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/op") requests.push(request.postDataJSON());
    });
    await opened.picker.getByRole("button", { name: "Next: Pictures", exact: true }).click();
    await opened.picker.getByRole("button", { name: "Use Pastel pictures", exact: true }).click();
    library.advance();
    const response = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/op",
    );
    await opened.picker.getByRole("button", { name: "Keep this look", exact: true }).click();
    const kept = await (await response).json();
    assert.ok(kept.ok, kept.output);
    await opened.picker.waitFor({ state: "detached" });
    assert.equal(requests.filter((r) => r.name === "setPictureStyle").length, 1);
    for (const [i, file] of paths.entries())
      assert.equal(hash(readFileSync(join(images, file))), expected("v1", "pastel", i).sha256);
    assert.equal(readFileSync(join(images, "samples/owner.webp"), "utf8"), "Owner's own bytes");
    await opened.context.close();
    // Later Look applies a chosen style immediately, with no presentation or guide.
    opened = await open(false);
    await opened.picker.getByRole("button", { name: "Next: Pictures", exact: true }).click();
    const manual = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/op",
    );
    await opened.picker.getByRole("button", { name: "Use Lifelike pictures", exact: true }).click();
    const manualResult = await (await manual).json();
    assert.ok(manualResult.ok, manualResult.output);
    await opened.picker.waitFor({ state: "detached" });
    for (const [i, file] of paths.entries())
      assert.equal(hash(readFileSync(join(images, file))), expected("v2", "lifelike", i).sha256);
    assert.equal(await page.getByRole("dialog", { name: /^Smith presents / }).count(), 0);
    await opened.context.close();
    // A failed fetch changes no files and leaves Skip available.
    opened = await open(false);
    await opened.picker.getByRole("button", { name: "Next: Pictures", exact: true }).click();
    const before = paths.map((file) => hash(readFileSync(join(images, file))));
    const beforeUx = readFileSync(join(dir, "smithable.ux.yml"), "utf8");
    library.offline(true);
    const failed = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/op",
    );
    await opened.picker.getByRole("button", { name: "Use Pastel pictures", exact: true }).click();
    assert.equal((await (await failed).json()).ok, false);
    await opened.picker.getByRole("alert").waitFor();
    assert.deepEqual(
      paths.map((file) => hash(readFileSync(join(images, file)))),
      before,
    );
    assert.equal(readFileSync(join(dir, "smithable.ux.yml"), "utf8"), beforeUx);
    await opened.picker.getByRole("button", { name: "Skip", exact: true }).click();
    await opened.picker.waitFor({ state: "detached" });
    await opened.context.close();
    console.log(
      "  ✓ picture picker: complete app sets, staged Skip, one pinned-version Keep, owned pictures, manual choice and offline refusal",
    );
  } catch (error) {
    console.error(`Picture picker failed; fixture: ${root}`);
    if (process.env.FIRST_LOOK_EVIDENCE && page && !page.isClosed()) {
      mkdirSync(process.env.FIRST_LOOK_EVIDENCE, { recursive: true });
      await page
        .screenshot({ path: join(process.env.FIRST_LOOK_EVIDENCE, "picture-failure.png") })
        .catch(() => {});
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
    await library.close();
    if (process.env.FIRST_LOOK_EVIDENCE) {
      mkdirSync(process.env.FIRST_LOOK_EVIDENCE, { recursive: true });
      writeFileSync(join(process.env.FIRST_LOOK_EVIDENCE, "picture-server.log"), log);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await checkPicturePicker(Number(process.env.TEST_STUDIO_PORT ?? 5840));
