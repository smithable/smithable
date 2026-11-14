import { expect, test } from "vitest";
import {
  appParts,
  type DocsIndex,
  searchDocs,
  searchDocsWith,
  searchWords,
  specLines,
} from "./docs-search.js";
import type { SummarySection } from "./summary.js";

const index: DocsIndex = {
  pages: [
    ["publish.html", "Publishing"],
    ["keys.html", "API keys"],
  ],
  parts: [
    [0, "Publishing", "", "Publish and share makes a link; Publish live needs an invite."],
    [0, "Your own domain", "domain", "Add an A record and a TXT record once the app is live."],
    [1, "API keys", "", "An administrator makes a key on the Team page; it is shown once."],
  ],
};

test("a request's words: no plain words, a plural's s dropped", () => {
  expect(searchWords("How do I add API keys?")).toEqual(["add", "api", "key"]);
  expect(searchWords("Hur publicerar jag appen?")).toEqual(["publicerar", "appen"]);
});

test("the docs' parts by BM25, a heading's words counting more", () => {
  expect(searchDocs(index, "Can I use my own domain?")[0]?.url).toBe(
    "https://docs.smithable.ai/publish.html#domain",
  );
  expect(searchDocs(index, "where do I make an API key")[0]?.title).toBe("API keys");
  expect(searchDocs(index, "how do I?")).toEqual([]);
});

const sections: SummarySection[] = [
  { concept: "model:Booking", title: "Bookings", sentences: ["A member books a place."] },
  { concept: "pages", title: "Pages", sentences: ["The schedule is public."] },
];

test("the app's parts the request names, else its whole summary", () => {
  expect(appParts(sections, "who can see the schedule?")).toBe("Pages: The schedule is public.");
  expect(appParts(sections, "what is this?")).toBe(
    "Bookings: A member books a place.\n\nPages: The schedule is public.",
  );
});

test("what the app does by itself is always there by its line: each action, outgoing call and timer (T844)", () => {
  const app: SummarySection[] = [
    ...sections,
    {
      concept: "outgoing:bookingMade",
      title: "Mail when a booking is made",
      sentences: ["To the member."],
    },
    { concept: "timer:remind", title: "Reminders every morning", sentences: ["At 08:00."] },
  ];
  // Found by the search: in full, the others by one line.
  expect(appParts(app, "who can see the schedule?")).toBe(
    "Pages: The schedule is public.\n\nAlso in the app:\n- outgoing:bookingMade: Mail when a booking is made\n- timer:remind: Reminders every morning",
  );
  // Found itself: in full, not listed again.
  expect(appParts(app, "when is the booking mail sent?")).not.toContain("- outgoing:bookingMade:");
});

test("a request's own best part first, then each phrase's, none twice", () => {
  const own = searchDocs(index, "can I use my own domain")[0]?.url;
  const hits = searchDocsWith(index, "can I use my own domain", ["publish", "API key"]);
  expect(hits[0]?.url).toBe(own);
  expect(hits.map((h) => h.url)).toContain("https://docs.smithable.ai/keys.html");
  expect(new Set(hits.map((h) => h.url)).size).toBe(hits.length);
  expect(hits.length).toBeLessThanOrEqual(3);
});

test("the spec's own entries a question names, as written", () => {
  const spec = `smithable: 0.1
app: { name: Studio }
models:
  Session:
    fields:
      capacity: int!
  Booking:
    fields:
      session: Session!
timers:
  reminder:
    every: day
pages:
  sessions: { crud: Session }
`;
  const lines = specLines(spec, "what happens when a session is full, is there a reminder?");
  expect(lines).toContain("  Session:\n    fields:\n      capacity: int!");
  expect(lines).toContain("timers:\n  reminder:");
  expect(specLines(spec, "the weather")).toBe("");
});
