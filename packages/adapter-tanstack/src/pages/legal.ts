// The privacy page (docs/design/legal-page.md): one route rendering the kit's LegalPage from
// facts taken from the spec, the auth file and the context file at generation time, so the page
// says what the app does now. The operator's details are the content file's.

import {
  type AuthIR,
  isUpload,
  modelAccess,
  type PageIR,
  personalFields,
  type SpecIR,
} from "@smithable/core";
import { pushEntries, smsEntries } from "../outgoing.js";
import { sha256Hex } from "../sha256.js";
import type { GenContext } from "../shared.js";
import {
  code,
  guard,
  HEADER,
  importList,
  indexPath,
  literal,
  modelNamed,
  names,
  type Texts,
} from "../shared.js";
import { TEMPLATES } from "../templates.gen.js";

const PAYMENT_NAMES: Record<string, string> = { stripe: "Stripe", mollie: "Mollie" };

const ANALYTICS_NAMES: Record<string, string> = {
  plausible: "Plausible",
  umami: "Umami",
  fathom: "Fathom",
  google: "Google Analytics",
};

/** What the page says, from the app itself (the kit's LegalFacts). */
export function legalFacts(
  ir: SpecIR,
  auth: AuthIR,
  t: Texts,
  ctx: Pick<GenContext, "options">,
  page?: string,
) {
  const everyone = auth.roles.map((r) => r.name);
  const own = page ? t.privacy(page) : {};
  const keeps = own.keeps ?? {};
  const records = ir.models.flatMap((m) => {
    const named = keeps[m.name] !== undefined;
    const personal = personalFields(m);
    if (!personal.length && !named) return [];
    // Named by the maker only: every field it holds, by label.
    const listed = personal.length
      ? personal
      : m.fields.filter((f) => !(f.type.kind === "relation" && f.type.many));
    const read = modelAccess(m, auth).read;
    const readers: "visitors" | "members" | string[] = read.public
      ? "visitors"
      : read.roles.length >= everyone.length
        ? "members"
        : read.roles;
    return [
      {
        label: code(`${names(m, t).ui}.pluralLabel`),
        fields: listed.map((f) => t.field(m, f).label ?? humanLabel(f.name)),
        readers,
        ...(named ? { keeps: keeps[m.name] } : {}),
      },
    ];
  });
  const analytics = ctx.options.analytics;
  const signIn =
    auth.signIn === "none"
      ? undefined
      : {
          email: auth.signIn.providers.includes("email"),
          google: auth.signIn.providers.includes("google"),
          invitedOnly: !auth.signIn.selfSignUp,
        };
  const plural = (name: string) => t.modelPluralLabel(modelNamed(ir, name)).toLowerCase();
  // Who gets Ask: visitors too (answered by rule), everyone who signs in, or some roles.
  const asks = auth.assistant;
  const assistant = asks
    ? {
        for:
          asks.for === "anyone"
            ? ("visitors" as const)
            : asks.for === "signed-in"
              ? ("members" as const)
              : asks.for,
        changes: asks.may === "change",
      }
    : undefined;
  // Services the operator set up that records are sent to (an outgoing entry with a target, not
  // one of the built-in channels), by the target's name and what the entry is about.
  const services = ir.outgoing
    .filter((o) => !o.channels)
    .map((o) => ({ name: o.to, about: "model" in o.when ? plural(o.when.model) : undefined }));
  // What comes in: mail that becomes records, and calls from other services.
  // Each with whether it keeps the sender's address (a field the mail's sender goes to).
  const mailInto = ir.incoming.flatMap((i) =>
    i.mail && i.create ? [{ into: plural(i.create), sender: !!i.mail.from }] : [],
  );
  const calls = ir.incoming
    .filter((i) => !i.mail)
    .map((i) => ({ name: i.name, into: i.create ? plural(i.create) : undefined }));
  // What visitors are asked for: the forms anyone may fill in, by their fields' labels.
  const forms = ir.models
    .filter((m) => auth.public.create.includes(m.name))
    .map((m) => ({
      label: code(`${names(m, t).ui}.pluralLabel`),
      fields: m.fields
        .filter((f) => !f.byApp && !f.formula && !(f.type.kind === "relation" && f.type.many))
        .map((f) => t.field(m, f).label ?? humanLabel(f.name)),
    }));
  // The operator's own functions: their custom actions by name, and whether there is custom code.
  const customActions = ir.actions.filter((a) => a.custom).map((a) => a.name);
  const custom =
    customActions.length > 0 ||
    ir.incoming.some((i) => i.custom) ||
    ir.pages.some((p) => p.pattern.kind === "custom") ||
    own.custom !== undefined;
  const payProvider = PAYMENT_NAMES[ctx.options.paymentProvider ?? ""];
  return {
    app: code("app.name"),
    ...(ir.app.description ? { purpose: ir.app.description } : {}),
    ...(signIn ? { signIn } : {}),
    ...(assistant ? { assistant } : {}),
    records,
    ...(forms.length ? { forms } : {}),
    ...(services.length ? { services } : {}),
    ...(mailInto.length ? { mailInto } : {}),
    ...(calls.length ? { calls } : {}),
    ...(custom
      ? { custom: { actions: customActions, ...(own.custom ? { text: own.custom } : {}) } }
      : {}),
    ...(own.services?.length ? { ownServices: own.services } : {}),
    ...(payProvider ? { payProvider } : {}),
    uploads: ir.models.some((m) => m.fields.some(isUpload)),
    ...(analytics
      ? {
          analytics: {
            provider: ANALYTICS_NAMES[analytics.provider] ?? analytics.provider,
            consent: analytics.provider === "google",
          },
        }
      : {}),
    mailAbout: [
      ...new Set(
        ir.outgoing
          .filter((o) => o.to === "mail")
          // A custom action's mail is about the records its input names.
          .flatMap((o) =>
            "model" in o.when
              ? ir.models.filter((m) => "model" in o.when && m.name === o.when.model)
              : ir.models.filter((m) =>
                  ir.actions
                    .find((a) => "custom" in o.when && a.name === o.when.custom)
                    ?.input.some((f) => f.type.kind === "relation" && f.type.model === m.name),
                ),
          )
          .map((m) => t.modelPluralLabel(m).toLowerCase()),
      ),
    ],
    // Payments (payments.md): what is paid for on the provider's page.
    ...(ir.payments.length
      ? {
          payAbout: [
            ...new Set(
              ir.payments.map((p) => t.modelPluralLabel(modelNamed(ir, p.on)).toLowerCase()),
            ),
          ],
        }
      : {}),
    // Texts (notifications.md §5): what they are about.
    ...(smsEntries(ir, auth).length
      ? {
          smsAbout: [
            ...new Set(
              smsEntries(ir, auth).flatMap((o) =>
                "model" in o.when
                  ? ir.models
                      .filter((m) => "model" in o.when && m.name === o.when.model)
                      .map((m) => t.modelPluralLabel(m).toLowerCase())
                  : [],
              ),
            ),
          ],
        }
      : {}),
    // Browser push (notifications.md §4): what it is about, named with the services it goes through.
    ...(pushEntries(ir, auth).length
      ? {
          pushAbout: [
            ...new Set(
              pushEntries(ir, auth).flatMap((o) =>
                "model" in o.when
                  ? ir.models
                      .filter((m) => "model" in o.when && m.name === o.when.model)
                      .map((m) => t.modelPluralLabel(m).toLowerCase())
                  : [],
              ),
            ),
          ],
        }
      : {}),
  };
}

