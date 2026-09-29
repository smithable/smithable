// Your implementation of the "mergeCustomers" action in smithable.yml. Smithable created this file
// once and never changes it. The input and output types are generated from the spec, so a change
// to the action's input or output shows up here as a type error.
// `viewer` is the signed-in user (null for a visitor). The records the input refers to are ones
// they may read; the data functions in src/generated/*.server.ts check access for them.
import { eq, getTableColumns } from "drizzle-orm";
import { db } from "#/db";
import { customers, orders } from "#/db/schema";
import type {
  MergeCustomersInput,
  MergeCustomersOutput,
} from "#/generated/actions/merge-customers";
import type { Viewer } from "#/kit/access";

type Customer = typeof customers.$inferSelect;

/**
 * Merge a duplicate customer record into the one we keep.
 *
 * Rules (from smithable.yml):
 * - All orders of the duplicate move to the kept customer.
 * - Empty fields on the kept customer are filled from the duplicate.
 * - The duplicate is deleted afterwards.
 */
export async function mergeCustomers(
  { keep, duplicate }: MergeCustomersInput,
  _viewer: Viewer | null,
): Promise<MergeCustomersOutput> {
  if (keep === duplicate) throw new Error("Choose two different customers.");
  // Only admins may run this action (smithable.yml); the generated action checks that first.
  const kept = db.select().from(customers).where(eq(customers.id, keep)).get();
  const other = db.select().from(customers).where(eq(customers.id, duplicate)).get();
  if (!kept || !other) throw new Error("Both customers must exist.");
  const empty = (value: unknown) => value === null || value === undefined || value === "";
  // Every column the kept customer has no value for, taken from the duplicate.
  const filled = Object.fromEntries(
    Object.keys(getTableColumns(customers))
      .filter((column) => column !== "id")
      .filter((column) => empty(kept[column as keyof Customer]))
      .filter((column) => !empty(other[column as keyof Customer]))
      .map((column) => [column, other[column as keyof Customer]]),
  );
  // All at once or not at all. The duplicate goes before its values move, so a unique value
  // (its email) is never on two customers at the same time.
  db.transaction((tx) => {
    tx.update(orders).set({ customerId: keep }).where(eq(orders.customerId, duplicate)).run();
    tx.delete(customers).where(eq(customers.id, duplicate)).run();
    if (Object.keys(filled).length)
      tx.update(customers).set(filled).where(eq(customers.id, keep)).run();
  });
}
