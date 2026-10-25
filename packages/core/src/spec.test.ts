import { describe, expect, test } from "vitest";
import { validateSpec } from "./spec.js";

const valid = {
  ...import.meta.glob("./__fixtures__/valid/*.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  ...import.meta.glob("../../../examples/*/smithable.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
};
const invalid = import.meta.glob("./__fixtures__/invalid/*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("valid specs", () => {
  test.each(Object.entries(valid))("%s", (path, text) => {
    const result = validateSpec({ path, text });
    // Notes are advice (docs/design/advice.md), not problems: a starter may carry some.
    expect(result.diagnostics.filter((d) => d.severity !== "note")).toEqual([]);
    expect(result.ir).toMatchSnapshot();
  });
});

describe("invalid specs report each error on the line marked '# expect: <code>'", () => {
  test.each(Object.entries(invalid))("%s", (path, text) => {
    const result = validateSpec({ path, text });
    expect(result.ir).toBeUndefined();
    const actual = result.diagnostics.map((d) => `line ${d.line}: ${d.code}`).sort();
    expect(actual).toEqual(expectedDiagnostics(text));
  });
});

test("diagnostics carry a message, a column and the file path", () => {
  const [diagnostic] = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp:\n  name: X\nmodels:\n  Customer:\n    fields:\n      name: strng\n",
  }).diagnostics;
  expect(diagnostic).toEqual({
    severity: "error",
    code: "unknown-type",
    message: 'Field "Customer.name": Unknown field type "strng".',
    hint: 'Did you mean "string"?',
    file: "smithable.yml",
    line: 7,
    column: 13,
  });
});

test("navigation defaults to every page in declaration order", () => {
  const { ir } = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: X }\nmodels:\n  A: { fields: { n: string } }\npages:\n  b: { crud: A }\n  a: { crud: A }\n",
  });
  expect(ir?.navigation).toEqual([{ name: "main", pages: ["b", "a"] }]);
  expect(ir?.pages.map((p) => p.route)).toEqual(["/b", "/a"]);
});

function expectedDiagnostics(text: string): string[] {
  return text
    .split("\n")
    .flatMap((line, i) => {
      const codes = /# expect: (.+)$/.exec(line)?.[1];
      return codes ? codes.split(",").map((code) => `line ${i + 1}: ${code.trim()}`) : [];
    })
    .sort();
}

test("an app's currency is an ISO 4217 code, with the nearest one suggested", () => {
  const app = (currency: string) =>
    validateSpec({
      path: "smithable.yml",
      text: `smithable: 0.1\napp:\n  name: Shop\n  currency: ${currency}\n`,
    });
  expect(app("SEK").diagnostics).toEqual([]);
  expect(app("SEK").ir?.app.currency).toBe("SEK");
  const [wrong] = app("EUO").diagnostics;
  expect(wrong).toMatchObject({ code: "invalid-currency", hint: 'Did you mean "EUR"?' });
  // Three letters are not enough: a code no country uses is refused too.
  expect(app("ABC").diagnostics.map((d) => d.code)).toEqual(["invalid-currency"]);
  expect(app("eur").diagnostics[0]?.hint).toBe('Did you mean "EUR"?');
});

test("an app's time zone is one the runtime knows, with the nearest one suggested", () => {
  const app = (timezone: string) =>
    validateSpec({
      path: "smithable.yml",
      text: `smithable: 0.1\napp:\n  name: Shop\n  timezone: ${timezone}\n`,
    });
  expect(app("Europe/Mariehamn").ir?.app.timezone).toBe("Europe/Mariehamn");
  expect(app("UTC").diagnostics).toEqual([]);
  expect(app("Europe/Marieham").diagnostics[0]).toMatchObject({
    code: "invalid-timezone",
    hint: 'Did you mean "Europe/Mariehamn"?',
  });
  expect(app("Nowhere/At-all").diagnostics.map((d) => d.code)).toEqual(["invalid-timezone"]);
});

describe("advice: notes with the operation that does what they say", () => {
  const read = (models: string, pages = "  cases: { crud: SupportCase }\n") =>
    validateSpec({
      path: "smithable.yml",
      text: `smithable: 0.1\napp:\n  name: Support\nmodels:\n${models}pages:\n${pages}`,
    });
  const notes = (r: ReturnType<typeof validateSpec>) =>
    r.diagnostics.filter((d) => d.severity === "note").map((d) => [d.code, d.line, d.fix]);

  test("a model others refer to with no list back; a crud page with a choice and no filters", () => {
    const r = read(
      "  SupportCase:\n    fields:\n      subject: string!\n      status: open | closed\n  Message:\n    fields:\n      content: text!\n      supportCase: SupportCase!\n",
    );
    expect(r.ir).toBeDefined();
    expect(notes(r)).toEqual([
      [
        "list-back",
        5,
        { op: "addField", args: { model: "SupportCase", field: "messages", type: "Message[]" } },
      ],
      ["filters-possible", 14, { op: "setFilters", args: { page: "cases", fields: ["status"] } }],
    ]);
    // Notes are advice: the spec is valid, and errors hide them.
    expect(r.diagnostics.some((d) => d.severity === "error")).toBe(false);
  });

  test("nothing to say when the list, the filters and the trash are there", () => {
    const r = read(
      "  SupportCase:\n    trash: true\n    fields:\n      subject: string!\n      status: open | closed\n      messages: Message[]\n  Message:\n    trash: true\n    fields:\n      content: text!\n      supportCase: SupportCase!\n",
      "  cases: { crud: SupportCase, filters: [status] }\n",
    );
    expect(notes(r)).toEqual([]);
  });

  test("a required reference from a model without a trash to one with", () => {
    const r = read(
      "  SupportCase:\n    trash: true\n    fields:\n      subject: string!\n      messages: Message[]\n  Message:\n    fields:\n      content: text!\n      supportCase: SupportCase!\n",
    );
    expect(notes(r)).toEqual([
      ["trash-together", 10, { op: "setTrash", args: { model: "Message", trash: true } }],
    ]);
  });
});

test("an action named with a reserved word or a model's name is refused with one that fits (A 159)", () => {
  const actions = (models: string, actions: string) =>
    validateSpec({
      path: "smithable.yml",
      text: `smithable: 0.1\napp: { name: Tools }\nmodels:\n${models}${actions ? `actions:\n${actions}` : ""}`,
    }).diagnostics.filter((d) => d.severity === "error");
  const tool = "  Tool:\n    fields: { name: string!, status: in | out }\n";
  expect(
    actions(tool, "  return: { on: Tool, set: { status: in } }\n").map((d) => d.message),
  ).toEqual(['Action name "return" is a word the code reserves: name the action "returnTool".']);
  const habits =
    "  Habit:\n    fields: { name: string!, done: bool }\n  CheckIn:\n    fields: { at: date! }\n";
  expect(
    actions(habits, "  checkIn: { on: Habit, set: { done: true } }\n").map((d) => d.message),
  ).toEqual([
    'Action name "checkIn" is also the name of the model CheckIn: name the action "checkInHabit".',
  ]);
  // Any word may name a field: only an action's name becomes code of its own.
  expect(actions("  Tool:\n    fields: { return: string!, default: bool }\n", "")).toEqual([]);
});
