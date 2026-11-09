import { type FieldIR, kebab, type ModelIR, type SpecIR } from "@smithable/core";
import { formulaCompiler, formulasName } from "./formulas.js";
import { toldAbout } from "./outgoing.js";
import { dataKey, HEADER, modelNamed, SCHEMA_IMPORT, tableRef } from "./shared.js";

/**
 * Payments (docs/design/payments.md): the app's own part of the kit's flow. For each payments
 * entry, what a successful payment does to its record (unholds it, applies `paid.set` as the app,
 * fires the record's waiting `created` entries and the entry's own outgoing ones) and how a held
 * record nobody paid for is released. The checkout, the provider's word and the hold timer are
 * the kit's (src/kit/payments.server.ts).
 */
export function paymentsServerModule(ir: SpecIR, provider: string): string {
  const formulas = new Set<ModelIR>();
  let usesF = false;
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
    return `  ${p.name}: {
    model: ${JSON.stringify(model.name)},
    created: ${created},
    paid(tx, record) {
      const before = tx.select().from(${table}).where(eq(${table}.id, record)).get();
      if (!before) return false;
      ${tells ? "const row = " : ""}tx
        .update(${table})
        .set({ ${[...(model.heldByPayment ? ["payHeldAt: null"] : []), ...set].join(", ")} })
        .where(eq(${table}.id, record))
        ${tells ? ".returning()\n        .get();" : ".run();"}${
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
  },`;
  });
  const formulaImports = [...formulas].map(
    (m) => `import { ${formulasName(m)} } from "./${kebab(m.name)}.formulas";`,
  );
  const releases = ir.payments.some(
    (p) => p.when === "created" && modelNamed(ir, p.on).heldByPayment,
  );
  return `${HEADER}import { ${releases ? "and, eq, isNotNull" : "eq"} } from "drizzle-orm";
${SCHEMA_IMPORT}
${told.size ? 'import type { Viewer } from "#/kit/access";\n' : ""}${usesF ? 'import { F } from "#/kit/formula";\n' : ""}import type { PaymentEntry } from "#/kit/payments.server";
${told.size ? 'import { outgoing } from "./outgoing.server";\n' : ""}${formulaImports.join("\n")}${formulaImports.length ? "\n" : ""}
/** The provider smithable.context.yml names; the fake when it names none (a release then takes no payments). */
export const PAYMENTS_PROVIDER = ${JSON.stringify(provider)};

${
  told.size
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
export const PAYMENTS_FUNCTIONS = `${HEADER}// Payments (payments.md §4.1–4.2): the return page and the fake provider's page.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { AccessDenied } from "#/kit/access";
import { writeAllowed } from "#/kit/limit";
import { currentViewer } from "#/lib/viewer.server";

const id = z.number().int().positive();

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
    const { status, amount, currency, heldUntil, description } = await bound(data);
    return { status, amount, currency, heldUntil, description };
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

/** The routes: the return page, the fake provider's page, and the provider's address. */
export function paymentRoutes(provider: string): { path: string; content: string }[] {
  const pages = [
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
  return [
    ...pages.filter((p) => provider === "fake" || !p.path.includes("fake")),
    {
      path: `src/routes/incoming/payments-${provider}.ts`,
      content: `${HEADER}import { createFileRoute } from "@tanstack/react-router";
import { receive } from "#/kit/payments.server";

/** The payment provider's calls (payments.md §4.3): verified by its scheme, then applied once. */
export const Route = createFileRoute("/incoming/payments-${provider}")({
  server: {
    handlers: {
      POST: ({ request }) => receive(request, ${JSON.stringify(provider)}),
    },
  },
});
`,
    },
  ];
}
