import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  type Stats,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Allowed,
  type AuthIR,
  actionAccess,
  adminOnly,
  type ContentImage,
  type ContentIR,
  type Diagnostic,
  modelAccess,
  pageAccess,
  type SpecIR,
  type UxIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { noSignIn, summarize } from "@smithable/index";
import { maintenanceInfo } from "./maintenance.js";
import { lostFields } from "./op.js";
import { loadPlugins } from "./plugins.js";
import { privacyStates } from "./privacy-review.js";
import { childOptions } from "./secrets.js";
import type { Level, Result } from "./security.js";
import { changeTree } from "./tree-files.js";
import { loadSpec } from "./validate.js";
import { assetReview } from "./website-assets.js";

const STATE = "data/.smithable/release-review";
type Files = { spec: string; auth?: string };
type CheckRecord = {
  version: 1;
  run: string;
  at: string;
  revision?: string;
  level: Level;
  results: { what: string; ok: boolean; checked: boolean }[];
};
type Deployment = { version: 1; run?: string; at: string; revision?: string; files: Files };
const files = (dir: string): Files => ({
  spec: readFileSync(join(dir, "smithable.yml"), "utf8"),
  ...(existsSync(join(dir, "smithable.auth.yml"))
    ? { auth: readFileSync(join(dir, "smithable.auth.yml"), "utf8") }
    : {}),
});
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const timestamp = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const revisionOf = (value: unknown) =>
  value === undefined || (typeof value === "string" && /^[a-f0-9]{64}$/.test(value));
