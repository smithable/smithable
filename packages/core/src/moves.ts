/**
 * The moves a sample user may make, read from the spec and the auth file by rule, with no model
 * (docs/design/sample-users.md §3). A move is a shape with slots: `add Booking { session, places }`,
 * `run confirm on a Booking`, `open /sessions`, `change an Order { note }`. Core gives the shapes
 * and how each slot's value is made; the app fills in what only its data knows: which records the
 * user may see, whose `when` fits now. A seeded walk over the shapes is the random test at speed.
 * Pure and framework-neutral.
 */
import { type Allowed, actionAccess, modelAccess, pageAccess } from "./access.js";
import type { AuthIR } from "./auth.js";
import {
  type Condition,
  type FieldIR,
  type FieldValue,
  type ModelIR,
  mergeAsked,
  type SpecIR,
} from "./ir.js";

/** Who moves: a visitor without a session, or a signed-in person with a role. */
export type Actor = "visitor" | { role: string };

/** How a slot's value is made, as the sample data makes one of the field's kind. */
export type SlotKind =
  | "choice"
  | "reference"
  | "text"
  | "number"
  | "money"
  | "yesNo"
  | "date"
  | "datetime"
  | "email"
  | "phone"
  | "url";

export interface Slot {
  field: string;
  kind: SlotKind;
  required: boolean;
  /** A choice's values. */
  values?: string[];
  /** The model a reference points at: the app picks a record the user may read. */
  model?: string;
  min?: number;
  max?: number;
}

export type Move =
  | { id: string; kind: "open"; page: string; route: string }
  | { id: string; kind: "add"; model: string; slots: Slot[] }
  /** One record of the model the user may change; which one is the app's pick. */
  | { id: string; kind: "change"; model: string; slots: Slot[] }
  /** An action on one record of `model` (or, `rows`, on records picked by id); `when` says which fit. */
  | {
      id: string;
      kind: "run";
      action: string;
      model?: string;
      when?: Condition;
      rows?: boolean;
      slots: Slot[];
    }
  /**
   * A merge of two records of `model`, open to the roles granted the action with write on the
   * model: the app picks two records the user may write; `choices` are the fields it decides keep
   * or other for where the two differ.
   */
  | { id: string; kind: "merge"; action: string; model: string; choices: string[] }
  /**
   * A split of a record of `model` with two or more in `list`, open to the roles granted the
   * action with create on the model: the app picks the record and some of the list's records the
   * user may write, leaving at least one.
   */
  | { id: string; kind: "split"; action: string; model: string; list: string }
  | { id: string; kind: "delete"; model: string };

const may = (allowed: Allowed, actor: Actor): boolean =>
  actor === "visitor" ? allowed.public : allowed.public || allowed.roles.includes(actor.role);

/**
 * Whether the actor reaches records of the model under `allowed`: by the public or a role's
 * grant, or as an owner, which the actor can only be of a model that names its owner or that
 * the actor may add to (their own records are the ones they made).
 */
const reaches = (allowed: Allowed, actor: Actor, model: ModelIR, adds: boolean): boolean =>
  may(allowed, actor) ||
  (actor !== "visitor" && allowed.owner && (model.ownedBy !== undefined || adds));

/** The slot a field makes; none for a field the move cannot fill (a picture, a document, a user). */
function slotOf(field: FieldIR): Slot | undefined {
  const base = { field: field.name, required: field.required };
  const { type } = field;
  if (type.kind === "choice") return { ...base, kind: "choice", values: type.values };
  if (type.kind === "relation") {
    // Users sign in; a sample user cannot invent them. A list stores nothing.
    if (type.many || type.model === "User") return undefined;
    return { ...base, kind: "reference", model: type.model };
  }
  switch (type.name) {
    case "string":
    case "text":
    case "markdown":
      return { ...base, kind: "text", ...bounds(field) };
    case "int":
    case "decimal":
      return { ...base, kind: "number", ...bounds(field) };
    case "money":
      return { ...base, kind: "money", ...bounds(field) };
    case "bool":
      return { ...base, kind: "yesNo" };
    case "date":
    case "datetime":
    case "email":
    case "phone":
    case "url":
      return { ...base, kind: type.name };
    default:
      // Pictures and documents: someone sends them; a move has none to give.
      return undefined;
  }
}

