// Smithable app kit: the guard every page's route runs before it loads. A visitor is sent to sign
// in; a signed-in person whose role may not open the page gets the refusal, answered 403 where the
// page is rendered on the server (A 214). Apart from access.ts, which plain Node imports too.
import { redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { AccessDenied, allows, type Rule, type Viewer } from "./access";

/** For a page's beforeLoad: sends visitors to sign in, and refuses users without the role. */
export function guardPage(rule: Rule, viewer: Viewer | null, href: string): void {
  if (allows(rule, viewer)) return;
  if (!viewer) throw redirect({ href: `/sign-in?redirect=${encodeURIComponent(href)}` });
  // Rendered on the server, the page answers 403 as it shows the refusal (A 214).
  refusedStatus();
  throw new AccessDenied(true);
}

/** The status a refused page answers with, set where the page is rendered on the server. */
const refusedStatus = createIsomorphicFn().server(() => setResponseStatus(403));
