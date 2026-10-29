// Tests for planning follow-ups (schedule-follow-ups.ts): custom logic needs its own tests.
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { db } from "#/db";
import { customers, followUps } from "#/db/schema";
import { scheduleFollowUps } from "./schedule-follow-ups";

describe("planning follow-ups", () => {
  test("the first is due today, each next one so many days later", async () => {
    const customer = db.insert(customers).values({ name: "Follow Oy" }).returning().get();
    const { created } = await scheduleFollowUps(
      { customer: customer.id, count: 3, everyDays: 7 },
      null,
    );
    expect(created).toBe(3);
    const due = db
      .select()
      .from(followUps)
      .where(eq(followUps.customerId, customer.id))
      .all()
      .map((f) => f.dueOn)
      .sort();
    const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
    expect(due).toEqual([day(0), day(7), day(14)]);
  });

  test("at least one, at most a year of weeks", async () => {
    const customer = db.insert(customers).values({ name: "None Oy" }).returning().get();
    await expect(
      scheduleFollowUps({ customer: customer.id, count: 0, everyDays: 7 }, null),
    ).rejects.toThrow("between 1 and 52");
  });
});
