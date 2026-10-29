// Smithable app kit: merging two or more records into one (docs/design/intents.md §3). The person
// says which stays, decides each field they differ on where the spec asks, and reads what will
// happen before it does: what moves to the kept record, and where the others go. A combine (into
// new) makes a new record from them instead, which they stay beside unless the person removes them.
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { formatValue } from "./format";
import type { AppUi, ModelUi } from "./model";
import { tx, w } from "./words";

/** One of the records, as the form names it. */
export interface MergeSide {
  id: number;
  title: string;
}

/** What merging them would do, from the server, as the viewer may see it. */
export interface MergePreview {
  /** The records in their order, the kept one (a combine's first) first; and their titles. */
  records: Record<string, unknown>[];
  titles: string[];
  /** The fields the person decides, and what else each offers (the sum, the texts joined). */
  asked: { key: string; kind: "number" | "text" | "other" }[];
  /** A reference's value as its title, for each record. */
  refs: Record<string, string[]>;
  /** The fields that take another record's value by the spec's rule (or since the first has none). */
  taken: string[];
  moves: { model: string; label: string; plural: string; count: number }[];
  /** Where the others go: all to the trash (or deleted), all stay, or some of each. */
  goes: "trash" | "gone" | "stays" | "some";
  /** A combine: the unique fields the new record's is left empty, and whether they may be removed. */
  emptied: string[];
  removable: boolean;
  refused: string | null;
}

type Choice = number | "sum" | "join";

const NOTICE = "combined";

/** Remembers, for the new record's page, what a combine was made from. */
function rememberCombined(model: string, id: number, from: string[], removed: boolean): void {
  try {
    sessionStorage.setItem(NOTICE, JSON.stringify({ model, id, from, removed }));
  } catch {
    // Without storage there is no notice; the record's Activity names its sources.
  }
}

/** On a combine's new record's page, once: what it was made from, and where they went. */
export function CombineNotice({ model, id, label }: { model: string; id: number; label: string }) {
  const [made, setMade] = useState<{ from: string[]; removed: boolean }>();
  useEffect(() => {
    try {
      const kept = JSON.parse(sessionStorage.getItem(NOTICE) ?? "null");
      if (kept?.model === model && kept.id === id) {
        sessionStorage.removeItem(NOTICE);
        setMade({ from: kept.from, removed: kept.removed });
      }
    } catch {
      // Nothing to say.
    }
  }, [model, id]);
  if (!made) return null;
  return (
    <p
      role="status"
      data-part="combine-notice"
      className="mb-4 rounded-md border bg-card px-4 py-2 text-sm"
    >
      {w.combined(made.from, label, made.removed)}
    </p>
  );
}

