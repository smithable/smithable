import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { restoreAt } from "./pitr.js";
import { tempDir } from "./test-dir.js";

test("restore --at shows what was removed, refuses a record whose reference stays gone, and brings back both", () => {
  const dir = tempDir("restore-at-");
  mkdirSync(join(dir, "data/db"), { recursive: true });
  mkdirSync(join(dir, "bin"));
  writeFileSync(
    join(dir, "smithable.yml"),
    "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Customer:\n    fields: { name: string! }\n  Order:\n    fields: { number: string!, customer: Customer! }\npages:\n  orders: { crud: Order }\n",
  );
  writeFileSync(join(dir, "smithable.auth.yml"), "smithableAuth: 0.1\nsignIn: none\n");
  const schema =
    "CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, created_at INTEGER, updated_at INTEGER);" +
    "CREATE TABLE orders (id INTEGER PRIMARY KEY, number TEXT, customer_id INTEGER REFERENCES customers(id), created_at INTEGER, updated_at INTEGER);";
  const make = (file: string, rows: string) => {
    const db = new DatabaseSync(file);
    db.exec(schema + rows);
    db.close();
  };
  make(
    join(dir, "then.db"),
    "INSERT INTO customers VALUES (1, 'Anna Berg', 0, 1); INSERT INTO orders VALUES (10, 'A-10', 1, 0, 1);",
  );
  make(join(dir, "data/db/app.db"), "");
  // A stand-in for Litestream: "restore -o <file> …" copies the database of then.
  writeFileSync(
    join(dir, "bin/litestream"),
    `#!/bin/sh\n[ "$1" = restore ] && cp "${join(dir, "then.db")}" "$3"\n`,
  );
  chmodSync(join(dir, "bin/litestream"), 0o755);
  const path = process.env.PATH;
  process.env.PATH = `${join(dir, "bin")}:${path}`;
  try {
    const out: string[] = [];
    const io = { out: (s: string) => out.push(s), err: (s: string) => out.push(s) };
    const options = { at: "2026-10-01T09:00:00Z", from: join(dir, "stream") };
    expect(restoreAt(dir, io, options)).toBe(0);
    expect(out.join("")).toContain("Customer: 0 new, 0 changed, 1 removed (Anna Berg)");
    expect(restoreAt(dir, io, { ...options, bringBack: ["Order"], yes: true })).toBe(1);
    expect(out.join("")).toContain(
      "Order “A-10” needs a Customer that is gone too: bring back both.",
    );
    expect(restoreAt(dir, io, { ...options, bringBack: ["Customer", "Order"], yes: true })).toBe(0);
    const names = new DatabaseSync(join(dir, "data/db/app.db"))
      .prepare("SELECT name FROM customers")
      .all();
    expect(names.map((r) => (r as { name: string }).name)).toEqual(["Anna Berg"]);
  } finally {
    process.env.PATH = path;
  }
});
