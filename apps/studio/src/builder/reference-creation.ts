import { createContext } from "react";
import type { WizardKind } from "./Wizard";

export type CreateReference = (kind: WizardKind) => Promise<string | undefined>;

/** Complete creation is optional: a reference without this host never offers a bare name. */
export const ReferenceCreation = createContext<CreateReference | undefined>(undefined);

const PAGE_CREATIONS: Record<string, string | undefined> = {
  addPage: undefined,
  addLandingPage: undefined,
  addUsersPage: "team",
  addDataPage: "admin",
  addReviewPage: "review",
  addCalendarPage: undefined,
  addOrderPage: undefined,
  addArticlesPage: undefined,
  addCalculatorPage: undefined,
  addCustomPage: undefined,
  addPrivacyPage: "privacy",
  addSectionsPage: undefined,
};

/** Names from the proposed creation operations, including the operations' actual defaults. */
export function createdReferenceNames(
  kind: WizardKind,
  operations: readonly { op: string; args: Record<string, unknown> }[],
): string[] {
  return [
    ...new Set(
      operations.flatMap(({ op, args }) => {
        const name =
          kind === "model" && op === "addModel"
            ? args.model
            : kind === "action" && op === "addAction"
              ? args.action
              : kind === "page" && Object.hasOwn(PAGE_CREATIONS, op)
                ? (args.page ?? PAGE_CREATIONS[op])
                : undefined;
        return typeof name === "string" && name.trim() ? [name] : [];
      }),
    ),
  ];
}
