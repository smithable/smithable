// The sample users' runner (docs/design/sample-users.md §4–§6): the host's loop that makes the
// project's sample users act in the preview through the app's development door. Each turn reads
// the moves open to one person now, picks one (the model, from the persona; or the seeded random
// walk) and performs it as their session; the app's answer is a line in the feed. One move at a
// time per project, each person at their pace, within the caps. A run is sensible (each person
// draws from their memory) or everything (the coverage walk over every move's variants), and
// every turn is written to the run's log, which the memory and the coverage are rebuilt from
// (§3a).
import { chooseMove, type OpenMove, type Provider, type Usage } from "@smithable/ai";
import {
  type Actor,
  choose,
  coverageWalk,
  emptyMemory,
  type FieldValue,
  type Memory,
  type Move,
  PEOPLE_MAX,
  seeded,
  valueFor,
  variantsOf,
} from "@smithable/core";

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
  /** Its place in the feed, counted from the first. */
  n: number;
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
  /** The turn's seed; with the run's log before it, a finding replays (§3a). */
  seed?: number;
  /** In a run that tries everything: the variant tried and what the app had to do with it. */
  variant?: { id: string; expect: "done" | "refused"; why: string };
}

/** Sensible: each person does what makes sense next. Everything: every move's variants, for faults. */
export type RunMode = "sensible" | "everything";

/**
 * One turn as the run's log keeps it (§3a): who, the moves listed to them then, the move made with
 * its values, and the app's answer. The memory, the coverage and the feed are read from it.
 */
export interface LogEntry {
  turn: number;
  /** The person's door id. */
  id: string;
  /** The moves open to them when the turn began. */
  listed: string[];
  move?: string;
  kind?: OpenMove["kind"];
  model?: string;
  values?: Record<string, FieldValue | null>;
  /** The record (or records) the move was made on, as the app picked. */
  target?: { record?: number; records?: number[] };
  outcome: FeedLine["outcome"];
  message?: string;
  variant?: FeedLine["variant"];
}

/** A run's tally of variants (everything): tried of all known, how many passed and how many are findings. */
export interface Coverage {
  tried: number;
  of: number;
  passes: number;
  findings: number;
}

