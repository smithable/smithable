import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { tempDir } from "./test-dir.js";
import {
  approveAssetReviewCommand,
  assetReview,
  parseAssetManifest,
  WEBSITE_ASSETS,
  WEBSITE_PLACEHOLDER,
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

test("legacy exact SVG and current PNG placeholders remain reviewable without accepting other placeholder SVGs", () => {
  const dir = tempDir("website-legacy-placeholder-");
  mkdirSync(join(dir, "public/images/library"), { recursive: true });
  const legacy = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#e5e7eb"/><path d="M0 800 400 400 650 650 850 450 1200 800" fill="#cbd5e1"/></svg>',
  );
  expect(digest(legacy)).toBe("fbb13c3598e6338c49d6815deb0580cbb0f7de7946a83dd71084c7fea24db4af");
  const assets = (
    [
      [legacy, "svg"],
      [WEBSITE_PLACEHOLDER, "png"],
    ] as const
  ).map(([value, extension]) => {
    const bytes = value,
      sha256 = digest(bytes),
      path = `images/library/${sha256}.${extension}`;
    writeFileSync(join(dir, "public", path), bytes);
    return {
      path,
      sha256,
      source: { kind: "placeholder" as const },
      role: "hero",
      concept: false,
      factualPhotoReview: false,
    };
  });
  writeAssetManifest(dir, assets);
  expect(assetReview(dir)).toMatchObject({ approved: true, pending: [], diagnostics: [] });
  expect(WEBSITE_PLACEHOLDER.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  const other = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg"><script>not the placeholder</script></svg>',
  );
  expect(() =>
    parseAssetManifest({
      version: 1,
      assets: [
        { ...assets[0], path: `images/library/${digest(other)}.svg`, sha256: digest(other) },
      ],
    }),
  ).toThrow("classification");
  const old = assets[0];
  if (!old) throw new Error("Fixture");
  writeFileSync(join(dir, "public", old.path), other);
  expect(assetReview(dir).approved).toBe(false);
  expect(assetReview(dir).diagnostics.some((message) => message.includes("changed"))).toBe(true);
});

test("opaque sample and full raw original provenance retain the same factual review requirement", () => {
  for (const url of [
    "https://source.invalid/ref/123",
    "https://business.example/Alice-Example.jpg?person=Alice#portrait",
  ]) {
    const { dir, path } = project();
    const value = JSON.parse(readFileSync(join(dir, WEBSITE_ASSETS), "utf8"));
    value.assets[0].source.url = url;
    const parsed = parseAssetManifest(value);
    expect(parsed.assets[0]?.source.url).toBe(url);
    writeAssetManifest(dir, parsed.assets);
    const review = assetReview(dir);
    expect(review.diagnostics).toEqual([]);
    expect(review.pending).toHaveLength(1);
    expect(review.approved).toBe(false);
    expect(readFileSync(join(dir, "public", path))).toEqual(Buffer.from([255, 216, 255, 0]));
  }
});
