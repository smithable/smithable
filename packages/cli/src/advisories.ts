// Holes in the packages an app depends on, read where they are published first: each package's
// own repository on GitHub. The vulnerability databases the scanners read (OSV, GitHub's reviewed
// list) take days to list them: six advisories of 2026-09-30 for the web framework, the sign-in
// library and the mail library were in neither four days later. No model, no tool to install.
// This file imports nothing, so scripts/stack-advisories.mjs runs it as it is.

export interface Advisory {
  id: string;
  severity: string;
  summary: string;
  /** owner/name on GitHub. */
  repository: string;
  affects: { name: string; range: string; patched?: string }[];
}

export interface Read {
  advisories: Advisory[];
  /** Packages and repositories that could not be read (no network, GitHub's hourly limit). */
  unread: string[];
}

/** A version's numbers and what follows a hyphen (a pre-release comes before its release). */
function parts(version: string): { numbers: number[]; pre: string[] } | undefined {
  const m = /^v?(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(version.trim());
  if (!m?.[1]) return undefined;
  return { numbers: m[1].split(".").map(Number), pre: m[2]?.split(".") ?? [] };
}

/** -1, 0 or 1 as semver orders them; undefined when either is not a version. */
export function compareVersions(a: string, b: string): number | undefined {
  const x = parts(a);
  const y = parts(b);
  if (!x || !y) return undefined;
  for (let i = 0; i < Math.max(x.numbers.length, y.numbers.length); i++) {
    const d = (x.numbers[i] ?? 0) - (y.numbers[i] ?? 0);
    if (d) return Math.sign(d);
  }
  if (!x.pre.length || !y.pre.length) return x.pre.length ? -1 : y.pre.length ? 1 : 0;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    const pn = /^\d+$/.test(p);
    const qn = /^\d+$/.test(q);
    const d = pn && qn ? Number(p) - Number(q) : pn ? -1 : qn ? 1 : p < q ? -1 : p > q ? 1 : 0;
    if (d) return Math.sign(d);
  }
  return 0;
}

/**
 * Whether a version is in a range as maintainers write them on GitHub, which is free text:
 * ">= 1.4.0, < 1.7.7", ">=3.0.2 <=3.2.6", several such in a row (">=4.0.0,<4.0.5,>=4.1.0,<4.1.5"),
 * or a list of single releases ("1.169.5, 1.169.8"). Undefined when it cannot be read.
 */
export function inRange(version: string, range: string): boolean | undefined {
  const clauses = [...range.matchAll(/(>=|<=|>|<|=)?\s*(v?\d[\w.+-]*)/g)];
  const rest = clauses.reduce((text, c) => text.replace(c[0], ""), range);
  if (!clauses.length || /[^\s,]/.test(rest)) return undefined;
  const bare = clauses.filter((c) => !c[1]).length;
  if (bare && bare !== clauses.length) return undefined;
  let within = false;
  // One span of a range: its clauses all hold. A lower bound after an upper one starts the next.
  let span = true;
  let closed = false;
  for (const [, op = "=", bound = ""] of clauses) {
    const order = compareVersions(version, bound);
    if (order === undefined) return undefined;
    if (bare || (closed && (op === ">=" || op === ">"))) {
      within ||= span && closed;
      span = true;
      closed = false;
    }
    span &&=
      op === ">="
        ? order >= 0
        : op === "<="
          ? order <= 0
          : op === ">"
            ? order > 0
            : op === "<"
              ? order < 0
              : order === 0;
    closed ||= op !== ">=" && op !== ">";
    if (bare) closed = true;
  }
  return within || span;
}

/** The first two numbers of a version: its line of releases. */
const line = (version: string) => parts(version)?.numbers.slice(0, 2) ?? [];
const before = (a: number[], b: number[]) =>
  (a[0] ?? 0) !== (b[0] ?? 0) ? (a[0] ?? 0) < (b[0] ?? 0) : (a[1] ?? 0) < (b[1] ?? 0);

/** Every package in a pnpm-lock.yaml with the versions installed, dependencies of dependencies too. */
export function lockedVersions(lock: string): Map<string, string[]> {
  const versions = new Map<string, string[]>();
  for (const [, name, version] of lock.matchAll(
    /^ {2}'?((?:@[^/@\s']+\/)?[^@\s'/]+)@(\d[^\s':()]*)/gm,
  )) {
    if (!name || !version) continue;
    const known = versions.get(name) ?? [];
    if (!known.includes(version)) versions.set(name, [...known, version]);
  }
  return versions;
}

/**
 * One line per installed version an advisory covers, with the version that fixes it. A range
 * that cannot be read is a line too: better checked by hand than passed over.
 */
