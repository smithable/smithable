// The ports above 1024 that browsers, and so Node's fetch, refuse to talk to (the Fetch
// standard's "bad ports"). A test server on one of them starts fine and then never "answers":
// the check fails as "did not respond" with nothing wrong in the app.
const REFUSED = new Set([
  1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669,
  6679, 6697, 10080,
]);

export const refused = (port) => REFUSED.has(port);

/** Stops with the reason when a test would use a refused port. */
export function checkPorts(what, ports) {
  const bad = ports.filter(refused);
  if (!bad.length) return;
  console.error(
    `${what} would use port ${bad.join(", ")}, which Node's fetch refuses ("bad port"). Set another base port.`,
  );
  process.exit(1);
}

/** What test-apps.mjs adds to an example's base port for its servers. */
export const APP_OFFSETS = [0, 100, 200, 300];

/**
 * Each example's base port in a run of test-apps-parallel: ten apart from `base`, and an example
 * whose ports would include a refused one takes the next ten instead. A run of fewer examples uses
 * the first of these.
 */
export function appBases(base, count) {
  let next = base;
  return Array.from({ length: count }, () => {
    while (APP_OFFSETS.some((offset) => refused(next + offset))) next += 10;
    next += 10;
    return next - 10;
  });
}