/** "mobileNumber" → "mobile number", for a field without a label. */
const humanLabel = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();

type LegalPageIR = PageIR & { pattern: { kind: "legal"; legal: "privacy" } };

/**
 * What the page describes, as the project's files give it (§6.4): the facts frozen into the
 * route, with the operator's details and the maker's own parts; not the review record itself.
 */
export function privacyFacts(page: LegalPageIR, ctx: GenContext) {
  const { ir, auth, t } = ctx;
  const facts = legalFacts(ir, auth, t, ctx, page.id);
  const operator = t.section(page.id, "operator") as Record<string, string | undefined>;
  const more = t.section(page.id, "more") as { title?: string; text?: string };
  const given = Object.fromEntries(Object.entries(operator).filter(([, v]) => v));
  return {
    ...facts,
    ...(Object.keys(given).length ? { operator: given } : {}),
    ...(more.text ? { more } : {}),
  };
}

/** The page's sentences in the app's language, as the kit's words file writes them (legal*). */
function legalSentences(language: string): string {
  // The kit's own default (English) for a language it has no file for, as it falls back itself.
  const source = TEMPLATES[`src/kit/words/${language}.ts`] ?? TEMPLATES["src/kit/words/en.ts"] ?? "";
  const kept: string[] = [];
  let on = false;
  for (const line of source.split("\n")) {
    const key = /^ {2}([A-Za-z]+)\s*:/.exec(line)?.[1];
    if (key) on = key.startsWith("legal");
    else if (/^ {2}\/\*\*|^\}/.test(line)) on = false;
    if (on) kept.push(line);
  }
  return kept.join("\n");
}

