import { expect, test } from "vitest";
import { editorLink } from "./EntryTools";

test("a custom file opens in the person's editor by its full path on their machine", () => {
  expect(editorLink("/home/ana/apps/crm", "src/custom/actions/merge-customers.ts")).toBe(
    "vscode://file/home/ana/apps/crm/src/custom/actions/merge-customers.ts",
  );
  expect(editorLink("/home/ana/my apps/crm/", "src/custom/pages/Planner.tsx")).toBe(
    "vscode://file/home/ana/my%20apps/crm/src/custom/pages/Planner.tsx",
  );
  expect(editorLink("C:/Users/ana/crm", "src/custom/pages/Planner.tsx")).toBe(
    "vscode://file/C:/Users/ana/crm/src/custom/pages/Planner.tsx",
  );
});
