/**
 * The one-time notices Builder put on the page, those whose acknowledgement failed (T1602), and
 * the newest put on the page (T1604).
 */
export type NoticesSeen = { shown: Set<string>; failed: Set<string>; newest?: string };

/** A notice id's run and number ("<run>.<n>", T1604); undefined for an id without an order. */
function order(id: string): { run: string; n: number } | undefined {
  const at = id.lastIndexOf(".");
  const n = Number(id.slice(at + 1));
  return at > 0 && Number.isInteger(n) ? { run: id.slice(0, at), n } : undefined;
}

/** Whether a notice came before another of the same Studio run. */
function older(id: string, than: string | undefined): boolean {
  const a = order(id);
  const b = than === undefined ? undefined : order(than);
  return Boolean(a && b && a.run === b.run && a.n < b.n);
}

/**
 * What a read of the project does with the notice it carries: shows one not shown yet, says
 * seen again a shown one whose acknowledgement failed, and leaves any other. A late read that
 * still carries an older notice does not put it back over a newer one: neither one shown
 * already, nor one the page never showed that came before the newest it did (T1604).
 */
export function noticeStep(seen: NoticesSeen, id: string | undefined): "show" | "again" | "none" {
  if (!id) return "none";
  if (!seen.shown.has(id)) return older(id, seen.newest) ? "none" : "show";
  return seen.failed.has(id) ? "again" : "none";
}

/** Notes a notice put on the page as the newest, unless a newer one is there already. */
export function noticeShown(seen: NoticesSeen, id: string): void {
  if (!older(id, seen.newest)) seen.newest = id;
}
