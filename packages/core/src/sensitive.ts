// Fields that look like data an app should not hold, or should hold with great care, by their
// names: payment card numbers, passwords and keys, national identity numbers, health and the
// other specially protected kinds of personal data. Finding them is deterministic; whether the
// name means what it looks like is the person's to judge, so these are warnings.
import type { FieldIR } from "./ir.js";

export type SensitiveKind =
  | "card-data"
  | "secret-field"
  | "identity-number"
  | "special-category-data";

/** A camelCase name as lowercase words: cardNumber → card, number. */
const wordsOf = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** What a stored field looks like by its name, or nothing. */
export function sensitiveKind(
  field: Pick<FieldIR, "name" | "type" | "formula">,
): SensitiveKind | undefined {
  if (field.formula || field.type.kind === "relation") return undefined;
  const words = wordsOf(field.name);
  const has = (...all: string[]) => all.every((w) => words.includes(w));
  const any = (...some: string[]) => some.some((w) => words.includes(w));

  // A payment card's number, security code or expiry. A library, member or gift card is not one.
  const otherCard = any(
    "library",
    "member",
    "membership",
    "loyalty",
    "gift",
    "business",
    "id",
    "sim",
  );
  if (
    any("cvv", "cvc", "cvv2") ||
    (words.length === 1 && words[0] === "pan") ||
    (has("card") && any("number", "no", "expiry", "expiration") && !otherCard) ||
    has("credit", "card") ||
    has("debit", "card")
  )
    return "card-data";

  // A password, a key or a token.
  if (
    any("password", "passwd", "passphrase", "secret") ||
    has("api", "key") ||
    has("private", "key") ||
    (has("token") && any("access", "auth", "bearer", "refresh", "api")) ||
    (words.length <= 2 && words[0] === "pin" && (words.length === 1 || words[1] === "code"))
  )
    return "secret-field";

  // A national identity or passport number.
  if (
    any("ssn", "personnummer", "hetu", "henkilotunnus", "cpr") ||
    has("social", "security") ||
    (has("national") && any("id", "identity")) ||
    (has("personal") && any("identity", "id") && any("number", "code")) ||
    (has("identity") && any("number", "code")) ||
    (has("passport") && any("number", "no"))
  )
    return "identity-number";

  // Health and the other specially protected kinds. A choice named "health" is more often the
  // state of a machine than of a person, so that word counts for texts only.
  const text =
    field.type.kind === "scalar" && ["string", "text", "markdown"].includes(field.type.name);
  if (field.type.kind === "scalar" && !text) return undefined;
  if (
    any(
      "diagnosis",
      "diagnoses",
      "medication",
      "medications",
      "medical",
      "allergy",
      "allergies",
      "injury",
      "injuries",
      "disability",
      "disabilities",
      "religion",
      "ethnicity",
      "biometric",
      "genetic",
    ) ||
    (text && any("health")) ||
    has("blood", "type") ||
    has("sexual", "orientation") ||
    (has("political") && any("view", "views", "opinion", "opinions", "affiliation", "party")) ||
    (has("criminal") && any("record", "records", "conviction", "convictions"))
  )
    return "special-category-data";
  return undefined;
}

/** The warning's words for a field of a model. */
export function sensitiveMessage(kind: SensitiveKind, model: string, field: string): string {
  const what = `"${model}.${field}"`;
  switch (kind) {
    case "card-data":
      return `${what} looks like a payment card's number, security code or expiry. Card data must not be stored in an app: take payments through a payment provider and keep only its reference.`;
    case "secret-field":
      return `${what} looks like a password, a key or a token. Records are not the place for secrets: people sign in through the app's own sign-in, and keys for other services belong in the environment.`;
    case "identity-number":
      return `${what} looks like a national identity or passport number, which the law lets an app keep only when its purpose needs it. Leave it out unless it does, and never make ${model} public.`;
    case "special-category-data":
      return `${what} looks like health data or another specially protected kind of personal data (health, religion, ethnicity, sexual orientation, political views, criminal records). It needs a legal ground of its own and stricter care: leave it out unless the app cannot do without it.`;
  }
}
