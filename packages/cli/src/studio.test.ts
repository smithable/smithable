import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { changeDetail, pictureRefusal, refusal, studio, trace, unchangedEdit } from "./studio.js";
import { tempDir } from "./test-dir.js";
import { captureIo } from "./test-io.js";

test("locally, only this machine's own host names reach Studio", () => {
  expect(refusal({ host: "localhost:4321" }, undefined, undefined)).toBeUndefined();
  expect(refusal({ host: "[::1]:4321" }, undefined, undefined)).toBeUndefined();
  expect(refusal({ host: "evil.example:4321" }, undefined, undefined)?.status).toBe(403);
});

test("behind a proxy with a token, only requests carrying it reach Studio", () => {
  const behind = (headers: Record<string, string>) => refusal(headers, "0.0.0.0", "s3cret-token");
  expect(behind({ host: "ws-0123456789:4321" })?.status).toBe(401);
  expect(behind({ host: "x", "x-smithable-studio-token": "wrong-token!" })?.status).toBe(401);
  expect(behind({ host: "x", "x-smithable-studio-token": "s3cret-token" })).toBeUndefined();
});

test("a change needs Studio's header, JSON and no other site's origin", () => {
  const post = (headers: Record<string, string>, path = "/api/op") =>
    refusal({ host: "localhost:4321", ...headers }, undefined, undefined, "POST", path);
  const json = { "content-type": "application/json", "x-smithable": "1" };
  expect(post(json)).toBeUndefined();
  expect(post({ ...json, origin: "http://localhost:4321" })).toBeUndefined();
  expect(post({ ...json, origin: "https://evil.example" })?.status).toBe(403);
  expect(post({ "content-type": "text/plain" })?.status).toBe(403);
  expect(post({ "content-type": "application/json" })?.status).toBe(403);
  // Opening and closing an old version are changes like any other.
  for (const method of ["POST", "DELETE"]) {
    const at = (headers: Record<string, string>) =>
      refusal(
        { host: "localhost:4321", ...headers },
        undefined,
        undefined,
        method,
        "/api/old-version",
      );
    expect(at(json)).toBeUndefined();
    expect(at({ "content-type": "application/json" })?.status).toBe(403);
    expect(at({ ...json, origin: "https://evil.example" })?.status).toBe(403);
  }
  // MCP clients are not pages; a page on another site that calls /mcp is refused.
  expect(post({ "content-type": "application/json" }, "/mcp")).toBeUndefined();
  expect(
    post({ "content-type": "application/json", origin: "https://evil.example" }, "/mcp")?.status,
  ).toBe(403);
});

test("on the network, Studio does not start without a token unless told to run open", async () => {
  const saved = process.env.SMITHABLE_STUDIO_TOKEN;
  delete process.env.SMITHABLE_STUDIO_TOKEN;
  try {
    const io = captureIo();
    expect(await studio("/nonexistent", io, 4999, { host: "0.0.0.0" })).toBe(1);
    expect(io.stderr).toMatch(/without a token.*--insecure/s);
  } finally {
    if (saved !== undefined) process.env.SMITHABLE_STUDIO_TOKEN = saved;
  }
});

test("a crashed preview restarts at once a few times, then with a growing pause, never giving up", async () => {
  const { previewRestartDelay } = await import("./studio.js");
  expect([1, 2, 5].map(previewRestartDelay)).toEqual([1000, 1000, 1000]);
  expect([6, 7, 8, 9].map(previewRestartDelay)).toEqual([10_000, 20_000, 40_000, 80_000]);
  expect([10, 11, 50].map(previewRestartDelay)).toEqual([120_000, 120_000, 120_000]);
});

