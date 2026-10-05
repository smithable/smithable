// Smithable app kit: the refusals a program or an assistant can act on, in the app's words. The
// API answers them as 400 and 404, the tools as their error, the panel as a line under the answer.

/** A value or a request the app cannot take: what is wrong, and what there is. */
export class BadInput extends Error {}
/** A record that is not there, or not one the caller may read: never which of the two. */
export class NotFound extends Error {}
