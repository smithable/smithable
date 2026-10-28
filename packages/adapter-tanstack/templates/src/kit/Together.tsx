// Smithable app kit: deleting a record that other records point to (docs/design/delete-together.md).
// The server refuses with the facts; the dialog here says what would go with it to the trash
// and offers to move them all, or says why it cannot be deleted.
import { useEffect, useRef } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { type InUse, inUseFacts } from "./refusal";
import { w } from "./words";

export { type InUse, inUseFacts };

/** "3 orders and 12 order lines", with "what belongs to them" when deeper records go too. */
function listOf(facts: InUse): string {
  const named = facts.with
    .filter((e) => e.count !== null)
    .map((e) => w.nOf(e.count as number, e.label, e.plural));
  return w.listed(
    facts.with.some((e) => e.count === null) ? [...named, w.whatBelongsToThem] : named,
  );
}

/**
 * Asks whether to move the record and what points to it to the trash together, or says why
 * it cannot be deleted. `what` names the record ("“Acme”", or "this customer"); `rootLabel` is
 * its model's label for "will show no customer".
 */
export function TogetherDialog({
  facts,
  what,
  rootLabel,
  busy,
  onTogether,
  onClose,
}: {
  facts: InUse;
  what: string;
  rootLabel: string;
  busy?: boolean;
  onTogether: () => void;
  onClose: () => void;
}) {
  const list = listOf(facts);
  const n = facts.with.reduce((sum, e) => sum + (e.count ?? 2), 0);
  const dialog = useRef<HTMLDialogElement>(null);
  // Shown as soon as the facts are there; Escape closes it.
  useEffect(() => dialog.current?.showModal(), []);
  return (
    <dialog
      ref={dialog}
      data-part="together"
      aria-labelledby="together-title"
      className="m-auto w-[calc(100%-2.5rem)] max-w-md rounded-lg border bg-card p-0 text-card-foreground backdrop:bg-black/50"
      onClose={onClose}
    >
      <Card className="space-y-4 border-0 p-card shadow-none">
        <h2 id="together-title" className="text-lg font-semibold">
          {facts.together ? w.moveToTrashAsk(what) : w.cannotDeleteUsed(facts.title, list)}
        </h2>
        <div className="space-y-2 text-muted-foreground">
          {facts.together ? (
            <p>{w.goesWith(list, n)}</p>
          ) : (
            <p>{w.turnTrashOn(w.listed(facts.missing.map((m) => m.toLowerCase())))}</p>
          )}
          {facts.loose.length > 0 && (
            <p>
              {w.willShowNone(
                w.listed(facts.loose.map((e) => w.nOf(e.count, e.label, e.plural))),
                rootLabel,
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {facts.together ? w.cancel : w.close}
          </Button>
          {facts.together && (
            <Button type="button" variant="destructive" onClick={onTogether} disabled={busy}>
              {w.moveAllToTrash}
            </Button>
          )}
        </div>
      </Card>
    </dialog>
  );
}
