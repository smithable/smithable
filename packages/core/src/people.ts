/**
 * The sample users of a project, samples/people.yml (docs/design/sample-users.md §5): people of
 * the sample data who use the app by themselves in a development or demo build. Each has a name,
 * a role (one of the auth file's, or `visitor`), a persona in a sentence (data in the host's
 * prompt, never an instruction) and a pace in minutes between moves. Kept with the samples, so
 * "Remove sample data" takes them too; never seeded into a published app.
 */
import { isSeq, LineCounter, type ParsedNode, parseDocument } from "yaml";
import type { AuthIR } from "./auth.js";
import { checkKeys, mapEntries, ParseContext, readNumber, readString } from "./context.js";
import type { Diagnostic } from "./diagnostics.js";
import { didYouMean } from "./suggest.js";

export interface PersonIR {
  name: string;
  /** A role of the auth file, or "visitor": no session, the public pages and forms. */
  role: string;
  persona: string;
  /** Minutes between this person's moves. */
  pace: number;
}

export const PACE_DEFAULT = 1;
export const PACE_MIN = 0.25;
export const PACE_MAX = 60;
/** How many sample users may act in one project (sample-users.md §4). */
export const PEOPLE_MAX = 5;
/** The file, in the project. */
export const PEOPLE_PATH = "samples/people.yml";

const KEYS = { allowed: ["name", "role", "persona", "pace"] } as const;

/** Reads samples/people.yml against the auth file's roles. */
export function validatePeople(
  file: { path: string; text: string },
  auth: Pick<AuthIR, "roles">,
): { people: PersonIR[]; diagnostics: Diagnostic[] } {
  const counter = new LineCounter();
  const doc = parseDocument(file.text, { lineCounter: counter, keepSourceTokens: true });
  const ctx = new ParseContext(file.path, counter);
  for (const error of doc.errors) ctx.error(null, "yaml", error.message);
  const people: PersonIR[] = [];
  if (doc.errors.length) return { people, diagnostics: ctx.diagnostics };
  if (!isSeq(doc.contents)) {
    ctx.error(doc.contents, "expected-list", "samples/people.yml must be a list of people.");
    return { people, diagnostics: ctx.diagnostics };
  }
  // "visitor" is the person without a session; a role of that name would be the same word twice.
  const roles = [...new Set(["visitor", ...auth.roles.map((r) => r.name)])];
  const names = new Set<string>();
  (doc.contents.items as ParsedNode[]).forEach((item, i) => {
    const entries = mapEntries(ctx, item, `person ${i + 1}`);
    if (!entries) return;
    const allowed = checkKeys(ctx, entries, `person ${i + 1}`, KEYS);
    const at = (key: string) => allowed.find((e) => e.key === key);
    // A key that is there with a wrong value is said once, as wrong; a missing one as missing.
    const text = (key: string) => {
      const entry = at(key);
      return entry ? readString(ctx, entry.value, `person ${i + 1}'s ${key}`)?.trim() : undefined;
    };
    const name = text("name");
    const role = text("role");
    const persona = text("persona");
    const paceNode = at("pace");
    const pace = paceNode
      ? readNumber(ctx, paceNode.value, `${name ?? `person ${i + 1}`}'s pace`)
      : PACE_DEFAULT;
    for (const [key, value] of [
      ["name", name],
      ["role", role],
      ["persona", persona],
    ] as const)
      if (!at(key)) ctx.error(item, "missing-key", `Person ${i + 1} needs a ${key}.`);
      // undefined: readString said what was wrong with it already.
      else if (value === "")
        ctx.error(at(key)?.value, "empty-value", `Person ${i + 1}'s ${key} is empty.`);
    if (name && names.has(name))
      ctx.error(at("name")?.value, "duplicate-name", `Two people are called "${name}".`);
    if (name) names.add(name);
    if (role && !roles.includes(role))
      ctx.error(
        at("role")?.value,
        "unknown-role",
        `There is no role "${role}" for ${name ?? `person ${i + 1}`}.`,
        didYouMean(role, roles) ?? `The roles: ${roles.join(", ")}.`,
      );
    if (pace !== undefined && (pace < PACE_MIN || pace > PACE_MAX))
      ctx.error(
        paceNode?.value,
        "pace-out-of-range",
        `${name ?? `Person ${i + 1}`}'s pace is minutes between moves, from ${PACE_MIN} to ${PACE_MAX}.`,
      );
    if (
      name &&
      role &&
      persona &&
      roles.includes(role) &&
      pace !== undefined &&
      pace >= PACE_MIN &&
      pace <= PACE_MAX
    )
      people.push({ name, role, persona, pace });
  });
  if (people.length > PEOPLE_MAX)
    ctx.warning(
      null,
      "too-many-people",
      `${people.length} sample users; at most ${PEOPLE_MAX} act at once, the rest wait their turn.`,
    );
  return { people, diagnostics: ctx.diagnostics };
}
