import { expect, test, vi } from "vitest";
import { moveWords, type PeopleState, sampleRunner } from "./sample-run.js";

const MOVES = [
  { id: "open:sessions", kind: "open", page: "sessions", route: "/sessions" },
  {
    id: "add:Booking",
    kind: "add",
    model: "Booking",
    slots: [
      { field: "session", kind: "reference", required: true, model: "Session" },
      { field: "places", kind: "number", required: true, min: 1, max: 4 },
    ],
    candidates: { session: [3, 5] },
  },
  { id: "delete:Booking", kind: "delete", model: "Booking", records: [9] },
];

const PEOPLE = [
  { id: "sample-maja", name: "Maja", role: "member", persona: "A regular.", pace: 1 },
  { id: "sample-tomas", name: "Tomas", role: "member", persona: "New.", pace: 2 },
];

/** A door that answers the moves above and refuses every third act, as the app would. */
function fakeDoor(
  answers: (n: number) => Response = (n) =>
    Response.json({ ok: true }, { status: n % 3 === 2 ? 409 : 200 }),
) {
  const acts: Record<string, unknown>[] = [];
  const door = async (path: string, body?: unknown) => {
    if (path.startsWith("moves?"))
      return Response.json({ now: "2026-10-29T10:00:00.000Z", moves: MOVES });
    acts.push(body as Record<string, unknown>);
    const answer = answers(acts.length - 1);
    return answer.status === 409
      ? Response.json(
          { refused: true, status: 409, message: "The session is full." },
          { status: 409 },
        )
      : answer;
  };
  return { door, acts };
}

test("a step walks one move as the person due next, references and records picked from the door's", async () => {
  const { door, acts } = fakeDoor();
  const states: PeopleState[] = [];
  const runner = sampleRunner({
    door,
    load: () => ({ people: PEOPLE, summary: "" }),
    providers: () => [],
    changed: (s) => states.push(s),
    seed: 7,
  });
  await runner.step();
  await runner.step();
  await runner.step();
  expect(acts).toHaveLength(3);
  for (const act of acts) {
    expect(["sample-maja", "sample-tomas"]).toContain(act.user);
    // Opening a page is never a move the runner makes.
    expect(act.move).not.toBe("open:sessions");
    if (act.move === "add:Booking") {
      const values = act.values as Record<string, number>;
      expect([3, 5]).toContain(values.session);
      expect(values.places).toBeGreaterThanOrEqual(1);
    } else expect(act.record).toBe(9);
  }
  const state = runner.state();
  expect(state.moves).toBe(3);
  expect(state.feed.map((l) => l.outcome)).toEqual(["done", "done", "refused"]);
  expect(state.feed[2]?.message).toBe("The session is full.");
  expect(state.people.find((p) => p.id === state.feed[2]?.id)?.last).toMatch(
    /: The session is full\.$/,
  );
});

test("the same seed walks the same moves", async () => {
  const run = async () => {
    const { door, acts } = fakeDoor();
    const runner = sampleRunner({
      door,
      load: () => ({ people: PEOPLE, summary: "" }),
      providers: () => [],
      changed: () => {},
      seed: 11,
    });
    for (let i = 0; i < 6; i++) await runner.step();
    return acts;
  };
  expect(await run()).toEqual(await run());
});

test("a server error is a finding with its seed; a refusal is not", async () => {
  const { door } = fakeDoor(() => new Response("boom", { status: 500 }));
  const runner = sampleRunner({
    door,
    load: () => ({ people: PEOPLE, summary: "" }),
    providers: () => [],
    changed: () => {},
    seed: 3,
  });
  await runner.step();
  const [line] = runner.state().feed;
  expect(line?.outcome).toBe("finding");
  expect(line?.seed).toBe(3);
});

test("a door that does not open stops the run and says why; no people says so too", async () => {
  const shut = sampleRunner({
    door: async () => new Response("Not found", { status: 404 }),
    load: () => ({ people: PEOPLE, summary: "" }),
    providers: () => [],
    changed: () => {},
  });
  await shut.step();
  expect(shut.state().running).toBe(false);
  expect(shut.state().stopped).toMatch(/door did not open/);
  const none = sampleRunner({
    door: fakeDoor().door,
    load: () => ({ people: [], summary: "" }),
    providers: () => [],
    changed: () => {},
  });
  none.start();
  expect(none.state()).toMatchObject({
    running: false,
    stopped: expect.stringMatching(/No sample users/),
  });
});

