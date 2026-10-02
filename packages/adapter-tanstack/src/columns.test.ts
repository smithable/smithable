import { type AuthIR, type SpecIR, validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// Johan's listing from the marketplace test: the url and the price were listed, not the text.
const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Market }
models:
  Listing:
    fields:
      title: string!
      image: url
      condition: new | used
      description: text!
      price: money!
      photo: picture
pages:
  listings: { crud: Listing }
`,
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\n",
  },
  ir,
).auth as AuthIR;
const listing = generateApp(ir, { smithableVersion: "0.0.0", auth }).find(
  (f) => f.path === "src/generated/listing.ts",
)?.content;

test("default columns: the title, then pictures, then required fields, then the rest", () => {
  expect(listing).toContain('columns: ["title", "photo", "condition", "price", "image"]');
});

test("a card shows the description, a long text never being a column", () => {
  expect(listing).toContain('descriptionField: "description"');
});
