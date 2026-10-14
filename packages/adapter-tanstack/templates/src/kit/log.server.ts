// Smithable app kit: the app log (docs/design/logging.md §3.2). One JSON line on standard output
// per message, with the time, the level, the request's trace id and who it was for: what happened,
// with named values, never a record's contents. Custom code logs the same way:
//   log.warn("Payment provider slow", { ms: 5200 })
import { AccessDenied, Conflict } from "./access";
import { BadInput } from "./refusal";
import { traceId, traceWhoNow } from "./trace.server";
import { w } from "./words";

type Values = Record<string, unknown>;

function write(level: "info" | "warn" | "error", message: string, values: Values = {}): void {
  const named = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      // An error keeps its message and stack, which JSON would otherwise drop.
      value instanceof Error ? { message: value.message, stack: value.stack } : value,
    ]),
  );
  // The kit's fields last: a value named "message" or "level" never replaces them.
  const line = {
    ...named,
    time: new Date().toISOString(),
    log: "app",
    level,
    trace: traceId(),
    who: traceWhoNow(),
    message,
  };
  (level === "info" ? process.stdout : process.stderr).write(`${JSON.stringify(line)}\n`);
}

export const log = {
  info: (message: string, values?: Values) => write("info", message, values),
  warn: (message: string, values?: Values) => write("warn", message, values),
  error: (message: string, values?: Values) => write("error", message, values),
};

/**
 * A database error as people may see it: a unique value already taken, or a record still in
 * use. Anything else goes to the app log; the page gets a plain apology with the request's
 * reference, which finds the log line.
 */
export function refusal(error: unknown): Error {
  // A refusal the app made itself (an owner that must be someone, a place that is full, a locked
  // field) as it is.
  if (error instanceof AccessDenied || error instanceof Conflict || error instanceof BadInput)
    return error;
  const message = error instanceof Error ? error.message : "";
  // With several columns (unique per owner), the last one is the field.
  const column = /UNIQUE constraint failed: (?:\w+\.\w+, )*\w+\.(\w+)/.exec(message)?.[1];
  if (column) return new Conflict(`taken:${column}`);
  if (message.includes("FOREIGN KEY constraint failed")) return new Conflict("in-use");
  log.error("A change could not be saved", { error });
  const reference = traceId();
  return new Error(w.wentWrongReference(reference));
}
