// Smithable app kit: a record's payments on its page (payments.md §3.3, §4.1, §4.4). Pay where the
// record asks for a payment, its Payments (amount, state, when; the provider's reference and what
// went wrong for those who may refund), and Refund where the viewer may. The server decides all of
// it: this only shows what it said.
import { CreditCard, Undo2 } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { instantText, moneyText } from "./format";
import { w } from "./words";

export interface RecordPaymentsShown {
  lines: {
    id: number;
    amount: number;
    currency: string;
    status: string;
    at: string;
    reference?: string | null;
    note?: string | null;
    refundable: boolean;
  }[];
  pay: { entry: string; amount: number } | null;
}

export function RecordPayments({
  payments,
  currency,
  timeZone,
  pay,
  refund,
  changed,
}: {
  payments: RecordPaymentsShown;
  currency: string;
  timeZone?: string;
  /** Starts paying: the provider's page to go to. */
  pay: (entry: string) => Promise<string>;
  refund: (payment: number) => Promise<void>;
  /** After a refund: the page reads the record again. */
  changed: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const { lines, pay: offer } = payments;
  if (!lines.length && !offer) return null;
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setProblem(undefined);
    try {
      await work();
    } catch (error) {
      setProblem((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card data-kit="record-payments" className="mb-6 space-y-3 p-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{w.payments}</h2>
        {/* Those who see the provider's reference may open every payment (the Payments page). */}
        {lines.some((p) => "reference" in p) && (
          <a href="/payments" className="text-sm underline">
            {w.allPayments}
          </a>
        )}
        {offer && (
          <Button
            disabled={busy}
            onClick={() =>
              run(async () => {
                window.location.assign(await pay(offer.entry));
              })
            }
          >
            <CreditCard aria-hidden className="size-4" />{" "}
            {w.payAmount(moneyText(offer.amount, currency))}
          </Button>
        )}
      </div>
      {lines.length > 0 && (
        <ul className="divide-y">
          {lines.map((p) => (
            <li
              key={p.id}
              data-part="payment"
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <span className="tabular-nums">{moneyText(p.amount, p.currency)}</span>
              <span>{w.paymentStatus(p.status)}</span>
              <span className="text-sm text-muted-foreground">{instantText(p.at, timeZone)}</span>
              {p.reference && <span className="text-xs text-muted-foreground">{p.reference}</span>}
              {p.note && <span className="text-sm text-destructive">{p.note}</span>}
              {p.refundable && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      if (!confirm(w.refundAsk(moneyText(p.amount, p.currency)))) return;
                      await refund(p.id);
                      await changed();
                    })
                  }
                >
                  <Undo2 aria-hidden className="size-4" /> {w.refund}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
    </Card>
  );
}
