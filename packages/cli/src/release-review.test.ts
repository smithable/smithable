import {
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { git } from "./git.js";
import {
  beginChecks,
  beginDeployment,
  deploymentSnapshot,
  projectRevision,
  recordChecks,
  recordDeployment,
  releaseReview,
  writerLock,
} from "./release-review.js";
import { tempDir } from "./test-dir.js";

const spec = `smithable: 0.1
app: { name: Review fixture }
models:
  Note:
    fields: { title: string!, body: text }
pages:
  notes: { crud: Note }
`;
const auth =
  "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles: { admin: all, member: { pages: all, create: all } }\n";
function fixture() {
  const dir = tempDir("release-review-");
  writeFileSync(join(dir, "smithable.yml"), spec);
  writeFileSync(join(dir, "smithable.auth.yml"), auth);
  writeFileSync(join(dir, ".gitignore"), "data/\n");
  expect(git(dir, ["init", "-q"]).ok).toBe(true);
  return dir;
}
test("unknown baseline and copies never become verified recovery or passed checks", () => {
  const dir = fixture();
  mkdirSync(join(dir, "data/backups"), { recursive: true });
  writeFileSync(join(dir, "data/backups/copy.db"), "not recovery proof");
  const review = releaseReview(dir);
  expect(review.comparison).toBe("unavailable");
  expect(review.checks).toBeUndefined();
  expect(review.verifiedRestore).toBeUndefined();
});
test("check evidence is tied to source, preserves incomplete outcomes and excludes secret findings", () => {
  const dir = fixture(),
    revision = projectRevision(dir);
  expect(revision).toMatch(/^[a-f0-9]{64}$/);
  recordChecks(
    dir,
    "release",
    [
      {
        what: "Source check",
        by: "fixture",
        ok: true,
        findings: ["synthetic-secret-never-export"],
      },
    ],
    revision,
  );
  expect(releaseReview(dir).checks?.current).toBe(true);
  expect(
    readFileSync(join(dir, "data/.smithable/release-review/checks.json"), "utf8"),
  ).not.toContain("synthetic-secret");
  expect(statSync(join(dir, "data/.smithable/release-review/checks.json")).mode & 0o777).toBe(
    0o600,
  );
  writeFileSync(join(dir, "custom.ts"), "export const changed=true;");
  expect(releaseReview(dir).checks?.current).toBe(false);
  recordChecks(
    dir,
    "release",
    [{ what: "Not finished", by: "fixture", ok: true, checked: false, findings: [] }],
    projectRevision(dir),
  );
  expect(releaseReview(dir).checks?.results[0]?.checked).toBe(false);
});
test("core access comparison exposes public widening and removed stored values", () => {
  const dir = fixture();
  recordDeployment(dir);
  writeFileSync(
    join(dir, "smithable.auth.yml"),
    `${auth}public: { pages: [notes], read: [Note] }\n`,
  );
  writeFileSync(join(dir, "smithable.yml"), spec.replace(", body: text", ""));
  const review = releaseReview(dir);
  expect(review.comparison).toBe("available");
  expect(review.access).toContain("Note read: public access added");
  expect(review.access).toContain("Page notes: public access added");
  expect(review.migrations).toContain("Removed stored field Note.body; its values may be lost.");
  expect(review.verifiedRestore).toBeUndefined();
});
test("an old or unknown source revision cannot be relabelled as a checked current revision", () => {
  const dir = fixture(),
    revision = projectRevision(dir);
  writeFileSync(join(dir, "custom.ts"), "different while checks run");
  const results = [{ what: "Tests", by: "fixture", ok: true, findings: [] }];
  recordChecks(dir, "release", results, revision);
  expect(releaseReview(dir).checks?.current).toBe(false);
  recordChecks(dir, "release", results, undefined);
  expect(releaseReview(dir).checks?.current).toBe(false);
});

test("binary file boundaries and unsupported source links cannot forge a checked revision", () => {
  const dir = fixture();
  writeFileSync(join(dir, "a"), Buffer.from("x\0b\0y"));
  const before = projectRevision(dir);
  writeFileSync(join(dir, "a"), "x");
  writeFileSync(join(dir, "b"), "y");
  expect(projectRevision(dir)).not.toBe(before);
  const target = join(tempDir("release-link-"), "target.ts");
  writeFileSync(target, "synthetic");
  symlinkSync(target, join(dir, "link.ts"));
  expect(projectRevision(dir)).toBeUndefined();
});

test("an older check run and deployment metadata cannot revive a pending green result", () => {
  const dir = fixture(),
    revision = projectRevision(dir),
    old = beginChecks(dir, "release", revision);
  const current = beginChecks(dir, "release", revision);
  recordDeployment(dir);
  expect(
    recordChecks(
      dir,
      "release",
      [{ what: "Old", by: "fixture", ok: true, findings: [] }],
      revision,
      old,
    ),
  ).toBe(false);
  expect(releaseReview(dir).checks?.results[0]?.checked).toBe(false);
  expect(
    recordChecks(
      dir,
      "release",
      [{ what: "Current", by: "fixture", ok: true, findings: [] }],
      revision,
      current,
    ),
  ).toBe(true);
  expect(releaseReview(dir).checks?.results[0]?.what).toBe("Current");
});
test("the baseline keeps the captured build inputs despite edits before health succeeds", () => {
  const dir = fixture(),
    snapshot = deploymentSnapshot(dir);
  writeFileSync(
    join(dir, "smithable.auth.yml"),
    `${auth}public: { pages: [notes], read: [Note] }\n`,
  );
  recordDeployment(dir, snapshot);
  expect(releaseReview(dir).access).toContain("Note read: public access added");
});
test("malformed evidence is unknown and a tracked parent symlink cannot become source proof", () => {
  const dir = fixture();
  recordChecks(dir, "release", [], projectRevision(dir));
  writeFileSync(
    join(dir, "data/.smithable/release-review/checks.json"),
    JSON.stringify({ version: 1, results: "bad" }),
  );
  expect(releaseReview(dir).checks).toBeUndefined();
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src/a.ts"), "synthetic");
  expect(git(dir, ["add", "src/a.ts"]).ok).toBe(true);
  const moved = join(tempDir("release-parent-"), "src");
  renameSync(join(dir, "src"), moved);
  symlinkSync(moved, join(dir, "src"));
  expect(projectRevision(dir)).toBeUndefined();
});

test("pending or superseded deployment evidence cannot retain an old comparison", () => {
  const dir = fixture();
  recordDeployment(dir);
  const snapshot = deploymentSnapshot(dir);
  const old = beginDeployment(dir);
  expect(releaseReview(dir).comparison).toBe("unavailable");
  const current = beginDeployment(dir);
  expect(() => recordDeployment(dir, snapshot, old)).toThrow("newer deployment");
  expect(releaseReview(dir).comparison).toBe("unavailable");
  recordDeployment(dir, snapshot, current);
  expect(releaseReview(dir).comparison).toBe("available");
});
test("runtime data stays outside revision even without a data ignore rule", () => {
  const dir = fixture();
  writeFileSync(join(dir, ".gitignore"), "");
  const before = projectRevision(dir);
  mkdirSync(join(dir, "data"));
  writeFileSync(join(dir, "data/live.db"), "live state");
  expect(projectRevision(dir)).toBe(before);
});

test("an interrupted metadata writer cannot leave a green current result", () => {
  const dir = fixture();
  recordDeployment(dir);
  recordChecks(
    dir,
    "release",
    [{ what: "Fixture", by: "fixture", ok: true, findings: [] }],
    projectRevision(dir),
  );
  const lock = writerLock(dir);
  writeFileSync(lock, "interrupted fixture");
  expect(releaseReview(dir).checks?.current).toBe(false);
  expect(releaseReview(dir).comparison).toBe("unavailable");
  expect(() => beginChecks(dir, "release", projectRevision(dir))).toThrow("locked");
  unlinkSync(lock);
  expect(releaseReview(dir).checks?.current).toBe(true);
});

test("quiet review distinguishes an absent baseline from unreadable deployment evidence", () => {
  const dir = fixture();
  expect(releaseReview(dir).baselineState).toBe("none");
  expect(releaseReview(dir).currentAccess?.join(" ")).toContain("People sign in");
  mkdirSync(join(dir, "data/.smithable/release-review"), { recursive: true });
  writeFileSync(join(dir, "data/.smithable/release-review/deployment.json"), "broken");
  expect(releaseReview(dir).baselineState).toBe("unavailable");
  unlinkSync(join(dir, "data/.smithable/release-review/deployment.json"));
  symlinkSync(
    join(dir, "missing-deployment"),
    join(dir, "data/.smithable/release-review/deployment.json"),
  );
  expect(releaseReview(dir).baselineState).toBe("unavailable");
});

test("empty added-access lists do not call a narrowing change unchanged", () => {
  const dir = fixture();
  recordDeployment(dir);
  expect(releaseReview(dir).accessUnchanged).toBe(true);
  writeFileSync(join(dir, "smithable.auth.yml"), auth.replace("create: all", "create: []"));
  const review = releaseReview(dir);
  expect(review.comparison).toBe("available");
  expect(review.access).toEqual([]);
  expect(review.accessUnchanged).toBe(false);
});

test("a pending deployment record is unavailable, not a first release", () => {
  const dir = fixture();
  beginDeployment(dir);
  expect(releaseReview(dir).baselineState).toBe("unavailable");
});

test("hosted projects without local deployment evidence keep migration comparison unavailable", () => {
  const dir = fixture();
  // A local record is absent even when the hosted app already has live data.
  writeFileSync(join(dir, "smithable.yml"), spec.replace(", body: text", ""));
  const hosted = releaseReview(dir, { hosted: true });
  expect(hosted.baselineState).toBe("unavailable");
  expect(hosted.comparison).toBe("unavailable");
  expect(hosted.comparisonReason).toContain("No valid local deployment baseline");
  expect(releaseReview(dir).baselineState).toBe("none");
});

test("worth noting: a role with power over everyone's records and personal data made public", () => {
  const dir = fixture();
  expect(releaseReview(dir).warnings).toEqual([]);
  writeFileSync(
    join(dir, "smithable.yml"),
    spec.replace("pages:", "  Contact:\n    fields: { name: string!, email: email }\npages:"),
  );
  writeFileSync(
    join(dir, "smithable.auth.yml"),
    "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\ndefaultRole: member\nroles: { admin: all, member: { pages: all, create: all, write: all, delete: all } }\npublic: { read: [Contact] }\n",
  );
  const warnings = releaseReview(dir).warnings;
  expect(warnings).toContain(
    "The member role can change or delete everyone's Note and Contact records, and everyone who signs up gets it.",
  );
  expect(warnings.some((w) => /Contact.*email/.test(w))).toBe(true);
});
