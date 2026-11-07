// Smith tells the history and undoes (docs/design/ask-flows.md §8, A 234): requests read by
// rule (history.ts), answered with the Changes window's own lines, and an undo run only after one
// confirmation Studio writes from the undo check, never a model's words. The undo itself goes
// through the X's route (/api/undo), the newest first, stopping at the first refusal.
import { type ReactNode, useState } from "react";
import { api, type TraceEntry } from "../api";
import {
  grouped,
  type HistoryRequest,
  lastLine,
  line,
  lineByWords,
  listing,
  milestoneNamed,
  numbers,
  readHistory,
  restores,
  splitHistory,
  type Words,
} from "../history";
import { Button, cx } from "../ui";
import { CHIP, MINE, SMITHS } from "./chat-style";

interface Answer {
  text: string;
  /** Lines that open Changes at their change. */
  lines?: { text: string; id: string }[];
  /** Show all: Changes opened at the first line not shown (or at the top). */
  all?: string | true;
  /** Chips that send their words as if typed. */
  chips?: string[];
}

interface Confirm {
  request: string;
  text: string;
  /** The changes undone, newest first; or a milestone moved here. */
  ids: string[];
  move?: { id: string; name: string };
  /** The history's newest change when it was asked: moved since, it is asked again. */
  head: string;
  /** What comes after it in a mixed request ("… and add a notes field"). */
  after?: string;
}

