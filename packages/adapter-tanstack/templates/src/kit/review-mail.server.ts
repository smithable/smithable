// Smithable app kit: telling reviewers that files wait (docs/design/file-review.md). After a save
// that left a file waiting, each reviewer who may review it gets at most one mail every fifteen
// minutes, with how many wait for them and a link to the review page; without mail settings it
// lands in the outbox, as every mail does, and the menu's number says the same.
import { and, eq, inArray } from "drizzle-orm";
import { db } from "#/db";
import { fileReviews, user } from "#/db/schema";
import { REVIEW_PAGE, REVIEWER_ROLES } from "#/generated/review";
import { log } from "./log.server";
import { sendMail } from "./mail";
import { w } from "./words";

const QUIET = 15 * 60 * 1000;
/** When each reviewer was last told, by user id: this process's memory is enough for a pause. */
const told = new Map<string, number>();

/** Tells the reviewers of `model` how many files wait for them, each at most every fifteen minutes. */
export async function tellReviewers(app: string, model: string, now = Date.now()): Promise<void> {
  const roles = REVIEWER_ROLES[model] ?? [];
  if (!roles.length || !REVIEW_PAGE) return;
  const people = db
    .select({ id: user.id, email: user.email, role: user.role })
    .from(user)
    .where(inArray(user.role, roles))
    .all();
  const origin =
    process.env.BETTER_AUTH_URL ?? (import.meta.env.DEV ? "http://localhost:3000" : "");
  for (const person of people) {
    if (now - (told.get(person.id) ?? 0) < QUIET) continue;
    const theirs = Object.keys(REVIEWER_ROLES).filter((m) =>
      REVIEWER_ROLES[m]?.includes(String(person.role)),
    );
    const waiting = db
      .select({ id: fileReviews.id })
      .from(fileReviews)
      .where(and(inArray(fileReviews.model, theirs), eq(fileReviews.state, "pending")))
      .all().length;
    if (!waiting) continue;
    told.set(person.id, now);
    try {
      await sendMail({
        to: person.email,
        subject: w.reviewMailSubject(waiting, app),
        text: w.reviewMailText(waiting, `${origin}${REVIEW_PAGE}`),
      });
    } catch (error) {
      log.error("A reviewer could not be told of waiting files", { error });
    }
  }
}
