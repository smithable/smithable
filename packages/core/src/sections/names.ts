/** Model names: PascalCase, e.g. "Customer", "InvoiceLine". */
export const MODEL_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/;

/** Field names and choice values: camelCase, e.g. "email", "allLevels". */
export const FIELD_NAME_PATTERN = /^[a-z][A-Za-z0-9]*$/;

/** Page ids, menu names and rule ids: camelCase or kebab-case, e.g. "my-bookings". */
export const NAME_PATTERN = /^[a-z][A-Za-z0-9]*(?:-[a-z0-9]+)*$/;

/** A custom page's or section's component: a name for a file in src/custom/, e.g. Planner. */
export const COMPONENT_PATTERN = /^[A-Z][A-Za-z0-9]*$/;
