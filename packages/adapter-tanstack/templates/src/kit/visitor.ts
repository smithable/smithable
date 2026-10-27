// Smithable app kit: a demo's visitors (DEMO_VISITORS=1, beside DEMO_SIGN_IN=1). Each visitor works on a copy of the app's
// data of their own, made on their first request: what one adds, changes or uploads, no other
// visitor sees. The production server (server.mjs) runs every request as its visitor, named by a
// cookie; the database (src/db), the uploads and the outbox ask here whose data a request is.
import type { AsyncLocalStorage } from "node:async_hooks";
import { join } from "node:path";

/** The production server's store of the request's visitor, shared through a global. */
const KEY = Symbol.for("app.visitor");

export const demo = process.env.DEMO_VISITORS === "1";
export const dataDir = process.env.DATA_DIR ?? "data";

/** The visitor a request is from, in a demo; none outside a request, in development, or outside a demo. */
export function visitor(): string | undefined {
  if (!demo) return undefined;
  return (globalThis as Record<symbol, AsyncLocalStorage<string> | undefined>)[KEY]?.getStore();
}

/** Where a demo visitor's data is (data/visitors/<id>); the app's own data folder otherwise. */
export const ownDataDir = (): string => {
  const id = visitor();
  return id ? join(dataDir, "visitors", id) : dataDir;
};
