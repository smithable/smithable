// Part of the TanStack adapter's generator (generate.ts): the hook points of a generated app
// (ARCHITECTURE §6.3). After a record is created, changed or deleted, and once a day, the app
// calls what src/custom/hooks.ts (and a plugin's hooks file) put there: the one place for
// "when this happens, do that", so behavior needs no new construct in the spec.
import type { SpecIR, SpecPlugin } from "@smithable/core";
import { HEADER, names, type Texts } from "./shared.js";

/** Plugins that emit a hooks file in their folder, which the generated hooks import. */
export function pluginsWithHooks(ir: SpecIR, plugins: readonly SpecPlugin[] = []): SpecPlugin[] {
  return plugins.filter((plugin) => {
    const value = ir.extensions?.[plugin.key];
    if (value === undefined || !plugin.generate) return false;
    return plugin
      .generate(value, ir)
      .some((f) => f.path === `src/generated/plugins/${plugin.key}/hooks.ts`);
  });
}

/** src/generated/hooks.ts: the hook types, one per model's row, and what runs them. */
export function hooksModule(ir: SpecIR, t: Texts, plugins: readonly SpecPlugin[] = []): string {
  const models = ir.models.map((m) => ({ model: m, n: names(m, t) }));
  const withHooks = pluginsWithHooks(ir, plugins);
  const tables = models.map(({ n }) => n.table).sort();
  return `${HEADER}// Where the app reacts to changes: after a record is created, changed or deleted, and once a
// day. Your reactions go in src/custom/hooks.ts (send an email, update another record, call a
// service); a plugin's in its own hooks file. A hook runs on the server, in the request that
// made the change and with the viewer who made it, after the change is saved; a hook that
// throws fails that request. Daily jobs run in production, a day after the server started.
import type { ${tables.join(", ")} } from "#/db/schema";
import type { Viewer } from "#/kit/access";
import { log } from "#/kit/log.server";
import * as custom from "#/custom/hooks";
${withHooks.map((p) => `import * as ${p.key.replace(/[^A-Za-z0-9_$]/g, "_")} from "./plugins/${p.key}/hooks";`).join("\n")}${withHooks.length ? "\n" : ""}
export type Hook<Row> = (row: Row, viewer: Viewer | null) => void | Promise<void>;

/** Each model's record as it is stored. */
export interface Rows {
${models.map(({ model, n }) => `  ${model.name}: typeof ${n.table}.$inferSelect;`).join("\n")}
}

export interface Hooks {
  /** After a record is created, by model. */
  afterCreate?: { [M in keyof Rows]?: Hook<Rows[M]> };
  /** After a record is changed, with its new values. */
  afterUpdate?: { [M in keyof Rows]?: Hook<Rows[M]> };
  /** After a record is deleted; only its id is left. */
  afterDelete?: { [M in keyof Rows]?: Hook<{ id: number }> };
  /** Once a day. */
  daily?: (() => void | Promise<void>)[];
}

// Read when a hook runs, not when this module loads: custom code may import the data functions,
// which import this file.
const sources = (): Hooks[] => [custom.hooks${withHooks.map((p) => `, ${p.key.replace(/[^A-Za-z0-9_$]/g, "_")}.hooks`).join("")}];

export async function afterChange<M extends keyof Rows>(
  event: "afterCreate" | "afterUpdate",
  model: M,
  row: Rows[M],
  viewer: Viewer | null,
): Promise<void> {
  for (const source of sources()) {
    // One model's hook at a time: TypeScript cannot narrow the lookup by a generic key.
    const hook = source[event]?.[model] as Hook<Rows[M]> | undefined;
    await hook?.(row, viewer);
  }
}

export async function afterDelete<M extends keyof Rows>(
  model: M,
  id: number,
  viewer: Viewer | null,
): Promise<void> {
  for (const source of sources()) {
    const hook = source.afterDelete?.[model] as Hook<{ id: number }> | undefined;
    await hook?.({ id }, viewer);
  }
}

/** Every daily job, in order; a failing one is reported and the rest still run. */
export async function runDaily(): Promise<void> {
  for (const source of sources())
    for (const job of source.daily ?? []) {
      try {
        await job();
      } catch (error) {
        log.error("A daily job failed", { error });
      }
    }
}

// In production, once a day, starting a day after the server started (pnpm start). The timer
// never keeps the process alive by itself, so the server still stops when asked to.
if (import.meta.env.SSR && import.meta.env.PROD) {
  const day = 24 * 60 * 60 * 1000;
  const tick = () => setTimeout(() => runDaily().finally(tick), day).unref();
  tick();
}
`;
}

/** src/custom/hooks.ts, created once: where the project's reactions go. */
export function hooksStub(): string {
  return `// What happens after records change, and once a day: send an email, update another record,
// call a service. Smithable created this file once and never changes it. The types come from
// src/generated/hooks.ts, so a renamed model or field shows up here as a type error.
// A hook runs on the server after the change is saved, with the viewer who made it. Use the
// data functions in src/generated/*.server.ts to read and write other records with the same
// access checks, and sendMail from src/kit/mail.ts to send mail (SMTP settings from the
// environment; without them mails go to data/mail/outbox). A hook that throws fails the
// request that made the change.
import type { Hooks } from "#/generated/hooks";

export const hooks: Hooks = {
  // afterCreate: {
  //   Order: async (order, viewer) => {
  //     await sendMail({ to: "sales@example.com", subject: "New order " + order.id, text: "…" });
  //   },
  // },
  // daily: [async () => { /* e.g. remind about overdue invoices */ }],
};
`;
}
