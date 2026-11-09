// The undo round trip (C 67, Fable 70): random changes made through the operation layer, each
// undone in turn, leave the project as it was: the committed tree is the one it started from
// and nothing is left uncommitted. Generation is the adapter's property; here it is stubbed.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateSpec } from "@smithable/core";
import fc from "fast-check";
import { afterEach, expect, test, vi } from "vitest";
import { ensureRepository, git } from "./git.js";
import { runOperation } from "./op.js";
import { captureIo } from "./test-io.js";
import { undo } from "./undo.js";

vi.mock("./generate.js", () => ({ generate: vi.fn(async () => 0) }));

/** The weekly long run multiplies every property's cases (and their time) by FC_SCALE. */
const SCALE = Number(import.meta.env.FC_SCALE) || 1;

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), "smithable-undo-property-"));
  roots.push(dir);
  writeFileSync(join(dir, ".gitignore"), "data/\n");
  writeFileSync(
    join(dir, "smithable.yml"),
    "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Customer:\n    fields:\n      name: string!\n      email: email\n      notes: text\n  Item:\n    fields:\n      title: string!\n      price: money\npages:\n  customers: { crud: Customer }\n  items: { crud: Item }\n",
  );
  mkdirSync(join(dir, ".smithable"), { recursive: true });
  writeFileSync(join(dir, ".smithable/files.json"), '{"files":{}}\n');
  ensureRepository(dir);
  return dir;
}

const step = fc.record({
  op: fc.constantFrom("addModel", "addField", "renameField", "removeField"),
  at: fc.nat(),
  name: fc.constantFrom("phone", "due", "code", "level", "tag", "note"),
  type: fc.constantFrom("string", "text", "int", "money", "date", "bool", "email", "low | high"),
});

/** An operation's arguments for the spec as it is now; some are refused, which is part of it. */
function argsFor(dir: string, s: { op: string; at: number; name: string; type: string }) {
  const ir = validateSpec({
    path: "smithable.yml",
    text: readFileSync(join(dir, "smithable.yml"), "utf8"),
  }).ir;
  const models = ir?.models ?? [];
  const model = models[s.at % Math.max(models.length, 1)];
  const fields = (model?.fields ?? []).filter((f) => f.type.kind !== "relation");
  const field = fields[s.at % Math.max(fields.length, 1)];
  if (s.op === "addModel") return { model: `Thing${s.at % 4}`, fields: { [s.name]: s.type } };
  if (s.op === "addField") return { model: model?.name ?? "", field: s.name, type: s.type };
  if (s.op === "renameField")
    return { model: model?.name ?? "", from: field?.name ?? "", to: `${s.name}Renamed` };
  return { model: model?.name ?? "", field: field?.name ?? "" };
}

test(
  "random changes, each undone: the project is as it started",
  async () => {
    let total = 0;
    await fc.assert(
      fc.asyncProperty(fc.array(step, { minLength: 1, maxLength: 4 }), async (steps) => {
        const dir = project();
        const start = git(dir, ["rev-parse", "HEAD^{tree}"]).out;
        let applied = 0;
        for (const s of steps) {
          const io = captureIo();
          const code = await runOperation(dir, io, s.op, argsFor(dir, s) as never, {
            yes: true,
            reportLater: true,
          });
          if (code === 0) applied++;
          else
            expect(io.stderr.trim().length, `${s.op} refused without a reason`).toBeGreaterThan(0);
        }
        total += applied;
        for (let i = 0; i < applied; i++) {
          const io = captureIo();
          expect(undo(dir, io), io.stderr).toBe(0);
        }
        expect(git(dir, ["rev-parse", "HEAD^{tree}"]).out).toBe(start);
        expect(git(dir, ["status", "--porcelain"]).out.trim()).toBe("");
      }),
      {
        numRuns: Number(import.meta.env.FC_RUNS ?? 6 * SCALE),
        seed: Number(import.meta.env.FC_SEED ?? 1),
      },
    );
    // Some changes went in, or the property tests nothing.
    expect(total).toBeGreaterThan(0);
  },
  120_000 * SCALE,
);
