import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PEOPLE_MAX } from "@smithable/core";
import { expect, test } from "vitest";
import { git } from "./git.js";
import { type ScenarioControls, sampleRunner } from "./sample-run.js";
import {
  captureScenario,
  projectScenarioContext,
  readScenario,
  type ScenarioContext,
  validateScenario,
  writeScenario,
} from "./sample-scenario.js";
import { tempDir } from "./test-dir.js";

const CLOCK = "2026-10-29T10:00:00.000Z";
const PEOPLE = [
  { id: "sample-alice", name: "Alice", role: "member", persona: "Synthetic actor", pace: 1 },
  { id: "sample-bob", name: "Bob", role: "member", persona: "Synthetic actor", pace: 1 },
];
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
async function fixture() {
  const root = tempDir("scenario-"),
    active = join(root, "active.db"),
    snapshot = join(root, "initial.db"),
    spec = join(root, "schema.txt");
  writeFileSync(spec, "Booking v1: places integer, actor text");
  let db = new DatabaseSync(active),
    clock = CLOCK;
  db.exec(
    "CREATE TABLE bookings(id INTEGER PRIMARY KEY,actor TEXT NOT NULL,places INTEGER NOT NULL)",
  );
  db.exec(`VACUUM INTO '${snapshot}'`);
  const digest = hash(readFileSync(snapshot));
  let acts = 0,
    moveReads = 0,
    available = true;
  const door = async (path: string, body?: unknown) => {
    if (path.startsWith("moves?")) {
      moveReads++;
      return Response.json({
        now: clock,
        moves: available
          ? [
              {
                id: "add:Booking",
                kind: "add",
                model: "Booking",
                slots: [{ field: "places", kind: "number", required: true, min: 1, max: 4 }],
              },
            ]
          : [],
      });
    }
    acts++;
    const act = body as { user: string; values: { places: number } };
    if (!Number.isInteger(act.values.places) || act.values.places < 1 || act.values.places > 4)
      return Response.json({ refused: true, message: "Places must be 1 to 4." }, { status: 409 });
    db.prepare("INSERT INTO bookings(actor,places) VALUES(?,?)").run(act.user, act.values.places);
    return Response.json({ ok: true });
  };
  const current = (): ScenarioContext => ({
    specRevision: hash(readFileSync(spec)),
    appRevision: hash("Native SQLite fixture adapter v1"),
    seed: 7,
    snapshot: { id: "initial-empty-bookings", digest },
    clock: CLOCK,
    actors: PEOPLE.map(({ id, role }) => ({ id, role })),
    versions: {
      engine: "fixture-v1",
      stackProfile: "sqlite-fixture",
      dependencies: { node: process.versions.node },
    },
  });
  const runner = (seed = 7, loadPeople = () => PEOPLE) =>
    sampleRunner({
      door,
      load: () => ({ people: loadPeople(), summary: "" }),
      providers: () => [],
      changed: () => {},
      seed,
    });
  const first = runner();
  first.replay(
    [2, 3, 4, 99].map((places, turn) => ({
      turn,
      id: PEOPLE[turn % 2]?.id as string,
      listed: ["add:Booking"],
      move: "add:Booking",
      values: { places },
      outcome: places === 99 ? "refused" : "done",
    })),
  );
  for (let i = 0; i < 4; i++) await first.step();
  const plan = captureScenario(current(), first.log(), [
    { expectedOutcome: "done", checks: { count: 1, places: [2], actors: ["sample-alice"] } },
    {
      expectedOutcome: "done",
      checks: { count: 2, places: [2, 3], actors: ["sample-alice", "sample-bob"] },
    },
    {
      expectedOutcome: "done",
      checks: {
        count: 3,
        places: [2, 3, 4],
        actors: ["sample-alice", "sample-bob", "sample-alice"],
      },
    },
    {
      expectedOutcome: "refused",
      checks: {
        count: 3,
        places: [2, 3, 4],
        actors: ["sample-alice", "sample-bob", "sample-alice"],
      },
    },
  ]);
  const rows = () =>
    db.prepare("SELECT actor,places FROM bookings ORDER BY id").all() as {
      actor: string;
      places: number;
    }[];
  let resets = 0;
  const controls: ScenarioControls = {
    current,
    reset: async (expected) => {
      resets++;
      db.close();
      copyFileSync(snapshot, active);
      const restored = hash(readFileSync(active));
      db = new DatabaseSync(active);
      expect(db.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
      return { id: expected.id, digest: restored };
    },
    clock: async (at) => {
      clock = at;
    },
    observe: async () => {
      const found = rows();
      return {
        count: found.length,
        places: found.map((r) => r.places),
        actors: found.map((r) => r.actor),
      };
    },
  };
  return {
    root,
    plan,
    runner,
    controls,
    rows,
    spec,
    close: () => db.close(),
    resets: () => resets,
    acts: () => acts,
    moveReads: () => moveReads,
    setClock: (value: string) => {
      clock = value;
    },
    hideMove: () => {
      available = false;
    },
  };
}
test("persisted versioned replay repeats literal business outcomes on independently verified reset data", async () => {
  const f = await fixture();
  try {
    const path = join(f.root, "scenario.json");
    writeScenario(path, f.plan);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    for (let run = 0; run < 2; run++) {
      const next = f.runner(999),
        plan = readScenario(path);
      await next.replayScenario(plan, f.controls);
      (plan.steps[0]?.action.values as Record<string, unknown>).places = 99;
      for (let i = 0; i < 4; i++) await next.step();
      expect(next.scenarioResult()).toMatchObject({ status: "passed", checked: 4 });
      expect(f.rows()).toEqual([
        { actor: "sample-alice", places: 2 },
        { actor: "sample-bob", places: 3 },
        { actor: "sample-alice", places: 4 },
      ]);
      const acts = f.acts();
      await next.step();
      expect(f.acts()).toBe(acts);
    }
    expect(f.resets()).toBe(2);
  } finally {
    f.close();
  }
});
test("changed schema refuses replay before reset or any action", async () => {
  const f = await fixture();
  try {
    writeFileSync(f.spec, "Booking v2: places integer, actor text, tag text");
    const acts = f.acts();
    await expect(f.runner().replayScenario(f.plan, f.controls)).rejects.toThrow("incompatible");
    expect(f.resets()).toBe(0);
    expect(f.acts()).toBe(acts);
    expect(f.rows()).toHaveLength(3);
  } finally {
    f.close();
  }
});
test("a contradictory independent outcome stops further mutations", async () => {
  const f = await fixture();
  try {
    const bad = structuredClone(f.plan);
    if (bad.steps[1]) bad.steps[1].checks.count = 999;
    const next = f.runner();
    await next.replayScenario(bad, f.controls);
    for (let i = 0; i < 4; i++) await next.step();
    expect(next.scenarioResult()).toMatchObject({ status: "failed", checked: 1 });
    expect(f.rows()).toHaveLength(2);
  } finally {
    f.close();
  }
});
test("missing moves and unverifiable clocks cannot become a random replay", async () => {
  const f = await fixture();
  try {
    const next = f.runner();
    await next.replayScenario(f.plan, f.controls);
    f.hideMove();
    const acts = f.acts();
    await next.step();
    await next.step();
    expect(next.scenarioResult()?.status).toBe("failed");
    expect(f.acts()).toBe(acts);
  } finally {
    f.close();
  }
  const g = await fixture();
  try {
    const next = g.runner();
    await next.replayScenario(g.plan, {
      ...g.controls,
      clock: async () => {
        g.setClock("2026-10-30T10:00:00.000Z");
      },
    });
    const acts = g.acts();
    await next.step();
    expect(next.scenarioResult()?.status).toBe("failed");
    expect(g.acts()).toBe(acts);
  } finally {
    g.close();
  }
});

test("non-finite observations and incomplete expectations cannot satisfy replay", async () => {
  const f = await fixture();
  try {
    expect(() =>
      captureScenario(
        f.plan.context,
        f.plan.steps.map((step) => step.action),
        [],
      ),
    ).toThrow("expectation");
    const bad = structuredClone(f.plan);
    if (bad.steps[0]) bad.steps[0].checks.count = null;
    const next = f.runner();
    await next.replayScenario(bad, { ...f.controls, observe: async () => ({ count: Number.NaN }) });
    await next.step();
    expect(next.scenarioResult()?.status).toBe("failed");
  } finally {
    f.close();
  }
});

test("pending reset cannot overlap actions and cancellation waits for reset settlement", async () => {
  const f = await fixture();
  try {
    let release!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    const next = f.runner(),
      acts = f.acts();
    const beginning = next.replayScenario(f.plan, {
      ...f.controls,
      reset: async (snapshot) => {
        await gate;
        return f.controls.reset(snapshot);
      },
    });
    const rejected = expect(beginning).rejects.toThrow("cancelled");
    await expect(next.step()).rejects.toThrow("reset is still in progress");
    next.pause();
    const drained = next.drain();
    release();
    await rejected;
    await drained;
    await next.step();
    expect(next.scenarioResult()?.status).toBe("failed");
    expect(f.acts()).toBe(acts);
  } finally {
    f.close();
  }
});
test("pausing during an independent observation cannot become a pass or dispatch the next action", async () => {
  const f = await fixture();
  try {
    let release!: () => void, started!: () => void;
    const gate = new Promise<void>((done) => {
        release = done;
      }),
      observing = new Promise<void>((done) => {
        started = done;
      });
    const next = f.runner();
    await next.replayScenario(f.plan, {
      ...f.controls,
      observe: async (step) => {
        started();
        await gate;
        return f.controls.observe(step);
      },
    });
    const pending = next.step();
    await observing;
    next.pause();
    const acts = f.acts();
    release();
    await pending;
    await next.drain();
    await next.step();
    expect(next.scenarioResult()?.status).toBe("failed");
    expect(f.acts()).toBe(acts);
    expect(f.rows()).toHaveLength(1);
  } finally {
    f.close();
  }
});
test("incompatible preparation cannot fall back to a random walk", async () => {
  const f = await fixture();
  try {
    const next = f.runner(),
      acts = f.acts(),
      wrong = structuredClone(f.plan);
    wrong.context.specRevision = "f".repeat(64);
    await expect(next.replayScenario(wrong, f.controls)).rejects.toThrow("incompatible");
    await expect(next.step()).rejects.toThrow("fresh runner");
    expect(f.acts()).toBe(acts);
  } finally {
    f.close();
  }
});

test("adapter arguments cannot rewrite the pinned snapshot or independent expectations", async () => {
  const f = await fixture();
  try {
    const badReset = f.runner(),
      acts = f.acts();
    await expect(
      badReset.replayScenario(f.plan, {
        ...f.controls,
        reset: async (expected) => {
          expected.digest = "f".repeat(64);
          return expected;
        },
      }),
    ).rejects.toThrow("snapshot identity");
    await badReset.step();
    expect(f.acts()).toBe(acts);
    const next = f.runner();
    await next.replayScenario(f.plan, {
      ...f.controls,
      observe: async (step) => {
        step.checks.count = 999;
        return step.checks;
      },
    });
    await next.step();
    expect(next.scenarioResult()?.status).toBe("failed");
    expect(f.rows()).toHaveLength(1);
  } finally {
    f.close();
  }
});
test("project scenario identity is refreshed from source while reset data stays separate", () => {
  const dir = tempDir("scenario-context-");
  writeFileSync(join(dir, ".gitignore"), "data/\n");
  writeFileSync(join(dir, "smithable.yml"), "schema v1");
  writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { fixture: "1.0.0" } }));
  expect(git(dir, ["init", "-q"]).ok).toBe(true);
  const settings = {
    seed: 7,
    snapshot: { id: "empty", digest: "a".repeat(64) },
    clock: CLOCK,
    actors: PEOPLE.map(({ id, role }) => ({ id, role })),
  };
  const before = projectScenarioContext(dir, settings);
  mkdirSync(join(dir, "data"));
  writeFileSync(join(dir, "data/live.db"), "changed runtime data");
  expect(projectScenarioContext(dir, settings)).toEqual(before);
  writeFileSync(join(dir, "custom.ts"), "source changed");
  const custom = projectScenarioContext(dir, settings);
  expect(custom.appRevision).not.toBe(before.appRevision);
  expect(custom.specRevision).toBe(before.specRevision);
  writeFileSync(join(dir, "smithable.yml"), "schema v2");
  expect(projectScenarioContext(dir, settings).specRevision).not.toBe(before.specRevision);
});

