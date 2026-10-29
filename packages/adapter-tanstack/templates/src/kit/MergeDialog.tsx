// Smithable app kit: merging two records into one (docs/design/intents.md §3). The person says
// which stays, decides each field the two differ on where the spec asks, and reads what will
// happen before it does: what moves to the kept record, and where the other goes.
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { formatValue } from "./format";
import type { AppUi, ModelUi } from "./model";
import { tx, w } from "./words";

/** One of the two records, as the form names it. */
export interface MergeSide {
  id: number;
  title: string;
}

/** What merging the two would do, from the server, as the viewer may see it. */
export interface MergePreview {
  kept: Record<string, unknown>;
  other: Record<string, unknown>;
  keptTitle: string;
  otherTitle: string;
  /** The fields the person decides, and what else each offers (the sum, both texts). */
  asked: { key: string; kind: "number" | "text" | "other" }[];
  /** A reference's value as its title, for the two records. */
  refs: Record<string, [string, string]>;
  /** The fields that take the other's value by the spec's rule (or since the kept one has none). */
  taken: string[];
  moves: { model: string; label: string; plural: string; count: number }[];
  goes: "trash" | "gone" | "stays";
  refused: string | null;
}

type Choice = "kept" | "other" | "sum" | "join";

export function MergeDialog({
  label,
  help,
  ui,
  app,
  sides,
  keep,
  preview,
  run,
  onDone,
  onClose,
}: {
  label: string;
  help?: string;
  ui: ModelUi;
  app: AppUi;
  /** The two records; the first stays unless the person (or the spec's oldest/newest) says otherwise. */
  sides: [MergeSide, MergeSide];
  keep: "chosen" | "oldest" | "newest";
  preview: (keep: number, other: number) => Promise<MergePreview>;
  run: (keep: number, other: number, choices: Record<string, Choice>) => Promise<unknown>;
  onDone: (merged: {
    kept: MergeSide;
    other: MergeSide;
    goes: MergePreview["goes"];
  }) => Promise<unknown>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [kept, setKept] = useState(sides[0].id);
  const [facts, setFacts] = useState<MergePreview>();
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const other = sides.find((s) => s.id !== kept) ?? sides[1];
  // The pages pass a new function on every render: the latest, without asking again for it.
  const ask = useRef(preview);
  ask.current = preview;
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    let current = true;
    setFacts(undefined);
    setChoices({});
    ask.current(kept, other.id).then(
      (p) => current && setFacts(p),
      (error) =>
        current && setFailure(error instanceof Error ? error.message : w.somethingWentWrong),
    );
    return () => {
      current = false;
    };
  }, [kept, other.id]);
  const field = (key: string) => ui.fields.find((f) => f.name === key || f.relation?.key === key);
  const shown = (key: string, side: 0 | 1) => {
    if (!facts) return "";
    const ref = facts.refs[key];
    if (ref) return ref[side] || "—";
    const f = field(key);
    const value = (side === 0 ? facts.kept : facts.other)[key];
    return f ? formatValue(f, value, app) : String(value ?? "—");
  };
  const keptTitle = facts?.keptTitle ?? sides.find((s) => s.id === kept)?.title ?? "";
  const otherTitle = facts?.otherTitle ?? other.title;
  const moves = (facts?.moves ?? []).map(
    (m) => `${m.count} ${(m.count === 1 ? m.label : m.plural).toLowerCase()}`,
  );
  const close = () => {
    dialog.current?.close();
    onClose();
  };
  const merge = async () => {
    if (!facts) return;
    setBusy(true);
    setFailure(undefined);
    try {
      // The server says which stays when the spec does (oldest, newest): the preview's ids.
      const keptId = Number(facts.kept.id);
      const otherId = Number(facts.other.id);
      await run(keptId, otherId, choices);
      dialog.current?.close();
      await onDone({
        kept: { id: keptId, title: facts.keptTitle },
        other: { id: otherId, title: facts.otherTitle },
        goes: facts.goes,
      });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : w.somethingWentWrong);
    }
    setBusy(false);
  };
  return (
    <dialog
      ref={dialog}
      data-kit="merge-dialog"
      aria-label={tx(label)}
      onClose={onClose}
      className="m-auto w-full max-w-2xl bg-transparent p-0 backdrop:bg-black/50"
    >
      <Card className="space-y-4 rounded-xl p-card text-left">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{tx(label)}</h2>
          {help && <p className="text-sm text-muted-foreground">{tx(help)}</p>}
        </div>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{w.mergeKeeps}</span>
          <select
            className="h-9 rounded-md border bg-background px-2"
            // Oldest or newest: the one the server keeps, once it has said.
            value={keep === "chosen" ? kept : Number(facts?.kept.id ?? kept)}
            // Oldest or newest: the spec says which stays, shown and not chosen.
            disabled={keep !== "chosen" || busy}
            onChange={(e) => setKept(Number(e.target.value))}
          >
            {sides.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        {facts?.asked.length ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">{w.mergeDecide}</legend>
            {facts.asked.map(({ key, kind }) => {
              const f = field(key);
              const picked = choices[key] ?? "kept";
              const option = (value: Choice, text: string) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`merge-${key}`}
                    checked={picked === value}
                    onChange={() => setChoices({ ...choices, [key]: value })}
                  />
                  <span className="min-w-0 break-words">{text}</span>
                </label>
              );
              return (
                <fieldset key={key} className="space-y-1 rounded-md border p-2">
                  <legend className="text-sm font-medium">{f ? tx(f.label) : key}</legend>
                  {option("kept", shown(key, 0))}
                  {option("other", shown(key, 1))}
                  {kind === "number" && option("sum", w.mergeSum)}
                  {kind === "text" && option("join", w.mergeJoin)}
                </fieldset>
              );
            })}
          </fieldset>
        ) : null}
        {facts && !facts.refused && (
          <p className="text-sm" role="status">
            {w.mergeSentence(
              keptTitle,
              moves,
              otherTitle,
              facts.goes,
              facts.taken.map((key) => tx(field(key)?.label ?? key)),
            )}
          </p>
        )}
        {(facts?.refused || failure) && (
          <p role="alert" className="text-sm text-destructive">
            {facts?.refused ?? failure}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close}>
            {w.cancel}
          </Button>
          <Button type="button" disabled={!facts || Boolean(facts.refused) || busy} onClick={merge}>
            {tx(label)}
          </Button>
        </div>
      </Card>
    </dialog>
  );
}