const bounds = (field: FieldIR) => ({
  ...(field.min !== undefined ? { min: field.min } : {}),
  ...(field.max !== undefined ? { max: field.max } : {}),
});

/** The fields a form asks for: stored, not the app's own, not computed. */
function asked(model: ModelIR, changing: boolean): Slot[] | undefined {
  const slots: Slot[] = [];
  for (const f of model.fields) {
    if (f.formula || f.byApp || f.sequence || f.defaultMe) continue;
    // A field locked from the start is set once, at creation.
    if (changing && f.locked === true) continue;
    const slot = slotOf(f);
    // A required picture or document no move can give: the form would refuse every time.
    if (!slot && f.required && !changing) return undefined;
    if (slot) slots.push(slot);
  }
  return slots;
}

/** Every move the spec and the auth file open to the actor, in a stable order. */
export function movesFor(ir: SpecIR, auth: AuthIR, actor: Actor): Move[] {
  const moves: Move[] = [];
  for (const page of ir.pages)
    if (may(pageAccess(page, auth), actor) && page.route)
      moves.push({ id: `open:${page.id}`, kind: "open", page: page.id, route: page.route });
  for (const model of ir.models) {
    const access = modelAccess(model, auth);
    const adds = may(access.create, actor);
    const adding = adds ? asked(model, false) : undefined;
    if (adding)
      moves.push({ id: `add:${model.name}`, kind: "add", model: model.name, slots: adding });
    if (reaches(access.write, actor, model, adds)) {
      const slots = asked(model, true) ?? [];
      if (slots.length)
        moves.push({ id: `change:${model.name}`, kind: "change", model: model.name, slots });
    }
    if (reaches(access.delete, actor, model, adds))
      moves.push({ id: `delete:${model.name}`, kind: "delete", model: model.name });
  }
  if (actor !== "visitor")
    for (const action of ir.actions) {
      const allowed = actionAccess(action, auth, ir.models);
      if (action.custom) {
        if (!may(allowed, actor)) continue;
        const slots = action.input.flatMap((f) => {
          if (f.name === action.rows?.field) return [];
          const slot = slotOf(f);
          return slot ? [slot] : [];
        });
        moves.push({
          id: `run:${action.name}`,
          kind: "run",
          action: action.name,
          ...(action.rows ? { model: action.rows.model, rows: true } : {}),
          slots,
        });
        continue;
      }
      const model = ir.models.find((m) => m.name === action.on);
      if (!model) continue;
      // An action on one's own records is open to whoever can own one.
      if (!reaches(allowed, actor, model, may(modelAccess(model, auth).create, actor))) continue;
      if (action.merge) {
        moves.push({
          id: `merge:${action.name}`,
          kind: "merge",
          action: action.name,
          model: action.on,
          choices: mergeAsked(action, model),
        });
        continue;
      }
      if (action.split) {
        moves.push({
          id: `split:${action.name}`,
          kind: "split",
          action: action.name,
          model: action.on,
          list: action.split.move,
        });
        continue;
      }
      const names = new Set([
        ...action.set.flatMap((v) => ("asked" in v && v.asked ? [v.field] : [])),
        ...(action.asksRequired ?? []),
      ]);
      const slots: Slot[] = [];
      let fillable = true;
      for (const f of model.fields) {
        if (!names.has(f.name)) continue;
        const slot = slotOf(f);
        if (slot) slots.push(slot);
        else if (f.required || action.asksRequired?.includes(f.name)) fillable = false;
      }
      if (!fillable) continue;
      moves.push({
        id: `run:${action.name}`,
        kind: "run",
        action: action.name,
        model: action.on,
        ...(action.when ? { when: action.when } : {}),
        slots,
      });
    }
  return moves;
}

