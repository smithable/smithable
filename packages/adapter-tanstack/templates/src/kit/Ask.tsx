// Smithable app kit: "Ask" for the people who use the app (docs/design/assistant.md §4 and §6): a
// button that opens a sheet with a question field; the answer is worked out by the app with what
// the person may read, marked as from the records or by an AI, and can be read aloud. A chat
// (A 152): oldest first, earlier turns go with each question, and the conversation stays for the
// browser tab, kept by person, so a reload keeps it and signing out forgets it.
import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import type { Turn } from "./ask";
import type { Answer } from "./assistant.server";
import { Shown } from "./Inspector";
import { w } from "./words";

/** Its texts from the content file (docs/design/ask-defaults.md §2); the kit's words otherwise. */
export interface AskTexts {
  name?: string;
  greeting?: string;
  placeholder?: string;
  about?: string;
}

/** One question and what came of it. */
interface Asked {
  question: string;
  answer?: Answer;
  failed?: string;
}

/**
 * Where the tab keeps a person's conversation, by who, so nobody else's shows: `ask:<who>`
 * holds `{ asked }`, the turns oldest first; an open flow's state (docs/design/ask-flows.md
 * §2) goes beside them in the same object, so the server keeps no session.
 */
const KEPT = "ask:";
interface Kept {
  asked: Asked[];
}

const kept = (who: string): Asked[] => {
  try {
    const found = JSON.parse(sessionStorage.getItem(KEPT + who) ?? "{}") as Partial<Kept>;
    return Array.isArray(found.asked) ? found.asked : [];
  } catch {
    return [];
  }
};

/** What a call gave, in a line: a number, or how many rows and the first ones' names. */
function brief(result: unknown): string {
  if (typeof result !== "object" || result === null) return JSON.stringify(result ?? null);
  const { rows, total } = result as { rows?: unknown; total?: unknown };
  if (Array.isArray(rows)) {
    const names = rows.slice(0, 5).map((row) => {
      const values = Object.values((row ?? {}) as Record<string, unknown>);
      const named =
        (row as { title?: unknown } | null)?.title ?? values.find((v) => typeof v === "string");
      return String(named ?? "");
    });
    return `${rows.length}: ${names.filter(Boolean).join(", ")}`;
  }
  if (typeof total === "number" && Object.keys(result).length === 1) return String(total);
  return JSON.stringify(result).slice(0, 200);
}

/** A turn as the model reads it again: the words shown, else each call and what it gave in a line. */
const turnOf = (a: Asked): Turn => ({
  question: a.question,
  answer:
    a.answer?.text ??
    a.failed ??
    (a.answer?.steps.length
      ? a.answer.steps
          .map((s) => `${s.tool} ${JSON.stringify(s.args)} → ${s.error ?? brief(s.result)}`)
          .join("; ")
      : undefined) ??
    a.answer?.note ??
    "",
});

/** Forgets every conversation the tab keeps: at sign-out, when Ask may not be shown again. */
export function forgetAsked() {
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(KEPT)) sessionStorage.removeItem(key);
  } catch {}
}

export function Ask({
  who,
  ask,
  confirm,
  texts = {},
}: {
  /** Who is asking (a person's id, or "visitor"): whose conversation the tab keeps. */
  who: string;
  ask: (question: string, turns: Turn[]) => Promise<Answer>;
  /** With may: change: makes a proposed change once the person confirms it. */
  confirm?: (proposal: string) => Promise<unknown>;
  texts?: AskTexts;
}) {
  const name = texts.name ?? w.ask;
  const sheet = useRef<HTMLDialogElement>(null);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<Asked[]>([]);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLLIElement>(null);
  // The tab's conversation for this person, once the page runs in the browser; another person's
  // (signed out, or someone else signed in) is forgotten.
  useEffect(() => {
    try {
      for (const key of Object.keys(sessionStorage))
        if (key.startsWith(KEPT) && key !== KEPT + who) sessionStorage.removeItem(key);
    } catch {}
    setAsked(kept(who));
  }, [who]);
  // Who asks now, for an answer that comes after a sign-out or another person's sign-in.
  const asking = useRef(who);
  asking.current = who;
  const keep = (asker: string, turn: Asked) => {
    if (asker !== asking.current) return;
    setAsked((list) => {
      const next = [...list, turn].slice(-20);
      try {
        const found = JSON.parse(sessionStorage.getItem(KEPT + asker) ?? "{}") as Partial<Kept>;
        sessionStorage.setItem(KEPT + asker, JSON.stringify({ ...found, asked: next }));
      } catch {}
      return next;
    });
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: the newest answer, when one comes
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [asked.length]);
  const send = async (q: string) => {
    if (!q || busy) return;
    setBusy(true);
    const asker = who;
    try {
      const answer = await ask(q, asked.map(turnOf));
      keep(asker, { question: q, answer });
      setQuestion("");
    } catch (error) {
      const failed = error instanceof Error ? error.message : String(error);
      keep(asker, { question: q, failed });
    } finally {
      setBusy(false);
    }
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void send(question.trim());
  };
  return (
    <>
      <button
        type="button"
        className="fixed right-4 bottom-4 z-20 inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border bg-card pr-5 pl-2 text-sm font-semibold text-card-foreground shadow-xl outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => sheet.current?.showModal()}
      >
        <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground">
          <Sparkles aria-hidden className="size-4" />
        </span>
        {name}
      </button>
      <dialog
        ref={sheet}
        aria-labelledby="ask-title"
        className="m-0 mt-auto w-full max-w-none rounded-t-xl border bg-background p-0 text-foreground backdrop:bg-black/40 sm:m-auto sm:max-w-xl sm:rounded-xl"
      >
        <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="ask-title" className="text-lg font-semibold">
              {name}
            </h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => sheet.current?.close()}>
              {w.close}
            </Button>
          </div>
          {(texts.greeting || texts.about) && (
            <div className="space-y-1 text-sm">
              {texts.greeting && <p>{texts.greeting}</p>}
              {texts.about && <p className="text-muted-foreground">{texts.about}</p>}
            </div>
          )}
          <ol className="space-y-3">
            {asked.map((a, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: a conversation's turns by their place
                key={i}
                ref={i === asked.length - 1 ? end : undefined}
                data-answer
                className="space-y-2"
              >
                <p className="ml-8 rounded-lg bg-muted px-3 py-2 text-sm">{a.question}</p>
                <div className="space-y-2 rounded-lg border p-3">
                  {(a.answer?.source === "records" || a.answer?.source === "ai") && (
                    <div className="flex justify-end">
                      {a.answer.source === "records" ? (
                        <Badge variant="success">{w.fromYourRecords}</Badge>
                      ) : (
                        <Badge>{w.ai}</Badge>
                      )}
                    </div>
                  )}
                  {a.failed && <p className="text-sm text-destructive">{a.failed}</p>}
                  {a.answer && <Shown answer={a.answer} trace={false} confirm={confirm} />}
                  {/* Questions to try, after the latest answer only: picked, one is asked. */}
                  {i === asked.length - 1 && a.answer?.suggestions?.length ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{w.tryAsking}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {a.answer.suggestions.map((s) => (
                          <Button
                            key={s}
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => void send(s)}
                          >
                            {s}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          <form onSubmit={submit} className="space-y-2">
            <div className="flex gap-2">
              <Input
                aria-label={w.question}
                placeholder={texts.placeholder ?? w.askPlaceholder}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={busy || !question.trim()}>
                {busy ? w.asking : name}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{w.aiMayBeWrong}</p>
          </form>
        </div>
      </dialog>
    </>
  );
}
