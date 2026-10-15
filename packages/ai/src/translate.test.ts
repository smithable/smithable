import { expect, test } from "vitest";
import type { Provider } from "./provider.js";
import { draftTranslation } from "./translate.js";

function scripted(answer: unknown): Provider & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    name: "smithable",
    tier: "smithable",
    location: "eu",
    price: { input: 1, output: 3 },
    prompts,
    async complete({ user }) {
      prompts.push(user);
      if (answer instanceof Error) throw answer;
      return {
        text: JSON.stringify(answer),
        model: "smithable",
        inputTokens: 400,
        outputTokens: 80,
      };
    },
  };
}

test("a language's first draft: only the paths asked for, each a text, in one request", async () => {
  const model = scripted({
    texts: [
      { path: "models.Customer.label", text: "Kund" },
      { path: "pages.customers.title", text: " Kunder " },
      { path: "pages.made.up", text: "Påhittad" },
      { path: "models.Customer.pluralLabel", text: "" },
    ],
  });
  const draft = await draftTranslation({
    texts: {
      "models.Customer.label": "Customer",
      "models.Customer.pluralLabel": "Customers",
      "pages.customers.title": "Customers",
    },
    from: "en",
    to: "sv",
    providers: [model],
  });
  expect(draft.texts).toEqual({
    "models.Customer.label": "Kund",
    "pages.customers.title": "Kunder",
  });
  expect(model.prompts).toHaveLength(1);
  expect(model.prompts[0]).toContain("From English into Swedish.");
  expect(model.prompts[0]).toContain("pages.customers.title: Customers");
  expect(draft.usage).toHaveLength(1);
});

test("without a model, or when it fails, nothing is drafted", async () => {
  const texts = { "pages.home.title": "Home" };
  expect((await draftTranslation({ texts, from: "en", to: "sv", providers: [] })).texts).toEqual(
    {},
  );
  const failing = scripted(new Error("down"));
  expect(
    (await draftTranslation({ texts, from: "en", to: "sv", providers: [failing] })).texts,
  ).toEqual({});
});
