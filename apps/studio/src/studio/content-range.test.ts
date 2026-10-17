import { expect, test } from "vitest";
import { contentRange } from "./Code";

const text = `pages:
  customers: { subtitle: Keep every relationship in view. }
  home:
    hero:
      title: Welcome
`;
const at = (path: string) => {
  const range = contentRange(text, path);
  return range && text.slice(range[0], range[1]);
};

test("a text's place in the content file: its value, in a block or a flow map", () => {
  expect(at("pages.home.hero.title")).toBe("Welcome");
  expect(at("pages.customers.subtitle")).toBe("Keep every relationship in view.");
});

test("a text not written there shows the nearest key on its way", () => {
  expect(at("pages.home.hero.text")).toBe("hero");
  expect(at("pages.orders.title")).toBe("pages");
  expect(at("models.Customer.label")).toBeUndefined();
});
