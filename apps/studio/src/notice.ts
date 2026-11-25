/**
 * The one-time notices Builder put on the page, those whose acknowledgement failed (T1602), and
 * the newest number put on the page for each Studio run (T1604).
 */
export type NoticesSeen = { shown: Set<string>; failed: Set<string>; newest?: Map<string, number> };

/** A notice id's run and number ("<run>.<n>", T1604); undefined for an id without an order. */
function order(id: string): { run: string; n: number } | undefined {
  const match = /^(.+)\.(\d+)$/.exec(id);
  return match?.[1] && match[2] ? { run: match[1], n: Number(match[2]) } : undefined;
}

/** Whether a notice came before the newest the page showed of its Studio run. */
function older(seen: NoticesSeen, id: string): boolean {
  const at = order(id);
  const newest = at && seen.newest?.get(at.run);
  return Boolean(at && newest !== undefined && at.n < newest);
}

/**
 * What a read of the project does with the notice it carries: shows one not shown yet, says
 * seen again a shown one whose acknowledgement failed, and leaves any other. A late read that
 * still carries an older notice does not put it back over a newer one: neither one shown
 * already, nor one the page never showed that came before the newest it did (T1604).
 */
export function noticeStep(seen: NoticesSeen, id: string | undefined): "show" | "again" | "none" {
  if (!id) return "none";
  if (!seen.shown.has(id)) return older(seen, id) ? "none" : "show";
  return seen.failed.has(id) ? "again" : "none";
}

/** Notes a notice put on the page as its run's newest, unless a newer one of the run was shown. */
export function noticeShown(seen: NoticesSeen, id: string): void {
  const at = order(id);
  if (!at || older(seen, id)) return;
  seen.newest ??= new Map();
  seen.newest.set(at.run, at.n);
}
