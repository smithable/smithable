// The IANA time zones the runtime knows (Node 24 and every browser), for app.timezone's
// completion and its suggestion; UTC is offered too, where the list leaves it out.
const listed =
  typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];

export const TIME_ZONES: readonly string[] = listed.includes("UTC") ? listed : [...listed, "UTC"];
