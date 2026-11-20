import { expect, test } from "vitest";
import {
  columnOf,
  dropTakenColumn,
  dropTakenTables,
  dropTakenTablesSql,
  goneFirst,
  inSnapshot,
  inTurn,
  quoteReferences,
  renameColumnSql,
  renameInSnapshot,
  renameModelInSnapshot,
  renameModelSql,
} from "./migrations.js";

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

test("a rename onto a name a newer field took drops that column and its indexes first", () => {
  const before = JSON.stringify({
    tables: {
      customers: {
        columns: { id: { name: "id" }, phone: { name: "phone" }, mobile: { name: "mobile" } },
        indexes: { customers_phone_unique: { columns: ["phone"] } },
      },
    },
  });
  const dropped = dropTakenColumn(before, "Customer", "phone");
  expect(dropped?.sql).toEqual([
    "DROP INDEX IF EXISTS `customers_phone_unique`;\n",
    "ALTER TABLE `customers` DROP COLUMN `phone`;\n",
  ]);
  const after = JSON.parse(dropped?.snapshot ?? "{}");
  expect(Object.keys(after.tables.customers.columns)).toEqual(["id", "mobile"]);
  expect(after.tables.customers.indexes).toEqual({});
  // A name nobody holds needs nothing dropped.
  expect(dropTakenColumn(before, "Customer", "fax")).toBeUndefined();
  expect(dropTakenColumn(before, "Supplier", "phone")).toBeUndefined();
});

test("renames go in turn: none lands on a name another has still to leave, a swap passes through a free name", () => {
  const chain = inTurn(
    [
      { model: "Customer", from: "c", to: "b" },
      { model: "Customer", from: "b", to: "a" },
      { model: "Order", from: "a", to: "z" },
    ],
    (r) => r.model,
  );
  expect(chain.map((r) => `${r.from}>${r.to}`)).toEqual(["b>a", "c>b", "a>z"]);
  const swap = inTurn(
    [
      { model: "Customer", from: "a", to: "b" },
      { model: "Customer", from: "b", to: "a" },
    ],
    (r) => r.model,
  );
  expect(swap.map((r) => `${r.from}>${r.to}`)).toEqual(["a>aPassing0", "b>a", "aPassing0>b"]);
  // A passing name the schema already has is never used.
  const around = inTurn(
    [
      { model: "Customer", from: "a", to: "b" },
      { model: "Customer", from: "b", to: "a" },
    ],
    (r) => r.model,
    (name) => name === "aPassing0",
  );
  expect(around.map((r) => `${r.from}>${r.to}`)).toEqual(["a>aPassing1", "b>a", "aPassing1>b"]);
});

test("what goes is dropped first only when drizzle-kit would ask whether it was renamed", () => {
  const table = (columns: string[], more = {}) => ({
    columns: Object.fromEntries(columns.map((c) => [c, { name: c }])),
    ...more,
  });
  const previous = JSON.stringify({
    tables: {
      customers: table(["id", "tier", "owner_id"], {
        indexes: { customers_tier_idx: { columns: ["tier"] } },
        foreignKeys: { fk: { tableTo: "users", columnsFrom: ["owner_id"] } },
      }),
      notes: table(["id"]),
    },
  });
  // Only a column added, or only one gone: nothing to ask.
  expect(
    goneFirst(previous, {
      tables: { customers: table(["id", "tier", "owner_id", "website"]), notes: table(["id"]) },
    }),
  ).toBeUndefined();
  expect(
    goneFirst(previous, { tables: { customers: table(["id", "owner_id"]), notes: table(["id"]) } }),
  ).toBeUndefined();
  // One gone and one new in the same table: the first step drops what goes, with its index and key.
  const settled = JSON.parse(
    goneFirst(previous, {
      tables: { customers: table(["id", "website"]), notes: table(["id"]) },
    }) ?? "{}",
  );
  expect(Object.keys(settled.tables.customers.columns)).toEqual(["id"]);
  expect(settled.tables.customers.indexes).toEqual({});
  expect(settled.tables.customers.foreignKeys).toEqual({});
  // A reference into a column that goes goes with it.
  const into = JSON.parse(
    goneFirst(
      JSON.stringify({
        tables: {
          customers: table(["id", "code"]),
          orders: table(["id", "customer_code"], {
            foreignKeys: {
              fk: { tableTo: "customers", columnsFrom: ["customer_code"], columnsTo: ["code"] },
            },
          }),
        },
      }),
      { tables: { customers: table(["id", "label"]), orders: table(["id", "customer_code"]) } },
    ) ?? "{}",
  );
  expect(into.tables.orders.foreignKeys).toEqual({});
  // A table gone and another new.
  const tables = JSON.parse(
    goneFirst(previous, {
      tables: { customers: table(["id", "tier", "owner_id"]), memos: table(["id"]) },
    }) ?? "{}",
  );
  expect(Object.keys(tables.tables)).toEqual(["customers"]);
});

