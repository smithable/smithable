import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
  validateUx,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: "smithable: 0.1\napp: { name: Desk }\nmodels:\n  Note: { fields: { title: string! } }\npages:\n  notes: { crud: Note }\n",
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\n",
  },
  ir,
).auth as AuthIR;

test("the ux file's navigation puts the menu in a bar across the top, and chrome sets its surface (look-gap §4)", () => {
  const files = (ux: string) => {
    const read = validateUx({ path: "smithable.ux.yml", text: `smithableUx: 0.1\n${ux}` }, ir);
    expect(read.diagnostics).toEqual([]);
    const out = generateApp(ir, {
      smithableVersion: "0.0.0",
      auth,
      content: emptyContent(),
      ux: read.ux,
    });
    const at = (path: string) => out.find((f) => f.path === path)?.content ?? "";
    return { root: at("src/routes/__root.tsx"), theme: at("src/theme.css") };
  };
  const top = files("navigation: topbar-centered\nchrome: dark\n");
  expect(top.root).toContain(' navigation="topbar-centered" menus={menus}');
  expect(top.theme).toContain(
    "/* The menu's surface: dark (chrome in the ux file). */\n:root {\n  --sidebar: var(--foreground);",
  );
  // Unsaid: the sidebar, and the theme's own menu colours.
  const plain = files("");
  expect(plain.root).not.toContain("navigation=");
  expect(plain.theme).not.toContain("The menu's surface");
  // The sidebar said in so many words is the default too.
  expect(files("navigation: sidebar\n").root).not.toContain("navigation=");
});