export interface PeopleState {
  running: boolean;
  /** The random walk without a model and without pauses. */
  fast: boolean;
  mode: RunMode;
  /** Trying everything: the variants tried of all, the passes and the findings. */
  coverage?: Coverage;
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
/** The log a run keeps: enough for a long run's memory and coverage. */
const LOG_MAX = 5000;
/** The pause between moves in a fast run, so the preview still shows them land. */
const FAST_GAP = 250;

/** A move in the feed's words, with the app's labels: "Added a booking", "Ran Cancel on a booking". */
export function moveWords(move: OpenMove, labels: Record<string, string> = {}): string {
  const one = (model: string) => {
    const given = labels[model] ?? model;
    // "booking", but "API key" as it is.
    const label = /^[A-Z][a-z]/.test(given) ? given[0]?.toLowerCase() + given.slice(1) : given;
    return `${/^[aeiou]/.test(label) ? "an" : "a"} ${label}`;
  };
  switch (move.kind) {
    case "open":
      return `Opened ${move.route}`;
    case "add":
      return `Added ${one(move.model)}`;
    case "change":
      return `Changed ${one(move.model)}`;
    case "delete":
      return `Deleted ${one(move.model)}`;
    case "run":
      return `Ran ${labels[move.action] ?? move.action}${move.model ? ` on ${one(move.model)}` : ""}`;
    case "merge":
      return `Merged ${one(move.model)} into another`;
    case "split":
      return `Split ${one(move.model)}`;
  }
}

export function sampleRunner(options: {
  /** A call on the app's door: `moves?user=…`, or a side with its body. */
  door: (path: string, body?: unknown) => Promise<Response>;
  /** The project's sample users and the app in words, read at each start. */
  load: () => { people: SamplePerson[]; summary: string; labels?: Record<string, string> };
  providers: () => Provider[];
  changed: (state: PeopleState) => void;
  now?: () => number;
  seed?: number;
}) {
  const now = options.now ?? Date.now;
  const state: PeopleState = {
    running: false,
    fast: false,
    mode: "sensible",
    people: [],
    feed: [],
    moves: 0,
    cost: 0,
    currency: "EUR",
  };
  let summary = "";
  let labels: Record<string, string> = {};
  let seed = options.seed ?? now() % 1_000_000;
  let turns = 0;
  let lines = 0;
  let touched = now();
  let hour: number[] = [];
  const next = new Map<string, number>();
  /** The run's log (§3a): the truth the memory, the coverage and the feed's words come from. */
  let log: LogEntry[] = [];
  /** Every variant of every move a turn listed, by id: the coverage's "of". */
  const known = new Set<string>();
  /** Turns to perform as logged, instead of drawing (a replay). */
  let replaying: LogEntry[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** The turn under way: moves are serialized among themselves. */
  let chain: Promise<void> = Promise.resolve();
  /** Counted up by every start and stop: a turn begun before one makes no move after it. */
  let era = 0;

  const changed = () => options.changed(snapshot());
  const snapshot = (): PeopleState => ({
    ...state,
    people: state.people.map((p) => ({ ...p })),
    feed: [...state.feed],
    ...(state.mode === "everything" ? { coverage: coverage() } : {}),
  });
  /** What a person remembers, rebuilt from the log (§3a). */
  const memoryOf = (id: string): Memory => {
    const memory = emptyMemory();
    memory.turn = log.length ? (log.at(-1) as LogEntry).turn + 1 : 0;
    for (const entry of log) {
      if (entry.outcome === "done" && entry.model) memory.touched[entry.model] = entry.turn;
      if (entry.id !== id || !entry.move) continue;
      memory.recent = [...memory.recent, entry.move].slice(-5);
      if (entry.kind === "open") memory.opened.push(entry.move);
      if (entry.outcome === "refused") memory.refused.push({ move: entry.move, turn: entry.turn });
      if (entry.outcome === "done" && entry.kind === "add" && entry.model)
        memory.made[entry.model] = (memory.made[entry.model] ?? 0) + 1;
    }
    const last = log.findLast((e) => e.id === id && e.move);
    if (last?.outcome === "done" && last.kind === "add" && last.model) memory.justMade = last.model;
    return memory;
  };
  /** The variants tried and how they came out, from the log. */
  const coverage = (): Coverage => {
    // By variant: one that came out as a finding in any try is a finding.
    const found = new Map<string, boolean>();
    for (const e of log)
      if (e.variant)
        found.set(e.variant.id, (found.get(e.variant.id) ?? false) || e.outcome === "finding");
    const findings = [...found.values()].filter(Boolean).length;
    return {
      tried: found.size,
      of: Math.max(known.size, found.size),
      passes: found.size - findings,
      findings,
    };
  };
  const line = (
    person: SamplePerson,
    entry: Omit<FeedLine, "n" | "at" | "id" | "who">,
    logged: Omit<LogEntry, "turn" | "id" | "outcome" | "message" | "variant"> & { turn: number },
  ) => {
    log = [
      ...log,
      {
        ...logged,
        id: person.id,
        outcome: entry.outcome,
        ...(entry.message ? { message: entry.message } : {}),
        ...(entry.variant ? { variant: entry.variant } : {}),
      },
    ].slice(-LOG_MAX);
    const full = {
      n: lines++,
      at: new Date(now()).toISOString(),
      id: person.id,
      who: person.name,
      ...entry,
    };
    state.feed = [...state.feed, full].slice(-FEED_MAX);
    const shown = state.people.find((p) => p.id === person.id);
    if (shown) shown.last = entry.message ? `${entry.text}: ${entry.message}` : entry.text;
  };
  /** A person's last moves in words, with what the app refused, for a model's prompt (§3a). */
  const recentWords = (id: string): string[] =>
    state.feed
      .filter((l) => l.id === id && l.outcome !== "miss")
      .slice(-5)
      .map((l) => (l.outcome === "refused" ? `${l.text} (refused: ${l.message})` : l.text));
  const spend = (usage: Usage[]) => {
    for (const u of usage) {
      state.cost += u.cost;
      state.currency = u.currency;
    }
  };

  function load(): boolean {
    const loaded = options.load();
    summary = loaded.summary;
    labels = loaded.labels ?? {};
    // What each did last stays with them across a new read of the file.
    const last = new Map(state.people.map((p) => [p.id, p.last]));
    state.people = loaded.people.slice(0, PEOPLE_MAX).map((p) => {
      const was = last.get(p.id);
      return was ? { ...p, last: was } : p;
    });
    return state.people.length > 0;
  }

  /** One turn of one person: the moves open now, one picked, performed; the answer in the feed. */
  async function turn(person: SamplePerson, begun: number): Promise<void> {
    const n = turns++;
    const turnSeed = seed + n;
    const open = await options
      .door(`moves?user=${encodeURIComponent(person.id)}`)
      .catch(() => undefined);
    if (!open?.ok) {
      stop(
        open?.status === 404
          ? "The preview's door did not open: the app may still be starting, or was made before sample users."
          : "The preview did not answer.",
      );
      return;
    }
    const { now: appNow, moves: all } = (await open.json()) as {
      now: string;
      moves: OpenMove[];
    };
    // A page opened changes nothing anyone sees: the moves are the ones that do.
    const moves = all.filter((m) => m.kind !== "open");
    const at = new Date(appNow);
    const listed = moves.map((m) => m.id);
    const actor: Actor = person.id === "visitor" ? "visitor" : { role: person.role };
    const everything = state.mode === "everything";
    if (everything)
      for (const m of moves) for (const v of variantsOf(m as Move, at)) known.add(v.id);
    const rnd = seeded(turnSeed);
    const providers = state.fast || everything ? [] : options.providers();
    let id: string | undefined;
    let values: Record<string, FieldValue | null> = {};
    let why: string | undefined;
    let variant: FeedLine["variant"];
    /** The model was asked this turn: its answer has counted against the hour already. */
    let asked = false;
    // A replay's turn is its own person's; the entry is taken once the move is made.
    const replay = replaying[0]?.id === person.id ? replaying[0] : undefined;
    if (replay) {
      // A replay performs the logged move, not a new draw (§3a).
      ({ move: id, values = {}, variant } = replay);
      if (!listed.includes(id ?? "")) {
        replaying.shift();
        line(
          person,
          {
            text: "Could not replay a move",
            outcome: "finding",
            message: `${id} is not open now.`,
          },
          { turn: n, listed },
        );
        return;
      }
    } else if (everything) {
      // Coverage: the untried variant first, then the least tried (§3a).
      const tried: Record<string, number> = {};
      for (const e of log) if (e.variant) tried[e.variant.id] = (tried[e.variant.id] ?? 0) + 1;
      const next = coverageWalk(moves as Move[], tried, rnd, at);
      if (!next) {
        line(
          person,
          { text: "Had nothing to do", outcome: "miss", message: "No move is open." },
          { turn: n, listed },
        );
        return;
      }
      ({ move: id, values } = next);
      variant = { id: next.id, expect: next.expect, why: next.why };
    } else {
      if (providers[0]) {
        const choice = await chooseMove({
          person,
          summary,
          recent: recentWords(person.id),
          moves,
          provider: providers[0],
        });
        spend(choice.usage);
        // A model's answer counts as a move, whether or not one is made: it costs the same.
        hour.push(now());
        asked = true;
        if ("move" in choice) ({ move: id, values, why } = choice);
        else why = `Drawn from what they did: the model's answer did not fit (${choice.miss})`;
      }
      // No model, or a model that picked nothing in the list: the sensible draw from memory.
      if (id === undefined) {
        const step = choose(moves as Move[], memoryOf(person.id), actor, rnd, at);
        if (!step) {
          line(
            person,
            { text: "Had nothing to do", outcome: "miss", message: "No move is open." },
            { turn: n, listed },
          );
          return;
        }
        ({ move: id, values } = step);
      }
    }
    // Paused (or started again) while the model thought: no move after all.
    if (begun !== era) return;
    if (replay) replaying.shift();
    const move = moves.find((m) => m.id === id) as OpenMove;
    const one = (ids: number[]) => ids[Math.floor(rnd() * ids.length)];
    const filled: Record<string, FieldValue | null> = { ...values };
    // What the model left out of a required slot, the sample rules fill; a reference is the
    // app's own pick among the records the person may see. A variant's values stay as they
    // are: a required slot left empty may be what it tries.
    // A replay's values are the logged ones, references and all.
    for (const slot of !replay && "slots" in move ? move.slots : []) {
      const candidates = move.candidates?.[slot.field];
      if (slot.kind === "reference") {
        // A variant that leaves a reference empty on purpose keeps it so.
        const wanted = variant
          ? !(slot.field in values) && slot.required
          : slot.field in filled || slot.required;
        if (candidates?.length && wanted) filled[slot.field] = one(candidates) ?? null;
      } else if (!variant && slot.required && (filled[slot.field] ?? null) === null)
        filled[slot.field] = valueFor(slot, rnd, at);
    }
    const target = replay?.target
      ? replay.target
      : move.records?.length
        ? move.kind === "run" && move.rows
          ? { records: [one(move.records) as number] }
          : { record: one(move.records) as number }
        : {};
    const answer = await options
      .door("act", { user: person.id, move: move.id, values: filled, ...target })
      .catch(() => undefined);
    state.moves++;
    if (!asked) hour.push(now());
    const text = moveWords(move, labels);
    const logged = {
      turn: n,
      listed,
      move: move.id,
      kind: move.kind,
      ...("model" in move && move.model ? { model: move.model } : {}),
      values: filled,
      ...(Object.keys(target).length ? { target } : {}),
    };
    const said = answer?.ok
      ? undefined
      : ((await answer?.json().catch(() => undefined)) as
          | { refused?: boolean; message?: string }
          | undefined);
    const outcome: FeedLine["outcome"] = answer?.ok
      ? "done"
      : said?.refused
        ? "refused"
        : "finding";
    // A variant is judged by what the app had to do with it: a valid one refused, or a forbidden
    // one taken, is a finding; a crash always is (§3a).
    const judged =
      variant && outcome !== "finding" && outcome !== variant.expect ? "finding" : outcome;
    const message =
      judged === "finding" && outcome !== "finding" && variant
        ? `${outcome === "done" ? "Taken" : "Refused"}, but it should have been ${variant.expect === "done" ? "taken" : "refused"}: ${variant.why}.${said?.message ? ` ${said.message}` : ""}`
        : outcome === "done"
          ? undefined
          : (said?.message ?? (answer ? `The app answered ${answer.status}.` : "No answer."));
    line(
      person,
      {
        text,
        ...(why ? { why } : {}),
        outcome: judged,
        ...(message ? { message } : {}),
        ...(judged === "finding" ? { seed: turnSeed } : {}),
        ...(variant ? { variant } : {}),
      },
      logged,
    );
  }

  /** Serialized: a turn starts when the one before it ended. */
  const queued = (person: SamplePerson) => {
    const begun = era;
    chain = chain
      .then(() => turn(person, begun))
      // A turn that broke (an answer that was not JSON) is a finding; the next turn goes on.
      .catch((error: unknown) =>
        line(
          person,
          {
            text: "Broke a turn",
            outcome: "finding",
            message: (error as Error)?.message ?? String(error),
          },
          { turn: turns - 1, listed: [] },
        ),
      )
      .finally(changed);
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
    // A replay goes in the log's order: the next logged person is due now.
    if (replaying[0] && next.has(replaying[0].id)) due[0] = replaying[0].id;
    timer = setTimeout(
      async () => {
        if (!state.running) return;
        const why = capped();
        if (why) return stop(why);
        const person = state.people.find((p) => p.id === due[0]);
        if (!person) return;
        const begun = era;
        await queued(person);
        if (begun !== era) return;
        next.set(person.id, now() + (state.fast ? FAST_GAP : person.pace * 60_000));
        schedule();
      },
      Math.max(0, due[1] - now()),
    );
  }

  function stop(why?: string) {
    clearTimeout(timer);
    era++;
    state.running = false;
    if (why) state.stopped = why;
    else delete state.stopped;
    changed();
  }

  return {
    /** The state, with the people as samples/people.yml has them now unless a run is under way. */
    state() {
      if (!state.running) load();
      return snapshot();
    },
    /** Studio was used: the idle stop counts from now. */
    touch() {
      touched = now();
    },
    /**
     * Lets them run: sensible (with the model at their pace, or `fast`, the draw without pauses), or
     * trying everything (the coverage walk, fast and without a model).
     */
    start(fast = false, mode: RunMode = "sensible") {
      touched = now();
      delete state.stopped;
      if (!load()) return stop("No sample users yet: add one, or ask Smith to add some.");
      if (!state.running) seed = options.seed ?? now() % 1_000_000;
      era++;
      state.running = true;
      state.mode = mode;
      state.fast = fast || mode === "everything";
      next.clear();
      // One after another at first, a few seconds apart, rather than all at once.
      for (const [i, p] of state.people.entries())
        next.set(p.id, now() + i * (state.fast ? FAST_GAP : 3000));
      changed();
      schedule();
    },
    pause() {
      stop();
    },
    /** One move now, by whoever is due next (a replay's next person first), in the mode given. */
    async step(mode?: RunMode) {
      touched = now();
      if (mode && !state.running) state.mode = mode;
      if (!state.people.length && !load())
        return stop("No sample users yet: add one, or ask Smith to add some.");
      // A logged person no longer among the sample users: their moves are passed over.
      while (replaying[0] && !state.people.some((p) => p.id === replaying[0]?.id))
        replaying.shift();
      const why = capped();
      if (why) return stop(why);
      const due = (state.people.find((p) => p.id === replaying[0]?.id) ??
        [...state.people].sort(
          (a, b) => (next.get(a.id) ?? 0) - (next.get(b.id) ?? 0),
        )[0]) as SamplePerson;
      next.set(due.id, now() + due.pace * 60_000);
      await queued(due);
      schedule();
    },
    /** The run's log so far (§3a), to keep or to replay. */
    log(): LogEntry[] {
      return [...log];
    },
    /** The next turns perform these logged moves in order, by their people, instead of drawing. */
    replay(entries: LogEntry[]) {
      replaying = entries.filter((e) => e.move);
    },
    /** Forgets the feed, the log and the counts, as "Remove sample data" forgets what they did. */
    clear() {
      state.feed = [];
      state.moves = 0;
      state.cost = 0;
      log = [];
      known.clear();
      replaying = [];
      for (const p of state.people) delete p.last;
      changed();
    },
  };
}

export type SampleRunner = ReturnType<typeof sampleRunner>;