/** A value as JSON with its keys sorted, so the same facts always write the same text. */
const sorted = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(sorted)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value as object)
            .sort()
            .map((k) => [k, sorted((value as Record<string, unknown>)[k])]),
        )
      : value;

/**
 * The fingerprint of what the owner reviews (§6.4): SHA-256 over the facts as JSON with sorted
 * keys, a line end, and the sentences the page uses in the app's language; sixteen hex digits.
 */
export function privacyFingerprint(page: LegalPageIR, ctx: GenContext): string {
  const text = `${JSON.stringify(sorted(privacyFacts(page, ctx)))}\n${legalSentences(ctx.t.language)}`;
  return sha256Hex(text).slice(0, 16);
}

export function legalRoute(
  page: PageIR & { pattern: { kind: "legal"; legal: "privacy" } },
  ctx: GenContext,
): string {
  const { ir, t } = ctx;
  const facts = privacyFacts(page, ctx);
  // The review line, only while the facts are the ones reviewed (§6.4).
  const reviewed = t.privacy(page.id).reviewed;
  const reviewedOn =
    reviewed && reviewed.facts === privacyFingerprint(page, ctx) ? reviewed.on : undefined;
  // The root frames a public page for visitors in the site's layout and for signed-in people in
  // the app's shell (root.ts, visitorRoutes): the page renders itself alone.
  const imports = importList()
    .add("@tanstack/react-router", "createFileRoute")
    .add("#/generated/app", "app")
    .add("#/generated/pages", "pageAccess")
    .add("#/kit/page-guard", "guardPage")
    .add("#/kit/LegalPage", "LegalPage", "type LegalFacts");
  // The records' kinds by their plural, from their modules.
  for (const m of ir.models)
    if (facts.records.some((r) => r.label.text === `${names(m, t).ui}.pluralLabel`))
      imports.add(names(m, t).module, names(m, t).ui);
  // What only the running app knows (§6.1): read when the page is shown, never frozen in.
  const ai = Boolean(facts.assistant);
  const sms = Boolean(facts.smsAbout);
  const running = ai || sms;
  if (running) imports.add("@tanstack/react-start", "createServerFn");
  if (ai) imports.add("#/kit/assistant.server", "aiFacts");
  if (sms) imports.add("#/kit/sms.server", "smsProvider");
  const page_ = `<LegalPage title={${t.pageTitleOf(page.id)}} facts={facts}${running ? " running={Route.useLoaderData()}" : ""} />`;
  return `${HEADER}${imports.render()}
/** What the page says, from the app's definition when it was generated. */
const facts: LegalFacts = ${literal({ ...facts, ...(reviewedOn ? { reviewedOn } : {}) })};

${
  running
    ? `
/** What the app is set up with now: the AI model's provider and region, the SMS provider. */
const runningFacts = createServerFn().handler(async () => ({${ai ? "\n  ai: aiFacts()," : ""}${sms ? "\n  sms: smsProvider()," : ""}
}));
`
    : ""
}
export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${t.head(page)}${running ? "  loader: () => runningFacts(),\n" : ""}  component: () => ${page_},
});
`;
}