export function MergeDialog({
  label,
  help,
  ui,
  app,
  model,
  sides,
  into,
  preview,
  run,
  onDone,
  onClose,
}: {
  label: string;
  help?: string;
  ui: ModelUi;
  app: AppUi;
  model: string;
  /** The records in the order picked; the first stays unless the person says otherwise. */
  sides: MergeSide[];
  into: "chosen" | "new";
  preview: (ids: number[]) => Promise<MergePreview>;
  run: (ids: number[], choices: Record<string, Choice>, remove: boolean) => Promise<unknown>;
  /** After a merge: the one kept and the others, and where they went; after a combine: the new record. */
  onDone: (merged: {
    kept: MergeSide;
    others: MergeSide[];
    goes: MergePreview["goes"];
    made?: number;
  }) => Promise<unknown>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [kept, setKept] = useState(sides[0]?.id as number);
  const [facts, setFacts] = useState<MergePreview>();
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [remove, setRemove] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  // The kept one first, the others in the order picked.
  const ordered = [...sides.filter((s) => s.id === kept), ...sides.filter((s) => s.id !== kept)];
  const ids = ordered.map((s) => s.id);
  const order = ids.join(",");
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
    setRemove(false);
    ask.current(order.split(",").map(Number)).then(
      (p) => {
        if (!current) return;
        setFacts(p);
        // Each field asked starts as the first record's that has a value: the server takes no
        // merge with one undecided.
        setChoices(
          Object.fromEntries(
            p.asked.map((a) => [
              a.key,
              Number((p.records.find((r) => !empty(r[a.key])) ?? p.records[0])?.id),
            ]),
          ),
        );
      },
      (error) =>
        current && setFailure(error instanceof Error ? error.message : w.somethingWentWrong),
    );
    return () => {
      current = false;
    };
  }, [order]);
  const field = (name: string) =>
    ui.fields.find((f) => f.name === name || f.relation?.key === name);
  const shown = (name: string, at: number) => {
    if (!facts) return "";
    const ref = facts.refs[name];
    if (ref) return ref[at] || "—";
    const f = field(name);
    const value = facts.records[at]?.[name];
    return f ? formatValue(f, value, app) : String(value ?? "—");
  };
  const titles = facts?.titles ?? ordered.map((s) => s.title);
  const moves = (facts?.moves ?? []).map(
    (m) => `${m.count} ${(m.count === 1 ? m.label : m.plural).toLowerCase()}`,
  );
  const labels = (keys: string[]) => keys.map((k) => tx(field(k)?.label ?? k));
  const close = () => {
    dialog.current?.close();
    onClose();
  };
  const merge = async () => {
    if (!facts) return;
    setBusy(true);
    setFailure(undefined);
    try {
      const made = await run(ids, choices, remove);
      dialog.current?.close();
      if (into === "new") rememberCombined(model, Number(made), titles, remove);
      await onDone({
        kept: { id: ids[0] as number, title: titles[0] ?? "" },
        others: ordered.slice(1).map((s, i) => ({ id: s.id, title: titles[i + 1] ?? s.title })),
        goes: facts.goes,
        ...(into === "new" ? { made: Number(made) } : {}),
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
        {into === "chosen" && (
          <label className="grid gap-1 text-sm">
            <span className="font-medium">{w.mergeKeeps}</span>
            <select
              className="h-9 rounded-md border bg-background px-2"
              value={kept}
              disabled={busy}
              onChange={(e) => setKept(Number(e.target.value))}
            >
              {sides.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        )}
        {facts?.asked.length ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">{w.mergeDecide}</legend>
            {facts.asked.map(({ key: name, kind }) => {
              const f = field(name);
              const picked = choices[name];
              const option = (value: Choice, text: string) => (
                <label key={String(value)} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`merge-${name}`}
                    checked={picked === value}
                    onChange={() => setChoices({ ...choices, [name]: value })}
                  />
                  <span className="min-w-0 break-words">{text}</span>
                </label>
              );
              // Each value once, by the first record that has it; an empty one is no choice.
              const seen = new Set<string>();
              const values = facts.records.flatMap((r, at) => {
                const value = JSON.stringify(r[name] ?? null);
                if (empty(r[name]) || seen.has(value)) return [];
                seen.add(value);
                return [option(Number(r.id), shown(name, at))];
              });
              return (
                <fieldset key={name} className="space-y-1 rounded-md border p-2">
                  <legend className="text-sm font-medium">{f ? tx(f.label) : name}</legend>
                  {values}
                  {kind === "number" && option("sum", w.mergeSum)}
                  {kind === "text" && option("join", w.mergeJoin)}
                </fieldset>
              );
            })}
          </fieldset>
        ) : null}
        {facts && !facts.refused && into === "new" && facts.removable && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={remove}
              disabled={busy}
              onChange={(e) => setRemove(e.target.checked)}
            />
            <span>{w.combineRemove}</span>
          </label>
        )}
        {facts && !facts.refused && (
          <p className="text-sm" role="status">
            {into === "new"
              ? w.combineSentence(titles, ui.label, remove ? [] : labels(facts.emptied), remove)
              : w.mergeSentence(
                  titles[0] ?? "",
                  moves,
                  titles.slice(1),
                  facts.goes,
                  labels(facts.taken),
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

/** No value: nothing, or an empty text (no and zero are values). */
function empty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * The merge's button: "Merge" (or a combine's label) on the records picked in a list, or "Merge
 * into…" on a record's page, which first asks for the record it merges into (the one that stays).
 */
export function MergeButton({
  label,
  concept,
  mode,
  sides,
  into,
  ...dialog
}: Omit<Parameters<typeof MergeDialog>[0], "sides" | "onClose" | "into"> & {
  /** The action in the app description, for the preview editor: development only. */
  concept?: string;
  /** Into the record chosen or a new one. */
  mode: "chosen" | "new";
  /** The records picked in a list, in the order picked. */
  sides?: MergeSide[];
  /** On a record's page: the record, and the others it may merge into. */
  into?: {
    record: MergeSide;
    loadOptions: () => Promise<{ value: number | string; label: string }[]>;
  };
}) {
  const [open, setOpen] = useState<MergeSide[]>();
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
        <MergeDialog
          {...dialog}
          label={label}
          into={mode}
          sides={open}
          onClose={() => setOpen(undefined)}
        />
      )}
    </span>
  );
}
