// The app card served in the app (docs/design/app-card.md §4): core's facts for each of the app's
// languages, written as data into src/generated/card.ts, and the /app-card route that renders
// them through the kit's AppCard for the administrators. The app imports no Smithable package:
// the facts are a literal, the sentences the kit's words.
import { type AuthIR, appCard, type ContentIR, emptyContent, type SpecIR } from "@smithable/core";
import { HEADER, importList, literal } from "./shared.js";

/** One facts literal per language, from the spec files the host passed (their hash, the AI policy). */
export function cardModule(
  ir: SpecIR,
  auth: AuthIR,
  content: ContentIR = emptyContent(),
  files: { name: string; text: string }[] = [],
  smithable?: string,
): string {
  const context = files.find((f) => f.name === "smithable.context.yml")?.text;
  const cards = Object.fromEntries(
    [content.language, ...(content.languages ?? [])].map((language) => [
      language,
      appCard({
        ir,
        auth,
        content,
        files,
        language,
        ...(smithable ? { smithable } : {}),
        ...(context === undefined ? {} : { context }),
      }),
    ]),
  );
  return `${HEADER}import type { CardFacts } from "#/kit/AppCard";

/** The app card's facts in each of the app's languages, from its definition when generated. */
export const CARDS: Record<string, CardFacts> = ${literal(cards)};

/** The app's own language, for a page in a language the card is not in. */
export const MAIN = ${JSON.stringify(content.language)};
`;
}

/** /app-card, for the administrators: a role every app with sign-in has. */
export function cardRoute(): string {
  const imports = importList()
    .add("@tanstack/react-router", "createFileRoute")
    .add("#/generated/card", "CARDS", "MAIN")
    .add("#/kit/AppCard", "AppCard")
    .add("#/kit/page-guard", "guardPage");
  return `${HEADER}${imports.render()}
export const Route = createFileRoute("/app-card")({
  beforeLoad: ({ context, location }) =>
    guardPage({ public: false, roles: ["admin"], owner: false }, context.viewer, location.href),
  component: () => <AppCard cards={CARDS} main={MAIN} />,
});
`;
}
