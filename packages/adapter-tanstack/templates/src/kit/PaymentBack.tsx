// Smithable app kit: the page a payer comes back to from the payment provider (payments.md §4.2).
// It shows the Payment's state as the app knows it: paid once the provider's word has come, and
// until then a wait that asks again for a minute. The address marks nothing paid by itself.
import { CircleCheck, CircleX, Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { moneyText } from "./format";
import { clockText, whenAt } from "./time-text";
import { w } from "./words";

export interface PaymentShown {
  status: "pending" | "paid" | "failed" | "refunding" | "refunded";
  amount: number;
  currency: string;
  heldUntil: string;
  description: string;
  /** Paid, but not as asked (the wrong amount, after the hold): the record was not made. */
  unmatched?: boolean;
}

export function PaymentBack({
  payment: first,
  refresh,
  payAgain,
}: {
  payment: PaymentShown;
  refresh: () => Promise<PaymentShown>;
  payAgain: () => Promise<string>;
}) {
  const [payment, setPayment] = useState(first);
  const [asked, setAsked] = useState(0);
  const [problem, setProblem] = useState<string>();
  const ask = useRef(refresh);
  ask.current = refresh;
  // Asks again every three seconds for a minute while the provider's word has not come.
  useEffect(() => {
    if (payment.status !== "pending" || asked >= 20) return;
    const timer = setTimeout(async () => {
      setPayment(await ask.current());
      setAsked((n) => n + 1);
    }, 3000);
    return () => clearTimeout(timer);
  }, [payment.status, asked]);
  const amount = moneyText(payment.amount, payment.currency);
  const until = whenAt(payment.heldUntil);
  return (
    <main className="mx-auto max-w-lg p-5">
      <Card data-kit="payment-back" className="space-y-4 p-card" aria-live="polite">
        {payment.unmatched ? (
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <CircleX aria-hidden className="size-6 text-destructive" /> {w.paymentUnmatched}
          </h1>
        ) : payment.status === "paid" || payment.status === "refunding" ? (
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <CircleCheck aria-hidden className="size-6 text-primary" /> {w.paymentPaid(amount)}
          </h1>
        ) : payment.status === "pending" ? (
          <>
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              <Clock aria-hidden className="size-6 text-muted-foreground" /> {w.paymentWaiting}
            </h1>
            {asked >= 20 && <p>{w.paymentReceiptLater}</p>}
            <p className="text-sm text-muted-foreground">
              {w.paymentHeldUntil(clockText(until.hour, until.minute))}
            </p>
            <Button
              onClick={async () => {
                setProblem(undefined);
                try {
                  window.location.assign(await payAgain());
                } catch (error) {
                  setProblem((error as Error).message);
                }
              }}
            >
              {w.payAmount(amount)}
            </Button>
          </>
        ) : (
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <CircleX aria-hidden className="size-6 text-destructive" />
            {payment.status === "refunded" ? w.paymentRefunded : w.paymentNotMade}
          </h1>
        )}
        <p className="text-sm text-muted-foreground">{payment.description}</p>
        {problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
      </Card>
    </main>
  );
}
