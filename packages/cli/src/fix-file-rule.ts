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

/**
 * A script's code with its comments and blank space taken out: comments outside strings and
 * template text go, so two versions that differ only in comments come out the same. Code in a
 * template string (the generator's output) is text here, so a comment there counts as a change:
 * the rule fails closed.
 */
export function withoutComments(code: string): string {
  let out = "";
  // Each open template literal: -1 while in its text, else the depth of braces in its ${…}.
  const templates: number[] = [];
  let i = 0;
  while (i < code.length) {
    const c = code[i] as string;
    const next = code[i + 1];
    const top = templates.length - 1;
    if (top >= 0 && templates[top] === -1) {
      if (c === "\\") {
        out += code.slice(i, i + 2);
        i += 2;
      } else if (c === "`") {
        templates.pop();
        out += c;
        i++;
      } else if (c === "$" && next === "{") {
        templates[top] = 0;
        out += "${";
        i += 2;
      } else {
        out += c;
        i++;
      }
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < code.length && code[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      const close = code.indexOf("*/", i + 2);
      i = close < 0 ? code.length : close + 2;
      out += " ";
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < code.length && code[j] !== c && code[j] !== "\n") j += code[j] === "\\" ? 2 : 1;
      out += code.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === "`") {
      templates.push(-1);
      out += c;
      i++;
      continue;
    }
    if (top >= 0 && c === "{") templates[top] = (templates[top] as number) + 1;
    if (top >= 0 && c === "}")
      templates[top] = templates[top] === 0 ? -1 : (templates[top] as number) - 1;
    out += c;
    i++;
  }
  return out.replace(/\s+/g, " ").trim();
}

/** A file whose change only a reader sees: a document, or a script whose code is the same without comments. */
export function commentsOnly(
  path: string,
  before: string | undefined,
  after: string | undefined,
): boolean {
  if (/\.md$/.test(path)) return true;
  if (before === undefined || after === undefined || !/\.(ts|tsx|js|mjs)$/.test(path)) return false;
  return withoutComments(before) === withoutComments(after);
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
  /** The stack profile's diff from the base. */
  diffOf: (path: string) => string;
  /** A file as it was at the base and as it is now (undefined where it is not there). */
  filesOf: (path: string) => { before?: string; after?: string };
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
  const quiet = rest.every((p) => {
    const { before, after } = input.filesOf(p);
    return commentsOnly(p, before, after);
  });
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
