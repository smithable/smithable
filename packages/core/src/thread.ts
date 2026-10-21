import { type FieldIR, type ModelIR, USER_MODEL } from "./ir.js";

/** What a thread shows of a message model (docs/design/conversation.md §2), resolved. */
export interface ThreadBindings {
  /** The message's text: a long text field (a string when the model has none). */
  body?: FieldIR;
  /** Who wrote it: a field that refers to a person, or an email field. */
  author?: FieldIR;
  /** Which side a message is on, and the value that is ours. */
  side?: { field: FieldIR; ours: string };
  /** The attachments: files and pictures. */
  files: FieldIR[];
  /** The other choices, shown as badges. */
  badges: FieldIR[];
  /** The parts the inference had to pick one of several for; the model's `thread` settles them. */
  ambiguous: ("body" | "author" | "side")[];
}

const kind = (f: FieldIR) => (f.type.kind === "scalar" ? f.type.name : f.type.kind);
const isLong = (f: FieldIR) => ["text", "markdown"].includes(kind(f));
const isPerson = (f: FieldIR) =>
  f.type.kind === "relation" && f.type.model === USER_MODEL && !f.type.many;
const isEmail = (f: FieldIR) => kind(f) === "email";
const isSide = (f: FieldIR) => f.type.kind === "choice" && f.type.values.length === 2;

/**
 * The thread's bindings for a model: what its `thread` says first, the rest by rule. The body is
 * the first long text field, the author the first person (else the first email), the side the
 * first two-valued choice with its first value as ours. A part the rule had several candidates
 * for is listed in `ambiguous`, so validation can ask for the word.
 */
export function threadBindings(model: ModelIR): ThreadBindings {
  const named = (name: string | undefined) => model.fields.find((f) => f.name === name);
  const given = model.thread ?? {};
  const ambiguous: ThreadBindings["ambiguous"] = [];
  const pick = <T extends FieldIR>(
    part: "body" | "author" | "side",
    explicit: FieldIR | undefined,
    candidates: FieldIR[],
  ): T | undefined => {
    if (explicit) return explicit as T;
    if (candidates.length > 1) ambiguous.push(part);
    return candidates[0] as T | undefined;
  };
  const body = pick("body", named(given.body), model.fields.filter(isLong));
  const people = model.fields.filter(isPerson);
  const author = pick(
    "author",
    named(given.author),
    people.length ? people : model.fields.filter(isEmail),
  );
  const sideField = pick("side", named(given.side?.field), model.fields.filter(isSide));
  const side =
    sideField?.type.kind === "choice"
      ? { field: sideField, ours: given.side?.ours ?? (sideField.type.values[0] as string) }
      : undefined;
  const files = model.fields.filter((f) =>
    ["file", "files", "picture", "pictures"].includes(kind(f)),
  );
  const badges = model.fields.filter((f) => f.type.kind === "choice" && f !== sideField);
  return { body, author, side, files, badges, ambiguous };
}