test("the trace has each change's id, the person's files it changed and a model's request; a change opens as its patch", () => {
  const dir = tempDir("smithable-trace-");
  const commit = (message: string, files: Record<string, string>) => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(dir, path, ".."), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    spawnSync("git", ["add", "-A"], { cwd: dir });
    spawnSync(
      "git",
      ["-c", "user.name=T", "-c", "user.email=t@t.invalid", "commit", "-qm", message],
      { cwd: dir },
    );
  };
  try {
    spawnSync("git", ["init", "-q"], { cwd: dir });
    commit("smithable: start of history", { "smithable.yml": "smithable: 0.1\n" });
    commit("smithable: Add field phone to Customer", {
      "smithable.yml": "smithable: 0.1\nmodels: {}\n",
      "src/generated/schema.ts": "export {};\n",
      "src/custom/actions/merge.ts": "export {};\n",
    });
    commit(
      'smithable: Add field website to Customer\n\nSmithable-AI: {"request":"customers need a website","tier":"frontier","model":"m","tokens":10,"cost":0.01}',
      { "smithable.yml": "smithable: 0.1\nmodels: { A: {} }\n" },
    );
    // An edit made in Code: the file before and after read as what it did.
    const was =
      "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Customer:\n    fields: { name: string! }\npages:\n  customers: { crud: Customer }\n";
    const is = was
      .replace("name: string!", "name: string!, phone: phone")
      .replace("name: Shop", "name: Store");
    commit("smithable: Edit smithable.yml", { "smithable.yml": was });
    commit(
      `smithable: Edit smithable.yml\n\nSmithable-Op: ${JSON.stringify({ op: "editSpec", args: { text: is } })}`,
      { "smithable.yml": is },
    );
    const [edited, , asked, added] = trace(dir);
    expect(edited?.description).toBe("Customers: added a phone; Edited the app");
    expect(asked).toMatchObject({ files: ["smithable.yml"], request: "customers need a website" });
    expect(added?.id).toMatch(/^[0-9a-f]{40}$/);
    expect(added?.files).toEqual(["smithable.yml", "src/custom/actions/merge.ts"]);
    expect(added?.rewritten).toEqual(["src/generated/schema.ts"]);
    expect(added?.request).toBeUndefined();
    const detail = changeDetail(dir, added?.id ?? "");
    expect(detail?.patch).toContain("+models: {}");
    expect(detail?.patch).not.toContain("src/generated");
    expect(detail?.generated).toBe(1);
    expect(detail?.before.spec).toBe("smithable: 0.1");
    expect(detail?.after.spec).toContain("models: {}");
    expect(changeDetail(dir, added?.id ?? "", true)?.patch).toContain("src/generated/schema.ts");
    expect(changeDetail(dir, "0".repeat(40))).toBeUndefined();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  // A real project's trace: seconds on a loaded machine, so not vitest's five.
}, 30_000);

test("a request's body is refused past its limit, before it is read in full", async () => {
  const { readJson, TooLarge } = await import("./studio.js");
  async function* parts(...chunks: string[]) {
    for (const c of chunks) yield Buffer.from(c);
  }
  expect(await readJson(parts('{"a":', "1}"), "6")).toEqual({ a: 1 });
  expect(await readJson(parts(), undefined)).toEqual({});
  // Its stated length alone is enough to refuse it.
  await expect(readJson(parts("{}"), "21000000")).rejects.toBeInstanceOf(TooLarge);
  // Without one, it stops once too much has come.
  let read = 0;
  async function* endless() {
    for (;;) {
      read++;
      yield Buffer.alloc(1000, 32);
    }
  }
  await expect(readJson(endless(), undefined, 10_000)).rejects.toBeInstanceOf(TooLarge);
  expect(read).toBeLessThanOrEqual(11);
});

