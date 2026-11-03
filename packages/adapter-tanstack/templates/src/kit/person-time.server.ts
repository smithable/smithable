// Smithable app kit: a person's own time zone and clock on the page the server renders (A 220),
// from the cookie, or for a new browser from their record. A server function stays in the app's zone
// (what it does may be a mail to someone else), unless it asks: personZone for a list's days, asPerson
// for the labels of a picker.
import { AsyncLocalStorage } from "node:async_hooks";
import { getRequestHeader } from "@tanstack/react-start/server";
import {
  type Person,
  personFrom,
  readPerson,
  TIME_COOKIE,
  TIME_COOKIE_SECONDS,
  writtenPerson,
} from "./time-text";

const store = new AsyncLocalStorage<Person>();

/** The person this request is for, from the page's store or, in a server function, the cookie. */
function requester(): Person {
  const held = store.getStore();
  if (held) return held;
  try {
    return readPerson(getRequestHeader("cookie") ?? "");
  } catch {
    // No request at all (a timer, a job): the app's zone.
    return {};
  }
}

/** The zone a filter's days are in: the viewer's own, else the app's. */
export function personZone(appZone?: string): string | undefined {
  return requester().zone ?? appZone;
}

/** Runs what writes times for the viewer, in a server function, in their own zone and clock. */
export function asPerson<T>(run: () => Promise<T>): Promise<T> {
  return store.run(requester(), run);
}

export async function inPersonTime(
  request: Request,
  run: () => Promise<Response>,
  own: () => Promise<Person | undefined>,
): Promise<Response> {
  personFrom(() => store.getStore() ?? {});
  if (new URL(request.url).pathname.startsWith("/_serverFn")) return run();
  const cookies = request.headers.get("cookie") ?? "";
  if (cookies.includes(`${TIME_COOKIE}=`)) return store.run(readPerson(cookies), run);
  // A visitor has no record to look in, and no request of theirs pays for the look.
  if (!cookies.includes("session_token=")) return run();
  const person = (await own().catch(() => undefined)) ?? {};
  const response = await store.run(person, run);
  try {
    response.headers.append(
      "Set-Cookie",
      `${TIME_COOKIE}=${writtenPerson(person)}; Path=/; Max-Age=${TIME_COOKIE_SECONDS}; SameSite=Lax`,
    );
  } catch {
    // A response whose headers are fixed (a redirect made elsewhere) keeps them.
  }
  return response;
}
