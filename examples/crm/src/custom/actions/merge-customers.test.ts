// Tests for the customer merge (merge-customers.ts): custom logic needs its own tests.
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { db } from "#/db";
import { customers, orders } from "#/db/schema";
import { mergeCustomers } from "./merge-customers";

describe("merging customers", () => {
  test("orders move, empty fields are filled, and the duplicate is gone", async () => {
    const keep = db
      .insert(customers)
      .values({ name: "Arctic Oy", phone: "+358 40 1" })
      .returning()
      .get();
    const duplicate = db
      .insert(customers)
      .values({
        name: "Arctic",
        email: "sales@arctic.example",
        phone: "+358 40 2",
      })
      .returning()
      .get();
    db.insert(orders).values({ number: "M-1", customerId: duplicate.id, total: 1000 }).run();
    db.insert(orders).values({ number: "M-2", customerId: duplicate.id, total: 2000 }).run();

    await mergeCustomers({ keep: keep.id, duplicate: duplicate.id });

    const kept = db.select().from(customers).where(eq(customers.id, keep.id)).get();
    expect(kept?.name).toBe("Arctic Oy");
    expect(kept?.phone).toBe("+358 40 1");
    expect(kept?.email).toBe("sales@arctic.example");
    expect(db.select().from(customers).where(eq(customers.id, duplicate.id)).get()).toBeUndefined();
    const moved = db.select().from(orders).where(eq(orders.customerId, keep.id)).all();
    expect(moved.map((o) => o.number).sort()).toEqual(["M-1", "M-2"]);
  });

  test("a customer is not merged into itself", async () => {
    const one = db.insert(customers).values({ name: "Solo" }).returning().get();
    await expect(mergeCustomers({ keep: one.id, duplicate: one.id })).rejects.toThrow(
      "two different",
    );
  });
});
