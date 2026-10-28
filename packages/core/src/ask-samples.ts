/**
 * The app's own Ask check, samples/ask.yml (docs/design/ask-words.md §4): questions a person with
 * a role would ask the in-app assistant, each with the shape of the answer expected (the kind, a
 * where or a measure, and whether a count, names or a number answers it). Written by Smith's
 * question pass and editable by hand; the host sends them through the development door and
 * compares what Ask asked with the shape, never the answer's words. Read like the sample files:
 * what names a kind, field, role or choice value no longer in the spec is a warning naming the
 * line, so a rename leaves nothing silently broken. Gone with the sample data, never published.
 */
import { isMap, isScalar, isSeq, LineCounter, type ParsedNode, parseDocument } from "yaml";
import type { AuthIR } from "./auth.js";
import { checkKeys, type Entry, mapEntries, ParseContext, readString } from "./context.js";
import type { Diagnostic } from "./diagnostics.js";
import type { FieldIR, ModelIR, SpecIR } from "./ir.js";
import { ASK_FILE } from "./samples.js";
import { didYouMean } from "./suggest.js";

/** The file, in the project. */
export const ASK_PATH = "samples/ask.yml";
export { ASK_FILE };

export const ASK_ANSWERS = ["count", "names", "number"] as const;
export type AskAnswer = (typeof ASK_ANSWERS)[number];

export interface AskExpectation {
  kind: string;
  /** A field to a value, a list of values, or a range ({ from, to, over, under }). */
  where?: Record<string, unknown>;
  /** The number field measured. */
  measure?: string;
  answer: AskAnswer;
}

export interface AskIR {
  /** A role of the auth file, or "visitor". */
  role: string;
  question: string;
  expects: AskExpectation;
}

const KEYS = { allowed: ["role", "question", "expects"] } as const;
const EXPECT_KEYS = { allowed: ["kind", "where", "measure", "answer"] } as const;

/** What a choice field is called with its values, for a message. */
const valuesOf = (field: FieldIR) => (field.type.kind === "choice" ? field.type.values : undefined);

/** Reads samples/ask.yml against the spec and the auth file's roles. */
export function validateAsk(
  file: { path: string; text: string },
  ir: SpecIR,
  auth: Pick<AuthIR, "roles"> | undefined,
): { asks: AskIR[]; diagnostics: Diagnostic[] } {
  const counter = new LineCounter();
  const doc = parseDocument(file.text, { lineCounter: counter, keepSourceTokens: true });
  const ctx = new ParseContext(file.path, counter);
  for (const error of doc.errors) ctx.error(null, "yaml", error.message);
  const asks: AskIR[] = [];
  if (doc.errors.length) return { asks, diagnostics: ctx.diagnostics };
  // The meaning texts' stale words are said with the file, whatever it holds (none yet included).
  for (const d of staleMeaningWords(ir)) ctx.diagnostics.push({ ...d, file: file.path });
  if (doc.contents === null) return { asks, diagnostics: ctx.diagnostics };
  if (!isSeq(doc.contents)) {
    ctx.error(doc.contents, "expected-list", `${ASK_PATH} must be a list of questions.`);
    return { asks, diagnostics: ctx.diagnostics };
  }
  const roles = [...new Set(["visitor", ...(auth?.roles.map((r) => r.name) ?? [])])];
  (doc.contents.items as ParsedNode[]).forEach((item, i) => {
    const what = `question ${i + 1}`;
    const entries = mapEntries(ctx, item, what);
    if (!entries) return;
    const allowed = checkKeys(ctx, entries, what, KEYS);
    const at = (key: string) => allowed.find((e) => e.key === key);
    const text = (key: string) => {
      const entry = at(key);
      return entry ? readString(ctx, entry.value, `${what}'s ${key}`)?.trim() : undefined;
    };
    for (const key of ["role", "question", "expects"] as const)
      if (!at(key))
        ctx.error(
          item,
          "missing-key",
          `${what[0]?.toUpperCase()}${what.slice(1)} needs ${key === "expects" ? "an" : "a"} ${key}.`,
        );
    const role = text("role");
    const question = text("question");
    // A role the auth file no longer has: stale, said, and left out.
    if (role && !roles.includes(role))
      ctx.warning(
        at("role")?.value,
        "unknown-role",
        `There is no role "${role}" for ${what}.`,
        didYouMean(role, roles) ?? `The roles: ${roles.join(", ")}.`,
      );
    const expects = at("expects")
      ? readExpectation(ctx, at("expects") as Entry, ir, what)
      : undefined;
    if (role && roles.includes(role) && question && expects) asks.push({ role, question, expects });
  });
  return { asks, diagnostics: ctx.diagnostics };
}

