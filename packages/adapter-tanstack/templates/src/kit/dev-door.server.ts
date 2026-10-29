// Smithable app kit: the development door (docs/design/sample-users.md §4). The host acts through it
// as the app's sample users: the moves open to one now, one move performed as their session, the
// development clock, and Ask as them. Only a development build (or a demo, for what a demo has)
// opens it, and only to the secret the host started the app with; anything else is a 404.
import { timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { AccessDenied, Conflict } from "./access";
import { TooMany } from "./limit";
import { BadInput, conflict, NotFound } from "./refusal";

/** How a move's slot is filled, as the generated moves name it. */
export interface Slot {
  field: string;
  kind: string;
  required: boolean;
  values?: string[];
  model?: string;
  min?: number;
  max?: number;
}

/** A move a sample user may make: open a page, add, change, delete, or run an action. */
export interface DoorMove {
  id: string;
  kind: "open" | "add" | "change" | "delete" | "run" | "merge" | "split";
  page?: string;
  route?: string;
  model?: string;
  action?: string;
  rows?: boolean;
  /** For an action, when it fits a record (the app checks; shown for the host's reading). */
  when?: Record<string, unknown>;
  slots?: Slot[];
  /** A merge: the fields the records may differ in that the person decides (intents.md §3). */
  choices?: string[];
  /** A merge: into the record chosen, or a new one (a combine). */
  into?: "chosen" | "new";
  /** A split: the list whose records go to the new record (intents.md §4). */
  list?: string;
}

/** A move as it is open now: with the records it may be made on and each reference's choices. */
export type OpenMove = DoorMove & { records?: number[]; candidates?: Record<string, number[]> };

/** A 404 unless the door is open: a development build (a demo too, unless `devOnly`) and the secret. */
export function doorShut(request: Request, devOnly = false): Response | undefined {
  const open = import.meta.env.DEV || (!devOnly && process.env.DEMO_SIGN_IN === "1");
  const secret = Buffer.from(process.env.DEV_DOOR_SECRET ?? "");
  const given = Buffer.from(request.headers.get("x-dev-door") ?? "");
  if (open && secret.length && given.length === secret.length && timingSafeEqual(given, secret))
    return undefined;
  return new Response("Not found", { status: 404 });
}

/**
 * A move's values as the app stores them: a reference under its key (`customerId`, or the
 * field's name for an action's input), money in cents, a date and time as a date.
 */
export function stored(
  slots: readonly Slot[],
  values: Record<string, unknown>,
  keys: Record<string, string> = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const slot of slots) {
    if (!(slot.field in values)) continue;
    const value = values[slot.field];
    const key = keys[slot.field] ?? slot.field;
    if (value === null || value === undefined) out[key] = value;
    else if (slot.kind === "money") out[key] = Math.round(Number(value) * 100);
    else if (slot.kind === "datetime") out[key] = new Date(String(value));
    else out[key] = value;
  }
  return out;
}

/**
 * What the app said to a move, as the door answers it: a refusal is the app doing its job (the
 * session is full, not theirs to change) with its status; anything else is a fault, a 500.
 */
export function refused(error: unknown): Response {
  const status =
    error instanceof TooMany
      ? 429
      : error instanceof AccessDenied
        ? 403
        : error instanceof Conflict ||
            // An action whose condition no longer fits the record: someone moved first.
            (error as Error)?.message === "This cannot be done now."
          ? 409
          : error instanceof ZodError
            ? 422
            : error instanceof BadInput
              ? 400
              : error instanceof NotFound
                ? 404
                : 500;
  const message =
    error instanceof ZodError
      ? error.issues.map((i) => i.message).join("; ")
      : // A conflict in words ("No places left."), as the API says it, not its code.
        error instanceof Conflict
        ? conflict(error.message)
        : String((error as Error)?.message ?? error);
  return Response.json({ refused: status < 500, status, message }, { status });
}
