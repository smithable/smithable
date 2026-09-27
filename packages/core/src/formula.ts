import type { FieldIR, ModelIR } from "./ir.js";
import { didYouMean } from "./suggest.js";

/**
 * Spreadsheet-style formulas (ARCHITECTURE §2.5): arithmetic, comparisons, a fixed set of
 * functions, and aggregates over a list of related records. No user-defined functions,
 * loops or free queries.
 */
export type Expr =
  | { kind: "number"; value: number }
  | { kind: "text"; value: string }
  | { kind: "bool"; value: boolean }
  | { kind: "field"; name: string }
  | { kind: "unary"; op: "-"; operand: Expr }
  | { kind: "binary"; op: BinaryOp; left: Expr; right: Expr }
  | { kind: "call"; name: FunctionName; args: Expr[] }
  | { kind: "aggregate"; name: AggregateName; list: string; field?: string; value?: Expr };

export type BinaryOp = "+" | "-" | "*" | "/" | "&" | "=" | "<>" | "<" | ">" | "<=" | ">=";

export type ValueType = "number" | "text" | "bool" | "date" | "datetime";

const FUNCTIONS = [
  "IF",
  "AND",
  "OR",
  "NOT",
  "ROUND",
  "ABS",
  "MIN",
  "MAX",
  "TODAY",
  "NOW",
  "DATEADD",
  "DAYS",
  "CONCAT",
] as const;
const AGGREGATES = ["SUM", "COUNT", "COUNTIF", "AVG", "MIN", "MAX"] as const;
export type FunctionName = (typeof FUNCTIONS)[number];
export type AggregateName = (typeof AGGREGATES)[number];
const DATE_UNITS = ["day", "month", "year"];

export class FormulaError extends Error {
  constructor(
    message: string,
    /** Offset in the formula text. */
    readonly offset: number,
    readonly hint?: string,
  ) {
    super(message);
  }
}

// ── Parsing ──────────────────────────────────────────────────────────────────

type Token = {
  type: "num" | "str" | "id" | "op" | "(" | ")" | "," | "." | "end";
  text: string;
  at: number;
};

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i] as string;
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(source[i + 1] ?? ""))) {
      const m = /^[0-9]*\.?[0-9]+/.exec(source.slice(i)) as RegExpExecArray;
      tokens.push({ type: "num", text: m[0], at: i });
      i += m[0].length;
    } else if (c === '"') {
      const end = source.indexOf('"', i + 1);
      if (end === -1) throw new FormulaError("A text value is missing its closing quote.", i);
      tokens.push({ type: "str", text: source.slice(i + 1, end), at: i });
      i = end + 1;
    } else if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i)) as RegExpExecArray;
      tokens.push({ type: "id", text: m[0], at: i });
      i += m[0].length;
    } else if (c === "(" || c === ")" || c === "," || c === ".") {
      tokens.push({ type: c, text: c, at: i });
      i++;
    } else {
      const op = ["<>", "<=", ">=", "+", "-", "*", "/", "&", "=", "<", ">"].find((o) =>
        source.startsWith(o, i),
      );
      if (!op) {
        throw new FormulaError(
          `"${c}" cannot be used in a formula.`,
          i,
          c === "!" || c === "|"
            ? "Use NOT(…) and OR(…) instead."
            : c === "'"
              ? 'Write text in double quotes, like "standard".'
              : undefined,
        );
      }
      tokens.push({ type: "op", text: op, at: i });
      i += op.length;
    }
  }
  tokens.push({ type: "end", text: "", at: source.length });
  return tokens;
}

