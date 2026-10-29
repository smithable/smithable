// Your implementation of the "scheduleFollowUps" action in smithable.yml. Smithable created this file
// once and never changes it. The input and output types are generated from the spec, so a change
// to the action's input or output shows up here as a type error.
// `viewer` is the signed-in user (null for a visitor). The records the input refers to are ones
// they may read; the data functions in src/generated/*.server.ts check access for them.
import { db } from "#/db";
import { followUps } from "#/db/schema";
import type {
  ScheduleFollowUpsInput,
  ScheduleFollowUpsOutput,
} from "#/generated/actions/schedule-follow-ups";
import type { Viewer } from "#/kit/access";

/** A date as the app stores one, "2026-10-29", so many days after another. */
function daysAfter(start: Date, days: number): string {
  const day = new Date(start);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

/**
 * Plan a series of follow-up notes for a customer, one every so many days.
 *
 * Rules (from smithable.yml):
 * - The first note is due today; each next one everyDays later.
 */
export async function scheduleFollowUps(
  { customer, count, everyDays }: ScheduleFollowUpsInput,
  viewer: Viewer | null,
): Promise<ScheduleFollowUpsOutput> {
  if (count < 1 || count > 52) throw new Error("Plan between 1 and 52 follow-ups at a time.");
  if (everyDays < 1) throw new Error("Follow-ups are at least a day apart.");
  // Only the roles the auth file names may run this (smithable.yml); the generated action checks that first.
  const today = new Date();
  // All at once or not at all.
  db.transaction((tx) => {
    for (let i = 0; i < count; i++)
      tx.insert(followUps)
        .values({ customerId: customer, dueOn: daysAfter(today, i * everyDays), ownerId: viewer?.id })
        .run();
  });
  return { created: count };
}