export function affected(versions: Map<string, string[]>, advisories: Advisory[]): string[] {
  const lines: string[] = [];
  const said = new Set<string>();
  for (const advisory of advisories) {
    // The nearest fix first: a version in two of an advisory's entries is said once, with that one.
    const entries = [...advisory.affects].sort((a, b) =>
      a.patched && b.patched
        ? (compareVersions(a.patched, b.patched) ?? 0)
        : a.patched
          ? -1
          : b.patched
            ? 1
            : 0,
    );
    for (const { name, range, patched } of entries)
      for (const version of versions.get(name) ?? []) {
        const hit = inRange(version, range);
        if (hit === false || said.has(`${advisory.id} ${name}@${version}`)) continue;
        // A version at or past the entry's own fix is fixed, whatever the range says
        // (">= 5.0.0-beta.1", fixed in 5.0.0-rc.2, is not about 5.0.2).
        if (patched && (compareVersions(version, patched) ?? -1) >= 0) continue;
        // A range with no lower end ("<= 1.0.0-beta.19", for the beta line alone) does not
        // reach back over an older line's fix that the version has ("<= 0.45.1", fixed in
        // 0.45.2, in an entry of its own).
        if (
          patched &&
          !range.includes(">") &&
          before(line(version), line(patched)) &&
          advisory.affects.some(
            (other) =>
              other.name === name &&
              other.patched !== undefined &&
              other.patched !== patched &&
              (compareVersions(version, other.patched) ?? -1) >= 0,
          )
        )
          continue;
        said.add(`${advisory.id} ${name}@${version}`);
        const about = `${name}@${version}: ${advisory.id} (${advisory.severity}) ${advisory.summary}`;
        lines.push(
          hit
            ? `${about}${patched ? `; fixed in ${patched}` : "; no fixed version yet"}`
            : `${about}; its range "${range}" could not be read, so check it by hand`,
        );
      }
  }
  return lines;
}

const githubOf = (url: unknown) =>
  typeof url === "string"
    ? /github\.com[/:]([^/]+\/[^/#]+?)(?:\.git)?(?:[/#].*)?$/.exec(url)?.[1]
    : undefined;

/**
 * The published advisories of the repositories these packages come from (name to version). One
 * call to the package registry per package and one to GitHub per repository: without a token
 * GitHub answers sixty an hour per address, which `token` (any, no permissions) lifts. The
 * hundred newest per repository are read; older ones are in the databases.
 */
export async function readAdvisories(
  packages: Record<string, string>,
  options: { token?: string; fetch?: typeof fetch } = {},
): Promise<Read> {
  const get = async (url: string, headers: Record<string, string> = {}) => {
    try {
      const answer = await (options.fetch ?? fetch)(url, {
        headers: { "User-Agent": "smithable", ...headers },
        signal: AbortSignal.timeout(20_000),
      });
      return answer.ok ? ((await answer.json()) as unknown) : undefined;
    } catch {
      return undefined;
    }
  };
  const unread: string[] = [];
  const repositories = new Set<string>();
  await Promise.all(
    Object.entries(packages).map(async ([name, version]) => {
      const doc = (await get(`https://registry.npmjs.org/${name}/${version}`)) as
        | { repository?: { url?: unknown } | string }
        | undefined;
      if (!doc) return unread.push(name);
      const repository = githubOf(
        typeof doc.repository === "string" ? doc.repository : doc.repository?.url,
      );
      // A package kept elsewhere has no list to read here; the databases still cover it.
      if (repository) repositories.add(repository);
    }),
  );
  const advisories: Advisory[] = [];
  await Promise.all(
    [...repositories].map(async (repository) => {
      const list = (await get(
        `https://api.github.com/repos/${repository}/security-advisories?state=published&per_page=100`,
        {
          Accept: "application/vnd.github+json",
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
      )) as
        | {
            ghsa_id: string;
            severity?: string;
            summary?: string;
            vulnerabilities?: {
              package?: { ecosystem?: string; name?: string };
              vulnerable_version_range?: string | null;
              patched_versions?: string | null;
            }[];
          }[]
        | undefined;
      if (!Array.isArray(list)) return unread.push(repository);
      for (const a of list)
        advisories.push({
          id: a.ghsa_id,
          severity: a.severity ?? "unknown",
          summary: a.summary ?? "",
          repository,
          affects: (a.vulnerabilities ?? [])
            .filter((v) => v.package?.ecosystem === "npm" && v.package.name)
            .map((v) => ({
              name: v.package?.name as string,
              range: v.vulnerable_version_range ?? "",
              ...(v.patched_versions ? { patched: v.patched_versions } : {}),
            })),
        });
    }),
  );
  return {
    advisories: advisories.sort((a, b) => a.id.localeCompare(b.id)),
    unread: unread.sort(),
  };
}

/** The newest release with the same first two numbers (a patch), when it is newer; pre-releases never. */
export function newerPatch(version: string, released: string[]): string | undefined {
  const mine = parts(version);
  if (!mine) return undefined;
  const same = released.filter((v) => {
    const p = parts(v);
    return (
      p && !p.pre.length && p.numbers[0] === mine.numbers[0] && p.numbers[1] === mine.numbers[1]
    );
  });
  const newest = same.sort((a, b) => compareVersions(b, a) ?? 0)[0];
  return newest && (compareVersions(newest, version) ?? 0) > 0 ? newest : undefined;
}
