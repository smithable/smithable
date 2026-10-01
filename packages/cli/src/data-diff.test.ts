import { DatabaseSync } from "node:sqlite";
import { dataDiffSql } from "@smithable/core";
import { expect, test } from "vitest";

test("three queries per table give what is new, changed and removed since then", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("ATTACH DATABASE ':memory:' AS past");
  for (const schema of ["main", "past"])
    db.exec(
      `CREATE TABLE ${schema}.customers (id INTEGER PRIMARY KEY, name TEXT, updated_at INTEGER)`,
    );
  db.exec("INSERT INTO past.customers VALUES (1, 'Anna', 1), (2, 'Bo', 1), (3, 'Cai', 1)");
  db.exec("INSERT INTO main.customers VALUES (2, 'Bo', 1), (3, 'Cai AB', 2), (4, 'Dan', 3)");
  const sql = dataDiffSql({ table: "customers", title: "name" });
  const n = (s: string) => (db.prepare(s).get() as { n: number }).n;
  expect([n(sql.added), n(sql.changed), n(sql.removed)]).toEqual([1, 1, 1]);
  expect(
    db
      .prepare(sql.removedNames())
      .all()
      .map((r) => (r as { name: string }).name),
  ).toEqual(["Anna"]);
  expect(
    db
      .prepare(sql.changedIds)
      .all()
      .map((r) => (r as { id: number }).id),
  ).toEqual([3]);
});
