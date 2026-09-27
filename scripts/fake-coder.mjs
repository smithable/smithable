// A stand-in coder for tests: it gets the prompt on stdin and writes the churn query's code.
// With FAKE_CODER=trespass it also edits a generated file, which Smithable must undo.
import { readFileSync, writeFileSync } from "node:fs";

const prompt = readFileSync(0, "utf8");
if (!prompt.includes("query:churnRisk")) throw new Error("the prompt does not name the query");
writeFileSync(
  "src/custom/queries/churn-risk.ts",
  `import { customerData } from "#/generated/customer.server";
import { orderData } from "#/generated/order.server";
import type { ChurnRiskRows } from "#/generated/queries/churn-risk";
import type { Viewer } from "#/kit/access";

/** Customers most likely to stop buying: the longest since their last order first. */
export async function churnRisk(viewer: Viewer | null): Promise<ChurnRiskRows> {
  const [customers, orders] = await Promise.all([customerData.list(viewer), orderData.list(viewer)]);
  const last = new Map<number, number>();
  for (const order of orders) {
    const at = order.placedAt ? new Date(order.placedAt).getTime() : 0;
    last.set(order.customerId, Math.max(last.get(order.customerId) ?? 0, at));
  }
  return [...customers].sort((a, b) => (last.get(a.id) ?? 0) - (last.get(b.id) ?? 0));
}
`,
);
if (process.env.FAKE_CODER === "trespass")
  writeFileSync("src/generated/app.ts", "// edited by a coder that should not\n", { flag: "a" });
