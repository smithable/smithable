// Smithable app kit: the privacy page (docs/design/legal-page.md), written from facts the
// generator takes from the app's own definition, so it stays true as the app changes. The
// operator's details and any words of the maker's own come from the content file.
import { w } from "./words";

export interface LegalFacts {
  app: string;
  /** The app's purpose, from its description. */
  purpose?: string;
  operator?: {
    name?: string;
    address?: string;
    email?: string;
    country?: string;
    hosting?: string;
  };
  /** How people sign in; none for an app without sign-in. */
  signIn?: { email: boolean; google: boolean; invitedOnly: boolean };
  /** Kinds of record with personal details: what they hold and who may read them. */
  records: { label: string; fields: string[]; readers: "visitors" | "members" | string[] }[];
  /** Whether people can upload pictures or documents. */
  uploads: boolean;
  analytics?: { provider: string; consent: boolean };
  /** Kinds of record something happening to which sends a mail. */
  mailAbout: string[];
  /** The maker's own words under the generated text. */
  more?: { title?: string; text?: string };
}

export function LegalPage({ facts, title }: { facts: LegalFacts; title: string }) {
  const o = facts.operator ?? {};
  const providers = [
    ...(facts.signIn?.email ? [w.legalByEmailCode] : []),
    ...(facts.signIn?.google ? [w.legalByGoogle] : []),
  ];
  return (
    <article data-kit="legal" className="mx-auto max-w-3xl space-y-8 px-5 py-12">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">{w.legalIntro(facts.app)}</p>
      </header>
      <Part title={w.legalOperatorTitle}>
        {o.name ? (
          <>
            <p>{w.legalOperator(o.name, facts.app)}</p>
            <p>
              {[o.address, o.country].filter(Boolean).join(", ")}
              {o.email && (
                <>
                  {o.address || o.country ? " · " : ""}
                  <a href={`mailto:${o.email}`} className="underline">
                    {o.email}
                  </a>
                </>
              )}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">{w.legalOperatorUnknown}</p>
        )}
        {facts.purpose && <p>{w.legalPurpose(facts.app, facts.purpose)}</p>}
      </Part>
      {facts.signIn && (
        <Part title={w.legalAccountTitle}>
          <p>{w.legalAccount(providers)}</p>
          {facts.signIn.invitedOnly && <p>{w.legalInvitedOnly}</p>}
        </Part>
      )}
      <Part title={w.legalRecordsTitle}>
        {facts.records.length ? (
          <>
            <p>{w.legalRecordsIntro}</p>
            <ul className="list-disc space-y-1 pl-6">
              {facts.records.map((r) => (
                <li key={r.label}>
                  <strong>{r.label}</strong>: {r.fields.join(", ")}. {w.legalReadBy(r.readers)}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>{w.legalNoRecords}</p>
        )}
        {facts.uploads && <p>{w.legalUploads}</p>}
      </Part>
      <Part title={w.legalCookiesTitle}>
        <p>{facts.signIn ? w.legalCookies : w.legalNoCookies}</p>
        {facts.analytics && (
          <p>
            {facts.analytics.consent
              ? w.legalAnalyticsConsent(facts.analytics.provider)
              : w.legalAnalytics(facts.analytics.provider)}
          </p>
        )}
      </Part>
      {(facts.signIn || facts.mailAbout.length > 0) && (
        <Part title={w.legalMailTitle}>
          {facts.signIn && <p>{w.legalMailSignIn}</p>}
          {facts.mailAbout.length > 0 && <p>{w.legalMailEvents(facts.mailAbout)}</p>}
        </Part>
      )}
      <Part title={w.legalLogsTitle}>
        <p>{w.legalLogs}</p>
        <p>{o.hosting ? w.legalBackupsAt(o.hosting) : w.legalBackups}</p>
      </Part>
      <Part title={w.legalRightsTitle}>
        <p>{w.legalRights(o.email)}</p>
      </Part>
      {facts.more?.text && (
        <Part title={facts.more.title ?? w.legalMoreTitle}>
          <p className="whitespace-pre-line">{facts.more.text}</p>
        </Part>
      )}
    </article>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
