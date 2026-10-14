import type { Expr } from "@smithable/core";

const OPERATORS: Record<string, string> = {
  "+": "plus",
  "-": "minus",
  "*": "times",
  "/": "divided by",
  "&": "followed by",
  "=": "is",
  "<>": "is not",
  "<": "is less than",
  ">": "is more than",
  "<=": "is at most",
  ">=": "is at least",
};
const PRECEDENCE: Record<string, number> = {
  "=": 1,
  "<>": 1,
  "<": 1,
  ">": 1,
  "<=": 1,
  ">=": 1,
  "&": 2,
  "+": 2,
  "-": 2,
  "*": 3,
  "/": 3,
};

/**
 * A formula in plain words for the Builder's summary: "quantity * unitPrice" → "the quantity
 * times the unit price", IF(total > 100, 0, 5) → "0 if the total is more than 100, otherwise
 * 5". `label` names a field, or for "lines.amount" the list and the field.
 */
export function formulaInWords(expr: Expr, label: (name: string) => string): string {
  const words = (e: Expr) => formulaInWords(e, label);
  const operand = (e: Expr, min: number) =>
    e.kind === "binary" && (PRECEDENCE[e.op] ?? 0) < min ? `(${words(e)})` : words(e);
  const own = (list: string, field?: string) =>
    field ? `${label(field)} of its ${label(list)}` : `its ${label(list)}`;
  switch (expr.kind) {
    case "number":
      return String(expr.value);
    case "text":
      return `“${expr.value}”`;
    case "bool":
      return expr.value ? "yes" : "no";
    case "field": {
      const [first, second] = expr.name.split(".");
      return second
        ? `the ${label(second)} of the ${label(first as string)}`
        : `the ${label(first as string)}`;
    }
    case "unary":
      return `minus ${operand(expr.operand, 4)}`;
    case "binary": {
      const p = PRECEDENCE[expr.op] ?? 0;
      return `${operand(expr.left, p)} ${OPERATORS[expr.op]} ${operand(expr.right, p + 1)}`;
    }
    case "call": {
      const [a, b, c] = expr.args.map(words);
      switch (expr.name) {
        case "IF":
          return `${b} if ${a}, otherwise ${c}`;
        case "AND":
          return expr.args.map(words).join(" and ");
        case "OR":
          return expr.args.map(words).join(" or ");
        case "NOT":
          return `not ${a}`;
        case "ROUND":
          return `${a} rounded to ${b ?? 0} decimals`;
        case "ABS":
          return `the absolute value of ${a}`;
        case "PMT":
          return `the payment per period of ${words(expr.args[2] as never)} over ${b} periods at ${a} per period`;
        case "MIN":
          return `the smaller of ${a} and ${b}`;
        case "MAX":
          return `the larger of ${a} and ${b}`;
        case "TODAY":
          return "today";
        case "NOW":
          return "now";
        case "DATEADD":
          return `${a} plus ${b} ${String(c).replace(/[“”]/g, "")}s`;
        case "DAYS":
          return `the number of days from ${b} to ${a}`;
        case "CONCAT":
          return expr.args.map(words).join(" followed by ");
      }
      return expr satisfies never;
    }
    case "aggregate": {
      const what = own(expr.list, expr.field);
      switch (expr.name) {
        case "SUM":
          return `the total ${what}`;
        case "COUNT":
          return `the number of ${what}`;
        case "COUNTIF":
          return `the number of its ${label(expr.list)} whose ${label(expr.field ?? "")} is ${expr.value ? words(expr.value) : ""}`;
        case "AVG":
          return `the average ${what}`;
        case "MIN":
          return `the lowest ${what}`;
        case "MAX":
          return `the highest ${what}`;
        case "LAST":
          return `the ${label(expr.field ?? "")} of the newest of its ${label(expr.list)}`;
        case "FIRST":
          return `the ${label(expr.field ?? "")} of the first of its ${label(expr.list)}`;
      }
    }
  }
}
