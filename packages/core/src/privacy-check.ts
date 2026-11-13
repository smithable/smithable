// The privacy page's completeness check (docs/design/legal-page.md §6.3): what is missing, as
// warnings, never a verdict on the law. Whether the page was reviewed needs the generator's
// fingerprint, so the host adds privacy-unreviewed beside these.
import type { AuthIR } from "./auth.js";
import type { ContentIR } from "./content.js";
import type { Diagnostic } from "./diagnostics.js";
import type { SpecIR } from "./ir.js";

const at = (file: string, code: string, message: string, hint?: string): Diagnostic => ({
  severity: "warning",
  code,
  message,
  ...(hint ? { hint } : {}),
  file,
  line: 1,
  column: 1,
});

export function privacyCheck(
  ir: SpecIR,
  auth: AuthIR | undefined,
  content: ContentIR | undefined,
  files: { spec: string; content: string },
  options: { analytics?: boolean } = {},
): Diagnostic[] {
  const found: Diagnostic[] = [];
  const pages = ir.pages.filter((p) => p.pattern.kind === "legal");
  // What makes a privacy page needed: people sign in, a public form, mail coming in, Ask open to
  // visitors, or analytics.
  const why = [
    auth && auth.signIn !== "none" ? "people sign in" : undefined,
    auth?.public.create.length ? "anyone can fill in a form" : undefined,
    ir.incoming.some((i) => i.mail) ? "mail comes in" : undefined,
    auth?.assistant?.for === "anyone" ? "visitors can ask the assistant" : undefined,
    options.analytics ? "visits are counted" : undefined,
  ].filter((w): w is string => Boolean(w));
  if (!pages.length && why.length)
    found.push(
      at(
        files.spec,
        "privacy-missing",
        `The app has no privacy page, and ${why.join(", ")}.`,
        "smithable op addPrivacyPage",
      ),
    );
  for (const page of pages) {
    const own = content?.pages[page.id];
    const operator = own?.sections?.operator;
    // operator-unknown (the name) is the content file's own warning; a contact email is this one's.
    if (operator?.name && !operator.email)
      found.push(
        at(
          files.content,
          "operator-unknown",
          `The privacy page "${page.id}" gives no email to write to: add it under pages.${page.id}.operator.email.`,
        ),
      );
    const custom =
      ir.actions.some((a) => a.custom) ||
      ir.incoming.some((i) => i.custom) ||
      ir.pages.some((p) => p.pattern.kind === "custom");
    if (custom && !own?.privacy?.custom)
      found.push(
        at(
          files.content,
          "privacy-custom",
          `The app runs functions of its own, and the privacy page "${page.id}" does not say what they do with people's details: write it under pages.${page.id}.custom.`,
        ),
      );
  }
  return found;
}
