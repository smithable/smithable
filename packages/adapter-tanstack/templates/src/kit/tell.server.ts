// Smithable app kit: telling from your own code (docs/design/integrations.md §4.3). `tell` puts a
// call to a named target into the same outbox the spec's outgoing entries use, and `tellMail` a
// mail, so code in src/custom gets the signing, the retries for a day, Activity's line and "Send
// again" without writing them. A target is one the spec's outgoing section names (`to:`): where
// the app may call stays the administrator's, and its address and secret are settings. For a call
// that needs its answer at once, use fetch.
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { user } from "#/db/schema";
import { TARGETS, type Target } from "#/generated/outgoing.server";
import { currentViewer } from "#/lib/viewer.server";
import type { Viewer } from "./access";
import { audit } from "./audit.server";
import { queueCall, queueMail, type Recipient } from "./outgoing.server";

/**
 * Who it is done for: the signed-in person or a visitor in a request, or the app's own work (a
 * daily hook), which has no request to read a session from.
 */
async function viewerNow(): Promise<{ viewer: Viewer | null; inRequest: boolean }> {
  try {
    return { viewer: await currentViewer(), inRequest: true };
  } catch {
    return { viewer: null, inRequest: false };
  }
}

/** Calls `target` with `body` (sent as JSON, signed with the target's secret), after now. */
export async function tell(target: Target, body: unknown): Promise<void> {
  if (!(TARGETS as readonly string[]).includes(target))
    throw new Error(`"${target}" is not a target of smithable.yml's outgoing section.`);
  const { viewer } = await viewerNow();
  db.transaction((tx) => {
    queueCall(tx, { entry: "tell", model: null, record: null, target, body: JSON.stringify(body) });
    audit(tx, viewer, { action: "told", details: { target } });
  });
}

/**
 * Mails `to`: an address, or a role's name (every user who has it). A visitor's request (no one
 * signed in) mails roles only, never an address: the code might pass on what a stranger typed.
 * The app's own work (a daily hook) may mail an address.
 */
export async function tellMail(to: string, subject: string, body: string): Promise<void> {
  const { viewer, inRequest } = await viewerNow();
  const address = to.includes("@");
  if (address && inRequest && !viewer)
    throw new Error("A visitor's request mails a role, not an address: sign in, or mail a role.");
  const recipients: Recipient[] = address
    ? [{ email: to }]
    : db.select({ id: user.id, email: user.email }).from(user).where(eq(user.role, to)).all();
  db.transaction((tx) => {
    queueMail(
      tx,
      viewer,
      { entry: "tellMail", model: null, record: null, subject, text: body, fields: [] },
      recipients,
      true,
    );
    audit(tx, viewer, { action: "mailed", details: { to: address ? "an address" : to } });
  });
}
