/** The one-time notices Builder put on the page, and the one whose acknowledgement failed (T1602). */
export type NoticesSeen = { shown: Set<string>; failed?: string };

/**
 * What a read of the project does with the notice it carries: shows one not shown yet, says
 * seen again a shown one whose acknowledgement failed, and leaves any other. A late read that
 * still carries an older notice does not put it back over a newer one.
 */
export function noticeStep(seen: NoticesSeen, id: string | undefined): "show" | "again" | "none" {
  if (!id) return "none";
  if (!seen.shown.has(id)) return "show";
  return seen.failed === id ? "again" : "none";
}
