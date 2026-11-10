// The fix-file rule (fixes/README.md), as CI runs it through scripts/fix-file-rule.mjs: a pull
// request that changes what built apps do says which apps it reaches with a fix file. It passes
// without one, by itself and without a model, when the change is plainly harmless: pinned packages
// bumped by patch (or by minor from 1.0 on) over no published advisory, or only comments and
// documents in the app's parts. Otherwise a fix file, a line "Fix file: none, because <reason>"
// in the pull request's text, or the label no-fix-file for people.
// Types only: CI runs this file with Node as it is, which resolves no ".js" import to its ".ts".
import type { Advisory } from "./advisories.js";

/** Whether a version is in an advisory's range (advisories.ts's inRange). */
export type InRange = (version: string, range: string) => boolean | undefined;

/** The stack profile: a change there is a bump when every changed line is a pin's version. */
export const STACK_FILE = "packages/adapter-tanstack/src/stack.ts";

export interface Bump {
  name: string;
  from: string;
  to: string;
}

const PIN = /^\s*"?((?:@[\w.-]+\/)?[\w.-]+)"?:\s*"(\d+\.\d+\.\d+[\w.+-]*)",?\s*$/;

/** The pins a diff of the stack profile bumps, or undefined when it changes anything else. */
export function pinBumps(diff: string): Bump[] | undefined {
  const from = new Map<string, string>();
  const to = new Map<string, string>();
  for (const line of diff.split("\n")) {
    if (line.startsWith("---") || line.startsWith("+++")) continue;
    const sign = line[0];
    if (sign !== "-" && sign !== "+") continue;
    if (line.slice(1).trim() === "") continue;
    const pin = PIN.exec(line.slice(1));
    if (!pin) return undefined;
    (sign === "-" ? from : to).set(pin[1] as string, pin[2] as string);
  }
  if (from.size !== to.size || !from.size) return undefined;
  const bumps: Bump[] = [];
  for (const [name, old] of from) {
    const next = to.get(name);
    if (!next) return undefined;
    bumps.push({ name, from: old, to: next });
  }
  return bumps;
}

/** A patch, or a minor from 1.0 on (semver: a 0.x minor may break), never a step back. */
export function harmlessStep(from: string, to: string): boolean {
  const [a, b] = [from, to].map((v) => /^(\d+)\.(\d+)\.(\d+)$/.exec(v)?.slice(1).map(Number));
  if (!a || !b) return false;
  const [am, an, ap] = a as [number, number, number];
  const [bm, bn, bp] = b as [number, number, number];
  if (am !== bm) return false;
  if (an === bn) return bp > ap;
  return am >= 1 && bn > an;
}

/** Whether a bump leaves a published advisory behind: then it is a security fix. */
export function fixesAdvisory(bump: Bump, advisories: Advisory[], inRange: InRange): boolean {
  return advisories.some((advisory) =>
    advisory.affects.some(
      (a) =>
        a.name === bump.name &&
        inRange(bump.from, a.range) === true &&
        inRange(bump.to, a.range) !== true,
    ),
  );
}

/** A changed line that only a reader sees: blank, or a comment. */
const commentLine = (text: string) => {
  const t = text.trim();
  return (
    t === "" ||
    t.startsWith("//") ||
    t.startsWith("/*") ||
    t.startsWith("*") ||
    t.startsWith("{/*") ||
    t.startsWith("<!--")
  );
};

/** A file's diff changes only comments (or the file is a document). */
export function commentsOnly(path: string, diff: string): boolean {
  if (/\.md$/.test(path)) return true;
  return diff
    .split("\n")
    .filter((l) => (l[0] === "+" || l[0] === "-") && !l.startsWith("+++") && !l.startsWith("---"))
    .every((l) => commentLine(l.slice(1)));
}

/** The reason a pull request's text gives for needing no fix file, if it gives one. */
export function declaredReason(body: string | undefined): string | undefined {
  const found = /^\s*Fix file:\s*none,?\s+because\s+(.+?)\s*$/im.exec(body ?? "");
  const reason = found?.[1];
  return reason && reason.length >= 10 ? reason : undefined;
}

export interface RuleInput {
  /** The kit, template and generator files the change touches (tests, snapshots and *.gen.ts left out). */
  engine: string[];
  /** The fix files it adds or edits. */
  fixes: string[];
  /** Each engine file's diff from the base. */
  diffOf: (path: string) => string;
  labelled: boolean;
  body: string | undefined;
  /** The published advisories of these pins' packages; undefined when they could not be read. */
  advisories: (pins: Record<string, string>) => Promise<Advisory[] | undefined>;
  inRange: InRange;
}

/** Whether the change passes, and which rule said so (or what it needs). */
export async function fixFileRule(input: RuleInput): Promise<{ ok: boolean; why: string }> {
  const { engine, fixes } = input;
  if (!engine.length) return { ok: true, why: "No kit, template or generator file changed." };
  if (fixes.length) return { ok: true, why: `Fix files: ${fixes.join(", ")}.` };
  const rest = engine.filter((p) => p !== STACK_FILE);
  const bumps = engine.includes(STACK_FILE) ? pinBumps(input.diffOf(STACK_FILE)) : [];
  const quiet = rest.every((p) => commentsOnly(p, input.diffOf(p)));
  if (bumps && quiet) {
    if (!bumps.length)
      return { ok: true, why: "Only comments and documents of the app's parts changed." };
    const steps = bumps.every((b) => harmlessStep(b.from, b.to));
    const advisories = steps
      ? await input.advisories(Object.fromEntries(bumps.map((b) => [b.name, b.from])))
      : undefined;
    const fixed = advisories
      ? bumps.filter((b) => fixesAdvisory(b, advisories, input.inRange))
      : [];
    const said = bumps.map((b) => `${b.name} ${b.from} → ${b.to}`).join(", ");
    if (steps && advisories && !fixed.length)
      return {
        ok: true,
        why: `Only pins bumped by patch or minor, over no published advisory: ${said}.`,
      };
    if (fixed.length)
      return needs(
        input,
        `The bump of ${fixed.map((b) => b.name).join(", ")} leaves a published advisory behind: a security fix needs a fix file.`,
        true,
      );
    if (!advisories && steps)
      return needs(
        input,
        `The advisories of ${said} could not be read, so the bump was not passed by itself.`,
      );
  }
  return needs(input, undefined);
}

function needs(
  input: RuleInput,
  first: string | undefined,
  security = false,
): { ok: boolean; why: string } {
  const lead = first ? `${first}\n` : "";
  // A security fix names the apps it reaches: a written declaration does not stand in for it
  // (a person's label still does).
  const reason = security ? undefined : declaredReason(input.body);
  if (reason)
    return { ok: true, why: `${lead}The pull request says: no fix file, because ${reason}` };
  if (input.labelled)
    return { ok: true, why: `${lead}The label no-fix-file says no built app shows this change.` };
  return {
    ok: false,
    why: `${lead}These change what built apps do, and no fix file says which apps it reaches:\n${input.engine
      .map((p) => `  ${p}\n`)
      .join(
        "",
      )}Add fixes/<id>.yml (fixes/README.md)${security ? "" : ', or a line "Fix file: none, because <reason>" in the pull request\'s text when no built app shows the change'}.`,
  };
}
