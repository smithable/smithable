import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { tempDir } from "./test-dir.js";
import {
  approveAssetReviewCommand,
  assetReview,
  WEBSITE_ASSETS,
  writeAssetManifest,
} from "./website-assets.js";
import { digest } from "./website-input.js";

const quiet = { out: () => {}, err: () => {} };
function project() {
  const dir = tempDir("website-assets-"),
    bytes = Buffer.from([255, 216, 255, 0]),
    sha256 = digest(bytes),
    path = `images/originals/${sha256}.jpg`;
  mkdirSync(join(dir, "public/images/originals"), { recursive: true });
  writeFileSync(join(dir, "public", path), bytes);
  writeFileSync(join(dir, "smithable.content.yml"), "smithableContent: 0.1\n");
  writeAssetManifest(dir, [
    {
      path,
      sha256,
      source: {
        kind: "original",
        url: "https://example.test/photo.jpg",
        authorizationId: "auth-1",
      },
      role: "hero",
      concept: false,
      factualPhotoReview: true,
    },
  ]);
  return { dir, path };
}
test("publication review binds actual image bytes and presentation; stale approvals refuse", () => {
  const { dir, path } = project();
  const before = assetReview(dir);
  expect(before.approved).toBe(false);
  expect(before.pending).toHaveLength(1);
  expect(approveAssetReviewCommand(dir, before.manifestDigest, quiet)).toBe(0);
  expect(assetReview(dir).approved).toBe(true);
  writeFileSync(join(dir, "smithable.content.yml"), "smithableContent: 0.1\npages: {}\n");
  expect(assetReview(dir).approved).toBe(false);
  expect(approveAssetReviewCommand(dir, before.manifestDigest, quiet)).toBe(1);
  writeFileSync(join(dir, "public", path), "changed");
  expect(assetReview(dir).diagnostics.length).toBeGreaterThan(0);
});
test("missing provenance and symlinked images fail closed; empty ordinary projects remain valid", () => {
  const { dir } = project();
  rmSync(join(dir, WEBSITE_ASSETS));
  expect(assetReview(dir).approved).toBe(false);
  const other = project();
  const target = join(other.dir, "elsewhere");
  writeFileSync(target, "outside");
  rmSync(join(other.dir, "public", other.path));
  symlinkSync(target, join(other.dir, "public", other.path));
  expect(assetReview(other.dir).approved).toBe(false);
  expect(readFileSync(target, "utf8")).toBe("outside");
  expect(assetReview(tempDir("website-empty-")).approved).toBe(true);
});
test("project content cannot simply turn off factual review classification", () => {
  const { dir } = project();
  const value = JSON.parse(readFileSync(join(dir, WEBSITE_ASSETS), "utf8"));
  value.assets[0].factualPhotoReview = false;
  writeFileSync(join(dir, WEBSITE_ASSETS), JSON.stringify(value));
  expect(assetReview(dir).approved).toBe(false);
});

test("a photograph cannot evade review by being relabelled as a logo or placeholder", () => {
  const { dir } = project();
  const value = JSON.parse(readFileSync(join(dir, WEBSITE_ASSETS), "utf8"));
  value.assets[0].role = "logo";
  value.assets[0].factualPhotoReview = false;
  writeFileSync(join(dir, WEBSITE_ASSETS), JSON.stringify(value));
  expect(assetReview(dir).approved).toBe(false);
});
test("localized external image references have no provenance", () => {
  const { dir } = project();
  writeFileSync(
    join(dir, "smithable.content.en-US.yml"),
    'pages: {home: {hero: {image: {src: "https://other.example/photo.jpg"}}}}',
  );
  expect(assetReview(dir).diagnostics.join(" ")).toContain("no reviewed provenance");
});

test("special asset files fail without blocking", () => {
  const { dir, path } = project();
  rmSync(join(dir, "public", path));
  execFileSync("mkfifo", [join(dir, "public", path)]);
  expect(assetReview(dir).diagnostics.join(" ")).toContain("missing or unsafe");
});
