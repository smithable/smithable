// The privacy page (docs/design/legal-page.md): one route rendering the kit's LegalPage from
// facts taken from the spec, the auth file and the context file at generation time, so the page
// says what the app does now. The operator's details are the content file's.
import {
  type AuthIR,
  isUpload,
  modelAccess,
  type PageIR,
  type SpecIR,
  USER_MODEL,
} from "@smithable/core";
import type { GenContext } from "../shared.js";
import {
  code,
  guard,
  HEADER,
  importList,
  indexPath,
  literal,
  names,
  type Texts,
} from "../shared.js";

const ANALYTICS_NAMES: Record<string, string> = {
  plausible: "Plausible",
  umami: "Umami",
  fathom: "Fathom",
  google: "Google Analytics",
};

/** What the page says, from the app itself (the kit's LegalFacts). */
export function legalFacts(ir: SpecIR, auth: AuthIR, t: Texts, ctx: Pick<GenContext, "options">) {
  const everyone = auth.roles.map((r) => r.name);
  const records = ir.models.flatMap((m) => {
    const personal = m.fields.filter(
      (f) =>
        (f.type.kind === "scalar" && ["email", "phone"].includes(f.type.name)) ||
        (f.type.kind === "relation" && f.type.model === USER_MODEL),
    );
    if (!personal.length) return [];
    const read = modelAccess(m, auth).read;
    const readers: "visitors" | "members" | string[] = read.public
      ? "visitors"
      : read.roles.length >= everyone.length
        ? "members"
        : read.roles;
    return [
      {
        label: code(`${names(m, t).ui}.pluralLabel`),
        fields: personal.map((f) => t.field(m, f).label ?? humanLabel(f.name)),
        readers,
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
  return {
    app: code("app.name"),
    ...(ir.app.description ? { purpose: ir.app.description } : {}),
    ...(signIn ? { signIn } : {}),
    records,
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
          .map((o) => ir.models.find((m) => m.name === o.when.model))
          .flatMap((m) => (m ? [t.modelPluralLabel(m).toLowerCase()] : [])),
      ),
    ],
  };
}

/** "mobileNumber" → "mobile number", for a field without a label. */
const humanLabel = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();

export function legalRoute(
  page: PageIR & { pattern: { kind: "legal"; legal: "privacy" } },
  ctx: GenContext,
): string {
  const { ir, auth, t } = ctx;
  const facts = legalFacts(ir, auth, t, ctx);
  const operator = t.section(page.id, "operator") as Record<string, string | undefined>;
  const more = t.section(page.id, "more") as { title?: string; text?: string };
  // The root frames a public page for visitors in the site's layout and for signed-in people in
  // the app's shell (root.ts, visitorRoutes): the page renders itself alone.
  const imports = importList()
    .add("@tanstack/react-router", "createFileRoute")
    .add("#/generated/app", "app")
    .add("#/generated/pages", "pageAccess")
    .add("#/kit/access", "guardPage")
    .add("#/kit/LegalPage", "LegalPage", "type LegalFacts");
  // The records' kinds by their plural, from their modules.
  for (const m of ir.models)
    if (facts.records.some((r) => r.label.text === `${names(m, t).ui}.pluralLabel`))
      imports.add(names(m, t).module, names(m, t).ui);
  const given = Object.fromEntries(Object.entries(operator).filter(([, v]) => v));
  const page_ = `<LegalPage title={${t.pageTitleOf(page.id)}} facts={facts} />`;
  return `${HEADER}${imports.render()}
/** What the page says, from the app's definition when it was generated. */
const facts: LegalFacts = ${literal({
    ...facts,
    ...(Object.keys(given).length ? { operator: given } : {}),
    ...(more.text ? { more } : {}),
  })};

export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${t.head(page)}  component: () => ${page_},
});
`;
}
