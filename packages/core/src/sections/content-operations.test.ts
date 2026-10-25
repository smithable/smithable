import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";

const files = {
  spec: "smithable: 0.1\napp:\n  name: Club\nmodels:\n  Court:\n    fields:\n      name: string!\npages:\n  courts:\n    crud: Court\n  home:\n    route: /\n    landing:\n      hero: {}\n      features:\n      faq:\n      footer: {}\n",
  content: "smithableContent: 0.1\n",
};

test("setItems gives a section its items, in place of its others", () => {
  const set = applyOperation(files, "setItems", {
    page: "home",
    section: "faq",
    items: [
      { question: "Can children play?", answer: "Yes, from six years old." },
      { question: "Do you rent rackets?", answer: "At the desk, for a few euros." },
    ],
  });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.content).toContain("question: Can children play?");
  const again = applyOperation(set.files, "setItems", {
    page: "home",
    section: "faq",
    items: [{ question: "Open on Sundays?", answer: "Every day from eight." }],
  });
  if (!again.ok) throw new Error(again.message);
  expect(again.files.content).not.toContain("Can children play?");
  expect(again.files.content).toContain("Open on Sundays?");
  const none = applyOperation(again.files, "setItems", { page: "home", section: "faq", items: [] });
  if (!none.ok) throw new Error(none.message);
  expect(none.files.content).not.toContain("items");
});

test("setItems refuses a key the section's items do not have, and a section without items", () => {
  expect(
    applyOperation(files, "setItems", {
      page: "home",
      section: "features",
      items: [{ question: "?" }],
    }),
  ).toMatchObject({ ok: false, message: expect.stringContaining("title, text") });
  expect(
    applyOperation(files, "setItems", { page: "home", section: "hero", items: [{ title: "x" }] }),
  ).toMatchObject({ ok: false });
});
