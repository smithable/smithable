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

/** The pins a diff of the stack profile changes, whatever else it changes: name and old version. */
export function pinsChanged(diff: string): { name: string; version: string }[] {
  return diff
    .split("\n")
    .filter((l) => l[0] === "-" && !l.startsWith("---"))
    .flatMap((l) => {
      const pin = PIN.exec(l.slice(1));
      return pin ? [{ name: pin[1] as string, version: pin[2] as string }] : [];
    });
}

/** The pins a diff of the stack profile bumps, or undefined when it changes anything else. */
export function pinBumps(diff: string): Bump[] | undefined {
  const from = new Map<string, string>();
  const to = new Map<string, string>();
  for (const line of diff.split("\n")) {
    if (line.startsWith("--- ") || line.startsWith("+++ ")) continue;
    const sign = line[0];
    if (sign !== "-" && sign !== "+") continue;
    if (line.slice(1).trim() === "") continue;
    const pin = PIN.exec(line.slice(1));
    if (!pin) return undefined;
    const side = sign === "-" ? from : to;
    // A name pinned twice cannot be told apart in a diff: not a plain bump.
    if (side.has(pin[1] as string)) return undefined;
    side.set(pin[1] as string, pin[2] as string);
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
        // Unsure counts as affected before and as fixed after: the rule fails closed.
        inRange(bump.from, a.range) !== false &&
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
  // Said in the text, not in a comment or a quoted block.
  const said = (body ?? "").replace(/<!--[\s\S]*?-->/g, "").replace(/^(```|~~~)[\s\S]*?^\1/gm, "");
  const found = /^Fix file:\s*none,?\s+because\s+(.+?)\s*$/im.exec(said);
  // Printed in CI's log: no workflow command (::…) rides along.
  const reason = found?.[1]?.replace(/::/g, ": :");
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
  const stack = engine.includes(STACK_FILE) ? input.diffOf(STACK_FILE) : "";
  // A security fix is found whatever else the change does: no declaration stands in for it.
  const changedPins = pinsChanged(stack);
  if (changedPins.length) {
    const read = await input.advisories(
      Object.fromEntries(changedPins.map((p) => [p.name, p.version])),
    );
    if (!read)
      return needs(
        input,
        "The changed pins' advisories could not be read, so whether this is a security fix is not known.",
        true,
      );
    const after = pinBumps(stack) ?? [];
    const fixed = changedPins.filter((p) => {
      const to = after.find((b) => b.name === p.name)?.to ?? "0.0.0-removed";
      return fixesAdvisory({ name: p.name, from: p.version, to }, read, input.inRange);
    });
    if (fixed.length)
      return needs(
        input,
        `The change of ${fixed.map((p) => p.name).join(", ")} leaves a published advisory behind: a security fix needs a fix file.`,
        true,
      );
  }
  const bumps = stack ? pinBumps(stack) : [];
  const quiet = rest.every((p) => {
    const { before, after } = input.filesOf(p);
    return commentsOnly(p, before, after);
  });
  if (bumps && quiet) {
    if (!bumps.length)
      return { ok: true, why: "Only comments and documents of the app's parts changed." };
    // The advisories were read above, and none is left behind.
    if (bumps.every((b) => harmlessStep(b.from, b.to)))
      return {
        ok: true,
        why: `Only pins bumped by patch or minor, over no published advisory: ${bumps.map((b) => `${b.name} ${b.from} → ${b.to}`).join(", ")}.`,
      };
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
