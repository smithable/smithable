// The sample users' operations (docs/design/sample-users.md §5): samples/people.yml is written
// only this way, by a person's command, Studio's "Add sample users" or Smith's reading of "add
// three customers who book over the week". The file is a list; the editor keeps its comments.
import { type AuthIR, validateAuth } from "../auth.js";
import type { Editors } from "../operation.js";
import { type AnyOperation, type Operation, OperationError } from "../operation.js";
import { PACE_DEFAULT, PACE_MAX, PACE_MIN, PEOPLE_MAX, type PersonIR } from "../people.js";
import { didYouMean } from "../suggest.js";

/** The people the file lists now, as written (the file is checked after the operation). */
function listed(editor: { get(path: string[]): unknown }): Partial<PersonIR>[] {
  const value = editor.get([]);
  return Array.isArray(value) ? (value as Partial<PersonIR>[]) : [];
}

/** The auth file as the operation finds it (one before it may have changed the roles). */
const rolesOf = (editors: Editors) =>
  editors.auth
    ? validateAuth({ path: "smithable.auth.yml", text: editors.auth.text }).auth
    : undefined;

/** The roles a sample user may have: the auth file's, and "visitor" (no session). */
export function sampleRoles(auth: Pick<AuthIR, "roles"> | undefined): string[] {
  return [...new Set(["visitor", ...(auth?.roles.map((r) => r.name) ?? [])])];
}

/**
 * A persona when none is given: the role's description from the auth file, or the role's name
 * in a sentence. Data for the host's prompt, never an instruction (sample-users.md §4).
 */
export function personaFor(role: string, auth: Pick<AuthIR, "roles"> | undefined): string {
  const described = auth?.roles.find((r) => r.name === role)?.description;
  if (described) return described;
  return role === "visitor" ? "Visits the app without signing in." : `Uses the app as ${role}.`;
}

const addSampleUser: Operation<{ name: string; role: string; persona?: string; pace?: number }> = {
  name: "addSampleUser",
  summary:
    'Add a sample user to samples/people.yml: a person of a role (or "visitor") who uses the app by themselves in the preview, with a persona in a sentence and a pace in minutes between moves.',
  schema: {
    type: "object",
    required: ["name", "role"],
    additionalProperties: false,
    properties: {
      name: {
        type: "string",
        minLength: 1,
        description: "The person's name, e.g. Maja Lindqvist.",
      },
      role: {
        type: "string",
        minLength: 1,
        description:
          'A role from smithable.auth.yml, or "visitor" for someone who does not sign in.',
      },
      persona: {
        type: "string",
        description:
          "Who they are and what they do in the app, in a sentence; without it, the role's description.",
      },
      pace: {
        type: "number",
        minimum: PACE_MIN,
        maximum: PACE_MAX,
        description: `Minutes between their moves (${PACE_DEFAULT} unless said).`,
      },
    },
  },
  positional: ["name", "role", "...persona"],
  describe: ({ name, role }) => `Add sample user "${name}" (${role})`,
  destructive: () => false,
  apply(editors, { name, role, persona, pace }) {
    const auth = rolesOf(editors);
    const roles = sampleRoles(auth);
    if (!roles.includes(role))
      throw new OperationError(
        `There is no role "${role}". ${didYouMean(role, roles) ?? `The roles: ${roles.join(", ")}.`}`,
      );
    const people = editors.people;
    if (!people) throw new OperationError("This project cannot have sample users.");
    const have = listed(people);
    if (have.some((p) => p.name === name))
      throw new OperationError(`There is already a sample user called "${name}".`);
    if (have.length >= PEOPLE_MAX)
      throw new OperationError(
        `At most ${PEOPLE_MAX} sample users act in a project; remove one first (removeSampleUser).`,
      );
    people.appendItem([], {
      name,
      role,
      persona: persona?.trim() || personaFor(role, auth),
      ...(pace !== undefined && pace !== PACE_DEFAULT ? { pace } : {}),
    });
    return [];
  },
};

const removeSampleUser: Operation<{ name: string }> = {
  name: "removeSampleUser",
  summary: "Remove a sample user from samples/people.yml by name.",
  schema: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: { name: { type: "string", minLength: 1, description: "The person's name." } },
  },
  positional: ["name"],
  describe: ({ name }) => `Remove sample user "${name}"`,
  destructive: () => false,
  apply(editors, { name }) {
    const people = editors.people;
    const have = people ? listed(people) : [];
    const at = have.findIndex((p) => p.name === name);
    if (!people || at < 0) {
      const names = have.map((p) => p.name).filter((n): n is string => typeof n === "string");
      throw new OperationError(
        `There is no sample user called "${name}". ${didYouMean(name, names) ?? (names.length ? `The sample users: ${names.join(", ")}.` : "There are none.")}`,
      );
    }
    people.removeItem([], at);
    return [];
  },
};

export const peopleOperations: AnyOperation[] = [addSampleUser, removeSampleUser];
