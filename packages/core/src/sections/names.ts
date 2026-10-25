/** Model names: PascalCase, e.g. "Customer", "InvoiceLine". */
export const MODEL_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/;

/** Field names and choice values: camelCase, e.g. "email", "allLevels". */
export const FIELD_NAME_PATTERN = /^[a-z][A-Za-z0-9]*$/;

/** Page ids, menu names and rule ids: camelCase or kebab-case, e.g. "my-bookings". */
export const NAME_PATTERN = /^[a-z][A-Za-z0-9]*(?:-[a-z0-9]+)*$/;

/** A custom page's or section's component: a name for a file in src/custom/, e.g. Planner. */
export const COMPONENT_PATTERN = /^[A-Z][A-Za-z0-9]*$/;

const LOWER = "must start with a lowercase letter and use only letters and digits";
const DASHED = "must start with a lowercase letter and use only letters, digits and dashes";
/** What each kind of name is called, the rule it follows in words, and an example. */
const NAMES = {
  model: [
    MODEL_NAME_PATTERN,
    "Model name",
    "must start with a capital letter and use only letters and digits",
    '"Customer"',
  ],
  field: [FIELD_NAME_PATTERN, "Field name", LOWER, '"email" or "createdBy"'],
  choice: [FIELD_NAME_PATTERN, "Choice value", LOWER, '"inProgress"'],
  action: [FIELD_NAME_PATTERN, "Action name", LOWER, '"mergeCustomers"'],
  tile: [FIELD_NAME_PATTERN, "Tile name", LOWER, '"totalFuelCost"'],
  query: [FIELD_NAME_PATTERN, "Query name", LOWER, '"churnRisk"'],
  outgoing: [FIELD_NAME_PATTERN, "Outgoing name", LOWER, '"bookingMade"'],
  incoming: [FIELD_NAME_PATTERN, "Incoming name", LOWER, '"monitorDown"'],
  timer: [FIELD_NAME_PATTERN, "Timer name", LOWER, '"remind"'],
  role: [FIELD_NAME_PATTERN, "Role name", LOWER, '"staff"'],
  page: [NAME_PATTERN, "Page name", DASHED, '"orders" or "my-bookings"'],
  menu: [NAME_PATTERN, "Menu name", DASHED, '"main"'],
  rule: [NAME_PATTERN, "Rule id", DASHED, '"no-double-booking"'],
} as const;
export type NameKind = keyof typeof NAMES;

/**
 * Words the code reserves (A 159): a spec name that is one cannot be what the generated app names
 * a function or a value after it, so it is refused, never renamed (the spec stays what the code
 * says). JavaScript's reserved words, strict mode's, and the globals a binding may not shadow.
 */
export const RESERVED_WORDS: ReadonlySet<string> = new Set(
  "await break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield constructor prototype undefined NaN Infinity eval arguments".split(
    " ",
  ),
);

/** The rule a name of this kind follows, as a sentence about `name`. */
export function nameRule(kind: NameKind, name: string): string {
  const [, what, rule, example] = NAMES[kind];
  return `${what} "${name}" ${rule}, like ${example}.`;
}

/**
 * Why a name does not fit its kind, or undefined when it does: the sentence an operation refuses
 * it with and a file's check reports, so a form can say the same while the name is typed.
 */
export function nameProblem(kind: NameKind, name: string): string | undefined {
  return NAMES[kind][0].test(name) ? undefined : nameRule(kind, name);
}
