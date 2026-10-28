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
import type { Condition, FieldIR, FieldValue, ModelIR, SpecIR } from "./ir.js";

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