export function useHistoryFlow({
  trace,
  words,
  onDone,
  onShow,
  propose,
}: {
  trace: TraceEntry[] | undefined;
  words?: Words;
  onDone?: () => void;
  /** Opens the Changes window, at a change when one is given. */
  onShow?: (id?: string) => void;
  /** Sends the rest of a mixed request on, as typed. */
  propose: (text: string) => void;
}) {
  const [answer, setAnswer] = useState<{ request: string } & Answer>();
  const [confirm, setConfirm] = useState<Confirm>();
  const [busy, setBusy] = useState(false);
  const entries = trace ?? [];
  const byNumber = (n: number) => entries.filter((e) => e.number === n);
  const newest = entries.reduce((n, e) => Math.max(n, e.number ?? 0), 0);
  const label = (group: TraceEntry[]) => line(group, words);

  const reply = (request: string, a: Answer, after?: string) => {
    setAnswer({ request, ...a });
    if (after) propose(after);
  };

  /** The confirmation for these changes, newest first, from the undo check of the first. */
  const ask = async (request: string, ids: string[], after?: string) => {
    const [first] = ids;
    const entry = entries.find((e) => e.id === first);
    if (!first || !entry) return;
    setBusy(true);
    const check = await api
      .undoCheck(first)
      .catch((e: Error) => ({ ok: false, output: e.message }));
    setBusy(false);
    const group = grouped(entries).find((g) => g.some((e) => e.id === first)) ?? [entry];
    if (!check.ok) {
      reply(request, { text: check.output.trim(), all: first }, after);
      return;
    }
    const isNewest = entries.find((e) => !e.isUndo && !e.undone)?.id === first;
    const back =
      isNewest && entry.snapshot
        ? "the files and the records as they were before it"
        : "the files only; the records stay as they are now";
    const later = grouped(entries.slice(0, entries.indexOf(group[0] as TraceEntry))).filter(
      (g) => !g[0]?.isUndo && g.some((e) => !e.undone),
    );
    const stay = isNewest
      ? ""
      : ` The ${later.length} later ${later.length === 1 ? "change stays" : "changes stay"}: ${later
          .slice(0, 3)
          .map(label)
          .join("; ")}${later.length > 3 ? `; and ${later.length - 3} more` : ""}.`;
    const lost = /It deletes [^.]*\./.exec(check.output)?.[0] ?? "";
    const what =
      ids.length > 1 && ids.every((id) => group.some((g) => g.id === id))
        ? label(group)
        : ids
            .map((id) => entries.find((e) => e.id === id))
            .filter((e): e is TraceEntry => Boolean(e))
            .map((e) => label([e]))
            .join("; ");
    setConfirm({
      request,
      text: `Undo ${what}? It puts back ${back}.${stay}${lost ? ` ${lost}` : ""}`,
      ids,
      head: entries[0]?.id ?? "",
      ...(after ? { after } : {}),
    });
  };

  const run = async (request: string, read: HistoryRequest, after?: string) => {
    setAnswer(undefined);
    // A question about the history is answered and a waiting confirmation stays (§8).
    if (read.kind !== "list" && read.kind !== "what") setConfirm(undefined);
    const say = (a: Answer) => reply(request, a, after);
    if (read.kind === "list") {
      if (entries.length === 0) return say({ text: "Nothing changed yet." });
      const listed = listing(entries, read.scope, words);
      if ("unknown" in listed) {
        const names = entries.filter((e) => e.milestone && !e.undone).map((e) => e.milestone ?? "");
        return say(
          listed.unknown.startsWith("#")
            ? { text: `There is no change ${listed.unknown}; the newest is #${newest}.` }
            : {
                text: names.length
                  ? `No milestone is called "${listed.unknown}". The milestones:`
                  : `No milestone is called "${listed.unknown}", and none is named yet.`,
                chips: names.map((n) => `What have I changed since "${n}"`),
              },
        );
      }
      if (listed.lines.length === 0)
        return say({ text: "Nothing changed in that time.", all: true });
      const firstHidden = listed.more ? grouped(entries)[listed.lines.length]?.[0]?.id : undefined;
      return say({
        text: "Your changes, the newest first:",
        lines: listed.lines.map((l) => ({
          text: `${l.text}. ${restores(l.group.find((e) => !e.undone) ?? (l.group[0] as TraceEntry), entries)}`,
          id: l.group[0]?.id ?? "",
        })),
        ...(firstHidden ? { all: firstHidden } : {}),
      });
    }
    if (read.kind === "what") {
      const [e, two] = byNumber(read.number);
      if (!e)
        return say({
          text: `There is no change #${read.number}; the newest is #${newest}.`,
        });
      if (two) return say({ text: `Two changes are #${read.number}: see Changes.`, all: e.id });
      const group = grouped(entries).find((g) => g.includes(e)) ?? [e];
      const parts = [
        label([e]),
        e.request ? `You asked: ${e.request}` : "",
        e.milestone ? `Milestone: ${e.milestone}` : "",
        e.undone ? `Undone by #${e.undoneBy ?? "?"}.` : e.isUndo ? "" : restores(e, entries),
        group.length > 1 ? `Part of ${label(group)}.` : "",
      ].filter(Boolean);
      return say({ text: "", lines: [{ text: parts.join(" "), id: e.id }] });
    }
    if (read.kind === "undo") {
      if ("last" in read) {
        const group = lastLine(entries);
        if (!group) return say({ text: "There is nothing left to undo." });
        return ask(
          request,
          group.filter((e) => !e.undone).map((e) => e.id),
          after,
        );
      }
      if ("words" in read) {
        const found = lineByWords(entries, read.words, words);
        if (!found) return say({ text: "I found no change about that.", all: true });
        if ("two" in found)
          return say({
            text: "Which one?",
            chips: found.two.map((g) => `Undo ${numbers(g)}`),
          });
        const left = found.group.filter((e) => !e.undone);
        if (left.length === 0)
          return say({
            text: `That one is undone already (${label(found.group)}).`,
          });
        return ask(
          request,
          left.map((e) => e.id),
          after,
        );
      }
      // By number: one, or a range newest first, passing over the undone and the undos.
      const ids: string[] = [];
      const notes: string[] = [];
      const one = read.from === read.to;
      for (let n = read.to; n >= read.from; n--) {
        const found = byNumber(n);
        const [e] = found;
        if (found.length > 1) {
          return say({
            text: `Two changes are #${n}. Which one?`,
            lines: found.map((f) => ({ text: label([f]), id: f.id })),
          });
        }
        if (!e) notes.push(`There is no change #${n}; the newest is #${newest}.`);
        else if (e.isUndo) notes.push(`#${n} undid #${e.undoes ?? "?"}; say redo to take it back.`);
        else if (e.undone) notes.push(`#${n} is undone already (by #${e.undoneBy ?? "?"}).`);
        else ids.push(e.id);
      }
      if (ids.length === 0) return say({ text: notes.join(" ") });
      if (notes.length && !one) setAnswer({ request, text: notes.join(" ") });
      return ask(request, ids, after);
    }
    // Milestones: a name changes no file, so it is set without a confirmation, unless the name
    // is on another change already.
    const named = async (id: string, name: string, done: string) => {
      setBusy(true);
      const result = await api
        .milestone(id, name)
        .catch((e: Error) => ({ ok: false, output: e.message }));
      setBusy(false);
      if (result.ok) onDone?.();
      say({ text: result.ok ? done : result.output });
    };
    if (read.kind === "name") {
      const target = read.number
        ? byNumber(read.number)[0]
        : lastLine(entries)?.find((e) => !e.undone);
      if (!target)
        return say({
          text: read.number
            ? `There is no change #${read.number}; the newest is #${newest}.`
            : "There is no change to name yet.",
        });
      // A point that is undone, or an undo, is not one to come back to.
      if (target.undone || target.isUndo)
        return say({
          text: `#${target.number} is ${target.isUndo ? "an undo" : "undone"}; name a change that is in place.`,
        });
      const elsewhere = entries.find(
        (e) =>
          !e.undone && e.milestone?.toLowerCase() === read.name.toLowerCase() && e.id !== target.id,
      );
      if (elsewhere) {
        setConfirm({
          request,
          text: `Move "${elsewhere.milestone}" here, to ${label([target])}?`,
          ids: [],
          move: { id: target.id, name: read.name },
          head: entries[0]?.id ?? "",
        });
        return;
      }
      return named(
        target.id,
        read.name,
        target.milestone
          ? `Renamed the milestone on ${label([target])} from "${target.milestone}" to "${read.name}".`
          : `Named ${label([target])} "${read.name}".`,
      );
    }
    const milestones = entries
      .filter((e) => e.milestone && !e.undone)
      .map((e) => e.milestone ?? "");
    const from = read.kind === "rename" ? read.from : read.name;
    const at = milestoneNamed(entries, from);
    if (!at)
      return say({
        text: milestones.length
          ? `No milestone is called "${from}". The milestones:`
          : "No milestone is named yet.",
        chips: milestones.map((n) =>
          read.kind === "rename"
            ? `Rename the milestone "${n}" to "${read.to}"`
            : `Remove the milestone "${n}"`,
        ),
      });
    return read.kind === "rename"
      ? named(at.id, read.to, `Renamed "${at.milestone}" to "${read.to}".`)
      : named(at.id, "", `"${at.milestone}" is no longer a milestone.`);
  };

  /** Takes a request about the history, or says it is not one. */
  const take = (text: string): boolean => {
    if (!trace) return false;
    const split = splitHistory(text);
    const read = split?.first ?? readHistory(text);
    if (!read) return false;
    void run(text, read, split?.rest);
    return true;
  };

  /** Yes: the changes undone through the X's route, the newest first, after a last look. */
  const yes = async () => {
    const c = confirm;
    if (!c) return;
    setConfirm(undefined);
    // The history moved since the confirmation was shown: it is void, checked and asked again.
    if ((entries[0]?.id ?? "") !== c.head) return take(c.request);
    setBusy(true);
    if (c.move) {
      const result = await api
        .milestone(c.move.id, c.move.name)
        .catch((e: Error) => ({ ok: false, output: e.message }));
      setBusy(false);
      if (result.ok) onDone?.();
      return reply(c.request, { text: result.ok ? `Moved "${c.move.name}" here.` : result.output });
    }
    const undid: string[] = [];
    let refused = "";
    for (const id of c.ids) {
      const result = await api
        .undoChange(id, true)
        .catch((e: Error) => ({ ok: false, output: e.message }));
      if (!result.ok) {
        refused = result.output.trim();
        break;
      }
      const e = entries.find((x) => x.id === id);
      if (e) undid.push(label([e]));
    }
    setBusy(false);
    onDone?.();
    reply(
      c.request,
      {
        text: `${undid.length ? `Undid: ${undid.join("; ")}.` : ""}${refused ? ` Not undone: ${refused}` : ""}`.trim(),
      },
      c.after,
    );
  };
  const no = () => {
    const c = confirm;
    setConfirm(undefined);
    if (c)
      reply(c.request, { text: c.move ? "It stays where it was." : "Nothing undone." }, c.after);
  };

  const view: ReactNode = (
    <>
      {answer && (
        <section aria-label="The history" className="space-y-1">
          <p className={MINE}>{answer.request}</p>
          <div className={cx(SMITHS, "space-y-1")}>
            {answer.text && <p>{answer.text}</p>}
            {answer.lines?.map((l) => (
              <button
                key={l.id}
                type="button"
                data-history-line={l.id}
                onClick={() => onShow?.(l.id)}
                className="block text-left hover:text-accent"
              >
                {l.text}
              </button>
            ))}
            {(answer.chips?.length || answer.all) && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {answer.chips?.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className={CHIP}
                    onClick={() => take(chip) || propose(chip)}
                  >
                    {chip}
                  </button>
                ))}
                {answer.all && (
                  <button
                    type="button"
                    className={CHIP}
                    onClick={() => onShow?.(answer.all === true ? undefined : answer.all)}
                  >
                    Show all
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}
      {confirm && (
        <section aria-label="Confirm" className={cx(SMITHS, "space-y-2")}>
          <p>{confirm.text}</p>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void yes()}>
              Yes
            </Button>
            <Button variant="ghost" disabled={busy} onClick={no}>
              No
            </Button>
          </div>
        </section>
      )}
    </>
  );

  return {
    take,
    view,
    busy,
    /** A confirmation waits: Smith's own question, so the ready prompts rest. */
    waiting: Boolean(confirm),
    /** A new request ends a waiting confirmation; "no", "stop" and "cancel" answer it. */
    interrupt: (text: string): boolean => {
      if (!confirm) {
        setAnswer(undefined);
        return false;
      }
      if (/^(?:no|stop|cancel|nope)[.!]?$/i.test(text.trim())) {
        no();
        return true;
      }
      if (/^(?:yes|ok|okay|sure|do it)[.!]?$/i.test(text.trim())) {
        void yes();
        return true;
      }
      // A question is answered and the confirmation stays; anything else ends it.
      if (!text.trim().endsWith("?")) setConfirm(undefined);
      setAnswer(undefined);
      return false;
    },
  };
}