/** Parses a formula into an expression tree. Throws FormulaError with the offset of the problem. */
export function parseFormula(source: string): Expr {
  const tokens = tokenize(source);
  let pos = 0;
  const peek = () => tokens[pos] as Token;
  const next = () => tokens[pos++] as Token;
  const expect = (type: Token["type"], what: string) => {
    const t = next();
    if (t.type !== type)
      throw new FormulaError(
        `Expected ${what}${t.type === "end" ? " at the end" : `, found "${t.text}"`}.`,
        t.at,
      );
    return t;
  };

  const binary = (ops: string[], operand: () => Expr) => () => {
    let left = operand();
    while (peek().type === "op" && ops.includes(peek().text)) {
      const op = next().text as BinaryOp;
      left = { kind: "binary", op, left, right: operand() };
    }
    return left;
  };
  const primary = (): Expr => {
    const t = next();
    if (t.type === "num") return { kind: "number", value: Number(t.text) };
    if (t.type === "str") return { kind: "text", value: t.text };
    if (t.type === "(") {
      const e = comparison();
      expect(")", 'a closing ")"');
      return e;
    }
    if (t.type === "op" && t.text === "-") return { kind: "unary", op: "-", operand: primary() };
    if (t.type !== "id")
      throw new FormulaError(
        t.type === "end" ? "The formula ends too early." : `Unexpected "${t.text}".`,
        t.at,
      );
    const upper = t.text.toUpperCase();
    if (upper === "TRUE" || upper === "FALSE") return { kind: "bool", value: upper === "TRUE" };
    if (peek().type === "(") {
      next();
      const args: Expr[] = [];
      if (peek().type !== ")") {
        do {
          args.push(comparison());
        } while (peek().type === "," && next());
      }
      expect(")", 'a closing ")"');
      return call(upper, args, t.at);
    }
    if (peek().type === ".") {
      next();
      const field = expect("id", "a field name after the dot");
      return { kind: "field", name: `${t.text}.${field.text}` };
    }
    return { kind: "field", name: t.text };
  };
  const unary = (): Expr => primary();
  const multiplicative = binary(["*", "/"], unary);
  const additive = binary(["+", "-", "&"], multiplicative);
  const comparison = binary(["=", "<>", "<", ">", "<=", ">="], additive);

  const call = (name: string, args: Expr[], at: number): Expr => {
    // MIN and MAX are aggregates only with a single list argument: MIN(lines.amount).
    const singleList = args.length === 1 && args[0]?.kind === "field" && args[0].name.includes(".");
    const isAggregate =
      (AGGREGATES as readonly string[]).includes(name) &&
      (name === "MIN" || name === "MAX" ? singleList : true);
    if (isAggregate) {
      const aggregate = name as AggregateName;
      const target = args[0];
      if (target?.kind !== "field")
        throw new FormulaError(`${name} needs a list, like ${name}(lines.amount).`, at);
      const [list, field] = target.name.split(".") as [string, string | undefined];
      if (name === "COUNT") {
        if (args.length !== 1)
          throw new FormulaError("COUNT takes one list, like COUNT(bookings).", at);
        return { kind: "aggregate", name: aggregate, list, ...(field ? { field } : {}) };
      }
      if (!field)
        throw new FormulaError(`${name} needs a list and a field, like ${name}(lines.amount).`, at);
      if (name === "COUNTIF") {
        if (args.length !== 2)
          throw new FormulaError(
            'COUNTIF takes a list field and a value, like COUNTIF(bookings.status, "confirmed").',
            at,
          );
        return { kind: "aggregate", name: aggregate, list, field, value: args[1] as Expr };
      }
      if (args.length !== 1)
        throw new FormulaError(`${name} takes one list field, like ${name}(lines.amount).`, at);
      return { kind: "aggregate", name: aggregate, list, field };
    }
    if (!(FUNCTIONS as readonly string[]).includes(name)) {
      throw new FormulaError(
        `Unknown function ${name}.`,
        at,
        didYouMean(name, [...FUNCTIONS, ...AGGREGATES]) ??
          `Available: ${[...new Set([...FUNCTIONS, ...AGGREGATES])].join(", ")}.`,
      );
    }
    return { kind: "call", name: name as FunctionName, args };
  };

  const expr = comparison();
  if (peek().type !== "end") throw new FormulaError(`Unexpected "${peek().text}".`, peek().at);
  return expr;
}

// ── Type checking ────────────────────────────────────────────────────────────

export function valueTypeOf(field: FieldIR): ValueType | undefined {
  if (field.type.kind === "choice") return "text";
  if (field.type.kind === "relation") return undefined;
  switch (field.type.name) {
    case "int":
    case "decimal":
    case "money":
      return "number";
    case "bool":
      return "bool";
    case "date":
      return "date";
    case "datetime":
      return "datetime";
    default:
      return "text";
  }
}

