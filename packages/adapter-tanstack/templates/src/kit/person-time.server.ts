// Smithable app kit: a person's own time zone and clock on the page the server renders (A 220),
// from the cookie, or for a new browser from their record. Pages only: what a server function does
// (a mail to someone else) stays in the app's zone.
import { AsyncLocalStorage } from "node:async_hooks";
import {
  type Person,
  personFrom,
  readPerson,
  TIME_COOKIE,
  TIME_COOKIE_SECONDS,
  writtenPerson,
} from "./time-text";

const store = new AsyncLocalStorage<Person>();

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
