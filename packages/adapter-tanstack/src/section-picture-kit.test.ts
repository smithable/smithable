import {
  applyOperation,
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
      about: { text: }
      callToAction: {}
      features: {}
`;

const content = `smithableContent: 0.1
logo: { src: images/logo.svg, alt: Workshop }
pages:
  home:
    hero: { title: The workshop }
    about: { title: About }
    callToAction: { title: Visit us }
    features:
      items:
        - { title: Repairs, text: Small repairs }
        - { title: Classes, text: Evening classes }
`;

const operation = (
  files: { spec: string; content?: string; ux?: string },
  name: string,
  args: Record<string, unknown>,
) => {
  const result = applyOperation(files, name, { page: "home", ...args });
  if (!result.ok) throw new Error(result.message);
  return result.files;
};

function generate(files: { spec: string; content?: string; ux?: string }) {
  const { ir } = validateSpec({ path: "smithable.yml", text: files.spec });
  if (!ir) throw new Error("Invalid fixture spec");
  const { auth } = validateAuth(
    { path: "smithable.auth.yml", text: "smithableAuth: 0.1\nsignIn: none\n" },
    ir,
  );
  const data = validateContent(
    { path: "smithable.content.yml", text: files.content ?? content },
    ir,
  );
  const looks = validateUx(
    { path: "smithable.ux.yml", text: files.ux ?? "smithableUx: 0.1\n" },
    ir,
  );
  if (!auth || !data.content || !looks.ux) throw new Error("Invalid fixture content or look");
  return generateApp(ir, { smithableVersion: "0.0.0", auth, content: data.content, ux: looks.ux });
}

test("section backgrounds and feature card pictures are opt-in and use the same content operation", () => {
  const baseline = { spec, content };
  let files: ReturnType<typeof operation> | typeof baseline = baseline;
  for (const section of ["about", "callToAction", "features"])
    files = operation(files, "setSectionPicture", {
      section,
      src: "images/work.webp",
      alt: "Work table",
    });
  files = operation(files, "setSectionPicture", {
    section: "features",
    item: 1,
    src: "images/card.webp",
    alt: "Tools",
  });
  files = operation(files, "setSectionLook", { section: "hero", key: "mark", value: "logo" });
  const generated = generate(files);
  const kit = generated.find(({ path }) => path === "src/kit/Landing.tsx")?.content ?? "";
  const route =
    generated.find(({ content }) => content.includes('texts="pages.home.features"'))?.content ?? "";
  expect(route.match(/background=\{/g)).toHaveLength(3);
  expect(route).toContain('logoMark="/images/logo.svg"');
  expect(route).toContain('title="The workshop"');
  expect(route).toContain('src: "/images/card.webp"');
  expect(kit).toContain('<span className="sr-only">{title}</span>');
  expect(kit).toContain("from-black/90 via-black/75 to-black/70");
  expect(kit).toContain("<AiMarked generated={item.image.generated}");

  files = operation(files, "setSectionPicture", { section: "features", item: 1 });
  expect(files.content).toContain("Evening classes");
  expect(files.content).not.toContain("images/card.webp");
  expect(files.content).toContain("images/work.webp");

  const unchanged = generate(baseline);
  expect(unchanged.find(({ path }) => path === "src/kit/Landing.tsx")?.content).not.toContain(
    "function SectionBackdrop",
  );
  const plainMark = operation(baseline, "setSectionLook", {
    section: "hero",
    key: "mark",
    value: "title",
  });
  expect(generate(plainMark)).toEqual(unchanged);
});