/** A small deterministic generator (mulberry32): the same seed, the same walk, on any machine. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(items: readonly T[], rnd: () => number): T | undefined =>
  items[Math.floor(rnd() * items.length)];

/**
 * A value for a slot, as the sample data would make one; `null` for a reference, which the app
 * fills with a record the user may read. `now` is the clock the walk lives by.
 */
export function valueFor(slot: Slot, rnd: () => number, now: Date): FieldValue | null {
  const n = Math.floor(rnd() * 1000);
  const between = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  switch (slot.kind) {
    case "choice":
      return pick(slot.values ?? [], rnd) ?? null;
    case "reference":
      return null;
    case "text": {
      let text = `${slot.field} ${n}`;
      if (slot.max !== undefined && text.length > slot.max) text = text.slice(0, slot.max);
      while (slot.min !== undefined && text.length < slot.min) text = `${text} ${n}`;
      return slot.max !== undefined && text.length > slot.max ? text.slice(0, slot.max) : text;
    }
    case "number":
      return within(slot, 1, 20, between);
    case "money":
      return within(slot, 5, 200, between);
    case "yesNo":
      return rnd() < 0.5;
    case "date":
      return shifted(now, between(-7, 30)).toISOString().slice(0, 10);
    case "datetime": {
      const at = shifted(now, between(-7, 30));
      at.setUTCHours(between(8, 18), [0, 15, 30, 45][between(0, 3)] ?? 0, 0, 0);
      return at.toISOString();
    }
    case "email":
      return `sample${n}@example.com`;
    case "phone":
      return `+358 40 ${String(100 + (n % 900))} ${String(1000 + ((n * 37) % 9000))}`;
    case "url":
      return `https://example.com/${slot.field}/${n}`;
  }
}

const shifted = (now: Date, days: number): Date => new Date(now.getTime() + days * 86_400_000);

/** A number between the slot's bounds, or between the usual ones where the slot gives none. */
function within(
  slot: Slot,
  lo: number,
  hi: number,
  between: (lo: number, hi: number) => number,
): number {
  const min = slot.min ?? Math.min(lo, slot.max ?? lo);
  const max = slot.max ?? Math.max(hi, min);
  return between(Math.ceil(min), Math.max(Math.ceil(min), Math.floor(max)));
}

export interface Step {
  move: string;
  /** A value per slot; `null` where the app picks a record. */
  values: Record<string, FieldValue | null>;
}

/**
 * The random walk: `count` moves drawn from the list with a seed, each with its values, the same
 * every time for the same seed, moves and clock. The app performs them one at a time, reading the
 * list again before each (a move whose `when` no longer fits is an expected refusal, not a finding).
 */
export function walk(moves: readonly Move[], seed: number, count: number, now: Date): Step[] {
  const rnd = seeded(seed);
  const steps: Step[] = [];
  for (let i = 0; i < count && moves.length; i++) {
    const move = pick(moves, rnd);
    if (!move) break;
    const values: Record<string, FieldValue | null> = {};
    if ("slots" in move)
      // An optional slot is sometimes left empty, as a person leaves a field.
      for (const slot of move.slots)
        if (slot.required || rnd() < 0.7) values[slot.field] = valueFor(slot, rnd, now);
    steps.push({ move: move.id, values });
  }
  return steps;
}

// ---- The two run modes (docs/design/sample-users.md §3a): a sensible draw from a person's
// memory, and the variants of every move for the coverage walk. Both pure; the host keeps the
// memory and the coverage table, rebuilt from the run's log.

