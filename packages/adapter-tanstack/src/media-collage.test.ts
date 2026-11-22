import {
  applyOperation,
  type ProjectFiles,
  validateAuth,
  validateContent,
  validateSpec,
  validateUx,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const spec = `smithable: 0.1
app: { name: Workshop }
pages:
  home:
    route: /
    landing:
      hero: {}
      story: { mediaText: true }
`;

const content = `smithableContent: 0.1
pages:
  home:
    story:
      title: A tour
      image: { src: images/main.webp, alt: The workshop }
`;

const operation = (files: ProjectFiles, name: string, args: Record<string, unknown>) => {
  const result = applyOperation(files, name, { page: "home", section: "story", ...args });
  if (!result.ok) throw new Error(result.message);
  return result.files;
};

function generate(files: ProjectFiles) {
  const { ir } = validateSpec({ path: "smithable.yml", text: files.spec });
  if (!ir) throw new Error("Invalid specification fixture");
  const { auth } = validateAuth(
    { path: "smithable.auth.yml", text: "smithableAuth: 0.1\nsignIn: none\n" },
    ir,
  );
  const visible = validateContent(
    { path: "smithable.content.yml", text: files.content ?? content },
    ir,
  ).content;
  const ux = validateUx(
    { path: "smithable.ux.yml", text: files.ux ?? "smithableUx: 0.1\n" },
    ir,
  ).ux;
  if (!auth || !visible || !ux) throw new Error("Invalid generated fixture");
  return generateApp(ir, { smithableVersion: "0.0.0", auth, content: visible, ux });
}

test("three extra media pictures appear only in the collage layout", () => {
  const baseline = { spec, content };
  let files: ProjectFiles = baseline;
  for (const [item, subject] of ["Tools", "Workbench", "Door"].entries())
    files = operation(files, "setSectionPicture", {
      item,
      src: `images/${subject.toLowerCase()}.webp`,
      alt: subject,
    });
  expect(generate(files)).toEqual(generate(baseline));
  expect(
    applyOperation(files, "setSectionPicture", {
      page: "home",
      section: "story",
      item: 3,
      src: "images/overflow.webp",
      alt: "Extra",
    }).ok,
  ).toBe(false);
  files = operation(files, "setSectionLook", { key: "layout", value: "collage" });
  const generated = generate(files);
  const route = generated.find(({ path }) => path === "src/routes/index.tsx")?.content;
  expect(route).toContain('layout="collage"');
  for (const alt of ["The workshop", "Tools", "Workbench", "Door"])
    expect(route).toContain(`alt: "${alt}"`);
  const kit = generated.find(({ path }) => path === "src/kit/Landing.tsx")?.content;
  expect(kit).toContain('const collage = layout === "collage"');
  expect(kit).toContain("alt={photo.alt}");

  files = operation(files, "setSectionPicture", { item: 1 });
  expect(files.content).toContain("Door");
  expect(files.content).not.toContain("Workbench");
  expect(generate(operation(files, "setSectionLook", { key: "layout", value: "default" }))).toEqual(
    generate(baseline),
  );
});
