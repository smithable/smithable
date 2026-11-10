// Smithable app kit: the Payments page (payments.md §3.3): every payment the app asked for, newest
// first, filtered by state, for admins and the roles that may refund. What went wrong is shown,
// with Refund where the viewer may; money that came for nothing is refunded here.
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { PageHeader } from "./AppShell";
import { instantText, moneyText } from "./format";
import { w } from "./words";

export interface PaymentListed {
  id: number;
  model: string;
  record: number;
  amount: number;
  currency: string;
  status: string;
  at: string;
  reference: string | null;
  note: string | null;
  description: string;
  refundable: boolean;
}

const STATES = ["pending", "paid", "failed", "refunding", "refunded"];

export function PaymentsPage({
  rows,
  status,
  timeZone,
  choose,
  refund,
}: {
  rows: PaymentListed[];
  status?: string;
  timeZone?: string;
  choose: (status?: string) => void;
  refund: (payment: number) => Promise<void>;
}) {
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PageHeader title={w.payments} />
      <fieldset className="mb-4 flex flex-wrap gap-2" aria-label={w.payments}>
        <Button variant={status ? "outline" : "default"} size="sm" onClick={() => choose()}>
          {w.all}
        </Button>
        {STATES.map((s) => (
          <Button
            key={s}
            variant={status === s ? "default" : "outline"}
            size="sm"
            onClick={() => choose(s)}
          >
            {w.paymentStatus(s)}
          </Button>
        ))}
      </fieldset>
      {problem && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {problem}
        </p>
      )}
      {rows.length ? (
        <ul data-kit="payments" className="divide-y rounded-lg border bg-card">
          {rows.map((p) => (
            <li key={p.id} data-part="payment" className="flex flex-wrap items-center gap-3 p-3">
              <span className="tabular-nums font-medium">{moneyText(p.amount, p.currency)}</span>
              <span>{w.paymentStatus(p.status)}</span>
              <span className="min-w-0 flex-1 truncate">{p.description}</span>
              <span className="text-sm text-muted-foreground">{instantText(p.at, timeZone)}</span>
              {p.reference && <span className="text-xs text-muted-foreground">{p.reference}</span>}
              {p.note && <span className="text-sm text-destructive">{p.note}</span>}
              {p.refundable && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    if (!confirm(w.refundAsk(moneyText(p.amount, p.currency)))) return;
                    setBusy(true);
                    setProblem(undefined);
                    try {
                      await refund(p.id);
                    } catch (error) {
                      setProblem((error as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {w.refund}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{w.noneYet(w.payments.toLowerCase())}</p>
      )}
    </>
  );
}