test("a run moves each person at their pace, and stops after an hour without anyone touching Studio", async () => {
  vi.useFakeTimers({ now: 0 });
  try {
    const { door, acts } = fakeDoor();
    const runner = sampleRunner({
      door,
      load: () => ({ people: PEOPLE, summary: "" }),
      providers: () => [],
      changed: () => {},
    });
    runner.start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(acts.map((a) => a.user)).toEqual(["sample-maja", "sample-tomas"]);
    // Maja moves every minute, Tomas every two.
    await vi.advanceTimersByTimeAsync(2 * 60_000);
    expect(acts.filter((a) => a.user === "sample-maja")).toHaveLength(3);
    expect(acts.filter((a) => a.user === "sample-tomas")).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(runner.state().running).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

test("touching Studio keeps a run going", async () => {
  vi.useFakeTimers({ now: 0 });
  try {
    const { door } = fakeDoor();
    const runner = sampleRunner({
      door,
      load: () => ({ people: PEOPLE, summary: "" }),
      providers: () => [],
      changed: () => {},
    });
    runner.start();
    await vi.advanceTimersByTimeAsync(50 * 60_000);
    runner.touch();
    await vi.advanceTimersByTimeAsync(50 * 60_000);
    expect(runner.state().running).toBe(true);
    await vi.advanceTimersByTimeAsync(11 * 60_000);
    expect(runner.state()).toMatchObject({
      running: false,
      stopped: expect.stringMatching(/nobody used Studio/),
    });
  } finally {
    vi.useRealTimers();
  }
});

test("the model's choice is used, and on its miss the person draws from their memory", async () => {
  const { door, acts } = fakeDoor();
  let answer = { move: "add:Booking", values: { places: 2 }, why: "Books for two." };
  const provider = {
    name: "fake",
    tier: "smithable" as const,
    price: { input: 0, output: 0 },
    complete: async () => ({
      text: JSON.stringify(answer),
      model: "fake",
      inputTokens: 10,
      outputTokens: 5,
    }),
  };
  const runner = sampleRunner({
    door,
    load: () => ({ people: PEOPLE, summary: "Bookings." }),
    providers: () => [provider as never],
    changed: () => {},
    seed: 1,
  });
  await runner.step();
  expect(acts[0]).toMatchObject({ move: "add:Booking", values: { places: 2 } });
  expect(runner.state().feed[0]).toMatchObject({ outcome: "done", why: "Books for two." });
  answer = { move: "add:Booking", values: { owner: 1 } as never, why: "" };
  await runner.step();
  expect(acts).toHaveLength(2);
  expect(runner.state().feed[1]?.why).toMatch(/^Drawn from what they did/);
});

test("a pause while a turn reads the moves makes no move; a turn that breaks is a finding and the next goes on", async () => {
  let release: () => void = () => {};
  const acts: unknown[] = [];
  let broken = true;
  const door = async (path: string, body?: unknown) => {
    if (path.startsWith("moves?")) {
      if (broken) {
        broken = false;
        return new Response("not json", { status: 200 });
      }
      await new Promise<void>((r) => {
        release = r;
      });
      return Response.json({ now: "2026-10-29T10:00:00.000Z", moves: MOVES });
    }
    acts.push(body);
    return Response.json({ ok: true });
  };
  const runner = sampleRunner({
    door,
    load: () => ({ people: PEOPLE, summary: "" }),
    providers: () => [],
    changed: () => {},
    seed: 2,
  });
  await runner.step();
  expect(runner.state().feed[0]).toMatchObject({ outcome: "finding", text: "Broke a turn" });
  const pending = runner.step();
  await new Promise((r) => setTimeout(r, 10));
  runner.pause();
  release();
  await pending;
  expect(acts).toHaveLength(0);
});

test("a move is said with the app's labels", () => {
  const labels = { Booking: "Booking", Instructor: "Instructor", cancel: "Cancel" };
  expect(moveWords({ id: "a", kind: "add", model: "Booking", slots: [] }, labels)).toBe(
    "Added a booking",
  );
  expect(moveWords({ id: "d", kind: "delete", model: "Instructor" }, labels)).toBe(
    "Deleted an instructor",
  );
  expect(
    moveWords({ id: "r", kind: "run", action: "cancel", model: "Booking", slots: [] }, labels),
  ).toBe("Ran Cancel on a booking");
});

test("sensible: a move the app refused rests for a few turns, and the log keeps every turn", async () => {
  // Every booking is refused; deleting is done.
  const { door, acts } = fakeDoor((n) => Response.json({ ok: true }, { status: 200 + n * 0 }));
  const refusing = async (path: string, body?: unknown) => {
    if (path.startsWith("moves?")) return door(path, body);
    const act = body as { move: string };
    acts.push(act);
    return act.move === "add:Booking"
      ? Response.json({ refused: true, message: "The session is full." }, { status: 409 })
      : Response.json({ ok: true });
  };
  const runner = sampleRunner({
    door: refusing,
    load: () => ({ people: [PEOPLE[0] as (typeof PEOPLE)[number]], summary: "" }),
    providers: () => [],
    changed: () => {},
    seed: 3,
  });
  for (let i = 0; i < 12; i++) await runner.step();
  const log = runner.log();
  expect(log).toHaveLength(12);
  expect(log[0]).toMatchObject({
    turn: 0,
    id: "sample-maja",
    listed: ["add:Booking", "delete:Booking"],
  });
  // Right after a refusal the same add rests: no move has touched bookings since.
  expect(log.some((e) => e.outcome === "refused")).toBe(true);
  for (const [i, entry] of log.entries())
    if (entry.outcome === "refused") expect(log[i + 1]?.move).not.toBe("add:Booking");
});

test("everything: each variant is judged by what the app had to do with it", async () => {
  const acts: Record<string, unknown>[] = [];
  // An app that takes everything, also what its rules forbid.
  const door = async (path: string, body?: unknown) => {
    if (path.startsWith("moves?"))
      return Response.json({ now: "2026-10-29T10:00:00.000Z", moves: MOVES });
    acts.push(body as Record<string, unknown>);
    return Response.json({ ok: true });
  };
  const runner = sampleRunner({
    door,
    load: () => ({ people: PEOPLE, summary: "" }),
    providers: () => {
      throw new Error("no model when trying everything");
    },
    changed: () => {},
    seed: 5,
  });
  runner.start(false, "everything");
  runner.pause();
  expect(runner.state()).toMatchObject({ mode: "everything", fast: true });
  for (let i = 0; i < 8; i++) await runner.step();
  const feed = runner.state().feed;
  // Every variant tried once before any twice.
  const ids = feed.map((l) => l.variant?.id);
  expect(new Set(ids.slice(0, 6)).size).toBe(6);
  // A forbidden value taken is a finding that says why; a valid one taken passes.
  const forbidden = feed.find((l) => l.variant?.expect === "refused");
  expect(forbidden).toMatchObject({ outcome: "finding" });
  expect(forbidden?.message).toMatch(/^Taken, but it should have been refused: /);
  expect(feed.find((l) => l.variant?.expect === "done")).toMatchObject({ outcome: "done" });
  const coverage = runner.state().coverage;
  expect(coverage?.tried).toBeGreaterThan(5);
  expect(coverage?.of).toBeGreaterThanOrEqual(coverage?.tried ?? 0);
  expect((coverage?.passes ?? 0) + (coverage?.findings ?? 0)).toBe(coverage?.tried);
});

test("a replay performs the logged moves in order, with their values and records", async () => {
  const first = fakeDoor();
  const runner = sampleRunner({
    door: first.door,
    load: () => ({ people: PEOPLE, summary: "" }),
    providers: () => [],
    changed: () => {},
    seed: 11,
  });
  for (let i = 0; i < 4; i++) await runner.step();
  const log = runner.log();
  const second = fakeDoor();
  const again = sampleRunner({
    door: second.door,
    load: () => ({ people: PEOPLE, summary: "" }),
    providers: () => [],
    changed: () => {},
    seed: 999,
  });
  again.replay(log);
  for (let i = 0; i < 4; i++) await again.step();
  expect(second.acts).toEqual(first.acts);
});
