import { validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import type { CompletionRequest, Provider } from "./provider.js";
import { draftSamples, sampledModels } from "./samples.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Le Petit Zinc, description: A bistro in Bayonne. }
models:
  Dish:
    fields: { name: string!, price: money, photo: picture, course: starter | main | dessert, chef: Chef }
  Chef:
    fields: { name: string!, since: date }
  Review:
    fields: { text: text!, author: User! }
pages:
  dishes: { crud: Dish }
  chefs: { crud: Chef }
  reviews: { crud: Review }
`,
}).ir;
if (!ir) throw new Error("invalid");

const fake = (answer: unknown, asked: CompletionRequest[] = []): Provider => ({
  name: "fake",
  tier: "frontier",
  location: "eu",
  price: { input: 1, output: 3 },
  async complete(request) {
    asked.push(request);
    return { text: JSON.stringify(answer), model: "fake", inputTokens: 1, outputTokens: 1 };
  },
});

test("a model's records are drafted by its fields; one that needs a user is left to the app", async () => {
  expect(sampledModels(ir).map((m) => m.name)).toEqual(["Dish", "Chef"]);
  const asked: CompletionRequest[] = [];
  const drafted = await draftSamples({
    description: "A bistro with dishes of the day",
    ir,
    providers: [
      fake(
        {
          Dish: [
            { name: "Fish soup", price: 14.5, course: "main", chef: "Amaia", photo: "x.webp" },
            "not a record",
          ],
          Chef: [{ name: "Amaia", since: "2019-04-01" }],
        },
        asked,
      ),
    ],
  });
  expect(drafted.samples).toEqual({
    Dish: [{ name: "Fish soup", price: 14.5, course: "main", chef: "Amaia" }],
    Chef: [{ name: "Amaia", since: "2019-04-01" }],
  });
  expect(drafted.usage).toHaveLength(1);
  const schema = asked[0]?.schema as {
    properties: Record<string, { items: { properties: object; required: string[] } }>;
  };
  // Pictures are the app's to give, choices are their values, a reference names a record.
  expect(Object.keys(schema.properties)).toEqual(["Dish", "Chef"]);
  expect(schema.properties.Dish?.items.properties).not.toHaveProperty("photo");
  expect(schema.properties.Dish?.items.properties).toMatchObject({
    course: { enum: ["starter", "main", "dessert"] },
    chef: { type: "string", description: "The name of a Chef record you wrote." },
  });
  expect(schema.properties.Dish?.items.required).toEqual(["name", "course"]);
  expect(asked[0]?.user).toContain("A bistro with dishes of the day");
});

test("no model, or a failing one: no records, the generated rows stay", async () => {
  expect((await draftSamples({ description: "x", ir, providers: [] })).samples).toEqual({});
  const failing: Provider = {
    ...fake({}),
    async complete() {
      throw new Error("down");
    },
  };
  expect((await draftSamples({ description: "x", ir, providers: [failing] })).samples).toEqual({});
});
