// Smithable app kit: the privacy page (docs/design/legal-page.md), written from facts the
// generator takes from the app's own definition, so it stays true as the app changes. The
// operator's details and any words of the maker's own come from the content file.

import { contactHref } from "./contact-href";
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
  /** Ask, the assistant in the app: who gets it, and whether it may propose changes. */
  assistant?: { for: "visitors" | "members" | string[]; changes: boolean };
  /** Kinds of record with personal details: what they hold and who may read them. */
  records: {
    label: string;
    fields: string[];
    readers: "visitors" | "members" | string[];
    /** How long they are kept, in the maker's words; unsaid, until removed or asked for. */
    keeps?: string;
  }[];
  /** Whether people can upload pictures or documents. */
  uploads: boolean;
  analytics?: { provider: string; consent: boolean };
  /** Kinds of record something happening to which sends a mail. */
  mailAbout: string[];
  /** Kinds of record a browser push is about, for those who turn it on (notifications.md §4). */
  pushAbout?: string[];
  /** Kinds of record a text is about (notifications.md §5). */
  smsAbout?: string[];
  /** Kinds of record paid for on the payment provider's page (payments.md). */
  payAbout?: string[];
  /** The payment provider, by name, when the app's settings name one. */
  payProvider?: string;
  /** The forms anyone may fill in, by their fields' labels. */
  forms?: { label: string; fields: string[] }[];
  /** Services the operator set up that records are sent to, and what about. */
  services?: { name: string; about?: string }[];
  /** Kinds of record that mail sent to the app's address becomes, and whether the sender is kept. */
  mailInto?: { into: string; sender: boolean }[];
  /** Calls from other services, and the kind of record each becomes (none: the operator's own code). */
  calls?: { name: string; into?: string }[];
  /** The operator's own functions: custom actions by name, or other custom code; the maker's words on them. */
  custom?: { actions: string[]; text?: string };
  /** Other services the operator uses that the files do not show, in the maker's words. */
  ownServices?: { name: string; for?: string; where?: string }[];
  /** The day the operator reviewed this description, while it is the one reviewed (§6.4). */
  reviewedOn?: string;
  /** The maker's own words under the generated text. */
  more?: { title?: string; text?: string };
}

/**
 * What only the running app knows (legal-page.md §6.1), read when the page is shown: the AI
 * model's provider and region (null: no model is set up), the SMS provider (null: none set).
 */
export interface RunningFacts {
  ai?: { provider?: string; region?: string } | null;
  sms?: string | null;
}

export function LegalPage({
  facts,
  title,
  running,
}: {
  facts: LegalFacts;
  title: string;
  running?: RunningFacts;
}) {
  const o = facts.operator ?? {};
  const providers = [
    ...(facts.signIn?.email ? [w.legalByEmailCode] : []),
    ...(facts.signIn?.google ? [w.legalByGoogle] : []),
  ];
  return (
    <article data-kit="legal" className="mx-auto max-w-3xl space-y-8 px-5 py-12">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">{title}</h1>
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
                  <a href={contactHref(`mailto:${o.email}`, o.email)} className="underline">
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
          {facts.signIn.google && <p>{w.legalGoogle}</p>}
          {facts.signIn.invitedOnly && <p>{w.legalInvitedOnly}</p>}
        </Part>
      )}
      {facts.assistant && (
        <Part title={w.legalAssistantTitle}>
          <p>{w.legalAssistant(facts.assistant.for, facts.assistant.changes)}</p>
          {running?.ai === null && <p>{w.legalNoModelNow}</p>}
          {running?.ai?.provider && (
            <p>{w.legalModelNow(running.ai.provider, running.ai.region)}</p>
          )}
        </Part>
      )}
      <Part title={w.legalRecordsTitle}>
        {facts.records.length ? (
          <>
            <p>{w.legalRecordsIntro}</p>
            <ul className="list-disc space-y-1 pl-6">
              {facts.records.map((r) => (
                <li key={r.label}>
                  <strong>{r.label}</strong>: {r.fields.join(", ")}. {w.legalReadBy(r.readers)}{" "}
                  {r.keeps ? w.legalKeeps(r.keeps) : w.legalKeptUntil}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>{w.legalNoRecords}</p>
        )}
        {facts.uploads && <p>{w.legalUploads}</p>}
      </Part>
      {facts.forms && (
        <Part title={w.legalFormsTitle}>
          <p>{w.legalFormsIntro}</p>
          <ul className="list-disc space-y-1 pl-6">
            {facts.forms.map((f) => (
              <li key={f.label}>
                <strong>{f.label}</strong>: {f.fields.join(", ")}.
              </li>
            ))}
          </ul>
        </Part>
      )}
      {(facts.mailInto || facts.calls) && (
        <Part title={w.legalIncomingTitle}>
          {facts.mailInto && <p>{w.legalMailInto(facts.mailInto)}</p>}
          {facts.calls && <p>{w.legalCalls(facts.calls)}</p>}
        </Part>
      )}
      {(facts.services || facts.ownServices) && (
        <Part title={w.legalServicesTitle}>
          {facts.services && <p>{w.legalServices(facts.services)}</p>}
          {facts.ownServices && (
            <>
              <p>{w.legalOwnServices}</p>
              <ul className="list-disc space-y-1 pl-6">
                {facts.ownServices.map((s) => (
                  <li key={s.name}>
                    <strong>{s.name}</strong>
                    {s.for ? `: ${s.for}` : ""}
                    {s.where ? ` (${s.where})` : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Part>
      )}
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
      {facts.payAbout && (
        <Part title={w.legalPayTitle}>
          <p>{w.legalPay(facts.payAbout, facts.payProvider)}</p>
        </Part>
      )}
      {facts.smsAbout && (
        <Part title={w.legalSmsTitle}>
          <p>{w.legalSms(facts.smsAbout)}</p>
          {running?.sms && <p>{w.legalSmsNow(running.sms)}</p>}
        </Part>
      )}
      {facts.pushAbout && (
        <Part title={w.legalPushTitle}>
          <p>{w.legalPush(facts.pushAbout)}</p>
        </Part>
      )}
      {facts.custom && (
        <Part title={w.legalCustomTitle}>
          <p>{w.legalCustom(facts.custom.actions, Boolean(facts.custom.text))}</p>
          {facts.custom.text && <p className="whitespace-pre-line">{facts.custom.text}</p>}
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
      {facts.reviewedOn && (
        <p className="text-sm text-muted-foreground">{w.legalReviewed(facts.reviewedOn)}</p>
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
