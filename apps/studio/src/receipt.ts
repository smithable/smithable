/**
 * The receipt line on a change (T721): who made it, a rule or which model, and what it cost.
 * Johan, 2026-11-12: shown on every change, in the history and after Apply. It states what was
 * recorded and promises nothing about prices.
 */
import type { TraceEntry } from "./api";

type Spent = { model?: string; costs: Map<string, number> };

/** An amount as people read it: 0, or a symbol and enough decimals to show a small one. */
function money(amount: number, currency: string): string {
  if (amount === 0) return "0";
  const symbol = currency === "USD" ? "$" : "€";
  return `${symbol}${amount < 0.1 ? amount.toFixed(4) : amount.toFixed(2)}`;
}

function cost(spent: Spent): string {
  const paid = [...spent.costs].filter(([, n]) => n > 0);
  return paid.length ? paid.map(([c, n]) => money(n, c)).join(" + ") : "0";
}

function by(spent: Spent): string {
  return spent.model ? `${spent.model}, cost ${cost(spent)}` : "rule, no AI, cost 0";
}

/** The receipt of a history entry, or of a request's changes together (their costs summed). */
export function receipt(group: TraceEntry[]): string {
  const costs = new Map<string, number>();
  const models = new Set<string>();
  for (const e of group) {
    if (e.engine === "generator" || e.isUndo) continue;
    models.add(e.model ?? e.engine);
    const currency = e.currency ?? "EUR";
    costs.set(currency, (costs.get(currency) ?? 0) + (e.cost ?? 0));
  }
  const model = models.size ? [...models].join(" and ") : undefined;
  return `${group.every((e) => e.isUndo) ? "Undone" : "Done"} by ${by({ model, costs })}`;
}

/**
 * What the engine's usage line says was spent on a request: the model in brackets and each
 * currency's total ("€0.0012"), or nothing when no model was used.
 */
function spentOn(usage: string): Spent {
  const costs = new Map<string, number>();
  if (!usage || usage.startsWith("Generator") || usage === "No model was used") return { costs };
  for (const [, symbol, amount] of usage.matchAll(/([€$])(\d+(?:\.\d+)?)/g)) {
    const currency = symbol === "$" ? "USD" : "EUR";
    costs.set(currency, (costs.get(currency) ?? 0) + Number(amount));
  }
  return { model: /\(([^)]+)\)/.exec(usage)?.[1] ?? usage.split(" (")[0], costs };
}

/** The receipt of a request from its usage line: done, still a proposal, or nothing changed. */
export function usageReceipt(
  usage: string,
  state: "done" | "by" | "proposed" | "answered" | "nothing",
): string {
  const spent = spentOn(usage);
  if (state === "nothing")
    return spent.model
      ? `Nothing changed; ${spent.model} was asked, cost ${cost(spent)}`
      : "Nothing changed, cost 0";
  // "by" follows a sentence that already says Done (after Apply).
  const verb = { done: "Done by", by: "By", proposed: "Proposed by", answered: "Answered by" }[
    state
  ];
  return `${verb} ${by(spent)}`;
}
