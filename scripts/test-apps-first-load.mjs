// A first page load that only the machine's network broke (T1707): Chrome answers every request in
// flight with ERR_NETWORK_CHANGED when an interface comes or goes. The browser check reloads such a
// load once and says so; any other failure, or a second one, fails the step.

export const RETRIED = "WARNING: first load retried after a network-level failure:";

/**
 * Whether every failure a page's load saw is network-level, with at least one failed request among
 * them. `events`: { kind: "request" | "response" | "error", text, script? }.
 */
export function networkOnly(events) {
  const network = (e) =>
    e.text.includes("ERR_NETWORK_CHANGED") || (e.script === true && e.text.startsWith("net::"));
  // What the page says when a module's request failed; the request itself is judged on its own.
  const moduleFetch = (e) => e.text.includes("Failed to fetch dynamically imported module");
  return (
    events.some((e) => e.kind === "request") &&
    events.every((e) => (e.kind === "request" ? network(e) : e.kind === "error" && moduleFetch(e)))
  );
}

/** The summary line's ending when loads were retried. */
export const retriedNote = (count) =>
  count ? ` (${count} first load(s) retried after a network-level failure)` : "";
