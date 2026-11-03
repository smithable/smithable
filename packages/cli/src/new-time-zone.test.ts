import { expect, test } from "vitest";
import { withTimeZone } from "./new.js";

const app = (more = "") =>
  `smithable: 0.1\napp:\n  name: Notes\n${more}models:\n  Note: { fields: { text: string! } }\n`;
const pages = "pages:\n  notes: { crud: Note }\n";
const spec = (text: string) => ({ "smithable.yml": text });

test("a new app takes the machine's time zone where its spec names none (A 220)", () => {
  const made = withTimeZone(spec(app() + pages), undefined, "Europe/Helsinki");
  expect(made["smithable.yml"]).toContain("timezone: Europe/Helsinki");
  // A machine on UTC says nothing of where the app is; the validator's warning stays.
  expect(withTimeZone(spec(app() + pages), undefined, "UTC")["smithable.yml"]).not.toContain(
    "timezone",
  );
  // A starter's own zone stays, and one given wins over the machine's.
  const own = app("  timezone: Asia/Tokyo\n") + pages;
  expect(withTimeZone(spec(own), undefined, "Europe/Helsinki")["smithable.yml"]).toBe(own);
  expect(
    withTimeZone(spec(app() + pages), "Asia/Tokyo", "Europe/Helsinki")["smithable.yml"],
  ).toContain("timezone: Asia/Tokyo");
  // An app with no pages is only an API: no one's clock is guessed for it.
  expect(withTimeZone(spec(app()), undefined, "Europe/Helsinki")["smithable.yml"]).not.toContain(
    "timezone",
  );
});
