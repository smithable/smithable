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
      contact: {}
      footer: {}
`;

const content = `smithableContent: 0.1
pages:
  home:
    contact:
      phone: "+358 123"
      hours: |
        Monday 09–16
        Tuesday 10–17
    footer:
      items:
        - { label: Home, link: / }
`;

test("the contact band takes its details from the existing site footer data", () => {
  const { ir } = validateSpec({ path: "smithable.yml", text: spec });
  if (!ir) throw new Error("Invalid spec fixture");
  const { auth } = validateAuth(
    { path: "smithable.auth.yml", text: "smithableAuth: 0.1\nsignIn: none\n" },
    ir,
  );
  const words = validateContent({ path: "smithable.content.yml", text: content }, ir).content;
  if (!auth || !words) throw new Error("Invalid auth or content fixture");
  const optIn = applyOperation({ spec, content }, "setSectionLook", {
    page: "home",
    section: "footer",
    key: "layout",
    value: "contactBand",
  });
  if (!optIn.ok || !optIn.files.ux) throw new Error("Cannot opt into footer layout");
  const desired = validateUx({ path: "smithable.ux.yml", text: optIn.files.ux }, ir).ux;
  if (!desired) throw new Error("Invalid look fixture");

  const options = { smithableVersion: "0.0.0", auth, content: words };
  const baseline = generateApp(ir, options);
  const adapted = generateApp(ir, { ...options, ux: desired });
  const changes = adapted.filter((file, index) => file.content !== baseline[index]?.content);
  expect(changes.map(({ path }) => path)).toEqual(["src/routes/index.tsx"]);
  const kit = baseline.find(({ path }) => path === "src/kit/Landing.tsx")?.content;
  expect(kit).toContain("{w.openingHours}");
  expect(kit).toContain("whitespace-pre-line");
  expect(changes[0]?.content).toContain("contactBand: true");
  expect(changes[0]?.content).toContain('label: "Home", link: "/"');
  const withoutContact = { ...options, content: undefined };
  expect(generateApp(ir, { ...withoutContact, ux: desired })).toEqual(
    generateApp(ir, withoutContact),
  );
  expect(adapted.find(({ path }) => path === "src/generated/site.ts")?.content).toContain(
    "Monday 09–16",
  );
});
