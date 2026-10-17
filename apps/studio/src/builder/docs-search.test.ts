import { expect, test } from "vitest";
import { asksTheDocs, type DocsIndex, searchDocs } from "./docs-search";

const index: DocsIndex = {
  pages: [
    ["self-host.html", "Self-hosting"],
    ["language.html", "Another language"],
  ],
  parts: [
    [0, "Self-hosting", "", "Run your app on your own server as a container."],
    [0, "Backups", "backups", "Back the database up to an S3 bucket every night."],
    [1, "Another language", "", "Add a language and translate the texts."],
  ],
};

test("the parts holding the question's words, those with them in the heading first", () => {
  const hits = searchDocs(index, "How do I make backups of my app?");
  expect(hits[0]).toEqual({
    title: "Self-hosting › Backups",
    url: "https://docs.smithable.ai/self-host.html#backups",
    line: "Back the database up to an S3 bucket every night.",
  });
  expect(searchDocs(index, "how do I add a language")[0]?.url).toBe(
    "https://docs.smithable.ai/language.html",
  );
  expect(searchDocs(index, "how do I?")).toEqual([]);
});

test("a question reads as one for the docs; a change does not", () => {
  expect(asksTheDocs("How do I publish?")).toBe(true);
  expect(asksTheDocs("Can I use my own domain")).toBe(true);
  expect(asksTheDocs("Customers should have a website")).toBe(false);
});
