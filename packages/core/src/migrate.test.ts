import { expect, test } from "vitest";
import { migrateSpec, type SpecMigration } from "./migrate.js";

/** A pretend earlier format where the app name was called "title". */
const renameTitle: SpecMigration = {
  from: "0.0",
  to: "0.1",
  description: "app.title is renamed to app.name",
  migrate(doc) {
    const title = doc.getIn(["app", "title"], true);
    doc.deleteIn(["app", "title"]);
    doc.setIn(["app", "name"], title);
  },
};

const old = `# The CRM spec
smithable: 0.0
app:
  title: Acme CRM # our app
`;

test("applies migrations step by step and keeps comments", () => {
  const result = migrateSpec(old, [renameTitle]);
  expect(result).toEqual({
    text: "# The CRM spec\nsmithable: 0.1\napp:\n  name: Acme CRM # our app\n",
    from: "0.0",
    to: "0.1",
    applied: ["0.0 → 0.1: app.title is renamed to app.name"],
  });
});

test("returns the text unchanged when it is already current", () => {
  const current = "smithable: 0.1 # current\napp:\n  name: X\n";
  expect(migrateSpec(current, [renameTitle])).toEqual({
    text: current,
    from: "0.1",
    to: "0.1",
    applied: [],
  });
});

test("fails clearly when no migration path exists", () => {
  expect(() => migrateSpec("smithable: 0.0\n", [])).toThrow(
    "No migration from spec version 0.0 towards 0.1.",
  );
});
