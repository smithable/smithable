// The data-* hooks custom styles rely on (docs/design/look.md §2.2): a snapshot per kit
// component, so a change to one is a visible change in review.
import { expect, test } from "vitest";
import { TEMPLATES } from "./templates.gen.js";

const HOOK = /"?(data-(?:kit|part|field|section|tone|page))"?(?:=|: )(\{[^}]*\}|"[^"]*"|[^,\n}]+)/g;

test("every kit component's hooks, as they are", () => {
  const hooks: Record<string, string[]> = {};
  for (const [path, source] of Object.entries(TEMPLATES)) {
    if (!/^src\/(kit|components\/ui)\/.*\.tsx$/.test(path)) continue;
    const found = [...source.matchAll(HOOK)].map((m) => `${m[1]}=${m[2]}`);
    if (found.length) hooks[path] = [...new Set(found)];
  }
  expect(hooks).toMatchSnapshot();
  // The components the README's table names all have their root hook.
  for (const [file, kit] of [
    ["AppShell", "app-shell"],
    ["ModelTable", "model-table"],
    ["ModelForm", "model-form"],
    ["SearchBox", "search-box"],
    ["Calendar", "calendar"],
    ["Landing", "landing"],
    ["Users", "users"],
    ["SignIn", "sign-in"],
    ["Onboarding", "onboarding"],
  ])
    expect(hooks[`src/kit/${file}.tsx`]).toContain(`data-kit="${kit}"`);
});