/**
 * The merge's button: "Merge" on the two records picked in a list, or "Merge into…" on a record's
 * page, which first asks for the record it merges into (the one that stays).
 */
export function MergeButton({
  label,
  concept,
  sides,
  into,
  ...dialog
}: Omit<Parameters<typeof MergeDialog>[0], "sides" | "onClose"> & {
  /** The action in the app description, for the preview editor: development only. */
  concept?: string;
  /** The two records picked in a list. */
  sides?: [MergeSide, MergeSide];
  /** On a record's page: the record, and the others it may merge into. */
  into?: {
    record: MergeSide;
    loadOptions: () => Promise<{ value: number | string; label: string }[]>;
  };
}) {
  const [open, setOpen] = useState<[MergeSide, MergeSide]>();
  const [choices, setChoices] = useState<{ value: number; label: string }[]>();
  const [failure, setFailure] = useState<string>();
  const picker = useRef<HTMLDialogElement>(null);
  const start = async () => {
    setFailure(undefined);
    if (sides) return setOpen(sides);
    if (!into) return;
    try {
      const all = await into.loadOptions();
      setChoices(
        all
          .map((o) => ({ value: Number(o.value), label: o.label }))
          .filter((o) => o.value !== into.record.id),
      );
      picker.current?.showModal();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : w.somethingWentWrong);
    }
  };
  return (
    <span
      data-kit="merge-button"
      {...(import.meta.env.DEV && concept ? { "data-sm-concept": concept } : {})}
      className="inline-flex flex-col items-end gap-1"
    >
      <Button type="button" variant="outline" onClick={() => void start()}>
        {into ? w.mergeInto : tx(label)}
      </Button>
      {failure && (
        <span role="alert" className="text-sm text-destructive">
          {failure}
        </span>
      )}
      {into && (
        <dialog
          ref={picker}
          aria-label={w.mergeInto}
          className="m-auto w-full max-w-md bg-transparent p-0 backdrop:bg-black/50"
        >
          <Card className="space-y-4 rounded-xl p-card text-left">
            <h2 className="text-lg font-semibold">{w.mergeIntoWhich(dialog.ui.label)}</h2>
            <select
              aria-label={w.mergeIntoWhich(dialog.ui.label)}
              className="h-9 w-full rounded-md border bg-background px-2"
              defaultValue=""
              onChange={(e) => {
                const picked = choices?.find((c) => c.value === Number(e.target.value));
                if (!picked) return;
                picker.current?.close();
                // The record picked stays: this one merges into it.
                setOpen([{ id: picked.value, title: picked.label }, into.record]);
              }}
            >
              <option value="" disabled>
                {w.mergeChoose}
              </option>
              {(choices ?? []).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => picker.current?.close()}>
                {w.cancel}
              </Button>
            </div>
          </Card>
        </dialog>
      )}
      {open && (
        <MergeDialog {...dialog} label={label} sides={open} onClose={() => setOpen(undefined)} />
      )}
    </span>
  );
}
