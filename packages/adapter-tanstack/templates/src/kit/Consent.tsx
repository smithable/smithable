// Smithable app kit: the consent bar (docs/design/analytics.md §3). Shown only when something on
// the page asks for consent (afterConsent) and no choice is kept: one sentence, Accept and
// Decline as equal buttons, and the privacy page when the app has one.
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "#/components/ui/button";
import { AppLink } from "./AppLink";
import { choose, consentAsked, consentWanted, onConsentChange, reopenConsent } from "./consent";
import { textMarker } from "./model";
import { w } from "./words";

export interface ConsentTexts {
  text?: string;
  accept?: string;
  decline?: string;
}

/** The choice's state, read only in the browser once the page is hydrated. */
function useConsent<T>(read: () => T, before: T): T {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const value = useSyncExternalStore(onConsentChange, read, () => before);
  return mounted ? value : before;
}

export function Consent({ texts, privacy }: { texts?: ConsentTexts; privacy?: string }) {
  const asked = useConsent(consentAsked, false);
  if (!asked) return null;
  return (
    <section
      aria-label={w.consentTitle}
      data-part="consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 text-sm sm:flex-row sm:items-center">
        <p className="flex-1">
          <span {...textMarker("consent.text")}>{texts?.text ?? w.consentText}</span>
          {privacy && (
            <>
              {" "}
              <AppLink href={privacy} className="underline">
                {w.privacy}
              </AppLink>
            </>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => choose("yes")}>
            <span {...textMarker("consent.accept")}>{texts?.accept ?? w.accept}</span>
          </Button>
          <Button variant="outline" onClick={() => choose("no")}>
            <span {...textMarker("consent.decline")}>{texts?.decline ?? w.decline}</span>
          </Button>
        </div>
      </div>
    </section>
  );
}

/** "Cookie settings": opens the bar again, shown only when something asks for consent. */
export function ConsentSettings({ className }: { className?: string }) {
  const wanted = useConsent(consentWanted, false);
  if (!wanted) return null;
  return (
    <button type="button" onClick={reopenConsent} className={className}>
      {w.cookieSettings}
    </button>
  );
}
