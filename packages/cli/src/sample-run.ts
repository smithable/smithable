// The sample users' runner (docs/design/sample-users.md §4–§6): the host's loop that makes the
// project's sample users act in the preview through the app's development door. Each turn reads
// the moves open to one person now, picks one (the model, from the persona; or the seeded random
// walk) and performs it as their session; the app's answer is a line in the feed. One move at a
// time per project, each person at their pace, within the caps.
import { chooseMove, type OpenMove, type Provider, type Usage } from "@smithable/ai";
import { type FieldValue, PEOPLE_MAX, seeded, valueFor, walk } from "@smithable/core";

export interface SamplePerson {
  /** The door's id: `sample-<slug>`, or `visitor`. */
  id: string;
  name: string;
  role: string;
  persona: string;
  /** Minutes between moves. */
  pace: number;
}

export interface FeedLine {
  at: string;
  /** The person's door id. */
  id: string;
  who: string;
  /** The move in words: "Added a Booking". */
  text: string;
  why?: string;
  /** done; refused (the app doing its job); finding (a fault: a crash, or a move it listed refused); miss (the model's). */
  outcome: "done" | "refused" | "finding" | "miss";
  message?: string;
  /** The random walk's seed for this turn, to replay a finding. */
  seed?: number;
}

export interface PeopleState {
  running: boolean;
  /** The random walk without a model and without pauses. */
  fast: boolean;
  people: (SamplePerson & { last?: string })[];
  feed: FeedLine[];
  moves: number;
  cost: number;
  currency: string;
  /** Why the run stopped by itself. */
  stopped?: string;
}

/** At most this many moves an hour per project (sample-users.md §4). */
export const MOVES_PER_HOUR = 300;
/** A run stops after an hour in which nobody touched Studio. */
export const IDLE_STOP = 60 * 60_000;
const FEED_MAX = 200;
/** The pause between moves in a fast run, so the preview still shows them land. */
const FAST_GAP = 250;

/** A move in the feed's words. */
export function moveWords(move: OpenMove): string {
  switch (move.kind) {
    case "open":
      return `Opened ${move.route}`;
    case "add":
      return `Added a ${move.model}`;
    case "change":
      return `Changed a ${move.model}`;
    case "delete":
      return `Deleted a ${move.model}`;
    case "run":
      return `Ran ${move.action}${move.model ? ` on a ${move.model}` : ""}`;
  }
}

