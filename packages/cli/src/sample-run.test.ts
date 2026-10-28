import { expect, test, vi } from "vitest";
import { type PeopleState, sampleRunner } from "./sample-run.js";

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

test("the model's choice is used, and its miss forfeits the turn", async () => {
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
  expect(acts).toHaveLength(1);
  expect(runner.state().feed[1]).toMatchObject({ outcome: "miss" });
});
