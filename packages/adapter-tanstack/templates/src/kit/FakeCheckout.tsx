// Smithable app kit: the fake payment provider's page (payments.md §6). It stands in for a
// provider's checkout in development and tests: Approve and Decline post a signed event to the
// app's payments address, as a provider does, and Cancel comes back unpaid. No money moves.
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { moneyText } from "./format";
import { w } from "./words";

export function FakeCheckout({
  id,
  payment,
  sign,
}: {
  id: number;
  payment: { status: string; amount: number; currency: string; description: string };
  sign: (kind: "paid" | "failed") => Promise<{ body: string; signature: string }>;
}) {
  const [busy, setBusy] = useState(false);
  const back = `/payments/${id}/back`;
  async function send(kind: "paid" | "failed") {
    setBusy(true);
    const { body, signature } = await sign(kind);
    await fetch("/incoming/payments-fake", {
      method: "POST",
      headers: { "content-type": "application/json", "x-fake-signature": signature },
      body,
    });
    window.location.assign(back);
  }
  return (
    <main className="mx-auto max-w-md p-5">
      <Card data-kit="fake-checkout" className="space-y-4 p-card">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {w.paymentFake}
        </p>
        <h1 className="text-2xl font-semibold">{moneyText(payment.amount, payment.currency)}</h1>
        <p>{payment.description}</p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || payment.status !== "pending"} onClick={() => send("paid")}>
            {w.paymentApprove}
          </Button>
          <Button
            variant="outline"
            disabled={busy || payment.status !== "pending"}
            onClick={() => send("failed")}
          >
            {w.paymentDecline}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => window.location.assign(back)}>
            {w.cancel}
          </Button>
        </div>
      </Card>
    </main>
  );
}
