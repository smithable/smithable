// A narrowed bound says how many records it leaves outside (T758), with the change, never refused.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { type SpecIR, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { databasePath } from "./database.js";
import { outsideBounds } from "./op.js";
import { tempDir } from "./test-dir.js";

const spec = (fields: string) =>
  validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Studio }
models:
  Session:
    fields:
${fields}
pages:
  sessions: { crud: Session }
`,
  }).ir as SpecIR;

test("a narrowed bound counts the records it leaves outside; a wider one says nothing", () => {
  const dir = tempDir("range-");
  mkdirSync(join(dir, "data", "db"), { recursive: true });
  const db = new DatabaseSync(databasePath(dir));
  db.exec(
    "create table sessions (id integer primary key, capacity integer, title text, fee integer)",
  );
  // Capacities 3, 8, 20; titles of 2 and 12 characters; fees 5.00 and 50.00 (stored in cents).
  db.exec(
    "insert into sessions (capacity, title, fee) values (3, 'Yo', 500), (8, 'Morning flow', 5000), (20, null, null)",
  );
  db.close();
  const before = spec("      capacity: int\n      title: string\n      fee: money");
  const narrowed = spec(
    "      capacity: { type: int, min: 5, max: 10 }\n      title: { type: string, min: 3 }\n      fee: { type: money, max: 10 }",
  );
  expect(outsideBounds(dir, before, narrowed)).toEqual([
    "2 sessions already have capacity below 5 or above 10; they keep it until edited, when the new bounds apply.",
    "1 session already has title shorter than 3 characters; it keeps it until edited, when the new bounds apply.",
    "1 session already has fee above 10; it keeps it until edited, when the new bounds apply.",
  ]);
  // Widening, or the same bounds: nothing to say.
  expect(outsideBounds(dir, narrowed, before)).toEqual([]);
  expect(outsideBounds(dir, narrowed, narrowed)).toEqual([]);
  // Only the bound that got narrower is counted: raising the min alone says nothing of the max.
  const minOnly = spec(
    "      capacity: { type: int, min: 9, max: 10 }\n      title: string\n      fee: money",
  );
  expect(outsideBounds(dir, narrowed, minOnly)).toEqual([
    "2 sessions already have capacity below 9; they keep it until edited, when the new bounds apply.",
  ]);
  // A bound exactly on a stored amount: 0.14 is 14 cents, not 14.000000000000002.
  const db2 = new DatabaseSync(databasePath(dir));
  db2.exec("insert into sessions (capacity, title, fee) values (null, null, 14)");
  db2.close();
  const cents = spec(
    "      capacity: int\n      title: string\n      fee: { type: money, min: 0.14 }",
  );
  expect(outsideBounds(dir, before, cents)).toEqual([]);
});
