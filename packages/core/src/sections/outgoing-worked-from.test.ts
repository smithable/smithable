import { expect, test } from "vitest";
import { validateContent } from "../content.js";
import { validateSpec } from "../spec.js";

// A worked-out field is no way round "nothing sensitive in a mail" (record-documents.md §3): it is
// refused when it is worked out from a field notSendable refuses, directly, through another
// worked-out field of the record, or over a list's records.
const SPEC = `smithable: 0.1
app:
  name: Shop
models:
  Customer:
    fields:
      name: string!
      email: email
      cardNumber: string
      ref: { type: string, formula: cardNumber }
      hint: { type: string, formula: 'CONCAT(ref, "!")' }
      bookings: Booking[]
      ssnSum: { type: int, formula: SUM(bookings.ssn) }
      count: { type: int, formula: COUNT(bookings) }
  Booking:
    fields:
      title: string!
      customer: Customer!
      ssn: int
outgoing:
  made:
    when: Customer created
    to: mail
    recipient: owner
`;
const CARD =
  "is worked out from cardNumber, which looks like a card number, a password or an identity number";
const SSN =
  "is worked out from Booking.ssn, which looks like a card number, a password or an identity number";

test("show refuses a worked-out field read from a sensitive field: directly, chained, aggregated", () => {
  const messages = (show: string) =>
    validateSpec({ path: "smithable.yml", text: `${SPEC}    show: [${show}]\n` })
      .diagnostics.filter((d) => d.severity === "error")
      .map((d) => d.message);
  expect(messages("name, count")).toEqual([]);
  expect(messages("ref")).toContainEqual(
    expect.stringContaining(`Customer.ref ${CARD}, so it cannot be shown.`),
  );
  expect(messages("hint")).toContainEqual(
    expect.stringContaining(`Customer.hint ${CARD}, so it cannot be shown.`),
  );
  expect(messages("ssnSum")).toContainEqual(
    expect.stringContaining(`Customer.ssnSum ${SSN}, so it cannot be shown.`),
  );
});

test("a placeholder refuses the same worked-out fields, and does not offer them", () => {
  const ir = validateSpec({ path: "smithable.yml", text: SPEC }).ir;
  if (!ir) throw new Error("spec");
  const messages = (subject: string) =>
    validateContent(
      {
        path: "smithable.content.yml",
        text: `smithableContent: 0.1\noutgoing:\n  made: { subject: ${JSON.stringify(subject)} }\n`,
      },
      ir,
    ).diagnostics.map((d) => d.message);
  expect(messages("{name} has {count} bookings")).toEqual([]);
  expect(messages("{ref}")).toEqual([
    expect.stringContaining(`Customer.ref ${CARD}, so it cannot fill a placeholder.`),
  ]);
  expect(messages("{hint}")).toEqual([expect.stringContaining(`Customer.hint ${CARD}`)]);
  expect(messages("{ssnSum}")).toEqual([expect.stringContaining(`Customer.ssnSum ${SSN}`)]);
  const offered = JSON.stringify(
    validateContent(
      {
        path: "smithable.content.yml",
        text: 'smithableContent: 0.1\noutgoing:\n  made: { subject: "{qqqqqqqqqqqq}" }\n',
      },
      ir,
    ).diagnostics,
  );
  expect(offered).toContain("count");
  for (const name of ["ref", "hint", "ssnSum"]) expect(offered).not.toContain(` ${name},`);
});
