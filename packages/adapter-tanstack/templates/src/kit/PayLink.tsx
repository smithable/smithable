// Smithable app kit: the page a pay link opens, for someone without an account. It shows the
// description and the amount and a Pay button, nothing else of the record; paid already, or a link
// that no longer works, said so (docs/design/payments.md §4.1).
import { CircleCheck, CircleX } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { moneyText } from "./format";
import type { PayLinkShown } from "./pay-link.server";
import { w } from "./words";

export function PayLink({ shown, pay }: { shown: PayLinkShown; pay: () => Promise<string> }) {
  const [problem, setProblem] = useState<string>();
  const amount = moneyText(shown.amount, shown.currency);
  return (
    <main className="mx-auto max-w-lg p-5">
      <Card data-kit="pay-link" className="space-y-4 p-card" aria-live="polite">
        {shown.state === "paid" ? (
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <CircleCheck aria-hidden className="size-6 text-primary-text" /> {w.paymentPaid(amount)}
          </h1>
        ) : shown.state === "ended" ? (
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <CircleX aria-hidden className="size-6 text-destructive" /> {w.payLinkEnded}
          </h1>
        ) : (
          <>
            <h1 className="text-xl font-semibold">{shown.description}</h1>
            <p className="text-2xl font-semibold tabular-nums">{amount}</p>
            <Button
              onClick={async () => {
                setProblem(undefined);
                try {
                  window.location.assign(await pay());
                } catch (error) {
                  setProblem((error as Error).message);
                }
              }}
            >
              {w.payAmount(amount)}
            </Button>
          </>
        )}
        {shown.state === "paid" && (
          <p className="text-sm text-muted-foreground">{shown.description}</p>
        )}
        {problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
      </Card>
    </main>
  );
}
