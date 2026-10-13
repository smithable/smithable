import { describe, expect, test } from "vitest";
import { parseDefault, parseFieldShorthand } from "./field-type.js";

describe("parseFieldShorthand", () => {
  test.each([
    ["string", { type: { kind: "scalar", name: "string" }, required: false, unique: false }],
    ["string!", { type: { kind: "scalar", name: "string" }, required: true, unique: false }],
    ["email unique", { type: { kind: "scalar", name: "email" }, required: false, unique: true }],
    [
      "  email!   unique  ",
      { type: { kind: "scalar", name: "email" }, required: true, unique: true },
    ],
    [
      "int! = 60",
      { type: { kind: "scalar", name: "int" }, required: true, unique: false, defaultText: "60" },
    ],
    [
      "url = https://a.b/?x=1",
      {
        type: { kind: "scalar", name: "url" },
        required: false,
        unique: false,
        defaultText: "https://a.b/?x=1",
      },
    ],
    [
      "draft | sent | paid",
      {
        type: { kind: "choice", values: ["draft", "sent", "paid"] },
        required: true,
        unique: false,
      },
    ],
    ["a|b", { type: { kind: "choice", values: ["a", "b"] }, required: true, unique: false }],
    [
      "Customer!",
      { type: { kind: "relation", model: "Customer", many: false }, required: true, unique: false },
    ],
    [
      "Customer unique",
      { type: { kind: "relation", model: "Customer", many: false }, required: false, unique: true },
    ],
    [
      "Order[]",
      { type: { kind: "relation", model: "Order", many: true }, required: false, unique: false },
    ],
  ])("%s", (input, expected) => {
    expect(parseFieldShorthand(input)).toEqual({ ok: true, value: expected });
  });

  test.each([
    ["strng", "unknown-type", 'Did you mean "string"?'],
    ["file[]", "unknown-type", 'Did you mean "files"?'],
    ["picture[]", "unknown-type", 'Did you mean "pictures"?'],
    ["", "invalid-field", undefined],
    ["string required", "invalid-field", undefined],
    ["string uniqe", "invalid-field", 'Did you mean "unique"?'],
    ["int =", "invalid-default", undefined],
    [
      "draft | sent = sent",
      "invalid-choice",
      'Put the default first, or use the long form with "default:".',
    ],
    ["Order[]!", "invalid-field", undefined],
    ["Order[] unique", "invalid-field", undefined],
    ["draft | Sent", "invalid-choice", undefined],
    ["draft | draft", "invalid-choice", undefined],
    ["draft | ", "invalid-choice", undefined],
    [
      "draft! | sent",
      "invalid-choice",
      'Choice fields always have a value (the first one by default), so "!" is not needed.',
    ],
  ])("%s fails with %s", (input, code, hint) => {
    const result = parseFieldShorthand(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(code);
      expect(result.hint).toBe(hint);
    }
  });
});

describe("parseDefault", () => {
  const scalar = (name: string) => ({ kind: "scalar", name }) as const;

  test.each([
    [scalar("int"), "60", 60],
    [scalar("int"), 60, 60],
    [scalar("decimal"), "0.5", 0.5],
    [scalar("money"), "-12.50", -12.5],
    [scalar("bool"), "false", false],
    [scalar("bool"), true, true],
    [scalar("date"), "2026-02-28", "2026-02-28"],
    [scalar("datetime"), "2026-09-01T09:30:00Z", "2026-09-01T09:30:00Z"],
    [scalar("string"), '"quoted"', "quoted"],
    [scalar("text"), "plain words", "plain words"],
  ] as const)("%o %s", (type, raw, expected) => {
    expect(parseDefault(type as never, raw)).toEqual({ ok: true, value: expected });
  });

  test.each([
    [scalar("int"), "1.5"],
    [scalar("decimal"), "abc"],
    [scalar("bool"), "yes"],
    [scalar("date"), "2026-02-30"],
    [scalar("datetime"), "2026-09-01"],
    [{ kind: "choice", values: ["a", "b"] }, "c"],
  ] as const)("%o %s is invalid", (type, raw) => {
    expect(parseDefault(type as never, raw)).toMatchObject({ ok: false, code: "invalid-default" });
  });

  test("formula defaults are reported as not yet supported", () => {
    expect(parseDefault(scalar("date") as never, "TODAY()")).toMatchObject({
      ok: false,
      code: "not-yet-supported",
    });
  });
});
