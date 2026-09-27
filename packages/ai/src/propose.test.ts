import { type SpecIR, validateSpec } from "@smithable/core";
import { buildContext, buildIndex } from "@smithable/index";
import { describe, expect, test } from "vitest";
import { proposeChange } from "./propose.js";
import { allowedBy, type Provider, parsePolicy, route } from "./provider.js";

const spec = Object.values(
  import.meta.glob("../../../examples/crm/smithable.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
)[0] as string;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const index = buildIndex({ ir, generated: {}, custom: [] });

/** A stand-in model that gives these answers in turn, and records what it was asked. */
function scripted(
  answers: unknown[],
  over: Partial<Provider> = {},
): Provider & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    name: "scripted",
    tier: "local",
    location: "local",
    price: { input: 0, output: 0 },
    prompts,
    async complete({ user }) {
      prompts.push(user);
      const answer = answers.shift();
      if (answer === undefined) throw new Error("no more answers");
      return {
        text: typeof answer === "string" ? answer : JSON.stringify(answer),
        model: "stand-in",
        inputTokens: 1000,
        outputTokens: 50,
      };
    },
    ...over,
  };
}

const propose = (request: string, providers: Provider[]) =>
  proposeChange({ request, files: { spec }, context: buildContext(index, request), providers });

const addPhone = {
  kind: "operations",
  operations: [{ op: "addField", args: { model: "Customer", field: "mobile", type: "phone" } }],
};

describe("proposeChange", () => {
  test("a clear request becomes operations, described and dry-run, with what the model used", async () => {
    const model = scripted([addPhone]);
    const proposal = await propose("Customers should have a mobile number", [model]);
    expect(proposal).toMatchObject({
      kind: "change",
      operations: [
        { op: "addField", description: "Add field mobile (phone) to Customer", destructive: false },
      ],
      usage: [
        { provider: "scripted", model: "stand-in", tier: "local", inputTokens: 1000, cost: 0 },
      ],
    });
    expect(proposal.kind === "change" && proposal.files.spec).toContain("mobile: phone");
    // The model got the relevant part of the app and the operations' arguments.
    expect(model.prompts[0]).toContain("model:Customer");
    expect(model.prompts[0]).toContain("- addField { model: string, field: string (camelCase name");
  });

  test("an answer that does not apply gets one repair, with the reason", async () => {
    const wrong = {
      kind: "operations",
      operations: [{ op: "addField", args: { model: "Client", field: "mobile", type: "phone" } }],
    };
    const model = scripted([wrong, addPhone]);
    const proposal = await propose("Customers should have a mobile number", [model]);
    expect(proposal.kind).toBe("change");
    expect(model.prompts[1]).toContain("It cannot be applied: addField:");
    expect(proposal.usage).toHaveLength(2);
  });

  test("when a tier cannot do it, the next tier gets the same request; costs add up", async () => {
    const local = scripted(["not json"]);
    const hosted = scripted([addPhone], {
      name: "smithable",
      tier: "smithable",
      location: "eu",
      price: { input: 0.2, output: 0.6 },
    });
    const proposal = await propose("Customers should have a mobile number", [local, hosted]);
    expect(proposal.kind).toBe("change");
    expect(proposal.usage.map((u) => u.provider)).toEqual(["scripted", "smithable"]);
    expect(proposal.usage[1]?.cost).toBeCloseTo((1000 * 0.2 + 50 * 0.6) / 1e6);
    expect(hosted.prompts[0]).toBe(local.prompts[0]);
  });

  test("an ambiguous request becomes a question, not a guess", async () => {
    const proposal = await propose("Add a date", [
      scripted([
        { kind: "question", question: "A date on what?", options: ["Orders", "Customers"] },
      ]),
    ]);
    expect(proposal).toMatchObject({
      kind: "question",
      question: "A date on what?",
      options: ["Orders", "Customers"],
    });
  });

  test("what only the host knows (existing rows) sends a proposal back for repair", async () => {
    const required = {
      kind: "operations",
      operations: [
        { op: "addField", args: { model: "Customer", field: "mobile", type: "phone!" } },
      ],
    };
    const model = scripted([required, addPhone]);
    const proposal = await proposeChange({
      request: "Customers should have a mobile number",
      files: { spec },
      context: buildContext(index, "Customers should have a mobile number"),
      providers: [model],
      check: (_before, after) =>
        after.spec.includes("mobile: phone!") ? "There are already 8 customers." : undefined,
    });
    expect(proposal.kind).toBe("change");
    expect(model.prompts[1]).toContain("It cannot be applied: There are already 8 customers.");
  });

  test("custom code is not an operation: the model says so", async () => {
    const proposal = await propose("Email a customer when an order ships", [
      scripted([{ kind: "none", reason: "Sending email needs custom code." }]),
    ]);
    expect(proposal).toMatchObject({ kind: "none", reason: "Sending email needs custom code." });
  });

  test("with no model allowed, nothing is sent anywhere", async () => {
    expect(await propose("Customers should have a mobile number", [])).toMatchObject({
      kind: "failed",
    });
  });
});

describe("the AI policy", () => {
  const local = scripted([], { name: "ollama", tier: "local", location: "local" });
  const eu = scripted([], { name: "mistral", tier: "smithable", location: "eu" });
  const us = scripted([], { name: "claude", tier: "frontier", location: "elsewhere" });

  test("eu-only is the default and keeps projects in the EU or on the machine", () => {
    expect(parsePolicy(undefined)).toBe("eu-only");
    expect(route([us, eu, local], "eu-only").map((p) => p.name)).toEqual(["ollama", "mistral"]);
  });

  test("local-only, best-available and an allowlist", () => {
    expect(route([us, eu, local], "local-only").map((p) => p.name)).toEqual(["ollama"]);
    expect(route([us, eu, local], "best-available").map((p) => p.name)).toEqual([
      "ollama",
      "mistral",
      "claude",
    ]);
    const allow = parsePolicy("allow:claude");
    expect(allowedBy(allow, us)).toBe(true);
    expect(allowedBy(allow, local)).toBe(false);
    expect(() => parsePolicy("anything")).toThrow("Unknown AI policy");
  });
});