function readRecord(dir: string, name: string): unknown {
  let fd: number | undefined;
  try {
    const path = join(dir, STATE, name),
      info = lstatSync(path);
    if (!info.isFile() || info.size > 4 * 1024 * 1024) return undefined;
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = fstatSync(fd);
    if (
      opened.dev !== info.dev ||
      opened.ino !== info.ino ||
      !opened.isFile() ||
      opened.size > 4 * 1024 * 1024
    )
      return undefined;
    return JSON.parse(readFileSync(fd, "utf8"));
  } catch {
    return undefined;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
function checksRecord(dir: string): CheckRecord | undefined {
  const value = readRecord(dir, "checks.json");
  if (
    !isObject(value) ||
    value.version !== 1 ||
    typeof value.run !== "string" ||
    !timestamp(value.at) ||
    !revisionOf(value.revision) ||
    typeof value.level !== "string" ||
    !["fast", "normal", "release"].includes(value.level) ||
    !Array.isArray(value.results) ||
    value.results.length > 50
  )
    return undefined;
  if (
    !value.results.every(
      (row) =>
        isObject(row) &&
        typeof row.what === "string" &&
        row.what.length <= 500 &&
        typeof row.ok === "boolean" &&
        typeof row.checked === "boolean",
    )
  )
    return undefined;
  return {
    version: 1,
    run: value.run,
    at: value.at,
    revision: value.revision as string | undefined,
    level: value.level as Level,
    results: value.results.map((row) => ({ what: row.what, ok: row.ok, checked: row.checked })),
  };
}
function deploymentRecord(dir: string): Deployment | undefined {
  const value = readRecord(dir, "deployment.json");
  if (
    !isObject(value) ||
    value.version !== 1 ||
    !timestamp(value.at) ||
    !revisionOf(value.revision) ||
    !isObject(value.files) ||
    typeof value.files.spec !== "string" ||
    (value.files.auth !== undefined && typeof value.files.auth !== "string")
  )
    return undefined;
  return {
    version: 1,
    run: typeof value.run === "string" ? value.run : undefined,
    at: value.at,
    revision: value.revision as string | undefined,
    files: {
      spec: value.files.spec,
      ...(typeof value.files.auth === "string" ? { auth: value.files.auth } : {}),
    },
  };
}
/** The writer's lock: this process's own file, outside the tree the project can change. */
export function writerLock(dir: string): string {
  const root = join(tmpdir(), `smithable-release-locks-${process.getuid?.() ?? "user"}`);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const owner = lstatSync(root);
  if (
    !owner.isDirectory() ||
    (process.getuid && (owner.uid !== process.getuid() || (owner.mode & 0o077) !== 0))
  )
    throw new Error(`${root} is not a private folder of this user. Fix or remove it, then retry.`);
  return join(root, `${createHash("sha256").update(realpathSync(dir)).digest("hex")}.lock`);
}
/** Short synchronous metadata writes are serialized; interrupted locks fail closed. */
function locked<T>(dir: string, write: () => T): T {
  changeTree([{ path: join(dir, STATE), folder: true }]);
  const path = writerLock(dir);
  let fd: number;
  try {
    fd = openSync(path, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error("Release evidence is locked by another writer; retry after it finishes.");
    throw error;
  }
  const owned = fstatSync(fd);
  try {
    return write();
  } finally {
    closeSync(fd);
    const kept = lstatSync(path, { throwIfNoEntry: false });
    if (kept?.dev === owned.dev && kept.ino === owned.ino) unlinkSync(path);
  }
}
function save(
  dir: string,
  name: string,
  value: CheckRecord | Deployment | { version: 1; run: string; status: "pending"; at: string },
): void {
  const path = join(dir, STATE, name),
    staging = `${path}.${randomUUID()}`;
  changeTree([
    { path: staging, data: JSON.stringify(value), mode: 0o600 },
    { path, from: staging },
  ]);
}
/** Git-visible project files only; configuration, live data and ignored files are separate. */
export function projectRevision(dir: string): string | undefined {
  try {
    const raw = execFileSync(
      "git",
      [
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "core.fsmonitor=false",
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
        "--",
        ".",
        ":(exclude)data",
      ],
      {
        cwd: dir,
        ...childOptions({ ...process.env, GIT_CONFIG_NOSYSTEM: "1" }),
        maxBuffer: 4 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    const listed = raw.toString("utf8");
    if (!Buffer.from(listed).equals(raw)) return undefined;
    const root = realpathSync(dir);
    const hash = createHash("sha256");
    let total = 0;
    const paths = [
      ...new Set(
        listed.split("\0").filter((path) => path && path !== "data" && !path.startsWith("data/")),
      ),
    ].sort();
    if (paths.length > 20000) return undefined;
    for (const path of paths) {
      if (path === "data" || path.startsWith("data/")) continue;
      const file = join(root, path);
      const parents = path.split("/").slice(0, -1);
      let parent = root;
      for (const part of parents) {
        parent = join(parent, part);
        const entry = lstatSync(parent, { throwIfNoEntry: false });
        if (entry && (!entry.isDirectory() || entry.isSymbolicLink())) return undefined;
      }
      let digest = "missing";
      let stat: Stats | undefined;
      try {
        stat = lstatSync(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") return undefined;
      }
      if (stat) {
        total += stat.size;
        if (!stat.isFile() || stat.size > 32 * 1024 * 1024 || total > 128 * 1024 * 1024)
          return undefined;
        if (realpathSync(file) !== file) return undefined;
        const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          const opened = fstatSync(fd);
          if (opened.dev !== stat.dev || opened.ino !== stat.ino || !opened.isFile())
            return undefined;
          digest = createHash("sha256").update(readFileSync(fd)).digest("hex");
          const after = fstatSync(fd);
          if (
            after.size !== opened.size ||
            after.mtimeMs !== opened.mtimeMs ||
            realpathSync(file) !== file
          )
            return undefined;
        } finally {
          closeSync(fd);
        }
      }
      // Frame each path/digest; binary source bytes cannot impersonate a file boundary.
      hash.update(JSON.stringify([path, digest])).update("\n");
    }
    return hash.digest("hex");
  } catch {
    return undefined;
  }
}
export function beginChecks(dir: string, level: Level, revision: string | undefined): string {
  const run = randomUUID();
  locked(dir, () =>
    save(dir, "checks.json", {
      version: 1,
      run,
      at: new Date().toISOString(),
      revision,
      level,
      results: [{ what: "Checks did not finish", ok: false, checked: false }],
    }),
  );
  return run;
}
export function recordChecks(
  dir: string,
  level: Level,
  results: Result[],
  revision: string | undefined,
  run?: string,
): boolean {
  return locked(dir, () => {
    if (run && checksRecord(dir)?.run !== run) return false;
    save(dir, "checks.json", {
      version: 1,
      run: run ?? randomUUID(),
      at: new Date().toISOString(),
      revision,
      level,
      results: results.map((r) => ({ what: r.what, ok: r.ok, checked: r.checked !== false })),
    });
    return true;
  });
}
export function deploymentSnapshot(dir: string): Deployment {
  return {
    version: 1,
    at: new Date().toISOString(),
    revision: projectRevision(dir),
    files: files(dir),
  };
}
export function beginDeployment(dir: string): string {
  const run = randomUUID();
  locked(dir, () =>
    save(dir, "deployment.json", {
      version: 1,
      run,
      status: "pending",
      at: new Date().toISOString(),
    }),
  );
  return run;
}
export function recordDeployment(
  dir: string,
  snapshot = deploymentSnapshot(dir),
  run?: string,
): void {
  locked(dir, () => {
    const current = readRecord(dir, "deployment.json");
    if (run && (!isObject(current) || current.run !== run))
      throw new Error("A newer deployment replaced this release evidence run.");
    save(dir, "deployment.json", {
      ...snapshot,
      run: run ?? randomUUID(),
      at: new Date().toISOString(),
    });
  });
}
function wider(before: Allowed, after: Allowed, roles: string[]): string[] {
  if (before.public && !before.where) return [];
  const changes: string[] = [];
  if (after.public && !before.public) changes.push("public access added");
  for (const role of after.roles)
    if (!before.roles.includes(role)) changes.push(`role ${role} added`);
  if (after.owner && !before.owner && roles.some((role) => !before.roles.includes(role)))
    changes.push("owner access added");
  if (after.public && before.public && JSON.stringify(before.where) !== JSON.stringify(after.where))
    changes.push(
      after.where
        ? "public record condition changed; review its effect"
        : "public record condition removed",
    );
  return changes;
}
/** The validator's warnings an owner can act on before publishing: data shown more widely than usual. */
const WORTH_NOTING = new Set([
  "public-personal-data",
  "open-shared-access",
  "api-personal-data",
  "visitors-read-drafts",
]);
const list = (names: string[]) =>
  names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
/**
 * Roles other than admin with an administrator's kind of power (T879, Johan 2026-11-18): every
 * grant, an administrator's page, everyone's records in every model, or, for the role anyone who
 * signs up gets, everyone's records in any model.
 */
export function powerfulRoles(ir: SpecIR, auth: AuthIR): string[] {
  if (auth.signIn === "none") return [];
  const open = auth.signIn.selfSignUp && !auth.signIn.allowedDomains?.length;
  const joining = (role: string) =>
    role !== auth.defaultRole
      ? ""
      : open
        ? ", and everyone who signs up gets it"
        : ", and every new user gets it";
  const found: string[] = [];
  if (auth.defaultRole === "admin")
    found.push(
      open
        ? "Everyone who signs up becomes an administrator."
        : "Every new user becomes an administrator.",
    );
  for (const role of auth.roles) {
    if (role.name === "admin") continue;
    const everyones = ir.models
      .filter((m) => {
        const a = modelAccess(m, auth);
        return a.write.roles.includes(role.name) || a.delete.roles.includes(role.name);
      })
      .map((m) => m.name);
    const pages = ir.pages
      .filter((p) => adminOnly(p) && pageAccess(p, auth).roles.includes(role.name))
      .map((p) => p.id);
    const all = role.grants === "all";
    const every = ir.models.length > 0 && everyones.length === ir.models.length;
    const anyone = role.name === auth.defaultRole && open && everyones.length > 0;
    if (!all && !every && !pages.length && !anyone) continue;
    const can = all
      ? ["do everything an administrator can"]
      : [
          ...(everyones.length ? [`change or delete everyone's ${list(everyones)} records`] : []),
          ...(pages.length
            ? [`open the ${list(pages)} ${pages.length === 1 ? "page" : "pages"}`]
            : []),
        ];
    found.push(`The ${role.name} role can ${can.join(" and ")}${joining(role.name)}.`);
  }
  return found;
}
/** Compare the complete effective access map, not just the list of added grants. */
function accessFacts(ir: SpecIR, auth: AuthIR) {
  return {
    auth,
    models: ir.models.map((m) => [m.name, modelAccess(m, auth)]),
    pages: ir.pages.map((p) => [p.id, pageAccess(p, auth)]),
    actions: ir.actions.map((a) => [a.name, actionAccess(a, auth, ir.models)]),
  };
}

/** A picture an image model made, where it would present the owner or their work. */
export interface ReviewPicture {
  page: string;
  section: string;
  /** An item's place, for gallery and media collage pictures. */
  item?: number;
  src: string;
  alt: string;
}

/**
 * The hero's picture, and those of sections whose pictures are the owner's work ("pictures: work"),
 * that an image model made (docs/design/picture-kinds.md §6): published as they are they would
 * present work nobody did. One the owner kept is not listed again (keepPicture). Decoration
 * elsewhere is never listed, and the list never stops a release.
 */
export function picturesToReview(
  ir: SpecIR,
  content: ContentIR | undefined,
  ux?: UxIR,
): ReviewPicture[] {
  const found: ReviewPicture[] = [];
  for (const page of ir.pages)
    for (const section of page.sections) {
      if (section.kind !== "hero" && section.pictures !== "work") continue;
      const texts = content?.pages[page.id]?.sections?.[section.name];
      const look = (image: ContentImage | undefined, item?: number) => {
        if (image?.generated && !image.kept)
          found.push({
            page: page.id,
            section: section.name,
            ...(item === undefined ? {} : { item }),
            src: image.src,
            alt: image.alt,
          });
      };
      look(texts?.image);
      const collage =
        section.kind === "mediaText" &&
        ux?.pages[page.id]?.looks?.[section.name]?.layout === "collage";
      if (section.kind === "gallery" || collage)
        texts?.items?.forEach((entry, i) => {
          look(
            typeof entry.image === "object" && !Array.isArray(entry.image)
              ? entry.image
              : undefined,
            i,
          );
        });
    }
  return found;
}

export function releaseReview(dir: string, options: { hosted?: boolean } = {}) {
  const revision = projectRevision(dir);
  const recorded = { checks: checksRecord(dir), deployment: deploymentRecord(dir) };
  const found: Diagnostic[] = [];
  const current = loadSpec(dir, { out: () => {}, err: () => {} }, [], found);
  const baseline = recorded.deployment;
  const plugins = loadPlugins(dir);
  const before =
    baseline?.revision && plugins.length === 0
      ? validateSpec({ path: "previous smithable.yml", text: baseline.files.spec }, { plugins }).ir
      : undefined;
  const beforeAuth =
    before && baseline
      ? validateAuth(
          {
            path: "previous smithable.auth.yml",
            text: baseline.files.auth ?? "smithableAuth: 0.1\nsignIn: none\n",
          },
          before,
        ).auth
      : undefined;
  const access: string[] = [],
    migrations: string[] = [];
  if (before && beforeAuth && current.ir && current.auth) {
    const none: Allowed = { public: false, roles: [], owner: false };
    if (JSON.stringify(beforeAuth.signIn) !== JSON.stringify(current.auth.signIn))
      access.push(
        "Sign-in settings changed; review providers, self-sign-up and who can obtain each role.",
      );
    if (beforeAuth.defaultRole !== current.auth.defaultRole)
      access.push(
        `New users' default role changed from ${beforeAuth.defaultRole} to ${current.auth.defaultRole}; review its access.`,
      );
    if (JSON.stringify(beforeAuth.admins) !== JSON.stringify(current.auth.admins))
      access.push("Administrator membership changed; review who receives administrator access.");
    for (const model of current.ir.models) {
      const old = before.models.find((m) => m.name === model.name);
      const previous = old ? modelAccess(old, beforeAuth) : undefined,
        next = modelAccess(model, current.auth);
      for (const op of ["read", "create", "write", "delete"] as const)
        for (const change of wider(
          previous?.[op] ?? none,
          next[op],
          current.auth.roles.map((role) => role.name),
        ))
          access.push(`${model.name} ${op}: ${change}`);
      if (!old) migrations.push(`Added model ${model.name}; review its generated migration.`);
      if (
        old &&
        JSON.stringify([old.unique, old.ownedBy, old.trash, old.capacity, old.occupies]) !==
          JSON.stringify([model.unique, model.ownedBy, model.trash, model.capacity, model.occupies])
      )
        migrations.push(
          `Changed model constraints ${model.name}; review migration and existing records.`,
        );
      for (const field of model.fields) {
        const was = old?.fields.find((f) => f.name === field.name);
        if (!was && old)
          migrations.push(
            `Added field ${model.name}.${field.name}; review defaults and required values.`,
          );
        else if (was && JSON.stringify(was) !== JSON.stringify(field))
          migrations.push(
            `Changed field ${model.name}.${field.name}; review its migration and constraints.`,
          );
      }
    }
    for (const name of lostFields(before, current.ir))
      migrations.push(`Removed stored field ${name}; its values may be lost.`);
    for (const model of before.models)
      if (!current.ir.models.some((m) => m.name === model.name))
        migrations.push(`Removed model ${model.name}; its records may be lost.`);
    for (const page of current.ir.pages) {
      const old = before.pages.find((p) => p.id === page.id);
      for (const change of wider(
        old ? pageAccess(old, beforeAuth) : none,
        pageAccess(page, current.auth),
        current.auth.roles.map((role) => role.name),
      ))
        access.push(`Page ${page.id}: ${change}`);
    }
    for (const action of current.ir.actions) {
      const old = before.actions.find((a) => a.name === action.name);
      for (const change of wider(
        old ? actionAccess(old, beforeAuth, before.models) : none,
        actionAccess(action, current.auth, current.ir.models),
        current.auth.roles.map((role) => role.name),
      ))
        access.push(`Action ${action.name}: ${change}`);
    }
  }
  const latestChecks = checksRecord(dir);
  const latestDeployment = deploymentRecord(dir);
  const busy = existsSync(writerLock(dir));
  const baselineChanged =
    latestDeployment?.run !== baseline?.run || latestDeployment?.at !== baseline?.at;
  const comparable =
    !busy && !baselineChanged && before && beforeAuth && current.ir && current.auth;
  return {
    // No record differs from an unreadable, pending or unsupported record; neither is proof
    // that a hosted project has never been published.
    baselineState: comparable
      ? "available"
      : !options.hosted &&
          !busy &&
          !baselineChanged &&
          current.ir &&
          current.auth &&
          !lstatSync(join(dir, STATE, "deployment.json"), { throwIfNoEntry: false })
        ? "none"
        : "unavailable",
    accessUnchanged: Boolean(
      comparable &&
        before &&
        beforeAuth &&
        current.ir &&
        current.auth &&
        JSON.stringify(accessFacts(before, beforeAuth)) ===
          JSON.stringify(accessFacts(current.ir, current.auth)),
    ),
    currentAccess:
      current.ir && current.auth
        ? summarize(current.ir, current.auth, current.content, plugins).find(
            (s) => s.concept === "auth",
          )?.sentences
        : undefined,
    // What an owner may not expect, at the top of the review (T879, Johan 2026-11-18).
    warnings:
      current.ir && current.auth
        ? [
            ...powerfulRoles(current.ir, current.auth),
            ...new Set(
              found
                .filter((d) => d.severity === "warning" && WORTH_NOTING.has(d.code))
                .map((d) => d.plain?.message ?? d.message),
            ),
          ]
        : [],
    assets: assetReview(dir),
    // Generated pictures that would present the owner's work, each with a choice (§6 of picture-kinds.md).
    pictures: current.ir ? picturesToReview(current.ir, current.content, current.ux) : [],
    // The privacy page: reviewed, changed since its review (and what), or never (§6.4).
    privacy: privacyStates(dir),
    baseline: baseline?.at,
    maintenance: maintenanceInfo(dir),
    comparison:
      !busy && !baselineChanged && before && beforeAuth && current.ir && current.auth
        ? "available"
        : "unavailable",
    comparisonReason: busy
      ? "Release evidence is being updated or a writer was interrupted; retry after the writer finishes."
      : baselineChanged
        ? "Deployment evidence changed while reading; reopen this review."
        : !baseline
          ? "No valid local deployment baseline is recorded."
          : !baseline.revision
            ? "The recorded deployment source revision is unknown; compare access and migrations manually."
            : plugins.length
              ? "Plugin-aware deployment comparison is not available; review the access map and migrations manually."
              : !current.ir || !current.auth
                ? "Current project files could not be validated for comparison."
                : !before || !beforeAuth
                  ? "The recorded deployment files could not be validated for comparison."
                  : undefined,
    // An app with no sign-in, said on every review, the first publish included (T769).
    ...((closed) => (closed ? { noSignIn: closed } : {}))(
      current.ir && current.auth ? noSignIn(current.ir, current.auth, current.content) : undefined,
    ),
    access,
    migrations,
    checks: latestChecks
      ? { ...latestChecks, current: !busy && !!revision && revision === latestChecks.revision }
      : undefined,
    verifiedRestore: undefined as string | undefined,
  };
}
