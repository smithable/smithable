import { type SpecIR, validateSpec } from "@smithable/core";
import { buildContext, buildIndex } from "@smithable/index";
import { describe, expect, test } from "vitest";
import {
  answerSchema,
  plainSchema,
  promptFor,
  proposeChange,
  relevantOperations,
} from "./propose.js";
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
): Provider & { prompts: string[]; systems: string[] } {
  const prompts: string[] = [];
  const systems: string[] = [];
  return {
    name: "scripted",
    tier: "local",
    location: "local",
    price: { input: 0, output: 0 },
    prompts,
    systems,
    async complete({ system, user }) {
      prompts.push(user);
      systems.push(system);
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
  test("a question the spec answers needs no model; one it cannot goes to the model as an answer", async () => {
    const model = scripted([
      { kind: "answer", text: "An order is shipped when its status says so." },
    ]);
    const auth =
      "smithableAuth: 0.1\nsignIn: { providers: [google], allowedDomains: [acme.com] }\ndefaultAccess: shared\nroles: { admin: {}, sales: {} }\ndefaultRole: sales\n";
    const answered = await proposeChange({
      request: "Who can delete customers?",
      files: { spec, auth },
      context: buildContext(index, "Who can delete customers?"),
      providers: [model],
    });
    expect(answered).toMatchObject({ kind: "answer", generator: "who-can", usage: [] });
    expect(answered.kind === "answer" && answered.text).toMatch(/can delete customers\.$/);
    expect(model.prompts).toHaveLength(0);
    const asked = await propose("When does an order count as shipped?", [model]);
    expect(asked).toMatchObject({
      kind: "answer",
      text: "An order is shipped when its status says so.",
    });
    expect(model.systems[0]).toContain('{"kind":"answer","text":"…"}');
  });

  test("a request the rules read and cannot make is answered with the reason, and no model is asked", async () => {
    const model = scripted([addPhone]);
    const proposal = await propose("Add a notes field to customers", [model]);
    expect(proposal).toMatchObject({
      kind: "none",
      reason: 'Customers already have a field called "notes".',
    });
    expect(model.prompts).toEqual([]);
  });

  test("a clear request becomes operations, described and dry-run, with what the model used", async () => {
    const model = scripted([addPhone]);
    const proposal = await propose("Sales people keep asking where to put a customer's mobile", [
      model,
    ]);
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
    // The model got the relevant part of the app; a local model has every operation's arguments
    // in its stable system prefix, and the ones that fit named after the context.
    expect(model.prompts[0]).toContain("model:Customer");
    expect(model.systems[0]).toContain("- addField { model: string, field: string (camelCase name");
    expect(model.prompts[0]).toMatch(/Operations that fit this request: .*addField/);
  });

  test("an answer that does not apply gets one repair, with the reason", async () => {
    const wrong = {
      kind: "operations",
      operations: [{ op: "addField", args: { model: "Client", field: "mobile", type: "phone" } }],
    };
    const model = scripted([wrong, addPhone]);
    const proposal = await propose("Sales people keep asking where to put a customer's mobile", [
      model,
    ]);
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
    const proposal = await propose("Sales people keep asking where to put a customer's mobile", [
      local,
      hosted,
    ]);
    expect(proposal.kind).toBe("change");
    expect(proposal.usage.map((u) => u.provider)).toEqual(["scripted", "smithable"]);
    expect(proposal.usage[1]?.cost).toBeCloseTo((1000 * 0.2 + 50 * 0.6) / 1e6);
    // The same context for both; the hosted model gets only the operations that fit, after it.
    const context = (p: string) => p.slice(0, p.indexOf("\n\nOperation"));
    expect(context(hosted.prompts[0] ?? "")).toBe(context(local.prompts[0] ?? ""));
    expect(hosted.prompts[0]).toContain("- addField {");
  });

  test("a cheaper tier's \"none\" goes to the next tier; the last tier's stands", async () => {
    const local = scripted([{ kind: "none", reason: "Cannot." }]);
    const hosted = scripted([addPhone], { name: "smithable", tier: "smithable", location: "eu" });
    expect(
      (await propose("Sales people keep asking where to put a customer's mobile", [local, hosted]))
        .kind,
    ).toBe("change");
    const alone = scripted([{ kind: "none", reason: "Cannot." }]);
    expect(
      await propose("Sales people keep asking where to put a customer's mobile", [alone]),
    ).toMatchObject({
      kind: "none",
      reason: "Cannot.",
    });
    const both = [
      scripted([{ kind: "none", reason: "A" }]),
      scripted([{ kind: "none", reason: "B" }], { name: "b", tier: "smithable", location: "eu" }),
    ];
    expect(
      await propose("Sales people keep asking where to put a customer's mobile", both),
    ).toMatchObject({
      kind: "none",
      reason: "B",
    });
  });

  test("operations that change no file are no change: refused, so nothing is applied or traced", async () => {
    // A setting put back to what it already is (Johan's rewritten "Your app" sentence).
    const same = { kind: "operations", operations: [{ op: "setApp", args: { name: "Acme CRM" } }] };
    const model = scripted([same]);
    const proposal = await propose("The app is called Acme CRM", [model]);
    expect(proposal).toMatchObject({ kind: "none", reason: "This changes nothing." });
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
      request: "Sales people keep asking where to put a customer's mobile",
      files: { spec },
      context: buildContext(index, "Sales people keep asking where to put a customer's mobile"),
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
    expect(
      await propose("Sales people keep asking where to put a customer's mobile", []),
    ).toMatchObject({
      kind: "failed",
    });
  });
});

describe("what a model is offered", () => {
  test("operations narrow to the request's concepts; creating ones and app-wide ones stay", () => {
    const names = (concepts: string[]) => relevantOperations(concepts).map((o) => o.name);
    expect(names(["page:orders"])).not.toContain("addField");
    expect(names(["page:orders"])).toEqual(
      expect.arrayContaining(["setNavigation", "setSearch", "addPage", "addModel", "setTheme"]),
    );
    expect(names(["model:Customer", "field:Customer.email"])).toEqual(
      expect.arrayContaining(["addField", "changeField", "grant"]),
    );
    expect(names(["model:Customer"])).not.toContain("setNavigation");
    expect(names([])).not.toContain("removeField");
    expect(names([])).toContain("addModel");
  });

  test("the schemas sent to a model carry none of Smithable's own annotations", () => {
    expect(JSON.stringify(answerSchema(relevantOperations(["model:Customer"])))).not.toContain(
      "x-smithable",
    );
    expect(
      plainSchema({
        type: "object",
        "x-smithable": { ref: "model" },
        properties: { a: { "x-y": 1, type: "string" } },
      }),
    ).toEqual({ type: "object", properties: { a: { type: "string" } } });
  });

  test("the strict schema holds each operation's own arguments; the loose one only the names", () => {
    const ops = relevantOperations(["model:Customer"]);
    const strict = answerSchema(ops) as {
      properties: {
        operations: {
          items: {
            anyOf: { properties: { op: { const: string }; args: { required?: string[] } } }[];
          };
        };
      };
    };
    const addField = strict.properties.operations.items.anyOf.find(
      (a) => a.properties.op.const === "addField",
    );
    expect(addField?.properties.args.required).toEqual(["model", "field", "type"]);
    const loose = answerSchema(ops, false) as {
      properties: { operations: { items: { properties: { op: { enum: string[] } } } } };
    };
    expect(loose.properties.operations.items.properties.op.enum).toContain("addField");
  });

  test("a hosted model's prompt is the shortest; a local model's has a stable prefix", () => {
    const slice = (concepts: string[], request: string) => ({
      request,
      concepts,
      text: `Request: ${request}`,
      tokens: { semantic: 5, implementation: 0, total: 5 },
    });
    const hosted = promptFor({ location: "eu" }, slice(["page:orders"], "Show orders first"));
    const local = promptFor({ location: "local" }, slice(["page:orders"], "Show orders first"));
    expect(hosted.user).toContain("- setNavigation {");
    expect(hosted.user).not.toContain("- addField {");
    expect(local.system).toContain("- addField {");
    expect(local.user).not.toContain("- addField {");
    expect(local.system).toBe(
      promptFor({ location: "local" }, slice(["model:Customer"], "Customers need a fax")).system,
    );
    // The kit's own words go in the stable prefix, for every provider (A 163).
    const kit = ["AppShell: the menu stays in view while the page scrolls."];
    for (const location of ["eu", "local"] as const)
      expect(
        promptFor({ location }, slice(["page:orders"], "Sticky menu"), undefined, kit).system,
      ).toContain("- AppShell: the menu stays in view");
  });
});

describe("the AI policy", () => {
  const local = scripted([], { name: "ollama", tier: "local", location: "local" });
  const eu = scripted([], { name: "mistral", tier: "smithable", location: "eu" });
  const us = scripted([], { name: "claude", tier: "frontier", location: "elsewhere" });

  test("nothing said uses what is configured; eu-only keeps projects in the EU or on the machine", () => {
    expect(parsePolicy(undefined)).toBe("best-available");
    expect(parsePolicy("eu-only")).toBe("eu-only");
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

describe("small talk (A 151)", () => {
  test("a greeting or thanks is answered like a chat, by rule, with no model and never a refusal", async () => {
    for (const hello of ["Hi", "hello smith!", "Good morning", "hey there"]) {
      const answer = await propose(hello, []);
      expect(answer.kind).toBe("answer");
      if (answer.kind !== "answer") continue;
      expect(answer.generator).toBe("small talk");
      // It leads back to the app, with something to try from its own names.
      expect(answer.text).toMatch(/^Hello! I'm Smith\. Tell me what to change in /);
      // A field the first kind of record does not have yet, so the try is a real change.
      expect(answer.text).toMatch(/For example “Add a (notes|comments|website) field to /);
      expect(answer.usage).toEqual([]);
    }
    const thanks = await propose("Thanks a lot", []);
    expect(thanks.kind === "answer" && thanks.text).toMatch(
      /^You're welcome! Anything else to change in /,
    );
  });

  test("a change is not small talk: it goes on to the change tiers as before", async () => {
    const asked = await propose("hello, add a phone number to customers", [scripted([addPhone])]);
    expect(asked.kind).toBe("change");
  });

  test("the models are told to answer small talk, never to refuse it", () => {
    const { system } = promptFor({ location: "local" }, buildContext(index, "hi"));
    expect(system).toContain("also for a greeting, thanks or other small talk");
    expect(system).toContain('Never answer "none" to small talk.');
  });
});
