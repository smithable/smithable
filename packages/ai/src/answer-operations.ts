/**
 * A model's list of operations, read one way for a draft and a proposal (T1718). The list is
 * taken as it is, or from a string that holds it as JSON (the shape a model sometimes sends when
 * the answer tool is offered, not forced); nothing else is guessed. What cannot be read is said
 * by its shape only (types and key names, never the content), for the model's next round and for
 * the failure message.
 */
export function operationsOf(
  answer: unknown,
): { operations: { op?: string; args?: Record<string, unknown> }[] } | { problem: string } {
  if (!answer || typeof answer !== "object" || Array.isArray(answer))
    return { problem: `the answer was ${kindOf(answer)}, not an object` };
  const record = answer as Record<string, unknown>;
  if (!("operations" in record)) {
    const keys = Object.keys(record);
    return { problem: `no operations key; keys: ${keys.length ? keys.join(", ") : "none"}` };
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

function kindOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "a list";
  if (typeof value === "object") return "an object";
  return `a ${typeof value}`;
}
