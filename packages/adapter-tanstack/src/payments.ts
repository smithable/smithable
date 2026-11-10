import { type FieldIR, kebab, type ModelIR, type SpecIR, titleField } from "@smithable/core";
import { aggregatedLists, formulaCompiler, formulasName, withFormulasName } from "./formulas.js";
import { toldAbout } from "./outgoing.js";
import {
  dataKey,
  HEADER,
  modelNamed,
  names,
  SCHEMA_IMPORT,
  type Texts,
  tableNames,
  tableRef,
} from "./shared.js";

/**
 * Payments (docs/design/payments.md): the app's own part of the kit's flow. For each payments
 * entry, what a successful payment does to its record (unholds it, applies `paid.set` as the app,
 * fires the record's waiting `created` entries and the entry's own outgoing ones) and how a held
 * record nobody paid for is released. The checkout, the provider's word and the hold timer are
 * the kit's (src/kit/payments.server.ts).
 */
export function paymentsServerModule(ir: SpecIR, provider: string): string {
  const formulas = new Set<ModelIR>();
  const withFormulas = new Set<ModelIR>();
  let usesF = false;
  let usesFits = false;
  const told = new Set<string>();
  const entries = ir.payments.map((p) => {
    const model = modelNamed(ir, p.on);
    const table = tableRef(model);
    const created = p.when === "created";
    const { compile, stored, imports } = formulaCompiler(model, ir);
    const set = (p.paid?.set ?? []).flatMap((v) => {
      const field = model.fields.find((f) => f.name === v.field) as FieldIR | undefined;
      if (!field || "asked" in v || "me" in v) return [];
      const scalar = field.type.kind === "scalar" ? field.type.name : field.type.kind;
      let code: string;
      if ("formula" in v) {
        usesF = true;
        code = stored(field, compile(v.formula, model, "before"));
      } else
        code =
          scalar === "money" ? String(Math.round(Number(v.value) * 100)) : JSON.stringify(v.value);
      return [`${dataKey(field)}: ${scalar === "datetime" ? `new Date(${code})` : code}`];
    });
    for (const m of imports) formulas.add(m);
    const tells = toldAbout(ir, model.name);
    if (tells) told.add(model.name);
    // What points to a held record (an order's lines) goes with it when it is released.
    const children = ir.models.flatMap((m) =>
      m.fields
        .filter((f) => f.type.kind === "relation" && !f.type.many && f.type.model === model.name)
        .map(
          (f) => `tx.delete(${tableRef(m)}).where(eq(${tableRef(m)}.${dataKey(f)}, record)).run();`,
        ),
    );
    const changes = [...(model.heldByPayment ? ["payHeldAt: null"] : []), ...set];
    const amount = model.fields.find((f) => f.name === p.amount) as FieldIR;
    const when = p.when === "created" ? undefined : p.when;
    // Paying for an existing record: it must still ask, for the amount paid (§4.3, §4.6).
    const lists = aggregatedLists(model);
    if (when) {
      usesFits = true;
      if (amount.formula) withFormulas.add(model);
    }
    const asks = when
      ? `
      if (!fits(${JSON.stringify(when)}, before)) return "the record no longer asks";
      const now = ${
        amount.formula
          ? `${withFormulasName(model)}(tx.query.${tableNames(model).table}.findFirst({ where: eq(${table}.id, record)${lists.length ? `, with: { ${lists.map((l) => `${l}: true`).join(", ")} }` : ""} }).sync() ?? before)`
          : "before"
      };
      if (Math.round(Number(now.${dataKey(amount)} ?? 0)) !== amount) return "amount differs";`
      : "";
    return `  ${p.name}: {
    model: ${JSON.stringify(model.name)},
    created: ${created},
    amount: ${JSON.stringify(dataKey(amount))},${when ? `\n    when: ${JSON.stringify(when)},` : ""}${p.refund ? `\n    refund: ${JSON.stringify(p.refund)},` : ""}
    paid(tx, record${when ? ", amount" : ""}) {
      const before = tx.select().from(${table}).where(eq(${table}.id, record)).get();
      if (!before) return "the record is gone";${asks}
      ${
        changes.length
          ? `${tells ? "const row = " : ""}tx
        .update(${table})
        .set({ ${changes.join(", ")} })
        .where(eq(${table}.id, record))
        ${tells ? ".returning()\n        .get();" : ".run();"}`
          : tells
            ? "// Nothing to set: the Payment line says it is paid.\n      const row = before;"
            : ""
      }${
        tells
          ? `${created ? `\n      // Its own "created" was waiting for the payment (payments.md §3.2).\n      outgoing(tx, APP, ${JSON.stringify(model.name)}, "created", row);` : ""}
      outgoing(tx, APP, ${JSON.stringify(model.name)}, ${JSON.stringify(`payment:${p.name}`)}, row, before);`
          : ""
      }
      return true;
    },
    release(${created ? "tx, record" : "_tx, _record"}) {${
      created && model.heldByPayment
        ? `
      if (!tx.select({ id: ${table}.id }).from(${table}).where(and(eq(${table}.id, record), isNotNull(${table}.payHeldAt))).get()) return;${children.map((c) => `\n      ${c}`).join("")}
      tx.delete(${table}).where(eq(${table}.id, record)).run();`
        : ""
    }
    },
    read(tx, record) {
      return tx.select().from(${table}).where(eq(${table}.id, record)).get();
    },${
      created && model.heldByPayment
        ? `
    async after(record) {
      // Its own afterCreate waited for the payment, as its "created" mail did.
      const row = db.select().from(${table}).where(eq(${table}.id, record)).get();
      if (row) await afterChange("afterCreate", ${JSON.stringify(model.name)}, row, APP);
    },`
        : ""
    }
  },`;
  });
  const formulaImports = [...new Set([...formulas, ...withFormulas])].map(
    (m) =>
      `import { ${[...(formulas.has(m) ? [formulasName(m)] : []), ...(withFormulas.has(m) ? [withFormulasName(m)] : [])].join(", ")} } from "./${kebab(m.name)}.formulas";`,
  );
  const releases = ir.payments.some(
    (p) => p.when === "created" && modelNamed(ir, p.on).heldByPayment,
  );
  return `${HEADER}import { ${releases ? "and, eq, isNotNull" : "eq"} } from "drizzle-orm";
${SCHEMA_IMPORT}
${releases ? 'import { db } from "#/db";\n' : ""}${told.size || releases ? 'import type { Viewer } from "#/kit/access";\n' : ""}${usesF ? 'import { F } from "#/kit/formula";\n' : ""}${usesFits ? 'import { fits } from "#/kit/model";\n' : ""}import type { PaymentEntry } from "#/kit/payments.server";
${releases ? 'import { afterChange } from "./hooks";\n' : ""}${told.size ? 'import { outgoing } from "./outgoing.server";\n' : ""}${formulaImports.join("\n")}${formulaImports.length ? "\n" : ""}
/** The provider smithable.context.yml names; the fake when it names none (a release then takes no payments). */
export const PAYMENTS_PROVIDER = ${JSON.stringify(provider)};

${
  told.size || releases
    ? `/** The app itself, as a payment is recorded: no role's grants apply. */
const APP: Viewer = { id: "payments", name: "", email: "", role: "", system: true };
`
    : ""
}
export const PAYMENT_ENTRIES: Record<string, PaymentEntry> = {
${entries.join("\n")}
};
`;
}

