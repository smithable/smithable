// Property-based checks (backlog A 63): the reader of first descriptions on random text. It reads
// a description or says it did not, and never throws; what it settles comes from the words given.
import fc from "fast-check";
import { expect, test } from "vitest";
import { readDescription } from "./read-description.js";

const WORDS = `a an the and or for to of with my our we I people customers members visitors
  booking bookings class classes shop products orders invoice invoices team staff only me
  sign up signs in public anyone list lists price photos photo who handles status page
  contact form app apps help desk tickets api assistant yoga studio second hand front
  , . ; : - ! ? ' "`.split(/\s+/);

const description = fc.oneof(
  fc.array(fc.constantFrom(...WORDS), { maxLength: 40 }).map((w) => w.join(" ")),
  fc.string({ maxLength: 300 }),
  fc.string({ maxLength: 300, unit: "grapheme" }),
);

test("a description is read or not, never a crash", () => {
  fc.assert(
    fc.property(description, (text) => {
      const reading = readDescription(text);
      expect(typeof reading.read).toBe("boolean");
      for (const list of [reading.things, reading.maybe, reading.fields, reading.leftover])
        expect(Array.isArray(list)).toBe(true);
    }),
    { numRuns: Number(import.meta.env.FC_RUNS ?? 500), seed: Number(import.meta.env.FC_SEED ?? 1) },
  );
});
