// The app card served in the app (docs/design/app-card.md §4): core's facts for each of the app's
// languages, written as data into src/generated/card.server.ts (so they never reach a browser's
// bundle), a server function that hands them to administrators only, and the /app-card route that
// renders them through the kit's AppCard. The app imports no Smithable package: the facts are a
// literal, the sentences the kit's words.
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
    [content.language, ...(content.languages ?? [])].map((language) => {
      const facts = appCard({
        ir,
        auth,
        content,
        files,
        language,
        ...(smithable ? { smithable } : {}),
        ...(context === undefined ? {} : { context }),
      });
      // The generator's version as the app names it: a detached app mentions no Smithable.
      const { smithable: engine, ...app } = facts.app;
      return [language, { ...facts, app: { ...app, ...(engine ? { engine } : {}) } }];
    }),
  );
  return `${HEADER}import type { CardFacts } from "#/kit/AppCard";

/** The app card's facts in each of the app's languages, from its definition when generated. */
export const CARDS: Record<string, CardFacts> = ${literal(cards)};

/** The app's own language, for a page in a language the card is not in. */
export const MAIN = ${JSON.stringify(content.language)};
`;
}

/** The server function: the facts for the administrators, refused to anyone else. */
export function cardServerFnModule(): string {
  return `${HEADER}import { createServerFn } from "@tanstack/react-start";
import { AccessDenied } from "#/kit/access";
import { currentViewer } from "#/lib/viewer.server";
import { CARDS, MAIN } from "./card.server";

/** The app card's facts, in every language: for the administrators only. */
export const appCard = createServerFn().handler(async () => {
  const viewer = await currentViewer();
  if (viewer?.role !== "admin") throw new AccessDenied(Boolean(viewer));
  return { cards: CARDS, main: MAIN };
});
`;
}

/** /app-card, for the administrators: a role every app with sign-in has. */
export function cardRoute(): string {
  const imports = importList()
    .add("@tanstack/react-router", "createFileRoute")
    .add("#/generated/card", "appCard")
    .add("#/kit/AppCard", "AppCard")
    .add("#/kit/page-guard", "guardPage");
  return `${HEADER}${imports.render()}
export const Route = createFileRoute("/app-card")({
  beforeLoad: ({ context, location }) =>
    guardPage({ public: false, roles: ["admin"], owner: false }, context.viewer, location.href),
  loader: () => appCard(),
  component: function AppCardPage() {
    const { cards, main } = Route.useLoaderData();
    return <AppCard cards={cards} main={main} />;
  },
});
`;
}
