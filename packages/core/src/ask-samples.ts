/**
 * The app's own Ask check, samples/ask.yml (docs/design/ask-words.md §4): questions a person with
 * a role would ask the in-app assistant, each with the shape of the answer expected (the kind, a
 * where or a measure, and whether a count, names or a number answers it). Written by Smith's
 * question pass and editable by hand; the host sends them through the development door and
 * compares what Ask asked with the shape, never the answer's words. Read like the sample files:
 * what names a kind, field, role or choice value no longer in the spec is a warning naming the
 * line and the question is kept as written, so the host can say what it finds now ("'Is anything
 * down?' finds nothing; its expectation still says down"). Gone with the sample data, never published.
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
  if (doc.contents === null) return { asks, diagnostics: ctx.diagnostics };
  if (!isSeq(doc.contents)) {
    ctx.error(doc.contents, "expected-list", `${file.path} must be a list of questions.`);
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
    // A role the auth file no longer has: stale, said; the question stays as written.
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
    if (role && question && expects) asks.push({ role, question, expects });
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
  const expectation: AskExpectation = { kind, answer: answer as AskAnswer };
  const model = ir.models.find((m) => m.name === kind);
  if (!model) {
    const names = ir.models.map((m) => m.name);
    ctx.warning(
      kindEntry?.value,
      "unknown-kind",
      `There is no kind "${kind}" for ${what}.`,
      didYouMean(kind, names) ?? `The kinds: ${names.join(", ")}.`,
    );
    // Kept as written, unchecked further: the host says what the question finds now.
    const measure = at("measure")
      ? readString(ctx, (at("measure") as Entry).value, `${what}'s measure`)
      : undefined;
    const where = at("where")?.value?.toJSON();
    return {
      ...expectation,
      ...(measure ? { measure } : {}),
      ...(where && typeof where === "object" ? { where: where as Record<string, unknown> } : {}),
    };
  }
  const measureEntry = at("measure");
  if (measureEntry) {
    const measure = readString(ctx, measureEntry.value, `${what}'s measure`);
    const measured = measure ? fieldOf(model, measure) : undefined;
    const hint = `The number fields: ${numbers(model).join(", ") || "none"}.`;
    if (measure && !measured)
      ctx.warning(
        measureEntry.value,
        "unknown-field",
        `${model.name} has no field "${measure}" to measure (${what}).`,
        didYouMean(measure, numbers(model)) ?? hint,
      );
    else if (measured && !isNumber(measured))
      ctx.warning(
        measureEntry.value,
        "not-a-number",
        `${model.name}.${measure} is not a number field to measure (${what}).`,
        hint,
      );
    if (measure) expectation.measure = measure;
  }
  const whereEntry = at("where");
  if (whereEntry) {
    const conditions = mapEntries(ctx, whereEntry.value, `${what}'s where`);
    if (conditions) {
      const where: Record<string, unknown> = {};
      for (const condition of conditions) {
        const value = condition.value?.toJSON();
        // Kept as written, whatever the check says: the host shows what it finds now.
        where[condition.key] = value;
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
        const values = valuesOf(field);
        if (values) {
          // A choice's value, or several: each must still be one of the field's.
          const named = Array.isArray(value)
            ? value.map(String)
            : typeof value === "string"
              ? [value]
              : undefined;
          if (!named)
            ctx.warning(
              condition.value,
              "unknown-value",
              `${model.name}.${field.name} takes one of its values, or a list of them (${what}).`,
              `The values: ${values.join(", ")}.`,
            );
          for (const v of named ?? [])
            if (!values.includes(v))
              ctx.warning(
                condition.value,
                "unknown-value",
                `"${v}" is not a value of ${model.name}.${field.name} (${what}).`,
                didYouMean(v, values) ?? `The values: ${values.join(", ")}.`,
              );
        }
      }
      expectation.where = where;
    }
  }
  return expectation;
}

const fieldOf = (model: ModelIR, name: string) => model.fields.find((f) => f.name === name);
const NUMBERS: readonly string[] = ["int", "decimal", "money"];
const isNumber = (field: FieldIR) =>
  field.type.kind === "scalar" && NUMBERS.includes(field.type.name);
const numbers = (model: ModelIR) => model.fields.filter(isNumber).map((f) => f.name);