test("a model renamed back onto a name a newer model took drops the newer model's tables first", () => {
  const snapshot = JSON.stringify({
    tables: {
      clients: { name: "clients", columns: { id: { name: "id" } } },
      customers: { name: "customers", columns: { id: { name: "id" } } },
      customers_reads: { name: "customers_reads", columns: { id: { name: "id" } } },
      orders: {
        name: "orders",
        columns: { id: { name: "id" }, customer_id: { name: "customer_id" } },
        foreignKeys: {
          fk: { tableTo: "customers", columnsFrom: ["customer_id"], columnsTo: ["id"] },
        },
      },
    },
  });
  const dropped = JSON.parse(dropTakenTables(snapshot, "Client", "Customer") ?? "{}");
  // The newer model's tables, the kit's beside it too.
  expect(Object.keys(dropped.tables)).toEqual(["clients", "orders"]);
  expect(dropped.tables.orders.foreignKeys).toEqual({});
  expect(dropTakenTables(snapshot, "Client", "Buyer")).toBeUndefined();
  // Without drizzle-kit's API, the statements too: the kit's table before the model's own.
  const taken = dropTakenTablesSql(snapshot, "Client", "Customer");
  expect(taken?.sql).toEqual(["DROP TABLE `customers_reads`;", "DROP TABLE `customers`;"]);
  expect(taken?.snapshot).toBe(dropTakenTables(snapshot, "Client", "Customer"));
  expect(dropTakenTablesSql(snapshot, "Client", "Buyer")).toBeUndefined();
});