/** The pay-to-create entry of a model, if its records are paid to be made. */
export const payToCreate = (ir: SpecIR, model: ModelIR) =>
  ir.payments.find((p) => p.on === model.name && p.when === "created");

/**
 * src/generated/payments.ts: the server functions of the return page and the fake provider's
 * page. Each answers the browser that started the payment only (a cookie bound to the Payment).
 */
export function paymentsFunctions(ir: SpecIR, t: Texts): string {
  // Each entry's record, read as the viewer may (its access and its condition of reading), and
  // what the payer sees at the provider.
  const readers = ir.payments.map((p) => {
    const model = modelNamed(ir, p.on);
    const n = names(model, t);
    return `  ${p.name}: async (viewer, id) => (await import("${n.module}.server")).${n.data}.get(viewer, id),`;
  });
  const describers = ir.payments.map((p) => {
    const model = modelNamed(ir, p.on);
    return `  ${p.name}: (row) => ${describeCode(model, p.description, "row", titleField(model))},`;
  });
  return `${HEADER}// Payments (payments.md §4.1–4.2, §4.4): Pay and Refund, the return page and the fake provider's page.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { AccessDenied, type Viewer } from "#/kit/access";
import { writeAllowed } from "#/kit/limit";
import { currentViewer } from "#/lib/viewer.server";

const id = z.number().int().positive();

type Row = Record<string, unknown> & { id: number };
const READ: Record<string, (viewer: Viewer | null, id: number) => Promise<Row | null>> = {
${readers.join("\n")}
};
// biome-ignore lint/suspicious/noExplicitAny: a record's fields, as its data module reads them
const DESCRIBE: Record<string, (row: any) => string> = {
${describers.join("\n")}
};

async function writer() {
  const viewer = await currentViewer();
  writeAllowed(viewer, getRequestHeaders());
  return viewer;
}

/** Pay on an existing record that asks for it (§4.1): on to the provider's page. */
export const payRecord = createServerFn({ method: "POST" })
  .validator(z.object({ entry: z.string().max(80), id }))
  .handler(async ({ data }) => {
    const viewer = await writer();
    const read = READ[data.entry];
    const row = read && (await read(viewer, data.id));
    if (!row) throw new AccessDenied(viewer !== null);
    const { startPayment } = await import("#/kit/payments.server");
    return startPayment(data.entry, row, DESCRIBE[data.entry]?.(row) ?? "");
  });

/** The Payments page's rows, for admins and the refund roles (§3.3). */
export const listPayments = createServerFn()
  .validator(z.enum(["pending", "paid", "failed", "refunding", "refunded"]).optional())
  .handler(async ({ data: status }) => {
    const { allPayments } = await import("#/kit/payments.server");
    const rows = allPayments(await currentViewer(), status);
    if (!rows) throw new AccessDenied(false);
    return rows;
  });

/** Refund a paid payment in full (§4.4), for admins and the entry's refund roles. */
export const refundPayment = createServerFn({ method: "POST" })
  .validator(id)
  .handler(async ({ data }) => {
    const viewer = await writer();
    const { mayRefund, paymentRow, refund } = await import("#/kit/payments.server");
    const payment = paymentRow(data);
    // The record as the viewer may read it, for the entry's refund condition; money that came for
    // nothing may be refunded when the record is gone.
    const row = payment && (await READ[payment.entry]?.(viewer, payment.record));
    if (!payment || !mayRefund(viewer, payment, row ?? undefined)) throw new AccessDenied(viewer !== null);
    await refund(data, viewer);
  });

async function bound(payment: number) {
  const { boundBrowser, paymentState } = await import("#/kit/payments.server");
  const state = paymentState(payment);
  if (!state || !boundBrowser(payment)) throw new AccessDenied(false);
  return state;
}

/** The Payment's state as the app knows it, for the browser that started it. */
export const paymentBack = createServerFn()
  .validator(id)
  .handler(async ({ data }) => {
    const { status, amount, currency, heldUntil, description, note } = await bound(data);
    // Money that came for nothing (the wrong amount, after the hold): said so, not "paid".
    return { status, amount, currency, heldUntil, description, unmatched: status === "paid" && Boolean(note) };
  });

/** Pay again after coming back: the same checkout while it is open. */
export const payAgain = createServerFn({ method: "POST" })
  .validator(id)
  .handler(async ({ data }) => {
    writeAllowed(await currentViewer(), getRequestHeaders());
    await bound(data);
    const { checkout } = await import("#/kit/payments.server");
    return checkout(data);
  });

/** What the fake provider's page shows. */
export const fakeCheckout = createServerFn()
  .validator(id)
  .handler(async ({ data }) => {
    const { provider } = await import("#/kit/payments.server");
    if (provider()?.name !== "fake") throw new AccessDenied(false);
    const { status, amount, currency, description } = await bound(data);
    return { status, amount, currency, description };
  });

/** The fake provider's event for Approve or Decline, signed, which its page posts to the payments address. */
export const fakeEvent = createServerFn({ method: "POST" })
  .validator(z.object({ id, kind: z.enum(["paid", "failed"]) }))
  .handler(async ({ data }) => {
    writeAllowed(await currentViewer(), getRequestHeaders());
    const { fakeSign, provider } = await import("#/kit/payments.server");
    if (provider()?.name !== "fake") throw new AccessDenied(false);
    const state = await bound(data.id);
    const { randomUUID } = await import("node:crypto");
    const body = JSON.stringify({
      id: randomUUID(),
      payment: data.id,
      kind: data.kind,
      amount: state.amount,
      currency: state.currency,
      mode: "test",
      ...(data.kind === "failed" ? { reason: "declined" } : {}),
    });
    return { body, signature: fakeSign(body) };
  });
`;
}

