// What people say to Smith, labelled (docs/benchmarks/smith-requests.json, T731), through the rule
// tiers with no model: whatever a rule answers must be right, and a request the set says needs no
// model must be caught by a rule. The ones not caught yet, and any a rule gets wrong, are reviewed
// lists (the snapshots) that only shrink. The models' side is scripts/bench-smith.mjs.
import { type SpecIR, validateSpec } from "@smithable/core";
import { buildContext, buildIndex } from "@smithable/index";
import { expect, test } from "vitest";
import { type Proposal, proposeChange } from "./propose.js";

interface Request {
  id: string;
  starter: string;
  text: string;
  kind: string;
  language: string;
  outcome: { operations?: string[]; [key: string]: unknown };
  noModel: boolean;
  after?: string;
}

const set = JSON.parse(
  Object.values(
    import.meta.glob("../../../docs/benchmarks/smith-requests.json", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
  )[0] as string,
) as { requests: Request[] };

/** Each starter's files, as Studio reads a project. */
const raw = import.meta.glob("../../../examples/*/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const fileOf = (starter: string, name: string) => raw[`../../../examples/${starter}/${name}`];
const projects = new Map<
  string,
  { files: Parameters<typeof proposeChange>[0]["files"]; ir: SpecIR }
>();
const project = (starter: string) => {
  let found = projects.get(starter);
  if (!found) {
    const spec = fileOf(starter, "smithable.yml") ?? "";
    const files = {
      spec,
      ...(fileOf(starter, "smithable.auth.yml")
        ? { auth: fileOf(starter, "smithable.auth.yml") }
        : {}),
      ...(fileOf(starter, "smithable.content.yml")
        ? { content: fileOf(starter, "smithable.content.yml") }
        : {}),
      ...(fileOf(starter, "smithable.ux.yml") ? { ux: fileOf(starter, "smithable.ux.yml") } : {}),
    };
    found = { files, ir: validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR };
    projects.set(starter, found);
  }
  return found;
};

/** What the rules did with a request: nothing (a model is needed), or what they answered. */
function ruled(p: Proposal): { by: string; operations?: string[] } | undefined {
  if (p.kind === "failed") return undefined;
  if (p.kind === "answer")
    return { by: p.generator === "small talk" ? "smalltalk" : "spec-question" };
  if (p.kind === "change") return { by: "change", operations: p.operations.map((o) => o.op) };
  if (p.kind === "none") return { by: "none" };
  return { by: p.kind };
}

/** Whether what a rule answered is right for the request's label. */
function right(r: Request, got: { by: string; operations?: string[] }): boolean {
  if (got.by === "smalltalk") return r.kind === "smalltalk";
  if (got.by === "spec-question") return r.kind === "spec-question";
  // A rule's "cannot as asked" is right only where nothing was to be added (already there).
  if (got.by === "none")
    return (r.kind === "change" || r.kind === "two-things") && !r.outcome.operations?.length;
  if (got.by === "change") {
    if (r.kind !== "change" && r.kind !== "two-things") return false;
    const wanted = r.outcome.operations ?? [];
    return (
      wanted.length > 0 &&
      [...new Set(got.operations)].sort().join() === [...new Set(wanted)].sort().join()
    );
  }
  return false;
}

test("the set is well formed: unique ids, known starters, follow-ups after a request in the set", () => {
  const ids = set.requests.map((r) => r.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const r of set.requests) {
    expect(fileOf(r.starter, "smithable.yml"), r.id).toBeDefined();
    if (r.after) expect(ids, r.id).toContain(r.after);
  }
});

test("what the rules answer is right, and what needs no model is caught (the lists only shrink)", async () => {
  const wrong: string[] = [];
  const missed: string[] = [];
  // Follow-ups are read with their turn before; the rules read one request at a time, so they
  // count only where the set says a rule should catch them.
  for (const r of set.requests) {
    const { files, ir } = project(r.starter);
    const index = buildIndex({ ir, generated: {}, custom: [] });
    const proposal = await proposeChange({
      request: r.text,
      files,
      context: buildContext(index, r.text),
      providers: [],
    });
    const got = ruled(proposal);
    // Undo, redo and feedback are Studio's own rules (apps/studio's smith-requests test).
    const studios = r.kind === "undo" || r.kind === "feedback";
    if (got && !right(r, got))
      wrong.push(
        `${r.id}: ${r.kind} read as ${got.by}${got.operations ? ` ${got.operations.join("+")}` : ""}`,
      );
    else if (!got && r.noModel && !studios) missed.push(`${r.id}: ${r.kind}`);
  }
  expect(wrong).toMatchSnapshot("read wrongly by a rule");
  expect(missed).toMatchSnapshot("needs no model, not caught by a rule yet");
});