test("a model's passing name is taken while any of its tables is there, the kit's beside it too", () => {
  const snapshot = JSON.stringify({
    tables: {
      customers_reads: { name: "customers_reads", columns: { id: { name: "id" } } },
    },
  });
  expect(inSnapshot(snapshot, "Customer")).toBe(true);
  expect(inSnapshot(snapshot, "Client")).toBe(false);
  expect(inSnapshot(snapshot, "Customer", "id")).toBe(false);
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

const renameFixture = () =>
  JSON.stringify({
    tables: {
      user: { name: "user", columns: { id: { name: "id" } }, indexes: {}, foreignKeys: {} },
      customers: {
        name: "customers",
        columns: { id: { name: "id" }, email: { name: "email" }, owner_id: { name: "owner_id" } },
        indexes: {
          customers_email_unique: {
            name: "customers_email_unique",
            columns: ["email"],
            isUnique: true,
            where: '"customers"."deleted_at" is null',
          },
          customers_live: { name: "customers_live", columns: ["owner_id"], isUnique: false },
        },
        foreignKeys: {
          customers_owner_id_user_id_fk: {
            name: "customers_owner_id_user_id_fk",
            tableFrom: "customers",
            tableTo: "user",
            columnsFrom: ["owner_id"],
            columnsTo: ["id"],
            onDelete: "set null",
            onUpdate: "no action",
          },
        },
        uniqueConstraints: {},
      },
      customers_favorites: {
        name: "customers_favorites",
        columns: { id: { name: "id" }, record_id: { name: "record_id" } },
        indexes: {},
        foreignKeys: {
          customers_favorites_record_id_customers_id_fk: {
            name: "customers_favorites_record_id_customers_id_fk",
            tableFrom: "customers_favorites",
            tableTo: "customers",
            columnsFrom: ["record_id"],
            columnsTo: ["id"],
          },
        },
        uniqueConstraints: {
          customers_favorites_user_id_record_id_unique: {
            name: "customers_favorites_user_id_record_id_unique",
            columns: ["user_id", "record_id"],
          },
        },
      },
      orders: {
        name: "orders",
        columns: { id: { name: "id" }, customer_id: { name: "customer_id" } },
        indexes: {},
        foreignKeys: {
          orders_customer_id_customers_id_fk: {
            name: "orders_customer_id_customers_id_fk",
            tableFrom: "orders",
            tableTo: "customers",
            columnsFrom: ["customer_id"],
            columnsTo: ["id"],
          },
        },
      },
      audit_log: { name: "audit_log", columns: { model: { name: "model" } }, indexes: {} },
    },
  });

test("a model's rename renames its tables and their indexes, and the audit log's rows about it", () => {
  expect(renameModelSql(renameFixture(), "Customer", "Client")).toEqual([
    "ALTER TABLE `customers` RENAME TO `clients`;",
    "DROP INDEX IF EXISTS `customers_email_unique`;",
    'CREATE UNIQUE INDEX `clients_email_unique` ON `clients` (`email`) WHERE "clients"."deleted_at" is null;',
    "DROP INDEX IF EXISTS `customers_live`;",
    "CREATE INDEX `clients_live` ON `clients` (`owner_id`);",
    "ALTER TABLE `customers_favorites` RENAME TO `clients_favorites`;",
    "UPDATE `audit_log` SET `model` = 'Client' WHERE `model` = 'Customer';",
  ]);
});

test("a model's rename moves its tables in the snapshot and every foreign key follows", () => {
  const after = JSON.parse(renameModelInSnapshot(renameFixture(), "Customer", "Client"));
  expect(Object.keys(after.tables)).toEqual([
    "user",
    "clients",
    "clients_favorites",
    "orders",
    "audit_log",
  ]);
  expect(after.tables.clients.name).toBe("clients");
  expect(Object.keys(after.tables.clients.indexes)).toEqual([
    "clients_email_unique",
    "clients_live",
  ]);
  expect(after.tables.clients.indexes.clients_email_unique.where).toBe(
    '"clients"."deleted_at" is null',
  );
  expect(after.tables.clients.foreignKeys).toEqual({
    clients_owner_id_user_id_fk: expect.objectContaining({
      name: "clients_owner_id_user_id_fk",
      tableFrom: "clients",
      tableTo: "user",
    }),
  });
  expect(Object.keys(after.tables.clients_favorites.foreignKeys)).toEqual([
    "clients_favorites_record_id_clients_id_fk",
  ]);
  expect(
    after.tables.clients_favorites.foreignKeys.clients_favorites_record_id_clients_id_fk,
  ).toMatchObject({
    tableFrom: "clients_favorites",
    tableTo: "clients",
  });
  expect(Object.keys(after.tables.clients_favorites.uniqueConstraints)).toEqual([
    "clients_favorites_user_id_record_id_unique",
  ]);
  expect(after.tables.orders.foreignKeys).toEqual({
    orders_customer_id_clients_id_fk: expect.objectContaining({
      name: "orders_customer_id_clients_id_fk",
      tableFrom: "orders",
      tableTo: "clients",
      columnsFrom: ["customer_id"],
    }),
  });
  // A rename of a table whose name is inside another's leaves that other alone.
  const other = JSON.parse(
    renameModelInSnapshot(
      JSON.stringify({
        tables: {
          orders: { name: "orders", columns: {}, indexes: {}, foreignKeys: {} },
          reorders: {
            name: "reorders",
            columns: {},
            indexes: { reorders_live: { name: "reorders_live", columns: ["x"], isUnique: false } },
            foreignKeys: {},
          },
        },
      }),
      "Order",
      "Deal",
    ),
  );
  expect(Object.keys(other.tables)).toEqual(["deals", "reorders"]);
  expect(Object.keys(other.tables.reorders.indexes)).toEqual(["reorders_live"]);
});