test("record targets reject empty, ambiguous and empty-list identities", async () => {
  const f = await fixture();
  try {
    for (const target of [{}, { record: 1, records: [2] }, { records: [] }]) {
      const bad = structuredClone(f.plan);
      const first = bad.steps[0];
      if (!first) throw new Error("Missing fixture step");
      first.action.target = target;
      expect(() => validateScenario(bad)).toThrow("target ids");
    }
  } finally {
    f.close();
  }
});
test("clearing an admitted scenario never permits random work on its runner", async () => {
  const f = await fixture();
  try {
    const next = f.runner();
    await next.replayScenario(f.plan, f.controls);
    next.clear();
    expect(() => next.start(true)).toThrow("fresh runner");
    await expect(next.step()).rejects.toThrow("fresh runner");
  } finally {
    f.close();
  }
});

test("a removed replay actor is refused without skipping to another action", async () => {
  const f = await fixture();
  try {
    let people = PEOPLE;
    const next = f.runner(7, () => people);
    await next.replayScenario(f.plan, f.controls);
    people = PEOPLE.slice(1);
    next.state();
    const acts = f.acts();
    await next.step();
    expect(next.scenarioResult()).toMatchObject({ status: "failed", checked: 0 });
    expect(f.acts()).toBe(acts);
  } finally {
    f.close();
  }
});
test("scenario actor rosters beyond the runner capacity fail before resetting data", async () => {
  const f = await fixture();
  try {
    const first = PEOPLE[0];
    if (!first) throw new Error("Missing actor fixture");
    const people = Array.from({ length: PEOPLE_MAX + 1 }, (_, i) => ({
      ...first,
      id: `sample-${i}`,
    }));
    const plan = structuredClone(f.plan);
    plan.context.actors = people.map(({ id, role }) => ({ id, role }));
    for (const step of plan.steps) step.action.id = "sample-0";
    const next = f.runner(7, () => people);
    await expect(
      next.replayScenario(plan, { ...f.controls, current: () => plan.context }),
    ).rejects.toThrow("capacity");
    expect(f.resets()).toBe(0);
  } finally {
    f.close();
  }
});

