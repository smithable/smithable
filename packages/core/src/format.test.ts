import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { formatSpec, sameContent } from "./format.js";

// Every example's spec and companion files, as text.
const examples = import.meta.glob("../../../examples/*/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("formatSpec", () => {
  it("writes objects as blocks and lists of objects as block lists; lists of scalars stay", () => {
    const text = `smithable: 0.1
app: { name: Shop, currency: EUR } # money
models:
  Order:
    fields: { number: string!, tags: [a, b], total: { type: money, required: true } }
    examples: [{ number: "1", tags: [a] }, { number: "2" }]
    list:
      - { number: "3" }
      - plain
`;
    expect(formatSpec(text)).toBe(`smithable: 0.1
app: # money
  name: Shop
  currency: EUR
models:
  Order:
    fields:
      number: string!
      tags: [a, b]
      total:
        type: money
        required: true
    examples:
      - number: "1"
        tags: [a]
      - number: "2"
    list:
      - number: "3"
      - plain
`);
  });
  it("touches nothing else: comments, blank lines, key order and quoting stay", () => {
    const text = `# The shop
smithable: 0.1

app:
  name: "Shop" # quoted on purpose
  description: What it sells

models: {}
`;
    expect(formatSpec(text)).toBe(text);
  });
  it("is stable on every example's files, and changes none of their meaning", () => {
    expect(Object.keys(examples).length).toBeGreaterThan(10);
    for (const [file, text] of Object.entries(examples)) {
      const once = formatSpec(text);
      expect(formatSpec(once), file).toBe(once);
      expect(parse(once), file).toEqual(parse(text));
      expect(once, file).not.toMatch(/: \{ |- \{ /);
    }
  });
  it("leaves text that is not YAML alone", () => {
    expect(formatSpec("a: [")).toBe("a: [");
  });
});

describe("sameContent", () => {
  it("is true for formatting, whitespace and comment differences only", () => {
    expect(sameContent("app: { name: Shop }\n", "# x\napp:\n  name: Shop\n\n")).toBe(true);
    expect(sameContent("app: { name: Shop }\n", "app: { name: Store }\n")).toBe(false);
    expect(sameContent("a: [", "a: [")).toBe(true);
    expect(sameContent("a: [", "a: 1")).toBe(false);
  });
});
