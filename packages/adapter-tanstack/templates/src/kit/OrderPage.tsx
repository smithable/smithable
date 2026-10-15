// Smithable app kit: the order page (docs/design/orders.md §1, §3): what can be chosen, by
// section, each with + and its price; a bar with the count and the total; the customer's
// details; and the order's number once it is in. The prices shown are for choosing: the server
// reads them again when the order is placed.
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import type { z } from "zod";
import { Button } from "#/components/ui/button";
import { PageHeader } from "./AppShell";
import { ModelForm } from "./ModelForm";
import type { AppUi, ModelUi } from "./model";
import { w } from "./words";

/** One thing to choose, as the menu gives it. */
export interface Choice {
  id: number;
  name: string;
  /** In cents, as money is stored. */
  price: number;
  section?: string | null;
  description?: string | null;
  picture?: { src: string; alt: string } | null;
  available: boolean;
}

/** What the server says of the menu now. */
export interface Menu {
  choices: Choice[];
  /** Orders are taken now. */
  open: boolean;
  /** When they are next taken, while closed (an ISO time). */
  opens: string | null;
}

interface OrderPageProps<S extends z.ZodType> {
  title: string;
  menu: Menu;
  /** The sections in their order, each value with its label. */
  sections: [string, string][];
  app: AppUi;
  /** The order's form: the fields the customer fills. */
  ui: ModelUi;
  schema: S;
  place: (
    values: z.output<S>,
    lines: { id: number; quantity: number }[],
  ) => Promise<{ number: unknown }>;
}

export function OrderPage<S extends z.ZodType>(props: OrderPageProps<S>) {
  const { title, menu, sections, app, ui, schema, place } = props;
  const [chosen, setChosen] = useState<Record<number, number>>({});
  const [step, setStep] = useState<"choose" | "details">("choose");
  const [placed, setPlaced] = useState<{ number: string; lines: [Choice, number][] }>();
  const [problem, setProblem] = useState<string>();
  const money = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: app.currency }).format(n / 100);
  const lines = menu.choices.flatMap((c): [Choice, number][] =>
    chosen[c.id] ? [[c, chosen[c.id] as number]] : [],
  );
  const count = lines.reduce((sum, [, q]) => sum + q, 0);
  const total = lines.reduce((sum, [c, q]) => sum + c.price * q, 0);
  const change = (id: number, by: number) =>
    setChosen((now) => {
      const next = Math.max(0, Math.min(99, (now[id] ?? 0) + by));
      const { [id]: _, ...rest } = now;
      return next ? { ...rest, [id]: next } : rest;
    });
  const opens = menu.opens
    ? new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: app.timeZone,
      }).format(new Date(menu.opens))
    : undefined;

  if (placed)
    return (
      <div data-kit="order-placed" className="mx-auto max-w-xl space-y-4 p-5">
        <PageHeader title={w.orderPlaced(placed.number)} />
        <ul className="divide-y rounded-lg border">
          {placed.lines.map(([c, q]) => (
            <li key={c.id} className="flex justify-between gap-3 p-3">
              <span>
                {q} × {c.name}
              </span>
              <span>{money(c.price * q)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 p-3 font-semibold">
            <span>{w.orderTotal}</span>
            <span>{money(placed.lines.reduce((s, [c, q]) => s + c.price * q, 0))}</span>
          </li>
        </ul>
      </div>
    );

  const grouped = [
    ...sections.map(
      ([value, label]) => [label, menu.choices.filter((c) => c.section === value)] as const,
    ),
    ["", menu.choices.filter((c) => !sections.some(([value]) => value === c.section))] as const,
  ].filter(([, cs]) => cs.length);
  return (
    <div data-kit="order" className="mx-auto max-w-2xl pb-28">
      <PageHeader title={title} />
      {!menu.open && (
        <p role="status" className="mx-5 rounded-md border bg-muted p-3 text-sm">
          {w.orderClosed(opens)}
        </p>
      )}
      {step === "details" ? (
        <div className="space-y-3 p-5">
          <h2 className="text-lg font-semibold">{w.orderDetails}</h2>
          {problem && (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          )}
          <ModelForm
            ui={ui}
            app={app}
            schema={schema}
            submitLabel={w.orderPlace}
            onCancel={() => setStep("choose")}
            onSubmit={async (values) => {
              setProblem(undefined);
              try {
                const made = await place(
                  values,
                  lines.map(([c, quantity]) => ({ id: c.id, quantity })),
                );
                setPlaced({ number: String(made.number), lines });
              } catch (error) {
                const message = (error as Error).message;
                const sold = /sold-out:(.*)$/.exec(message)?.[1];
                setProblem(sold ? w.orderSoldOut(sold) : message);
              }
            }}
          />
        </div>
      ) : (
        grouped.map(([label, choices]) => (
          <section key={label || "more"} aria-label={label || undefined} className="px-5 pt-5">
            {label && <h2 className="mb-2 text-lg font-semibold">{label}</h2>}
            <ul className="divide-y rounded-lg border bg-card">
              {choices.map((c) => (
                <li key={c.id} data-part="choice" className="flex items-center gap-3 p-3">
                  {c.picture && (
                    <img
                      src={c.picture.src}
                      alt={c.picture.alt}
                      className="size-16 shrink-0 rounded-md object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.name}</p>
                    {c.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                    )}
                    <p className="text-sm">{money(c.price)}</p>
                  </div>
                  {!c.available ? (
                    <span className="text-sm text-muted-foreground">{w.soldOut}</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      {chosen[c.id] ? (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={w.orderRemove(c.name)}
                            onClick={() => change(c.id, -1)}
                          >
                            <Minus aria-hidden />
                          </Button>
                          <span className="w-5 text-center tabular-nums">{chosen[c.id]}</span>
                        </>
                      ) : null}
                      <Button
                        size="icon"
                        aria-label={w.addOne(c.name)}
                        disabled={!menu.open}
                        onClick={() => change(c.id, 1)}
                      >
                        <Plus aria-hidden />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {step === "choose" && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <span aria-live="polite">{count ? w.orderBar(count, money(total)) : w.orderEmpty}</span>
            <Button disabled={!count || !menu.open} onClick={() => setStep("details")}>
              {w.orderSend}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
