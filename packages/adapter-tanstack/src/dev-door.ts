// The development door for sample users (docs/design/sample-users.md §4–§5): the people of
// samples/people.yml as users of the development database, and the door the host acts through.
import { kebab, type PersonIR } from "@smithable/core";
import { HEADER, literal } from "./shared.js";

/** A sample user as the development database has them: who signs in nowhere, the door acts as. */
export interface SampleUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

/**
 * The project's sample users who sign in (a visitor has no user), each with an id and an address
 * made from the name in plain letters: `sample-maja-lindqvist`, `maja-lindqvist@sample.example`.
 */
export function samplePeople(people: readonly PersonIR[] = []): SampleUser[] {
  return people.flatMap((p) => {
    if (p.role === "visitor") return [];
    const slug = kebab(p.name.normalize("NFKD").replace(/[̀-ͯ]/g, "")) || "person";
    return [{ id: `sample-${slug}`, name: p.name, email: `${slug}@sample.example`, role: p.role }];
  });
}

/**
 * src/generated/people.ts: the sample users, in a development or demo build only (empty in any
 * other): the people the development door acts as, marked on the users page.
 */
export function peopleModule(people: readonly SampleUser[]): string {
  return `${HEADER}// The project's sample users (samples/people.yml), in a development or demo build only: the
// people the development door acts as (docs/design/sample-users.md §4), marked on the users page.
export const SAMPLE_PEOPLE: { id: string; name: string; email: string; role: string }[] =
  import.meta.env.DEV || process.env.DEMO_SIGN_IN === "1"
    ? [
${people.map((u) => `        ${literal(u)},`).join("\n")}
      ]
    : [];
`;
}
