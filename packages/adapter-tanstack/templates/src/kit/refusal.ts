// Smithable app kit: the refusals a program or an assistant can act on, in the app's words. The
// API answers them as 400 and 404, the tools as their error, the panel as a line under the answer.

import { clockText, whenAt } from "./time-text";
import { w } from "./words";

/** A value or a request the app cannot take: what is wrong, and what there is. */
export class BadInput extends Error {}
/** A record that is not there, or not one the caller may read: never which of the two. */
export class NotFound extends Error {}

/** A record in the trash (docs/design/trash.md): since when, by whom, and where it is restored. */
export class Gone extends Error {
  constructor(
    message: string,
    readonly more: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** What the server says when a delete is refused because other records point to the record. */
export interface InUse {
  id: number;
  title: string;
  /** The record's model, and its label. */
  model: string;
  label: string;
  /** What would go with it to the trash, by model; `count` is null for what belongs to those. */
  with: { model: string; label: string; plural: string; depth: number; count: number | null }[];
  /** What would show no record afterwards, by model. */
  loose: { model: string; label: string; plural: string; count: number }[];
  /** Whether they can all go to the trash together: the record's model and theirs have one. */
  together: boolean;
  /** The models without a trash, when they cannot. */
  missing: string[];
}

/** The facts behind a refused delete ("in-use:{…}" from the server); nothing for any other error. */
export function inUseFacts(error: unknown): InUse | undefined {
  const message = error instanceof Error ? error.message : "";
  if (!message.startsWith("in-use:{")) return undefined;
  try {
    return JSON.parse(message.slice("in-use:".length)) as InUse;
  } catch {
    return undefined;
  }
}

/** "3 orders and 12 order lines", and "what belongs to them" for the deeper records. */
function listed(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/**
 * What a refused change says, as the form says it ("taken:email" → that address is taken): for a
 * program (the API, the tools) or the host's sample users, who read no form.
 */
export function conflict(code: string): string {
  const taken = /^taken:(\w+)$/.exec(code)?.[1];
  if (taken) return `That ${taken} is already taken.`;
  // A record others point to (docs/design/delete-together.md): what, and the way out.
  const facts = inUseFacts(new Error(code));
  if (facts) {
    const count = (e: { count: number | null; label: string; plural: string }) =>
      `${e.count} ${(e.count === 1 ? e.label : e.plural).toLowerCase()}`;
    const named = facts.with.filter((e) => e.count !== null).map(count);
    const list = listed(
      facts.with.some((e) => e.count === null) ? [...named, "what belongs to them"] : named,
    );
    const loose = facts.loose.length
      ? ` ${listed(facts.loose.map(count))} will show no ${facts.label.toLowerCase()}.`
      : "";
    return facts.together
      ? `"${facts.title}" is used by ${list}. Pass together=true to move them to the trash with it; they are restored together.${loose}`
      : `"${facts.title}" is used by ${list}, so it cannot be deleted. Turn the trash on for ${listed(facts.missing.map((m) => m.toLowerCase()))} to delete them together.`;
  }
  const root = /^restore-root-first:([^:]+):(.*)$/.exec(code);
  if (root)
    return `Restore the ${root[1]?.toLowerCase()} "${root[2]}" first: this record went to the trash with it.`;
  const noRight = /^no-right:(.+)$/.exec(code)?.[1];
  if (noRight)
    return `Some ${noRight.toLowerCase()} records are not this key's to delete, so nothing was moved.`;
  if (code.startsWith("in-use"))
    return "It is still used by other records, so it cannot be deleted.";
  if (code === "full") return "No places left.";
  // A worked-out value a mail names, with no value (record-documents.md §3).
  const missing = /^no-value:(.+)$/.exec(code)?.[1];
  if (missing)
    return `${missing} has no value to send, so nothing was changed and nothing was sent.`;
  // A sent document's copy (record-documents.md §5).
  if (code === "document-read")
    return "You may not read all of the document the mail links to, so nothing was changed and nothing was sent.";
  if (code === "document-settings")
    return "The business details the document is from are not filled in, so nothing was changed and nothing was sent.";
  if (code === "closed") return "Booking has closed.";
  if (code === "cancel-closed") return "Cancelling has closed.";
  const booked = /^booked:(\d+)$/.exec(code)?.[1];
  if (booked) return `${booked} are already taken.`;
  return code;
}

/**
 * A refused change in the person's words, on every surface that changes records (a form, a row
 * edited in place, an action, a selection, a merge, a message): the server's codes ("taken:email",
 * "in-use", "full", "no-value:Total", …) never reach the screen as they are. `label` is the
 * record's kind; `fields` names a taken column; anything else is said as it came, or `fallback`.
 */
export function refusalText(
  error: unknown,
  fallback: string,
  on: {
    label?: string;
    fields?: readonly { name: string; label: string }[];
    timeZone?: string;
  } = {},
): string {
  const label = on.label ?? w.record;
  // A thrown string is a message too (a row's save, a selection's delete).
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const taken = /^taken:(\w+)$/.exec(message)?.[1];
  if (taken) {
    const field = on.fields?.find(
      (f) => f.name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`) === taken,
    );
    return w.alreadyHas(label, field?.label ?? taken.replace(/_/g, " "));
  }
  if (message === "in-use" || inUseFacts(error)) return w.stillUsed(label);
  const noRight = /^no-right:(.+)$/.exec(message)?.[1];
  if (noRight) return w.noRightToDelete(noRight);
  if (message === "full") return w.noPlacesLeft;
  // A worked-out value a mail names, with no value (record-documents.md §3).
  const missing = /^no-value:(.+)$/.exec(message)?.[1];
  if (missing) return w.noValue(missing);
  // A sent document's copy that could not be read (record-documents.md §5).
  if (message === "document-read") return w.document.sendRefused;
  if (message === "document-settings") return w.document.sendSettings;
  if (message === "closed") return w.bookingClosed;
  if (message === "cancel-closed") return w.cancellingClosed;
  const booked = /^booked:(\d+)$/.exec(message)?.[1];
  if (booked) return w.alreadyTaken(booked);
  // A time someone does not have free, with the next free times that day.
  const notFree = /^not-free:(.*)$/.exec(message)?.[1];
  if (notFree !== undefined)
    return w.notFree(
      notFree
        .split(",")
        .filter(Boolean)
        .map((at) => (({ hour, minute }) => clockText(hour, minute))(whenAt(at, on.timeZone)))
        .join(", "),
    );
  return message || fallback;
}
