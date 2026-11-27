/**
 * The answer itself, out of a function call's wrapper: `{"arguments": {...}}` as its only key, the
 * object or a JSON string of it (3 of 19 beta-route drafts were sent so, T1719); anything else as
 * it came.
 */
export function answerOf(answer: unknown): unknown {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return answer;
  const keys = Object.keys(answer);
  if (keys.length !== 1 || keys[0] !== "arguments") return answer;
  let inner = (answer as { arguments: unknown }).arguments;
  if (typeof inner === "string") {
    try {
      inner = JSON.parse(inner);
    } catch {
      return answer;
    }
  }
  return inner && typeof inner === "object" && !Array.isArray(inner) ? inner : answer;
}

/**
 * A model's list of operations, read one way for a draft and a proposal (T1718). The list is
 * taken as it is, or from a string that holds it as JSON (the shape a model sometimes sends when
 * the answer tool is offered, not forced); nothing else is guessed (a function call's wrapper aside, answerOf). What cannot be read is said
 * by its shape only (types and key names, never the content), for the model's next round and for
 * the failure message.
 */
export function operationsOf(
  answer: unknown,
): { operations: { op?: string; args?: Record<string, unknown> }[] } | { problem: string } {
  answer = answerOf(answer);
  if (!answer || typeof answer !== "object" || Array.isArray(answer))
    return { problem: `the answer was ${kindOf(answer)}, not an object` };
  const record = answer as Record<string, unknown>;
  if (!("operations" in record)) {
    return { problem: `no operations key; keys: ${keysOf(record)}` };
  }
  let list = record.operations;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      return { problem: "operations was a string that is not JSON" };
    }
    if (!Array.isArray(list)) return { problem: `operations was a string holding ${kindOf(list)}` };
  }
  if (!Array.isArray(list)) return { problem: `operations was ${kindOf(list)}, not a list` };
  // An entry that is not an object names no operation; it is left out, never applied.
  return {
    operations: list.filter(
      (step): step is { op?: string; args?: Record<string, unknown> } =>
        !!step && typeof step === "object" && !Array.isArray(step),
    ),
  };
}

/**
 * An answer's keys, named only where they are short names (a wrapper such as "result"); a key
 * that is anything else could be the answer's own words, so it is counted, never copied.
 */
function keysOf(record: Record<string, unknown>): string {
  const keys = Object.keys(record);
  const named = keys.filter((k) => /^[A-Za-z_][A-Za-z0-9_-]{0,31}$/.test(k)).slice(0, 10);
  const others = keys.length - named.length;
  const said = [...named, ...(others ? [`${others} other${others === 1 ? "" : "s"}`] : [])];
  return said.length ? said.join(", ") : "none";
}

function kindOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "a list";
  if (typeof value === "object") return "an object";
  return `a ${typeof value}`;
}