test("pause during clock preparation performs no further door requests", async () => {
  const f = await fixture();
  try {
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    const began = new Promise<void>((done) => {
      entered = done;
    });
    const next = f.runner();
    await next.replayScenario(f.plan, {
      ...f.controls,
      clock: async () => {
        entered();
        await gate;
      },
    });
    const reads = f.moveReads();
    const pending = next.step();
    await began;
    next.pause();
    release();
    await pending;
    expect(f.moveReads()).toBe(reads);
    expect(next.scenarioResult()?.status).toBe("failed");
  } finally {
    f.close();
  }
});

test("clear fences late clock errors and pending reset results", async () => {
  const f = await fixture();
  try {
    let reject!: (error: Error) => void, entered!: () => void;
    const gate = new Promise<void>((_, fail) => {
      reject = fail;
    });
    const began = new Promise<void>((done) => {
      entered = done;
    });
    const next = f.runner();
    await next.replayScenario(f.plan, {
      ...f.controls,
      clock: async () => {
        entered();
        await gate;
      },
    });
    const pending = next.step();
    await began;
    next.clear();
    reject(new Error("late clock failure"));
    await pending;
    expect(next.log()).toEqual([]);
    expect(next.scenarioResult()).toBeUndefined();
    let release!: () => void;
    const resetGate = new Promise<void>((done) => {
      release = done;
    });
    const another = f.runner();
    const preparing = another.replayScenario(f.plan, {
      ...f.controls,
      reset: async (snapshot) => {
        await resetGate;
        return f.controls.reset(snapshot);
      },
    });
    const cancelled = expect(preparing).rejects.toThrow("cancelled");
    another.clear();
    release();
    await cancelled;
    expect(another.scenarioResult()).toBeUndefined();
  } finally {
    f.close();
  }
});
test("concurrent step requests preserve scenario actor order", async () => {
  const f = await fixture();
  try {
    const next = f.runner();
    await next.replayScenario(f.plan, f.controls);
    await Promise.all([next.step(), next.step()]);
    expect(next.scenarioResult()).toMatchObject({ status: "running", checked: 2 });
    expect(f.rows()).toEqual([
      { actor: "sample-alice", places: 2 },
      { actor: "sample-bob", places: 3 },
    ]);
    const bad = structuredClone(f.plan);
    if (bad.steps[0]) bad.steps[0].action.kind = "delete";
    expect(() => validateScenario(bad)).toThrow("record action target");
  } finally {
    f.close();
  }
});
