// Smithable app kit: the visitor's yes or no to what the app does not need to work, such as
// Google Analytics or a map embedded by custom code (docs/design/analytics.md). The choice is
// kept in this browser for a year; nothing waiting for it runs before a yes.

const KEY = "consent";
const YEAR = 365 * 24 * 60 * 60 * 1000;

type Choice = "yes" | "no";

const waiting: (() => void)[] = [];
const listeners = new Set<() => void>();
let wanted = false;
let reopened = false;

function changed() {
  for (const listener of listeners) listener();
}

/** The visitor's choice, if they made one within the year. */
export function consentChoice(): Choice | undefined {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? "null") as {
      choice?: string;
      at?: string;
    };
    if (
      (kept?.choice === "yes" || kept?.choice === "no") &&
      Date.now() - Date.parse(kept.at ?? "") < YEAR
    )
      return kept.choice;
  } catch {
    // No storage (a private window, blocked site data): asked on every visit.
  }
  return undefined;
}

/** Keeps the visitor's choice; a yes runs what was waiting for it. */
export function choose(choice: Choice) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ choice, at: new Date().toISOString() }));
  } catch {
    // Kept for this page only.
  }
  reopened = false;
  if (choice === "yes") for (const run of waiting.splice(0)) run();
  changed();
}

/**
 * Runs `run` once the visitor has said yes: at once if they have, when they do, else never.
 * Calling it is what makes the consent bar appear.
 */
export function afterConsent(run: () => void) {
  if (typeof window === "undefined") return;
  wanted = true;
  if (consentChoice() === "yes") run();
  else waiting.push(run);
  changed();
}

/** Whether the bar is to be shown: something asks and no choice is kept, or it was reopened. */
export function consentAsked(): boolean {
  return wanted && (reopened || consentChoice() === undefined);
}

/** Whether anything on this page asks for consent (the "Cookie settings" link is shown). */
export function consentWanted(): boolean {
  return wanted;
}

/** Shows the bar again, so a yes can be taken back ("Cookie settings"). */
export function reopenConsent() {
  reopened = true;
  changed();
}

export function onConsentChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A counter of visits (the app's analytics setting), as the generator describes it. */
export interface Analytics {
  /** The provider's script. */
  src: string;
  /** Its data attributes, e.g. { domain: "shop.example.com" }. */
  data: Record<string, string>;
  /** Whether it waits for a yes. */
  consent: boolean;
  /** Google's measurement id: its dataLayer is set up before the script. */
  gtag?: string;
}

/** Loads the counter in a production build, after a yes when it needs one. */
export function startAnalytics(analytics: Analytics) {
  if (!import.meta.env.PROD) return;
  const load = () => {
    if (analytics.gtag) {
      const page = window as unknown as {
        dataLayer: unknown[];
        gtag: (...args: unknown[]) => void;
      };
      page.dataLayer = page.dataLayer || [];
      page.gtag = function gtag() {
        // gtag.js reads each call's arguments object, not an array.
        // biome-ignore lint/complexity/noArguments: Google's documented snippet
        page.dataLayer.push(arguments);
      };
      page.gtag("js", new Date());
      page.gtag("config", analytics.gtag);
    }
    const script = document.createElement("script");
    script.src = analytics.src;
    script.defer = true;
    Object.assign(script.dataset, analytics.data);
    document.head.append(script);
  };
  if (analytics.consent) afterConsent(load);
  else load();
}