/** Checks a formula against a model; returns its type. Throws FormulaError. */
export function checkFormula(expr: Expr, model: ModelIR, models: ModelIR[]): ValueType {
  const fieldNamed = (m: ModelIR, name: string) => m.fields.find((f) => f.name === name);
  const typeOf = (e: Expr): ValueType => {
    switch (e.kind) {
      case "number":
        return "number";
      case "text":
        return "text";
      case "bool":
        return "bool";
      case "field": {
        if (e.name.includes(".")) {
          throw new FormulaError(
            `"${e.name}" refers to related records. Use it inside SUM, COUNT, COUNTIF, AVG, MIN or MAX.`,
            0,
          );
        }
        const field = fieldNamed(model, e.name);
        if (!field) {
          throw new FormulaError(
            `${model.name} has no field "${e.name}".`,
            0,
            didYouMean(
              e.name,
              model.fields.map((f) => f.name),
            ),
          );
        }
        const t = valueTypeOf(field);
        if (!t)
          throw new FormulaError(
            `"${e.name}" is a relation; formulas can use SUM, COUNT and the like over lists.`,
            0,
          );
        return t;
      }
      case "unary":
        need(typeOf(e.operand), "number", "-");
        return "number";
      case "binary": {
        const l = typeOf(e.left);
        const r = typeOf(e.right);
        if (["+", "-", "*", "/"].includes(e.op)) {
          need(l, "number", e.op);
          need(r, "number", e.op);
          return "number";
        }
        if (e.op === "&") return "text";
        if (l !== r) throw new FormulaError(`Cannot compare ${l} with ${r}.`, 0);
        checkChoice(e.left, e.right);
        checkChoice(e.right, e.left);
        return "bool";
      }
      case "call":
        return callType(e);
      case "aggregate": {
        const list = fieldNamed(model, e.list);
        if (list?.type.kind !== "relation" || !list.type.many) {
          const lists = model.fields
            .filter((f) => f.type.kind === "relation" && f.type.many)
            .map((f) => f.name);
          throw new FormulaError(
            `${model.name} has no list named "${e.list}".`,
            0,
            didYouMean(e.list, lists),
          );
        }
        const target = models.find((m) => m.name === (list.type as { model: string }).model);
        if (!target) return "number";
        if (e.field !== undefined) {
          const field = fieldNamed(target, e.field);
          if (!field) {
            throw new FormulaError(
              `${target.name} has no field "${e.field}".`,
              0,
              didYouMean(
                e.field,
                target.fields.map((f) => f.name),
              ),
            );
          }
          const t = valueTypeOf(field);
          if (!t)
            throw new FormulaError(
              `${target.name}.${e.field} is a relation, which ${e.name} cannot use.`,
              0,
            );
          if (e.name === "COUNTIF") {
            const v = e.value ? typeOf(e.value) : undefined;
            if (v !== t)
              throw new FormulaError(
                `COUNTIF compares ${target.name}.${e.field} (${t}) with a ${v}.`,
                0,
              );
            if (
              e.value?.kind === "text" &&
              field.type.kind === "choice" &&
              !field.type.values.includes(e.value.value)
            ) {
              throw new FormulaError(
                `"${e.value.value}" is not a choice of ${target.name}.${e.field}.`,
                0,
                didYouMean(e.value.value, field.type.values),
              );
            }
          } else if (e.name !== "COUNT") {
            need(t, "number", e.name);
          }
        }
        return "number";
      }
    }
  };
  const need = (actual: ValueType, expected: ValueType, where: string) => {
    if (actual !== expected)
      throw new FormulaError(`${where} needs a ${expected}, not a ${actual}.`, 0);
  };
  const checkChoice = (a: Expr, b: Expr) => {
    if (a.kind !== "field" || b.kind !== "text") return;
    const field = fieldNamed(model, a.name);
    if (field?.type.kind === "choice" && !field.type.values.includes(b.value)) {
      throw new FormulaError(
        `"${b.value}" is not a choice of ${a.name}.`,
        0,
        didYouMean(b.value, field.type.values),
      );
    }
  };
  const callType = (e: Extract<Expr, { kind: "call" }>): ValueType => {
    const types = e.args.map(typeOf);
    const count = (min: number, max = min) => {
      if (types.length < min || types.length > max) {
        const n =
          min === max
            ? `${min}`
            : max === Number.POSITIVE_INFINITY
              ? `at least ${min}`
              : `${min} or ${max}`;
        throw new FormulaError(
          `${e.name} takes ${n} value${min === 1 && max === 1 ? "" : "s"}.`,
          0,
        );
      }
    };
    switch (e.name) {
      case "IF":
        count(3);
        need(types[0] as ValueType, "bool", "The condition of IF");
        if (types[1] !== types[2])
          throw new FormulaError(
            `Both results of IF must be of the same kind (${types[1]} and ${types[2]}).`,
            0,
          );
        return types[1] as ValueType;
      case "AND":
      case "OR":
        count(1, Number.POSITIVE_INFINITY);
        for (const t of types) need(t, "bool", e.name);
        return "bool";
      case "NOT":
        count(1);
        need(types[0] as ValueType, "bool", "NOT");
        return "bool";
      case "ROUND":
        count(1, 2);
        for (const t of types) need(t, "number", "ROUND");
        return "number";
      case "ABS":
        count(1);
        need(types[0] as ValueType, "number", "ABS");
        return "number";
      case "MIN":
      case "MAX":
        count(2, Number.POSITIVE_INFINITY);
        for (const t of types) need(t, "number", e.name);
        return "number";
      case "TODAY":
        count(0);
        return "date";
      case "NOW":
        count(0);
        return "datetime";
      case "DATEADD": {
        count(3);
        need(types[0] as ValueType, "date", "DATEADD");
        need(types[1] as ValueType, "number", "DATEADD");
        const unit = e.args[2];
        if (unit?.kind !== "text" || !DATE_UNITS.includes(unit.value)) {
          throw new FormulaError(`The unit of DATEADD must be "day", "month" or "year".`, 0);
        }
        return "date";
      }
      case "DAYS":
        count(2);
        need(types[0] as ValueType, "date", "DAYS");
        need(types[1] as ValueType, "date", "DAYS");
        return "number";
      case "CONCAT":
        count(1, Number.POSITIVE_INFINITY);
        return "text";
    }
  };
  return typeOf(expr);
}

