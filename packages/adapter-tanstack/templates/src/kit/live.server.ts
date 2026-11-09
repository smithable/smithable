// Live in the app (docs/design/notifications.md §3): when a change commits that an outgoing entry
// is about, each recipient who is a user of the app and may read the record gets one event on
// the streams they have open: the entry's name, the model, the record's id, the title line and
// the link, nothing else. The mail is queued as before; this rides along. One process holds the
// streams, so the fan-out is in it (the hosted service runs one process per app).
import { and, eq, sql } from "drizzle-orm";
import { db } from "#/db";
import { outgoingMail, user } from "#/db/schema";
import type { Viewer } from "./access";
import { log } from "./log.server";
import type { Happening } from "./outgoing.server";

/** What a stream is sent: never a record's values beyond its title line. */
export interface LiveEvent {
  entry: string;
  model: string;
  id: number;
  title: string;
  link?: string;
}

/** May this person read that record: the model's read rule, as its page would check it. */
export type Readers = Record<string, (viewer: Viewer, id: number) => boolean | Promise<boolean>>;

interface Stream {
  send: (text: string) => void;
  close: () => void;
  /** The session is still on: checked before every event and at least once a minute. */
  alive: () => Promise<boolean>;
}

interface Live {
  streams: Map<string, Stream[]>;
  /** Waiting for their change to commit: the mail row that proves it, and whom to tell. */
  pending: { mail: number; to: { id?: string | null; email: string }; event: LiveEvent }[];
  soon?: ReturnType<typeof setTimeout>;
  readers?: Readers;
}
const everyInstance = globalThis as { smithableLive?: Live };
everyInstance.smithableLive ??= { streams: new Map(), pending: [] };
const live = everyInstance.smithableLive;

// The outbox tells of each mail it queues; a record's mail is an event for its recipient.
(globalThis as { smithableOnQueued?: unknown }).smithableOnQueued = (
  mail: number,
  to: { id?: string | null; email: string },
  happening: Happening,
) => {
  if (happening.model && happening.record !== null)
    liveLater(mail, to, {
      entry: happening.entry,
      model: happening.model,
      id: happening.record,
      title: happening.subject,
      ...(happening.link ? { link: happening.link } : {}),
    });
};

/** At most this many streams a person: a sixth closes the oldest. */
const STREAMS = 5;

/** The read checks by model, given once by the generated outgoing module. */
export function liveReaders(readers: Readers): void {
  live.readers = readers;
}

/**
 * Notes an event for a recipient of a mail just queued, in the change's transaction; it goes out
 * after the transaction, and only if the mail row is there, so a change that rolled back is
 * never announced.
 */
export function liveLater(
  mail: number,
  to: { id?: string | null; email: string },
  event: LiveEvent,
): void {
  if (!live.streams.size) return;
  live.pending.push({ mail, to, event });
  live.soon ??= setTimeout(() => {
    live.soon = undefined;
    const pending = live.pending.splice(0);
    announce(pending).catch((error) => log.error("A live event could not be sent", { error }));
  }, 0);
}

async function announce(pending: Live["pending"]): Promise<void> {
  for (const { mail, to, event } of pending) {
    // The mail row proves the change committed: the same row, not only its id, since SQLite gives
    // a rolled-back row's id to the next one.
    const committed = db
      .select({ id: outgoingMail.id })
      .from(outgoingMail)
      .where(
        and(
          eq(outgoingMail.id, mail),
          eq(outgoingMail.entry, event.entry),
          eq(outgoingMail.recordId, event.id),
          eq(outgoingMail.to, to.email),
        ),
      )
      .get();
    if (!committed) continue;
    // A role's people come with their id; an address the record names, by its user.
    const person = db
      .select({ id: user.id, name: user.name, email: user.email, role: user.role })
      .from(user)
      .where(to.id ? eq(user.id, to.id) : sql`lower(${user.email}) = ${to.email.toLowerCase()}`)
      .get();
    if (!person) continue;
    const streams = live.streams.get(person.id);
    if (!streams?.length) continue;
    const viewer: Viewer = { ...person, role: person.role ?? "" };
    const read = live.readers?.[event.model];
    if (!read || !(await read(viewer, event.id))) continue;
    const text = `event: notice\ndata: ${JSON.stringify(event)}\n\n`;
    for (const stream of [...streams])
      if (await stream.alive().catch(() => false)) stream.send(text);
      else stream.close();
  }
}

/** The person's stream of events (`/events`): open while the session is and the page listens. */
export function openStream(
  personId: string,
  alive: () => Promise<boolean>,
  signal: AbortSignal,
): Response {
  const encoder = new TextEncoder();
  let stream: Stream | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        clearInterval(timer);
        const list = live.streams.get(personId) ?? [];
        const left = list.filter((s) => s !== stream);
        if (left.length) live.streams.set(personId, left);
        else live.streams.delete(personId);
        try {
          controller.close();
        } catch {}
      };
      stream = {
        send: (text) => {
          // A page that reads nothing (gone, or too slow) is not buffered for: it is closed.
          if ((controller.desiredSize ?? 0) < -50) return close();
          try {
            controller.enqueue(encoder.encode(text));
          } catch {
            close();
          }
        },
        close,
        alive,
      };
      const list = live.streams.get(personId) ?? [];
      list.push(stream);
      // A sixth closes the oldest, which is told so: its page does not reconnect and take another.
      while (list.length > STREAMS) {
        const oldest = list.shift();
        oldest?.send("event: replaced\ndata: {}\n\n");
        oldest?.close();
      }
      live.streams.set(personId, list);
      stream.send(": open\n\n");
      // Once a minute: the session is checked, and a comment keeps proxies from closing it.
      timer = setInterval(() => {
        alive().then(
          (on) => (on ? stream?.send(": ping\n\n") : close()),
          () => close(),
        );
      }, 60_000);
      timer.unref?.();
      signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      stream?.close();
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
