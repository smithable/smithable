// Smithable app kit: numbers counting up (`sequence: true`, docs/design/orders.md §4). Each such
// field has a counter row (one per owner where the field is unique per owner), advanced in the
// record's own transaction, so two records made at once never share a number and a number is
// never given twice, not even after the record that had it is deleted for good. The counter
// stays ahead of the records' highest number, so numbers entered by an import are never given
// again either.
import { sql } from "drizzle-orm";
import type { db } from "#/db";
import { sequences } from "#/db/schema";

/** A transaction, as a record is made inside one. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The next number for `key` ("Order.number", or "Order.number:<owner>" per owner): one more than
 * the counter, and at least one more than `top`, the highest number the records hold.
 */
export function nextInSequence(tx: Tx, key: string, top: number): number {
  const row = tx
    .insert(sequences)
    .values({ key, last: top + 1 })
    .onConflictDoUpdate({
      target: sequences.key,
      set: { last: sql`max(${sequences.last} + 1, ${top + 1})` },
    })
    .returning({ last: sequences.last })
    .get();
  return row.last;
}
