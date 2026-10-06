// The counter of visits smithable.context.yml names (docs/design/analytics.md): each provider's
// script and the addresses the app's Content-Security-Policy must allow for it, nothing more.
import { ANALYTICS, type AnalyticsSetting } from "@smithable/core";

interface Provider {
  src: (id: string) => string;
  data: (id: string) => Record<string, string>;
  script: string[];
  connect: string[];
  img: string[];
}

const PROVIDERS: Record<AnalyticsSetting["provider"], Provider> = {
  plausible: {
    src: () => "https://plausible.io/js/script.js",
    data: (id) => ({ domain: id }),
    script: ["https://plausible.io"],
    connect: ["https://plausible.io"],
    img: [],
  },
  umami: {
    src: () => "https://cloud.umami.is/script.js",
    data: (id) => ({ websiteId: id }),
    script: ["https://cloud.umami.is"],
    connect: ["https://cloud.umami.is", "https://api-gateway.umami.dev"],
    img: [],
  },
  fathom: {
    src: () => "https://cdn.usefathom.com/script.js",
    data: (id) => ({ site: id }),
    script: ["https://cdn.usefathom.com"],
    connect: ["https://cdn.usefathom.com"],
    img: ["https://cdn.usefathom.com"],
  },
  // Google's own list for a Content-Security-Policy with Google Analytics 4.
  google: {
    src: (id) => `https://www.googletagmanager.com/gtag/js?id=${id}`,
    data: () => ({}),
    script: ["https://*.googletagmanager.com"],
    connect: [
      "https://*.google-analytics.com",
      "https://*.analytics.google.com",
      "https://*.googletagmanager.com",
    ],
    img: ["https://*.google-analytics.com", "https://*.googletagmanager.com"],
  },
};

/** The root route's constants for the counter: what startAnalytics loads, what the CSP allows. */
export function analyticsConstants(analytics: AnalyticsSetting): string {
  const p = PROVIDERS[analytics.provider];
  const consent = ANALYTICS[analytics.provider].consent;
  const load = {
    src: p.src(analytics.id),
    data: p.data(analytics.id),
    consent,
    ...(analytics.provider === "google" ? { gtag: analytics.id } : {}),
  };
  const allow = Object.fromEntries(
    (["script", "connect", "img"] as const).filter((k) => p[k].length).map((k) => [k, p[k]]),
  );
  return `/** Counting visits (smithable.context.yml analytics): in a production build only${consent ? ", after a yes" : ""}. */
const analytics: Analytics = ${JSON.stringify(load)};
/** The addresses the counter loads from and reports to, allowed by the page's policy. */
const analyticsAllow = ${JSON.stringify(allow)};
`;
}