/** What a person remembers of their run so far, built by the host from the log. */
export interface Memory {
  /** The turn now (the number of moves made in the run, by anyone). */
  turn: number;
  /** Records the person made: model → how many. Which record a move takes is the app's pick. */
  made: Record<string, number>;
  /** The model of the record the person made in their last move, when that move was an add that was done. */
  justMade?: string;
  /** The person's last moves, oldest first (move ids), for the words of a model's prompt. */
  recent: string[];
  /** Pages the person has opened (move ids of `open`). */
  opened: string[];
  /** Their refusals: the move, and the turn it was refused in. */
  refused: { move: string; turn: number }[];
  /** The turn a model was last touched by anyone's move (added, changed, run on, deleted). */
  touched: Record<string, number>;
}

export const emptyMemory = (): Memory => ({
  turn: 0,
  made: {},
  recent: [],
  opened: [],
  refused: [],
  touched: {},
});

/** How many turns a refused move is left alone, unless its model is touched meanwhile. */
export const REFUSAL_REST = 3;

const modelOf = (move: Move): string | undefined => ("model" in move ? move.model : undefined);

/**
 * The weight of a move for a person with this memory (§3a): a move on a model they have records
 * of weighs three times one on a model they have none of; right after adding a record, its
 * actions come first, then a change, and another add waits; a page weighs more before it has
 * been opened; a refusal rests; a visitor mostly looks.
 */
export function weightOf(move: Move, memory: Memory, actor: Actor): number {
  const model = modelOf(move);
  const rested = memory.refused.some(
    (r) =>
      r.move === move.id &&
      memory.turn - r.turn < REFUSAL_REST &&
      (model === undefined || (memory.touched[model] ?? -1) <= r.turn),
  );
  if (rested) return 0;
  if (actor === "visitor") return move.kind === "open" ? 3 : 1;
  let weight = 1;
  if (move.kind === "open") weight = memory.opened.includes(move.id) ? 0.5 : 2;
  else if (model !== undefined && (memory.made[model] ?? 0) > 0 && move.kind !== "add") weight = 3;
  if (memory.justMade !== undefined) {
    if (move.kind === "add") weight *= 0.5;
    else if (model === memory.justMade && move.kind === "run") weight *= 3;
    else if (model === memory.justMade && move.kind === "change") weight *= 2;
  }
  return weight;
}

/**
 * The sensible draw (§3a): one move from the list, weighted by the person's memory, with its
 * values; the same for the same seed and memory, so a replay holds. Nothing when every weight is 0.
 */
export function choose(
  moves: readonly Move[],
  memory: Memory,
  actor: Actor,
  rnd: () => number,
  now: Date,
): Step | undefined {
  const weights = moves.map((m) => weightOf(m, memory, actor));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return undefined;
  let at = rnd() * total;
  // Float residue may leave `at` just above 0 after the last weight: then the last weighted move.
  let move = moves[weights.findLastIndex((w) => w > 0)] as Move;
  for (let i = 0; i < moves.length; i++) {
    const w = weights[i] ?? 0;
    if (w <= 0) continue;
    at -= w;
    if (at < 0) {
      move = moves[i] as Move;
      break;
    }
  }
  const values: Record<string, FieldValue | null> = {};
  if ("slots" in move)
    for (const slot of move.slots)
      if (slot.required || rnd() < 0.7) values[slot.field] = valueFor(slot, rnd, now);
  return { move: move.id, values };
}

/** A variant of a move for the coverage walk: its values, and what the app must do with them. */
export interface Variant extends Step {
  /** The move's id and the variant's name: "add:Booking#places-below-min". */
  id: string;
  /** Done: the app must take it. Refused: the spec's own rules say the app must refuse it. */
  expect: "done" | "refused";
  /** Why, in a few words, for the report. */
  why: string;
}

/**
 * Every variant of a move (§3a): the plain one and the boundary values exactly at a slot's min
 * and max, which the app must take; and the values the spec's rules forbid, which it must
 * refuse: below min, above max, a required slot empty, a text shorter or longer than its bounds,
 * a choice not in the values, an email, phone, url, date or time that is not one. One slot
 * varies at a time, the rest plain; no variant without a rule behind it.
 */
