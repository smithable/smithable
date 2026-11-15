import { hostedLevel } from "./hosted-level.js";

export interface ModelUsage {
  window: { used: number; allowed: number; remaining: number; resetsAt: string; currency: "EUR" };
  paused: { is: boolean; reason: "day" | "month" | "shared" | null };
  recent: {
    at: string;
    kind: "change" | "question" | "first build" | "assistant" | "other";
    cost: number;
  }[];
}

const amount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const date = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const object = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

/** Copy only the allowance contract: credentials and any extra service fields never reach the browser. */
export function readModelUsage(value: unknown): ModelUsage | undefined {
  const body = object(value),
    window = object(body?.window),
    paused = object(body?.paused);
  if (
    !window ||
    !paused ||
    !amount(window.used) ||
    !amount(window.allowed) ||
    !amount(window.remaining) ||
    !date(window.resetsAt) ||
    window.currency !== "EUR" ||
    typeof paused.is !== "boolean" ||
    ![null, "day", "month", "shared"].includes(paused.reason as string | null) ||
    !Array.isArray(body?.recent) ||
    body.recent.length > 20
  )
    return undefined;
  if (paused.is ? paused.reason === null : paused.reason !== null) return undefined;
  const recent: ModelUsage["recent"] = [];
  for (const value of body.recent) {
    const row = object(value);
    if (
      !row ||
      !date(row.at) ||
      !amount(row.cost) ||
      !["change", "question", "first build", "assistant", "other"].includes(row.kind as string)
    )
      return undefined;
    recent.push({
      at: new Date(row.at).toISOString(),
      kind: row.kind as ModelUsage["recent"][number]["kind"],
      cost: row.cost,
    });
  }
  return {
    window: {
      used: window.used,
      allowed: window.allowed,
      remaining: window.remaining,
      resetsAt: new Date(window.resetsAt).toISOString(),
      currency: "EUR",
    },
    paused: { is: paused.is, reason: paused.reason as ModelUsage["paused"]["reason"] },
    recent,
  };
}

/** Hosted only, through the daemon's existing model credential and configured gateway. */
export async function modelUsage(
  env: NodeJS.ProcessEnv = process.env,
  request: typeof fetch = fetch,
): Promise<ModelUsage | undefined> {
  if (!hostedLevel(env) || !env.SMITHABLE_MODEL_URL || !env.SMITHABLE_MODEL_KEY) return undefined;
  try {
    const url = new URL(env.SMITHABLE_MODEL_URL);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return undefined;
    url.pathname = `${url.pathname.replace(/\/$/, "")}/usage`;
    const response = await request(url, {
      headers: { authorization: `Bearer ${env.SMITHABLE_MODEL_KEY}` },
      redirect: "error",
      signal: AbortSignal.timeout(3000),
    });
    return response.ok ? readModelUsage(await response.json()) : undefined;
  } catch {
    // Older services and local projects have no figures; neither produces an allowance bar.
    return undefined;
  }
}
