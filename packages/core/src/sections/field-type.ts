import { type FieldType, type FieldValue, SCALAR_TYPES, type ScalarType } from "../ir.js";
import { didYouMean } from "../suggest.js";
import { FIELD_NAME_PATTERN, nameRule } from "./names.js";

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string; hint?: string };

export interface FieldShorthand {
  type: FieldType;
  required: boolean;
  unique: boolean;
  /** Raw text after "=", not yet converted to the field's type. */
  defaultText?: string;
}

const MODIFIERS = ["unique"] as const;

/**
 * Parses the field shorthand, e.g. `string!`, `email unique`, `int! = 60` or `draft | sent | paid`.
 * The whole grammar is: `<type>[!] [unique] [= <default>]`, or choices separated by `|`.
 */
export function parseFieldShorthand(text: string): Result<FieldShorthand> {
  const source = text.trim();
  if (source.includes("|")) return parseChoice(source);

  const eq = source.indexOf("=");
  const head = (eq === -1 ? source : source.slice(0, eq)).trim();
  const defaultText = eq === -1 ? undefined : source.slice(eq + 1).trim();
  const [typeToken = "", ...modifiers] = head.split(/\s+/);

  const required = typeToken.endsWith("!");
  const typeName = required ? typeToken.slice(0, -1) : typeToken;
  const type = parseTypeName(typeName);
  if (!type.ok) return type;
  if (type.value.kind === "relation" && type.value.many) {
    const extra = required
      ? `"!"`
      : modifiers.length
        ? `"${modifiers.join(" ")}"`
        : eq !== -1
          ? "a default"
          : "";
    if (extra) {
      return fail(
        "invalid-field",
        `A list of related records (${typeName}) cannot have ${extra}: it is always the records that refer to this one.`,
      );
    }
  }

  let unique = false;
  for (const modifier of modifiers) {
    if (modifier === "unique") {
      unique = true;
    } else if (modifier === "required") {
      return fail("invalid-field", `Write "required" as "!" after the type, like "${typeName}!".`);
    } else {
      return fail(
        "invalid-field",
        `Unknown word "${modifier}" in a field definition.`,
        didYouMean(modifier, MODIFIERS) ??
          `After the type, only "unique" and "= <default>" may follow.`,
      );
    }
  }
  if (defaultText === "") return fail("invalid-default", `A default is missing after "=".`);
  return {
    ok: true,
    value: {
      type: type.value,
      required,
      unique,
      ...(defaultText === undefined ? {} : { defaultText }),
    },
  };
}

function parseChoice(source: string): Result<FieldShorthand> {
  if (source.includes("=")) {
    return fail(
      "invalid-choice",
      `A choice field's default is its first value, so "=" is not used here.`,
      `Put the default first, or use the long form with "default:".`,
    );
  }
  const values = source.split("|").map((v) => v.trim());
  const seen = new Set<string>();
  for (const value of values) {
    if (!FIELD_NAME_PATTERN.test(value)) {
      return fail(
        "invalid-choice",
        value === "" ? `A choice between "|" signs is empty.` : nameRule("choice", value),
        value.includes("!")
          ? `Choice fields always have a value (the first one by default), so "!" is not needed.`
          : undefined,
      );
    }
    if (seen.has(value)) return fail("invalid-choice", `Choice value "${value}" appears twice.`);
    seen.add(value);
  }
  return { ok: true, value: { type: { kind: "choice", values }, required: true, unique: false } };
}

function parseTypeName(name: string): Result<FieldType> {
  if ((SCALAR_TYPES as readonly string[]).includes(name)) {
    return { ok: true, value: { kind: "scalar", name: name as ScalarType } };
  }
  const relation = /^([A-Z][A-Za-z0-9]*)(\[\])?$/.exec(name);
  if (relation?.[1]) {
    return {
      ok: true,
      value: { kind: "relation", model: relation[1], many: relation[2] === "[]" },
    };
  }
  if (name === "") return fail("invalid-field", "The field type is missing.");
  // "file[]" and "picture[]" read like lists of related records; the list types are files and pictures.
  const list = /^(file|picture)\[\]$/.exec(name);
  return fail(
    "unknown-type",
    `Unknown field type "${name}".`,
    (list ? `Did you mean "${list[1]}s"?` : undefined) ??
      didYouMean(name, SCALAR_TYPES) ??
      `Available types: ${SCALAR_TYPES.join(", ")}. Choices are written like "a | b | c".`,
  );
}

/** Converts a default (shorthand text or a YAML value) to the field's type. */
export function parseDefault(type: FieldType, raw: FieldValue): Result<FieldValue> {
  if (type.kind === "relation") return fail("invalid-default", "Relations cannot have a default.");
  if (typeof raw === "string" && raw.includes("(")) {
    return fail(
      "not-yet-supported",
      `Formula defaults like "${raw}" are not available in spec version 0.1 yet.`,
    );
  }
  if (type.kind === "choice") {
    return typeof raw === "string" && type.values.includes(raw)
      ? { ok: true, value: raw }
      : fail(
          "invalid-default",
          `Default "${raw}" is not one of the choices: ${type.values.join(", ")}.`,
        );
  }
  const text = String(raw);
  switch (type.name) {
    case "int":
      return /^-?\d+$/.test(text)
        ? { ok: true, value: Number(text) }
        : wrong(text, "a whole number");
    case "decimal":
    case "money":
      return /^-?\d+(\.\d+)?$/.test(text)
        ? { ok: true, value: Number(text) }
        : wrong(text, "a number");
    case "bool":
      return text === "true" || text === "false"
        ? { ok: true, value: text === "true" }
        : wrong(text, "true or false");
    case "date":
      return isDate(text) ? { ok: true, value: text } : wrong(text, "a date like 2026-09-01");
    case "datetime":
      return isDateTime(text)
        ? { ok: true, value: text }
        : wrong(text, "a date and time like 2026-09-01T09:30");
    default:
      return { ok: true, value: unquote(text) };
  }
}

function isDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}

function isDateTime(text: string): boolean {
  const match = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?$/.exec(text);
  return match?.[1] !== undefined && isDate(match[1]) && !Number.isNaN(new Date(text).getTime());
}

function unquote(text: string): string {
  return /^".*"$|^'.*'$/.test(text) ? text.slice(1, -1) : text;
}

function wrong(text: string, expected: string): Result<never> {
  return fail("invalid-default", `Default "${text}" must be ${expected}.`);
}

function fail(code: string, message: string, hint?: string): Result<never> {
  return hint === undefined ? { ok: false, code, message } : { ok: false, code, message, hint };
}