/** Fields of the same record a formula reads, for dependency order and cycle checks. */
export function fieldsUsed(expr: Expr): string[] {
  switch (expr.kind) {
    case "field":
      return [expr.name];
    case "unary":
      return fieldsUsed(expr.operand);
    case "binary":
      return [...fieldsUsed(expr.left), ...fieldsUsed(expr.right)];
    case "call":
      return expr.args.flatMap(fieldsUsed);
    case "aggregate":
      return [expr.list, ...(expr.value ? fieldsUsed(expr.value) : [])];
    default:
      return [];
  }
}

const PRECEDENCE: Record<BinaryOp, number> = {
  "=": 1,
  "<>": 1,
  "<": 1,
  ">": 1,
  "<=": 1,
  ">=": 1,
  "+": 2,
  "-": 2,
  "&": 2,
  "*": 3,
  "/": 3,
};

/** Writes a formula back as text, with only the parentheses it needs. */
export function formatFormula(expr: Expr): string {
  const operand = (e: Expr, min: number): string =>
    e.kind === "binary" && PRECEDENCE[e.op] < min ? `(${formatFormula(e)})` : formatFormula(e);
  switch (expr.kind) {
    case "number":
      return String(expr.value);
    case "text":
      return `"${expr.value}"`;
    case "bool":
      return expr.value ? "TRUE" : "FALSE";
    case "field":
      return expr.name;
    case "unary":
      return `-${operand(expr.operand, 4)}`;
    case "binary": {
      const p = PRECEDENCE[expr.op];
      // Operators group to the left, so a right operand of the same level needs parentheses.
      return `${operand(expr.left, p)} ${expr.op} ${operand(expr.right, p + 1)}`;
    }
    case "call":
      return `${expr.name}(${expr.args.map(formatFormula).join(", ")})`;
    case "aggregate": {
      const target = expr.field ? `${expr.list}.${expr.field}` : expr.list;
      return `${expr.name}(${target}${expr.value ? `, ${formatFormula(expr.value)}` : ""})`;
    }
  }
}
