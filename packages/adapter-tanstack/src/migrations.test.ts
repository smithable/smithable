import { expect, test } from "vitest";
import { columnOf, quoteReferences, renameColumnSql, renameInSnapshot } from "./migrations.js";

test("columns follow the generated schema's naming", () => {
  expect(columnOf("ClassType", "durationMinutes")).toEqual({
    table: "class_types",
    column: "duration_minutes",
  });
  expect(renameColumnSql("Customer", "creditLimit", "maxCredit")).toBe(
    "ALTER TABLE `customers` RENAME COLUMN `credit_limit` TO `max_credit`;\n",
  );
});

test("a rename moves the column and its indexes in the snapshot, keeping order", () => {
  const before = JSON.stringify({
    tables: {
      customers: {
        columns: {
          id: { name: "id" },
          email: { name: "email", type: "text" },
          phone: { name: "phone" },
        },
        indexes: { customers_email_unique: { columns: ["email"] } },
      },
    },
  });
  const after = JSON.parse(renameInSnapshot(before, "Customer", "email", "workEmail"));
  expect(Object.keys(after.tables.customers.columns)).toEqual(["id", "work_email", "phone"]);
  expect(after.tables.customers.columns.work_email).toEqual({ name: "work_email", type: "text" });
  expect(after.tables.customers.indexes.customers_email_unique.columns).toEqual(["work_email"]);
});

test("a reference added to an existing table names its table quoted", () => {
  expect(
    quoteReferences(
      "ALTER TABLE `rows` ADD `group_id` integer REFERENCES values(id);--> statement-breakpoint\nCREATE TABLE `x` (`a` integer, FOREIGN KEY (`a`) REFERENCES `values`(`id`));",
    ),
  ).toBe(
    "ALTER TABLE `rows` ADD `group_id` integer REFERENCES `values`(id);--> statement-breakpoint\nCREATE TABLE `x` (`a` integer, FOREIGN KEY (`a`) REFERENCES `values`(`id`));",
  );
});
