// Smithable app kit: the page a pay link opens (docs/design/payments.md §4.1), for someone without
// an account. The link's token is bound to a payments entry, a record and an amount: it shows the
// entry's description and that amount, nothing else of the record, and pays while the record fits
// the entry's condition, is unpaid and still asks for that amount. A wrong, ended or withdrawn
// link, and one whose record is gone, are the same "not found".
import { db } from "#/db";
import { app } from "#/generated/app";
import { PAYMENT_ENTRIES } from "#/generated/payments.server";
import { paidWith, startPayment } from "./payments.server";
import { BadInput } from "./refusal";
import { openPay } from "./view.server";
import { w } from "./words";

type Row = Record<string, unknown> & { id: number };
/** Each entry's description of a record, as the generated payments module words it. */
// biome-ignore lint/suspicious/noExplicitAny: a record's fields, as its data module reads them
export type Describe = Record<string, (row: any) => string>;

/** What the page shows: open to pay, paid already (as it was paid), or a link that no longer works (no amount). */
export interface PayLinkShown {
  state: "open" | "paid" | "ended";
  amount: number;
  currency: string;
  /** The entry's description; empty for a link that no longer works. */
  description: string;
}

/** The link's entry and its record as stored (read as the app), or null. */
function linked(token: string) {
  const link = openPay(token);
  const entry = link && Object.hasOwn(PAYMENT_ENTRIES, link.entry) && PAYMENT_ENTRIES[link.entry];
  if (!link || !entry || !entry.when || !entry.due || entry.model !== link.model) return null;
  const row = db.transaction((tx) => entry.read(tx, link.record));
  // A record gone or in the trash opens nothing (its trash ended the link, too).
  if (!row || row.deletedAt) return null;
  return { link, entry, row: row as Row };
}

/** What a pay link opens, or null. Reading changes nothing. */
export function payLinkShown(token: string, describe: Describe): PayLinkShown | null {
  const found = linked(token);
  if (!found) return null;
  const { link, entry, row } = found;
  // Paid: what the payment was, as it was made, not the record's words now. Only a link for that
  // amount says so; an older link for another amount ended and shows nothing of the payment.
  const paid = db.transaction((tx) => paidWith(tx, link.entry, link.record));
  if (paid && (paid.amount !== link.amount || paid.currency !== link.currency))
    return { state: "ended", amount: 0, currency: app.currency, description: "" };
  if (paid)
    return {
      state: "paid",
      amount: paid.amount,
      currency: paid.currency,
      description: paid.description ?? "",
    };
  // It no longer fits the condition, or asks for another amount: the sender sends a new link, and
  // this one says nothing of the record.
  const due = db.transaction((tx) => entry.due?.(tx, link.record));
  if (due !== link.amount || link.currency !== app.currency || !(link.amount > 0))
    return { state: "ended", amount: 0, currency: app.currency, description: "" };
  return {
    state: "open",
    amount: link.amount,
    currency: app.currency,
    description: describe[link.entry]?.(row) ?? "",
  };
}

/**
 * Pays through a pay link: on to the provider's page, the pending Payment bound to this browser.
 * The amount and currency are checked again where the pending Payment is written.
 */
export async function payByLink(token: string, describe: Describe): Promise<string> {
  const found = linked(token);
  if (!found) throw new BadInput(w.paymentGone);
  const { link, row } = found;
  // No await between the link's check above and startPayment's write transaction, and the
  // database is one synchronous connection: nothing ends the link or trashes the record between.
  return startPayment(link.entry, row, describe[link.entry]?.(row) ?? "", {
    amount: link.amount,
    currency: link.currency,
  });
}
