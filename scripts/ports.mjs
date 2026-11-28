import { connect } from "node:net";
import { lintGuard } from "./lint-guard.mjs";

// The ports above 1024 that browsers, and so Node's fetch, refuse to talk to (the Fetch
// standard's "bad ports"). A test server on one of them starts fine and then never "answers":
// the check fails as "did not respond" with nothing wrong in the app.
const REFUSED = new Set([
  1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669,
  6679, 6697, 10080,
]);

export const refused = (port) => REFUSED.has(port);

/**
 * Stops with the reason when a test would use a refused port. Every browser walk asks this before
 * it starts anything, so the walks' lint guard runs here too.
 */
export function checkPorts(what, ports) {
  lintGuard();
  const bad = ports.filter(refused);
  if (!bad.length) return;
  console.error(
    `${what} would use port ${bad.join(", ")}, which Node's fetch refuses ("bad port"). Set another base port.`,
  );
  process.exit(1);
}

/**
 * Every server test-apps.mjs starts for an example, as what it adds to the example's base port.
 * It takes its ports from here only, so this is also what keeps the examples apart.
 */
export const APP_PORT = {
  production: 0,
  dev: 100,
  smoke: 200,
  noSecret: 300,
  demoVisitors: 400,
  demoFlows: 450,
};
export const APP_OFFSETS = Object.values(APP_PORT);

/**
 * How many examples fit: bases are one apart, and no two share a port while they span less than the
 * smallest gap between two offsets. Ten apart, an example's dev server had the port of another's
 * production server, and one app's checks ran against the other (2026-11-25).
 */
export const APP_LIMIT = Math.min(...APP_OFFSETS.slice(1).map((o, i) => o - APP_OFFSETS[i]));

/**
 * Each example's base port in a run of test-apps-parallel, from `base`; one whose ports would
 * include a refused one is passed over. A run of fewer examples uses the first of these.
 */
export function appBases(base, count) {
  let next = base;
  return Array.from({ length: count }, () => {
    while (APP_OFFSETS.some((offset) => refused(next + offset))) next += 1;
    if (next - base >= APP_LIMIT)
      throw new Error(`appBases: ${count} examples do not fit apart (limit ${APP_LIMIT})`);
    return next++;
  });
}

/** Whether anything on this machine listens on the port, on either loopback address. */
const listens = async (port) => {
  const tries = ["127.0.0.1", "::1"].map(
    (host) =>
      new Promise((resolve) => {
        const socket = connect({ port, host });
        const done = (yes) => {
          socket.destroy();
          resolve(yes);
        };
        socket.setTimeout(2000, () => done(true));
        socket.once("connect", () => done(true));
        socket.once("error", () => done(false));
      }),
  );
  return (await Promise.all(tries)).includes(true);
};

/**
 * Before a test server starts: its port must not answer already, or the checks would run against
 * whatever does. A server this run has just stopped gets `wait` milliseconds to let go of it.
 */
export async function claimPort(port, app, wait = 10_000) {
  const until = Date.now() + wait;
  while (await listens(port)) {
    if (Date.now() >= until)
      throw new Error(`port ${port} already answers: the server of ${app} is not started on it`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
