import { expect, test } from "vitest";
import { appParts, type DocsIndex, searchDocs, searchWords } from "./docs-search.js";
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
