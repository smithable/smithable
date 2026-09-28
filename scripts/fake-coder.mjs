// A stand-in coder for tests: it gets the prompt on stdin and writes the churn query's code.
// With FAKE_CODER=trespass it also edits a generated file, and with FAKE_CODER=hook it plants a
// Git hook: Smithable must undo both.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const prompt = readFileSync(0, "utf8");

// Teaching Smithable a newsletter section: a plugin that expands it into a model and a page.
if (prompt.includes('does not know the section "newsletter"')) {
  mkdirSync(`${process.env.SMITHABLE_CODER_AREA}`, { recursive: true });
  writeFileSync(
    `${process.env.SMITHABLE_CODER_AREA}/plugin.mjs`,
    `export default {
  key: "newsletter",
  description: "A newsletter visitors subscribe to, on one or more lists.",
  schema: {
    type: "object",
    required: ["from"],
    additionalProperties: false,
    properties: { from: { type: "string" }, lists: { type: "array", items: { type: "string" } } },
  },
  expand(value) {
    const lists = value.lists ?? [];
    return {
      models: {
        Subscriber: {
          description: "Someone who receives the newsletter from " + value.from + ".",
          fields: { email: "email! unique", ...(lists.length > 1 ? { list: lists.join(" | ") } : {}) },
        },
      },
      pages: { subscribers: { crud: "Subscriber", access: ["admin"] } },
    };
  },
  generate(value) {
    return [{ path: "src/generated/plugins/newsletter/sender.ts", content: "export const sender = " + JSON.stringify(value.from) + ";\\n" }];
  },
};
`,
  );
  process.exit(0);
}
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
// A hook runs on the user's next commit, and is not in Git's diff.
if (process.env.FAKE_CODER === "hook")
  writeFileSync(".git/hooks/pre-commit", "#!/bin/sh\necho planted\n", { mode: 0o755 });