export function variantsOf(move: Move, now: Date): Variant[] {
  const plain = (): Record<string, FieldValue | null> => {
    const rnd = seeded(1);
    const values: Record<string, FieldValue | null> = {};
    if ("slots" in move)
      for (const slot of move.slots) values[slot.field] = valueFor(slot, rnd, now);
    return values;
  };
  const variants: Variant[] = [
    {
      id: `${move.id}#plain`,
      move: move.id,
      values: plain(),
      expect: "done",
      why: "as a person would",
    },
  ];
  if (!("slots" in move)) return variants;
  const one = (
    slot: Slot,
    name: string,
    value: FieldValue | null,
    expect: Variant["expect"],
    why: string,
  ) =>
    variants.push({
      id: `${move.id}#${slot.field}-${name}`,
      move: move.id,
      values: { ...plain(), [slot.field]: value },
      expect,
      why,
    });
  for (const slot of move.slots) {
    // A reference is the app's pick (null): an empty one cannot be told from the plain variant.
    if (slot.required && slot.kind !== "reference")
      one(slot, "empty", null, "refused", `${slot.field} is required`);
    const numeric = slot.kind === "number" || slot.kind === "money";
    if (numeric) {
      if (slot.min !== undefined) {
        one(slot, "at-min", slot.min, "done", `${slot.field} at its least`);
        one(slot, "below-min", slot.min - 1, "refused", `${slot.field} below ${slot.min}`);
      }
      if (slot.max !== undefined) {
        one(slot, "at-max", slot.max, "done", `${slot.field} at its most`);
        one(slot, "above-max", slot.max + 1, "refused", `${slot.field} above ${slot.max}`);
      }
    }
    if (slot.kind === "text") {
      if (slot.min !== undefined && slot.min > 0) {
        one(slot, "at-min", "x".repeat(slot.min), "done", `${slot.field} at its shortest`);
        if (slot.min > 1)
          one(
            slot,
            "too-short",
            "x".repeat(slot.min - 1),
            "refused",
            `${slot.field} shorter than ${slot.min}`,
          );
      }
      if (slot.max !== undefined) {
        one(slot, "at-max", "x".repeat(slot.max), "done", `${slot.field} at its longest`);
        one(
          slot,
          "too-long",
          "x".repeat(slot.max + 1),
          "refused",
          `${slot.field} longer than ${slot.max}`,
        );
      }
    }
    if (slot.kind === "choice")
      one(
        slot,
        "not-a-choice",
        "not-one-of-them",
        "refused",
        `${slot.field} is not one of the choices`,
      );
    if (slot.kind === "email")
      one(slot, "not-an-email", "not an email", "refused", `${slot.field} is not an email`);
    if (slot.kind === "phone")
      one(slot, "not-a-phone", "not a phone", "refused", `${slot.field} is not a phone number`);
    if (slot.kind === "url")
      one(slot, "not-a-url", "not a url", "refused", `${slot.field} is not an address`);
    if (slot.kind === "date")
      one(slot, "not-a-date", "yesterday-ish", "refused", `${slot.field} is not a date`);
    if (slot.kind === "datetime")
      one(slot, "not-a-time", "noon-ish", "refused", `${slot.field} is not a time`);
  }
  return variants;
}

/**
 * The coverage walk's next variant (§3a): the untried first, then the least tried, ties by the
 * seed; `tried` counts each variant's tries by id. Nothing when there are no moves.
 */
export function coverageWalk(
  moves: readonly Move[],
  tried: Readonly<Record<string, number>>,
  rnd: () => number,
  now: Date,
): Variant | undefined {
  const all = moves.flatMap((m) => variantsOf(m, now));
  if (!all.length) return undefined;
  const fewest = Math.min(...all.map((v) => tried[v.id] ?? 0));
  const candidates = all.filter((v) => (tried[v.id] ?? 0) === fewest);
  return pick(candidates, rnd);
}