/** The expected shape: its kind, fields and values checked against the spec as it is now. */
function readExpectation(
  ctx: ParseContext,
  entry: Entry,
  ir: SpecIR,
  what: string,
): AskExpectation | undefined {
  const entries = mapEntries(ctx, entry.value, `${what}'s expects`);
  if (!entries) return undefined;
  const allowed = checkKeys(ctx, entries, `${what}'s expects`, EXPECT_KEYS);
  const at = (key: string) => allowed.find((e) => e.key === key);
  const kindEntry = at("kind");
  const answerEntry = at("answer");
  if (!kindEntry) ctx.error(entry.value, "missing-key", `${what} expects a kind.`);
  if (!answerEntry)
    ctx.error(entry.value, "missing-key", `${what} expects an answer: ${ASK_ANSWERS.join(", ")}.`);
  const kind = kindEntry ? readString(ctx, kindEntry.value, `${what}'s kind`) : undefined;
  const answer = answerEntry ? readString(ctx, answerEntry.value, `${what}'s answer`) : undefined;
  if (answer !== undefined && !(ASK_ANSWERS as readonly string[]).includes(answer))
    ctx.error(
      answerEntry?.value,
      "unknown-answer",
      `${what}'s answer must be one of ${ASK_ANSWERS.join(", ")}.`,
    );
  if (!kind || !answer || !(ASK_ANSWERS as readonly string[]).includes(answer)) return undefined;
  const model = ir.models.find((m) => m.name === kind);
  if (!model) {
    const names = ir.models.map((m) => m.name);
    ctx.warning(
      kindEntry?.value,
      "unknown-kind",
      `There is no kind "${kind}" for ${what}.`,
      didYouMean(kind, names) ?? `The kinds: ${names.join(", ")}.`,
    );
    return undefined;
  }
  const expectation: AskExpectation = { kind, answer: answer as AskAnswer };
  const measureEntry = at("measure");
  if (measureEntry) {
    const measure = readString(ctx, measureEntry.value, `${what}'s measure`);
    if (measure && !fieldOf(model, measure))
      ctx.warning(
        measureEntry.value,
        "unknown-field",
        `${model.name} has no field "${measure}" to measure (${what}).`,
        didYouMean(
          measure,
          model.fields.map((f) => f.name),
        ),
      );
    if (measure) expectation.measure = measure;
  }
  const whereEntry = at("where");
  if (whereEntry) {
    const conditions = mapEntries(ctx, whereEntry.value, `${what}'s where`);
    if (conditions) {
      const where: Record<string, unknown> = {};
      for (const condition of conditions) {
        const field = fieldOf(model, condition.key);
        if (!field) {
          ctx.warning(
            condition.keyNode,
            "unknown-field",
            `${model.name} has no field "${condition.key}" (${what}).`,
            didYouMean(
              condition.key,
              model.fields.map((f) => f.name),
            ),
          );
          continue;
        }
        const value = condition.value?.toJSON();
        const values = valuesOf(field);
        if (values) {
          // A choice's value, or several: each must still be one of the field's.
          const named = Array.isArray(value)
            ? value.map(String)
            : typeof value === "string"
              ? [value]
              : [];
          for (const v of named)
            if (!values.includes(v))
              ctx.warning(
                condition.value,
                "unknown-value",
                `"${v}" is not a value of ${model.name}.${field.name} (${what}).`,
                didYouMean(v, values) ?? `The values: ${values.join(", ")}.`,
              );
        }
        where[condition.key] = value;
      }
      expectation.where = where;
    }
  }
  return expectation;
}

const fieldOf = (model: ModelIR, name: string) => model.fields.find((f) => f.name === name);

/**
 * A choice field's meaning text (its description or intent) that names, in quotes, a word that
 * is not one of its values: "down" after it became "outage". Positions are the field's in the
 * spec as far as the text knows them: the message names the field.
 */
export function staleMeaningWords(ir: SpecIR): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const model of ir.models)
    for (const field of model.fields) {
      const values = valuesOf(field);
      if (!values) continue;
      for (const text of [field.description, field.intent]) {
        if (!text) continue;
        for (const word of quoted(text))
          if (!values.includes(word) && !values.some((v) => v.toLowerCase() === word.toLowerCase()))
            out.push({
              severity: "warning",
              code: "stale-meaning-word",
              message: `The meaning of ${model.name}.${field.name} names "${word}", which is not one of its values (${values.join(", ")}).`,
              hint: "Change the text with setMeaning, or add the value.",
              file: "smithable.yml",
              line: 0,
              column: 0,
            });
      }
    }
  return out;
}

/** The words a text quotes: 'x', "x", *x* or `x`, single words only (a quoted sentence is not a value). */
function quoted(text: string): string[] {
  const words: string[] = [];
  for (const m of text.matchAll(/(['"*`])([\p{L}\p{N}_-]+)\1/gu)) words.push(m[2] as string);
  return words;
}
