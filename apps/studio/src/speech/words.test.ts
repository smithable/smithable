import { expect, test } from "vitest";
import { browserOf, sentences, spoken, usableVoices, whereLine } from "./words";

test("what is read aloud: no code, links or tables, a list to five items", () => {
  expect(spoken("Run `smithable undo` to take it back.")).toBe("Run to take it back.");
  expect(spoken("See [the docs](https://docs.smithable.ai) or https://x.example now.")).toBe(
    "See the docs or now.",
  );
  expect(spoken("Fields:\n| a | b |\n| 1 | 2 |\nDone.")).toBe("Fields: Done.");
  expect(spoken("Pages:\n- one\n- two\n- three\n- four\n- five\n- six\n- seven")).toBe(
    "Pages: one two three four five and 2 more.",
  );
});

test("spoken a sentence at a time, a long one split at a comma", () => {
  expect(sentences("Done. Customers have a phone now! Anything else?")).toEqual([
    "Done.",
    "Customers have a phone now!",
    "Anything else?",
  ]);
  const long = `${"word ".repeat(30).trim()}, ${"more ".repeat(30).trim()}.`;
  const pieces = sentences(long, 180);
  expect(pieces).toHaveLength(2);
  expect(pieces.every((p) => p.length <= 180)).toBe(true);
});

test("the voices a policy allows, and where the voice goes", () => {
  const voices = [
    { name: "Google US English", lang: "en-US", localService: false },
    { name: "Samantha", lang: "en-US", localService: true },
    { name: "Alva", lang: "sv-SE", localService: true },
  ];
  expect(usableVoices(voices, false).map((v) => v.name)).toEqual(["Google US English", "Samantha"]);
  expect(usableVoices(voices, true).map((v) => v.name)).toEqual(["Samantha"]);
  const chrome =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
  expect(browserOf(chrome)).toBe("chrome");
  expect(browserOf(`${chrome} Edg/140.0`)).toBe("edge");
  expect(whereLine("browser", "chrome", false)).toBe(
    "Your voice is sent to Google to be written out, and kept under Google's terms.",
  );
  expect(whereLine("browser", "firefox", true)).toBe("Your voice is written out on this computer.");
  expect(whereLine("service", "chrome", false)).toContain("Amazon's speech service in Frankfurt");
});