export function sampleRunner(options: {
  /** A call on the app's door: `moves?user=…`, or a side with its body. */
  door: (path: string, body?: unknown) => Promise<Response>;
  /** The project's sample users and the app in words, read at each start. */
  load: () => { people: SamplePerson[]; summary: string };
  providers: () => Provider[];
  changed: (state: PeopleState) => void;
  now?: () => number;
  seed?: number;
}) {
  const now = options.now ?? Date.now;
  const state: PeopleState = {
    running: false,
    fast: false,
    people: [],
    feed: [],
    moves: 0,
    cost: 0,
    currency: "EUR",
  };
  let summary = "";
  let seed = options.seed ?? now() % 1_000_000;
  let turns = 0;
  let touched = now();
  let hour: number[] = [];
  const next = new Map<string, number>();
  const recent = new Map<string, string[]>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** The turn under way: moves are serialized among themselves. */
  let chain: Promise<void> = Promise.resolve();

  const changed = () => options.changed(snapshot());
  const snapshot = (): PeopleState => ({
    ...state,
    people: state.people.map((p) => ({ ...p })),
    feed: [...state.feed],
  });
  const line = (person: SamplePerson, entry: Omit<FeedLine, "at" | "id" | "who">) => {
    const full = { at: new Date(now()).toISOString(), id: person.id, who: person.name, ...entry };
    state.feed = [...state.feed, full].slice(-FEED_MAX);
    const shown = state.people.find((p) => p.id === person.id);
    if (shown) shown.last = entry.message ? `${entry.text}: ${entry.message}` : entry.text;
    if (entry.outcome !== "miss") {
      recent.set(person.id, [...(recent.get(person.id) ?? []), entry.text].slice(-5));
    }
  };
  const spend = (usage: Usage[]) => {
    for (const u of usage) {
      state.cost += u.cost;
      state.currency = u.currency;
    }
  };

  function load(): boolean {
    const loaded = options.load();
    summary = loaded.summary;
    state.people = loaded.people.slice(0, PEOPLE_MAX);
    return state.people.length > 0;
  }

  /** One turn of one person: the moves open now, one picked, performed; the answer in the feed. */
  async function turn(person: SamplePerson): Promise<void> {
    const n = turns++;
    const turnSeed = seed + n;
    const listed = await options
      .door(`moves?user=${encodeURIComponent(person.id)}`)
      .catch(() => undefined);
    if (!listed?.ok) {
      stop(
        listed?.status === 404
          ? "The preview's door did not open: the app may still be starting, or was made before sample users."
          : "The preview did not answer.",
      );
      return;
    }
    const { now: appNow, moves: all } = (await listed.json()) as {
      now: string;
      moves: OpenMove[];
    };
    // A page opened changes nothing anyone sees: the moves are the ones that do.
    const moves = all.filter((m) => m.kind !== "open");
    const providers = state.fast ? [] : options.providers();
    let id: string | undefined;
    let values: Record<string, FieldValue | null> = {};
    let why: string | undefined;
    if (providers[0]) {
      const choice = await chooseMove({
        person,
        summary,
        recent: recent.get(person.id) ?? [],
        moves,
        provider: providers[0],
      });
      spend(choice.usage);
      if ("miss" in choice) {
        line(person, { text: "Missed a turn", outcome: "miss", message: choice.miss });
        return;
      }
      ({ move: id, values, why } = choice);
    } else {
      const [step] = walk(moves, turnSeed, 1, new Date(appNow));
      if (!step) {
        line(person, { text: "Had nothing to do", outcome: "miss", message: "No move is open." });
        return;
      }
      ({ move: id, values } = step);
    }
    const move = moves.find((m) => m.id === id) as OpenMove;
    const rnd = seeded(turnSeed);
    const one = (ids: number[]) => ids[Math.floor(rnd() * ids.length)];
    const filled: Record<string, FieldValue | null> = { ...values };
    // What the model left out of a required slot, the sample rules fill; a reference is the
    // app's own pick among the records the person may see.
    for (const slot of "slots" in move ? move.slots : []) {
      const candidates = move.candidates?.[slot.field];
      if (slot.kind === "reference") {
        if (candidates?.length && (slot.field in filled || slot.required))
          filled[slot.field] = one(candidates) ?? null;
      } else if (slot.required && (filled[slot.field] ?? null) === null)
        filled[slot.field] = valueFor(slot, rnd, new Date(appNow));
    }
    const target =
      move.records && move.records.length
        ? move.kind === "run" && move.rows
          ? { records: [one(move.records)] }
          : { record: one(move.records) }
        : {};
    const answer = await options
      .door("act", { user: person.id, move: move.id, values: filled, ...target })
      .catch(() => undefined);
    state.moves++;
    hour.push(now());
    const text = moveWords(move);
    if (answer?.ok) {
      line(person, { text, outcome: "done", ...(why ? { why } : {}) });
      return;
    }
    const said = (await answer?.json().catch(() => undefined)) as
      | { refused?: boolean; message?: string }
      | undefined;
    line(person, {
      text,
      ...(why ? { why } : {}),
      outcome: said?.refused ? "refused" : "finding",
      message: said?.message ?? (answer ? `The app answered ${answer.status}.` : "No answer."),
      ...(said?.refused ? {} : { seed: turnSeed }),
    });
  }

  /** Serialized: a turn starts when the one before it ended. */
  const queued = (person: SamplePerson) => {
    chain = chain.then(() => turn(person)).finally(changed);
    return chain;
  };

  function capped(): string | undefined {
    hour = hour.filter((t) => now() - t < 60 * 60_000);
    if (hour.length >= MOVES_PER_HOUR)
      return `Stopped at ${MOVES_PER_HOUR} moves this hour, the most a project makes.`;
    if (now() - touched > IDLE_STOP) return "Stopped after an hour in which nobody used Studio.";
    return undefined;
  }

  function schedule() {
    clearTimeout(timer);
    if (!state.running) return;
    const due = [...next.entries()].sort((a, b) => a[1] - b[1])[0];
    if (!due) return;
    timer = setTimeout(
      async () => {
        if (!state.running) return;
        const why = capped();
        if (why) return stop(why);
        const person = state.people.find((p) => p.id === due[0]);
        if (!person) return;
        await queued(person);
        next.set(person.id, now() + (state.fast ? FAST_GAP : person.pace * 60_000));
        schedule();
      },
      Math.max(0, due[1] - now()),
    );
  }

  function stop(why?: string) {
    clearTimeout(timer);
    state.running = false;
    if (why) state.stopped = why;
    else delete state.stopped;
    changed();
  }

  return {
    state: snapshot,
    /** Studio was used: the idle stop counts from now. */
    touch() {
      touched = now();
    },
    /** Lets them run: with the model at their pace, or `fast`, the random walk without pauses. */
    start(fast = false) {
      touched = now();
      delete state.stopped;
      if (!load()) return stop("No sample users: add some to samples/people.yml.");
      if (!state.running) seed = options.seed ?? now() % 1_000_000;
      state.running = true;
      state.fast = fast;
      next.clear();
      // One after another at first, a few seconds apart, rather than all at once.
      state.people.forEach((p, i) => next.set(p.id, now() + i * (fast ? FAST_GAP : 3000)));
      changed();
      schedule();
    },
    pause() {
      stop();
    },
    /** One move now, by whoever is due next. */
    async step() {
      touched = now();
      if (!state.people.length && !load())
        return stop("No sample users: add some to samples/people.yml.");
      const why = capped();
      if (why) return stop(why);
      const due = [...state.people].sort(
        (a, b) => (next.get(a.id) ?? 0) - (next.get(b.id) ?? 0),
      )[0] as SamplePerson;
      next.set(due.id, now() + due.pace * 60_000);
      await queued(due);
      schedule();
    },
    /** Forgets the feed and the counts, as "Remove sample data" forgets what they did. */
    clear() {
      state.feed = [];
      state.moves = 0;
      state.cost = 0;
      recent.clear();
      for (const p of state.people) delete p.last;
      changed();
    },
  };
}

export type SampleRunner = ReturnType<typeof sampleRunner>;