test("the dev server's last word about a replaced app's modules is not the new app's log", async () => {
  const { oldAppEcho } = await import("./studio.js");
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = tempDir("echo-");
  mkdirSync(join(dir, "src", "generated"), { recursive: true });
  writeFileSync(join(dir, "src", "generated", "session.ts"), "");
  const line = (file: string) =>
    `11:14:00 PM [vite] (ssr) Failed to load url /src/generated/${file}?tss-serverfn-split (resolved id: /x). Does the file exist?`;
  const now = 1_000_000;
  // Just after a replacement, about a module that is gone: dropped.
  expect(oldAppEcho(line("item.ts"), dir, now - 2000, now)).toBe(true);
  // About a module the app has: kept, it is this app's own trouble.
  expect(oldAppEcho(line("session.ts"), dir, now - 2000, now)).toBe(false);
  // Long after, or with no replacement: kept.
  expect(oldAppEcho(line("item.ts"), dir, now - 60_000, now)).toBe(false);
  expect(oldAppEcho(line("item.ts"), dir, 0, now)).toBe(false);
  // Any other line: kept.
  expect(oldAppEcho("[vite] page reload src/routes/index.tsx", dir, now - 2000, now)).toBe(false);
});

test("an edit of a whole file that only formats it is no change; a different file or part is", () => {
  const dir = tempDir("smithable-unchanged-");
  writeFileSync(join(dir, "smithable.yml"), "smithable: 0.1\napp: { name: Shop }\n");
  const formatted = "smithable: 0.1\napp:\n  name: Shop\n";
  expect(unchangedEdit(dir, "editSpec", { text: formatted })).toBe(true);
  expect(unchangedEdit(dir, "editSpec", { text: formatted, file: "smithable.yml" })).toBe(true);
  expect(unchangedEdit(dir, "editSpec", { text: "smithable: 0.1\napp:\n  name: Store\n" })).toBe(
    false,
  );
  // A part, another file that is not there, or another operation: not this rule's.
  expect(unchangedEdit(dir, "editSpec", { path: ["app", "name"], value: "Shop" })).toBe(false);
  expect(unchangedEdit(dir, "editSpec", { text: "", file: "smithable.ux.yml" })).toBe(false);
  expect(unchangedEdit(dir, "addField", { text: formatted })).toBe(false);
  rmSync(dir, { recursive: true, force: true });
});

test("only the logo brings a picture with a change, so no upload replaces a picture that has smaller copies", () => {
  const webp = new Uint8Array([1, 2, 3]);
  expect(pictureRefusal("setLogo", "public/images/logo.webp", webp)).toBeUndefined();
  // A hero's file written over itself would keep its src, and with it the old picture's widths.
  expect(pictureRefusal("setText", "public/images/hero.webp", webp)).toMatch(/Only the logo/);
  expect(pictureRefusal("setLogo", "public/hero.webp", webp)).toMatch(/at most 2 MB/);
  expect(pictureRefusal("setLogo", "public/images/logo.webp", new Uint8Array())).toMatch(
    /at most 2 MB/,
  );
});

test("a section's picture comes as a new picture file named as its src", () => {
  const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const ok = (path: string, bytes: Uint8Array, there = false) =>
    pictureRefusal("setSectionPicture", path, bytes, { src: path.slice(7) }, () => there);
  expect(ok("public/images/hero-mine.webp", webp)).toBeUndefined();
  expect(ok("public/images/hero-mine.png", png)).toBeUndefined();
  expect(ok("public/images/hero-mine.jpg", jpeg)).toBeUndefined();
  // A file that is there (the library's hero, another section's) is never written over.
  expect(ok("public/images/hero.webp", webp, true)).toMatch(/already there/);
  // Its bytes must be a picture's, whatever its name says; no SVG, no folder, no other src.
  expect(ok("public/images/page.webp", new TextEncoder().encode("<html>"))).toMatch(/at most 2 MB/);
  expect(ok("public/images/mark.svg", webp)).toMatch(/at most 2 MB/);
  expect(ok("public/images/a/b.webp", webp)).toMatch(/at most 2 MB/);
  expect(ok("public/index.webp", webp)).toMatch(/at most 2 MB/);
  expect(
    pictureRefusal("setSectionPicture", "public/images/a.webp", webp, { src: "images/b.webp" }),
  ).toMatch(/at most 2 MB/);
});