/** The routes: the return page, the fake provider's page, and the provider's address. */
export function paymentRoutes(provider: string): { path: string; content: string }[] {
  const pages = [
    {
      path: "src/routes/payments/index.tsx",
      content: `${HEADER}import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { app } from "#/generated/app";
import { listPayments, refundPayment } from "#/generated/payments";
import { PaymentsPage } from "#/kit/PaymentsPage";

type Status = "pending" | "paid" | "failed" | "refunding" | "refunded";
const STATES: string[] = ["pending", "paid", "failed", "refunding", "refunded"];

export const Route = createFileRoute("/payments/")({
  validateSearch: (search: Record<string, unknown>): { status?: Status } =>
    STATES.includes(String(search.status)) ? { status: search.status as Status } : {},
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listPayments({ data: deps.status }),
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: PaymentsRoute,
});

function PaymentsRoute() {
  const { status } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  return (
    <PaymentsPage
      rows={Route.useLoaderData()}
      status={status}
      timeZone={app.timeZone}
      choose={(next) => navigate({ to: "/payments", search: next ? { status: next as Status } : {} })}
      refund={async (payment) => {
        await refundPayment({ data: payment });
        await router.invalidate();
      }}
    />
  );
}
`,
    },
    {
      path: "src/routes/payments/$id.back.tsx",
      content: `${HEADER}import { createFileRoute } from "@tanstack/react-router";
import { paymentBack, payAgain } from "#/generated/payments";
import { PaymentBack } from "#/kit/PaymentBack";

export const Route = createFileRoute("/payments/$id/back")({
  loader: ({ params }) => paymentBack({ data: Number(params.id) }),
  component: BackRoute,
});

function BackRoute() {
  const { id } = Route.useParams();
  return (
    <PaymentBack
      payment={Route.useLoaderData()}
      refresh={() => paymentBack({ data: Number(id) })}
      payAgain={() => payAgain({ data: Number(id) })}
    />
  );
}
`,
    },
    {
      path: "src/routes/payments/fake.$id.tsx",
      content: `${HEADER}import { createFileRoute } from "@tanstack/react-router";
import { fakeCheckout, fakeEvent } from "#/generated/payments";
import { FakeCheckout } from "#/kit/FakeCheckout";

export const Route = createFileRoute("/payments/fake/$id")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  loader: ({ params }) => fakeCheckout({ data: Number(params.id) }),
  component: FakeRoute,
});

function FakeRoute() {
  const { id } = Route.useParams();
  return (
    <FakeCheckout
      id={Number(id)}
      payment={Route.useLoaderData()}
      sign={(kind) => fakeEvent({ data: { id: Number(id), kind } })}
    />
  );
}
`,
    },
  ];
  // The fake's page and address for every provider: a copy that reaches none (PAYMENTS_FAKE=on, a
  // staging copy) previews the flow with it; elsewhere they refuse (the fake is not ready there).
  const incoming = (name: string) => ({
    path: `src/routes/incoming/payments-${name}.ts`,
    content: `${HEADER}import { createFileRoute } from "@tanstack/react-router";
import { receive } from "#/kit/payments.server";

/** The payment provider's calls (payments.md §4.3): verified by its scheme, then applied once. */
export const Route = createFileRoute("/incoming/payments-${name}")({
  server: {
    handlers: {
      POST: ({ request }) => receive(request, ${JSON.stringify(name)}),
    },
  },
});
`,
  });
  return [...pages, ...[...new Set([provider, "fake"])].map(incoming)];
}

/**
 * What the payer sees at the provider, as code over `row`: the entry's text with the record's
 * fields, or its title. Literal text is escaped, so a description cannot break the code.
 */
export function describeCode(
  model: ModelIR,
  text: string | undefined,
  row: string,
  titleKey: string | undefined,
): string {
  const value = (name: string) => {
    const field = model.fields.find((x) => x.name === name);
    if (!field || field.type.kind === "relation") return undefined;
    const read = `${row}.${dataKey(field)}`;
    return field.type.kind === "scalar" && field.type.name === "money"
      ? `\${(Number(${read} ?? 0) / 100).toFixed(2)}`
      : `\${String(${read} ?? "")}`;
  };
  if (!text)
    return titleKey && titleKey !== "id" ? `String(${row}.${titleKey} ?? "")` : `String(${row}.id)`;
  const filled = text
    .replace(/[\\`$]/g, (c) => `\\${c}`)
    .replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (all, name: string) => value(name) ?? all);
  return `\`${filled}\``;
}
