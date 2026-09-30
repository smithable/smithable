import {
  type AuthIR,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
  validateUx,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

test("a landing section's look from smithable.ux.yml is its component's props", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Site }\npages:\n  home:\n    route: /\n    landing:\n      hero:\n      features:\n      testimonials:\n      footer:\n",
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [home] }\n",
    },
    ir,
  ).auth as AuthIR;
  const ux = validateUx(
    {
      path: "smithable.ux.yml",
      text: "smithableUx: 0.1\npages:\n  home:\n    sections:\n      hero: { layout: split, image: left }\n      features: { columns: 4 }\n      testimonials: { layout: carousel }\n",
    },
    ir,
  ).ux;
  // Sections of items show only with items.
  const content = validateContent(
    {
      path: "smithable.content.yml",
      text: "smithableContent: 0.1\npages:\n  home:\n    features: { items: [{ title: Fast }] }\n    testimonials: { items: [{ quote: Great, name: Ann }] }\n",
    },
    ir,
  ).content;
  if (!content || !ux) throw new Error("the files do not validate");
  const route =
    generateApp(ir, { smithableVersion: "0.0.0", auth, content, ux }).find(
      (f) => f.path === "src/routes/index.tsx",
    )?.content ?? "";
  // The hero's side is imageSide: its image is the picture.
  expect(route).toContain('layout="split"\n          imageSide="left"');
  expect(route).toContain("columns={4}");
  expect(route).toContain('layout="carousel"');
});
