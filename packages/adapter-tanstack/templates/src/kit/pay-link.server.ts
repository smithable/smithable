// Smithable app kit: the page a pay link opens (docs/design/payments.md §4.1), for someone without
// an account. The link's token is bound to a payments entry, a record and an amount: it shows the
// entry's description and that amount, nothing else of the record, and pays while the record fits
// the entry's condition, is unpaid and still asks for that amount. A wrong, ended or withdrawn
// link, and one whose record is gone, are the same "not found".
import { db } from "#/db";
import { app } from "#/generated/app";
import { PAYMENT_ENTRIES } from "#/generated/payments.server";
import { paidFor, startPayment } from "./payments.server";
import { BadInput } from "./refusal";
import { openPay } from "./view.server";
import { w } from "./words";

type Row = Record<string, unknown> & { id: number };
/** Each entry's description of a record, as the generated payments module words it. */
// biome-ignore lint/suspicious/noExplicitAny: a record's fields, as its data module reads them
export type Describe = Record<string, (row: any) => string>;

/** What the page shows: open to pay, paid already, or a link that no longer works. */
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
  const shown = { amount: link.amount, currency: app.currency };
  const said = () => describe[link.entry]?.(row) ?? "";
  if (db.transaction((tx) => paidFor(tx, link.entry, link.record)))
    return { state: "paid", ...shown, description: said() };
  // It no longer fits the condition, or asks for another amount: the sender sends a new link.
  const due = db.transaction((tx) => entry.due?.(tx, link.record));
  if (due !== link.amount || !(link.amount > 0))
    return { state: "ended", ...shown, description: "" };
  return { state: "open", ...shown, description: said() };
}

/**
 * Pays through a pay link: on to the provider's page, the pending Payment bound to this browser.
 * The amount is checked again where the pending Payment is written.
 */
export async function payByLink(token: string, describe: Describe): Promise<string> {
  const found = linked(token);
  if (!found) throw new BadInput(w.paymentGone);
  const { link, row } = found;
  return startPayment(link.entry, row, describe[link.entry]?.(row) ?? "", link.amount);
}
