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
