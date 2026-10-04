import { expect, test } from "vitest";
import type { FieldIR } from "./ir.js";
import { sensitiveKind } from "./sensitive.js";
import { validateSpec } from "./spec.js";

const text = (name: string): Pick<FieldIR, "name" | "type"> => ({
  name,
  type: { kind: "scalar", name: "string" },
});
const kind = (name: string) => sensitiveKind(text(name));

test("names that look like data an app should not hold, or hold with great care", () => {
  for (const name of [
    "cardNumber",
    "creditCard",
    "creditCardNumber",
    "cvv",
    "cardCvc",
    "pan",
    "cardExpiry",
    "debitCardNo",
  ])
    expect(kind(name), name).toBe("card-data");
  for (const name of [
    "password",
    "apiKey",
    "clientSecret",
    "accessToken",
    "privateKey",
    "pin",
    "pinCode",
  ])
    expect(kind(name), name).toBe("secret-field");
  for (const name of [
    "ssn",
    "personnummer",
    "socialSecurityNumber",
    "nationalId",
    "passportNumber",
    "personalIdentityCode",
    "hetu",
  ])
    expect(kind(name), name).toBe("identity-number");
  for (const name of [
    "diagnosis",
    "allergies",
    "injuries",
    "medicalNotes",
    "healthNotes",
    "religion",
    "bloodType",
    "sexualOrientation",
    "criminalRecord",
  ])
    expect(kind(name), name).toBe("special-category-data");
});

test("names that only share a word with them are left alone", () => {
  for (const name of [
    // A card that is not a payment card.
    "libraryCardNumber",
    "memberCardNumber",
    "giftCardNumber",
    "businessCard",
    "cardTitle",
    // Words that contain the letters, or mean something else.
    "expand",
    "company",
    "keyAccount",
    "pinned",
    "tokenCount",
    "spinCount",
    "vatNumber",
    "orderNumber",
    "idNumber",
    "passportPhoto",
    "raceDate",
    "recordedAt",
    "partyName",
    "healthyOptions",
  ])
    expect(kind(name), name).toBeUndefined();
  // "health" as a choice or a number is the state of a thing, not of a person.
  expect(
    sensitiveKind({ name: "health", type: { kind: "choice", values: ["ok", "degraded"] } }),
  ).toBeUndefined();
  expect(sensitiveKind({ name: "health", type: { kind: "scalar", name: "int" } })).toBeUndefined();
  // A reference to another record is not the data itself.
  expect(
    sensitiveKind({
      name: "diagnosis",
      type: { kind: "relation", model: "Diagnosis", many: false },
    }),
  ).toBeUndefined();
});

test("validateSpec warns on the field, with what to do instead", () => {
  const read = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Studio }
models:
  Member:
    fields:
      name: string!
      cardNumber: string
      injuries: text
      password: string
      personnummer: string
pages:
  members: { crud: Member }
`,
  });
  expect(read.ir).toBeDefined();
  expect(read.diagnostics.map((d) => `${d.severity} ${d.code} ${d.line}`)).toEqual([
    "warning card-data 7",
    "warning special-category-data 8",
    "warning secret-field 9",
    "warning identity-number 10",
  ]);
  expect(read.diagnostics[0]?.message).toBe(
    '"Member.cardNumber" looks like a payment card\'s number, security code or expiry. Card data must not be stored in an app: take payments through a payment provider and keep only its reference.',
  );
});
