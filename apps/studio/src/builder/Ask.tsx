// Describe a change in your own words: a model proposes operations, and every proposal is shown
// first, in the summary's words, and waits for Apply (Johan, 2026-10-11: one click more is the
// design); Discard, Change it in the forms, or Refine it in a few more words (ARCHITECTURE §9.4).

import type { Diagnostic } from "@smithable/core";
import type { Part, SummarySection } from "@smithable/index";
import { useEffect, useRef, useState } from "react";
import { api, type Proposal, type TraceEntry } from "../api";
import type { GuideLine } from "../GuideTour";
import { Button, cx, Input } from "../ui";
import { PREFILLED, type Prefill } from "./ChangeForms";
import { CustomCode, customFile } from "./custom-code";
import { asksTheDocs, type DocsHit, docsIndex, searchDocs } from "./docs-search";
import { type Mood, SmithFace } from "./SmithFace";
import { ASK_SMITH, HANDED } from "./Wizard";

/**
 * Smith's box and thread (docs/design/studio-v3.md §2). `onEdit`, where given, opens a proposed
 * operation in a form with its values filled in. While the
 * app is being made (`making`), a request is kept for later instead (`waiting`, in Studio's
 * server); once the app is in place each is taken in turn, as if typed then.
 */
/** Where the words box keeps a request not yet sent. */
const DRAFT = "smithable:ask-draft";
/**
 * A line of the thread the change log does not hold: what was asked, and what came of it.
 * Studio's server keeps them while it runs (A 152), so every tab and a reload show the same.
 */
interface Said {
  at: string;
  request: string;
  reply: string;
}

export function Ask({
  presentFirst = false,
  onPresented,
  beta,
  guide,
  onDone,
  onEdit,
  words,
  making = false,
  waiting = [],
  trace,
  ready,
}: {
  /** The guide's stop, said as Smith's line with Next and Skip (smith-first.md §7). */
  guide?: GuideLine;
  /** The hosted beta, said in Smith's words (smith-first.md §8). */
  beta?: Beta;
  /** A new project: Smith presents the app at once (smith-first.md §2). */
  presentFirst?: boolean;
  /** The presentation is over (the guide comes next). */
  onPresented?: () => void;
  /** A change was made. */
  onDone?: () => void;
  onEdit?: (prefill: Prefill) => void;
  words?: Words;
  making?: boolean;
  waiting?: string[];
  /**
   * The change log, shown above the box as a thread with what this tab's session asked that
   * left no change (docs/design/ask-in-studio.md §3); without it, only the box.
   */
  trace?: TraceEntry[];
  /**
   * The ready prompts' answers, made by Studio itself (studio-v3.md §2): the app in words with
   * a way to each part, the advice notes with their fixes, where the app is published.
   */
  ready?: Ready;
}) {
  // A request half written stays when the person looks elsewhere (another tab, a mode) and
  // comes back: kept for the browser tab's session.
  const [request, setRequestState] = useState(() => {
    try {
      return sessionStorage.getItem(DRAFT) ?? "";
    } catch {
      return "";
    }
  });
  const setRequest = (text: string) => {
    setRequestState(text);
    try {
      if (text) sessionStorage.setItem(DRAFT, text);
      else sessionStorage.removeItem(DRAFT);
    } catch {}
  };
  const [proposal, setProposal] = useState<Proposal>();
  // A ready prompt's answer, shown until another request.
  const [local, setLocal] = useState<"next" | "publish">();
  // A question's answer from the docs: the parts found, or that the docs cannot be reached.
  const [docs, setDocs] = useState<DocsHit[] | "unreachable">();
  const docsAsked = useRef(0);
  // The last request and when, for the follow-up rule: a short line or one that leans on it
  // ("yes", "the second one", "also for orders") goes with it; anything else stands alone.
  const last = useRef<{ text: string; at: number; question: boolean }>(undefined);
  const [said, setSaid] = useState<Said[]>([]);
  useEffect(() => {
    void api.said().then(
      (kept) => setSaid(kept.said),
      () => undefined,
    );
  }, []);
  const say = (request: string, reply: string) => {
    setSaid((list) => [...list, { at: new Date().toISOString(), request, reply }]);
    void api.said({ request, reply }).then(
      (kept) => setSaid(kept.said),
      () => undefined,
    );
  };
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState("");
  // The next waiting request, once the app is in place and the box is free: out of the list
  // first, so another page does not take it too.
  const taking = useRef(false);
  // Only a page someone is looking at takes it, so two open tabs do not both take the first.
  const next =
    !making && !busy && !proposal && document.visibilityState === "visible"
      ? waiting[0]
      : undefined;
  useEffect(() => {
    if (next === undefined || taking.current) return;
    taking.current = true;
    setRequest(next);
    void api
      .waiting({ remove: 0 })
      .then(() => propose(next))
      .finally(() => {
        taking.current = false;
      });
  });

  // Words handed over by the creation wizard's "Ask Smith for help": said now, or kept until
  // this panel is on screen to take them.
  const proposeRef = useRef<(text: string) => void>(() => {});
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, and when the making ends
  useEffect(() => {
    const take = () => {
      // While the app is made the words wait for this panel's next turn.
      if (making) return;
      let text: string | null = null;
      try {
        text = sessionStorage.getItem(HANDED);
        sessionStorage.removeItem(HANDED);
      } catch {}
      if (!text) return;
      setRequest(text);
      proposeRef.current(text);
    };
    take();
    window.addEventListener(ASK_SMITH, take);
    return () => window.removeEventListener(ASK_SMITH, take);
  }, [making]);
  const propose = async (text: string) => {
    setBusy(true);
    setOutput("");
    setLocal(undefined);
    setDocs(undefined);
    // Smith looks in the docs too for a question (studio-v3.md §2): the parts found are shown
    // beside the answer, and go with the question so the model answers from them (A 152).
    // Only the latest question's hits are shown, however the index's loading falls.
    const asked = ++docsAsked.current;
    let found: DocsHit[] = [];
    if (trace && asksTheDocs(text)) {
      const searched = docsIndex().then(
        (index) => {
          const hits = searchDocs(index, text);
          if (asked === docsAsked.current) setDocs(hits);
          return hits;
        },
        () => {
          if (asked === docsAsked.current) setDocs("unreachable");
          return [];
        },
      );
      // The question waits a moment for the docs, not longer: Smith answers without them then.
      found = await Promise.race([
        searched,
        new Promise<DocsHit[]>((done) => setTimeout(() => done([]), 2500)),
      ]);
    }
    try {
      const next = await api.ask(text, {
        conversation: trace
          ? threadLines(trace, said, words)
              .slice(-6)
              .map(({ request, reply }) => ({ request: request ?? "", reply }))
          : [],
        docs: found.map(({ title, url, text }) => ({ title, url, text })),
      });
      last.current = { text, at: Date.now(), question: next.kind === "question" };
      setProposal(next);
      // An answer or a refusal is the end of that request: it goes into the thread.
      const reply =
        next.kind === "answer"
          ? next.text
          : next.kind === "none"
            ? next.reason
            : next.kind === "failed"
              ? next.message
              : undefined;
      if (trace && reply) {
        say(text, reply);
        setProposal(undefined);
        setRequest("");
      }
    } catch (error) {
      setOutput((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  proposeRef.current = (text) => void propose(text);
  const apply = async () => {
    if (!proposal) return;
    setBusy(true);
    try {
      const result = await api.applyProposal(proposal.id);
      const done =
        proposal.kind === "change"
          ? proposal.operations.map((o) => words?.(o.op, o.args) ?? o.description)
          : [];
      setOutput(
        result.ok && done.length
          ? `Done: ${done.join("; ")}. ${plainUsage(proposal.usage)}`
          : result.output,
      );
      setProposal(undefined);
      if (result.ok) {
        setRequest("");
        onDone?.();
      }
    } catch (error) {
      setOutput((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // A chat (A 162): the conversation fills the window top down, the greeting first and the
  // newest last, in view; the person's words on the right and Smith's on the left; one box at
  // the foot sends, with the ready prompts under it (Johan, 2026-10-27).
  const scroller = useRef<HTMLDivElement>(null);
  const grown = (trace?.length ?? 0) + said.length;
  // Smith's face says what is going on: hammering while he works or the app is made, then
  // how the last request went, and waiting while nothing is asked.
  const left = useMinutesLeft(beta?.until);
  // The presentation (smith-first.md §3): how many of its parts are said so far, and whether it
  // is going on; a new project's starts at once, "What does this app do?" starts it again.
  const parts = ready?.parts ?? [];
  const [partsSaid, setSaidParts] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const presentedOnce = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the parts are there
  useEffect(() => {
    if (!presentFirst || presentedOnce.current || !parts.length || making) return;
    presentedOnce.current = true;
    setSaidParts(1);
    setPresenting(true);
  }, [presentFirst, parts.length, making]);
  const nextPart = () => {
    if (partsSaid < parts.length) setSaidParts(partsSaid + 1);
    else {
      setPresenting(false);
      onPresented?.();
    }
  };
  // A part follows the one before after a moment to read it; a tap brings it at once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: each part once, as it is partsSaid
  useEffect(() => {
    if (!presenting || partsSaid >= parts.length) return;
    const later = setTimeout(nextPart, 4000);
    return () => clearTimeout(later);
  }, [presenting, partsSaid]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: when the conversation grows
  useEffect(() => {
    const box = scroller.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [grown, proposal, busy, docs, output, local, waiting.length, guide, partsSaid]);
  const mood: Mood = guide
    ? "pointing"
    : presenting && parts[partsSaid - 1]
      ? (parts[partsSaid - 1]?.expression ?? "pointing")
      : left !== undefined && left <= 15 && !busy && !proposal
        ? left <= 0
          ? "sad"
          : "impatient"
        : busy || making
          ? "working"
          : proposal?.kind === "question"
            ? "confused"
            : proposal?.kind === "change"
              ? "pointing"
              : output
                ? output.startsWith("Done: ")
                  ? "happy"
                  : "sad"
                : docs || local
                  ? "pointing"
                  : "waiting";
  const send = () => {
    if (!request.trim()) return;
    if (making)
      void api.waiting({ add: request.trim() }).then(
        () => setRequest(""),
        (error: Error) => setOutput(error.message),
      );
    else void propose(followUp(request.trim(), last.current));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {beta && left !== undefined && left <= 15 && (
        // The sandbox's time, where it stays in view however the thread scrolls.
        <p className="flex shrink-0 items-center gap-2 border-b border-line bg-subtle px-4 py-1.5 text-xs">
          <span className="flex-1">
            {left > 0 ? `Sandbox: ${left} min left` : "The sandbox has ended"}
          </span>
          {beta.invite && <InviteChip href={beta.invite} />}
        </p>
      )}
      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {ready && !making && <Greeting ready={ready} />}
        {beta && !making && <BetaLines beta={beta} left={left} />}
        {trace && <Thread trace={trace} said={said} words={words} />}
        {ready && !making && local && <ReadyAnswer shown={local} ready={ready} />}
        {ready && !making && partsSaid > 0 && (
          <Presentation
            parts={parts.slice(0, partsSaid)}
            going={presenting}
            onNext={nextPart}
            onSkip={() => {
              setSaidParts(parts.length);
              setPresenting(false);
              onPresented?.();
            }}
            onJump={ready.onJump}
          />
        )}
        {waiting.length > 0 && (
          <ul aria-label="Waiting" className="space-y-1">
            {waiting.map((text, i) => (
              <li
                // The same request may wait twice: the text and how many alike came before.
                key={`${text}#${waiting.slice(0, i).filter((t) => t === text).length}`}
                className={cx(MINE, "flex items-center gap-2 text-muted")}
              >
                <span className="min-w-0 flex-1 truncate">Waiting: {text}</span>
                <Button
                  variant="ghost"
                  className="h-6"
                  aria-label={`Take back: ${text}`}
                  onClick={() => void api.waiting({ remove: i }).catch(() => undefined)}
                >
                  Take back
                </Button>
              </li>
            ))}
          </ul>
        )}
        {/* What is being asked now, until it is answered and goes into the thread. */}
        {(busy || proposal) && request.trim() && <p className={MINE}>{request.trim()}</p>}
        {busy && !proposal && (
          <p className={cx(SMITHS, "animate-pulse text-quiet")} aria-hidden="true">
            …
          </p>
        )}
        {proposal && (
          <div className="mr-8">
            <ProposalView
              proposal={proposal}
              words={words}
              busy={busy}
              onApply={apply}
              onCancel={() => {
                if (trace) say(request.trim(), "Discarded.");
                setProposal(undefined);
              }}
              onEdit={onEdit}
              onOption={(option) => {
                const detailed = `${request.trim()} (${option})`;
                setRequest(detailed);
                void propose(detailed);
              }}
              onRefine={(more) => {
                const detailed = `${request.trim()} (${more})`;
                setRequest(detailed);
                void propose(detailed);
              }}
            />
          </div>
        )}
        {docs && (
          <section aria-label="From the docs" className={cx(SMITHS, "space-y-1")}>
            <h3 className="text-xs font-semibold tracking-wide text-quiet uppercase">
              From the docs
            </h3>
            {docs === "unreachable" ? (
              <p className="text-muted">The docs are not reachable right now.</p>
            ) : docs.length === 0 ? (
              <p className="text-muted">The docs say nothing on this.</p>
            ) : (
              docs.map((hit) => (
                <p key={hit.url}>
                  <a
                    href={hit.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline"
                  >
                    {hit.title}
                  </a>
                  <span className="block text-xs text-muted">{hit.line}</span>
                </p>
              ))
            )}
          </section>
        )}
        {output && <p className={SMITHS}>{output}</p>}
        {guide && (
          <div data-guide-card={guide.stop.anchor} className={cx(SMITHS, "space-y-2")}>
            <p className="text-xs text-quiet">
              {guide.at + 1} of {guide.count}
            </p>
            <p className="font-medium">{guide.stop.title}</p>
            <p>{guide.stop.text}</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={guide.next}
                className="rounded-full border border-accent px-2.5 py-0.5 text-xs text-accent hover:bg-accent-soft"
              >
                {guide.at === guide.count - 1 ? "Done" : "Next"}
              </button>
              {guide.at < guide.count - 1 && (
                <button
                  type="button"
                  onClick={guide.end}
                  className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted hover:border-accent hover:text-accent"
                >
                  Skip guide
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <form
        className="shrink-0 space-y-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="flex items-end gap-2">
          <SmithFace mood={mood} />
          <textarea
            aria-label="Describe a change, or ask a question"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            // Enter sends, as in any chat; Shift-Enter starts a new line.
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
              e.preventDefault();
              if (!busy) send();
            }}
            rows={2}
            className="block min-w-0 flex-1 resize-none rounded-md border border-line-strong bg-panel px-2 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <Button type="submit" disabled={busy || !request.trim()}>
            {making ? "Make it once the app is there" : busy && !proposal ? "Working…" : "Send"}
          </Button>
        </div>
        {ready && !making && (
          <ReadyChips
            // Words in the box are a request of their own: the prompts rest until it is sent.
            disabled={busy || Boolean(request.trim())}
            onPick={(prompt) => {
              if (prompt === "add") {
                setRequest("Help me add ");
                return;
              }
              // What does this app do?: Smith presents it again, part by part.
              if (prompt === "what") {
                setLocal(undefined);
                setSaidParts(1);
                setPresenting(true);
                return;
              }
              setLocal(prompt);
            }}
          />
        )}
      </form>
    </div>
  );
}

/** A message's bubble: the person's on the right, Smith's on the left. */
const MINE =
  "ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent-soft px-3 py-1.5 text-sm";
const SMITHS =
  "mr-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-subtle px-3 py-1.5 text-sm";

/**
 * The thread: the change log read as a conversation, oldest first, with what this tab's session
 * asked that left no change. Nothing new is stored but those lines.
 */
function Thread({ trace, said, words }: { trace: TraceEntry[]; said: Said[]; words?: Words }) {
  const lines = threadLines(trace, said, words);
  // Nothing yet: the greeting opens the conversation.
  if (!lines.length) return null;
  return (
    <ol aria-label="Thread" className="space-y-3">
      {lines.map((line) => (
        <li key={`${line.at}|${line.reply}`} className="space-y-1">
          {line.request && <p className={MINE}>{line.request}</p>}
          <p className={SMITHS}>{line.reply}</p>
        </li>
      ))}
    </ol>
  );
}

/** The thread's lines, oldest first: the change log's latest with what left no change. */
function threadLines(trace: TraceEntry[], said: Said[], words?: Words) {
  return [
    ...trace.slice(0, 30).map((t) => {
      const plain = t.operation && words?.(t.operation.op, t.operation.args);
      const what = plain ?? t.description;
      return {
        at: t.at,
        request: t.request,
        reply: t.isUndo
          ? what.startsWith("Undid: ")
            ? what
            : `Undid: ${what}`
          : t.undone
            ? `${what} (undone)`
            : `Done: ${what}`,
      };
    }),
    ...said,
  ].sort((a, b) => a.at.localeCompare(b.at));
}

/** What Smith answers by himself (studio-v3.md §2), from the app and its checks. */
export interface Ready {
  sections: SummarySection[];
  /** The presentation's parts (smith-first.md §3), from the app by rule. */
  parts?: Part[];
  /** The app's name, for the greeting. */
  appName?: string;
  /** The validator's notes: advice with its fix. */
  notes: Diagnostic[];
  /** Hosted: where the app is published and shared. */
  home?: string;
  /** Applies a note's fix through the operation path, as any change. */
  apply: (op: string, args: Record<string, unknown>) => void;
  /** Opens the part of the app a sentence is about (No code's Behavior). */
  onJump: (concept: string) => void;
}

/**
 * The words that lean on the last request go with it (studio-v3.md §2): a short line ("yes",
 * "the second one") or one that begins with a word that needs what came before, within a
 * minute of it, or within five when Smith had asked a question. A longer line that does not
 * lean stands alone, even after a question. By pattern, no model.
 */
export function followUp(
  text: string,
  last: { text: string; at: number; question: boolean } | undefined,
): string {
  if (!last) return text;
  const short = text.split(/\s+/).length <= 3;
  const leaning =
    /^(yes|no|ok|also|and|but|it|that|this|them|those|the (first|second|third|last|other)( one)?)\b/i.test(
      text,
    );
  const age = Date.now() - last.at;
  const recent = age < 60_000 || (last.question && age < 5 * 60_000);
  return (short || leaning) && recent ? `${last.text} (${text})` : text;
}

/** Smith's greeting, by rule, as an assistant opens a chat; no model is asked (Johan, 2026-10-23). */
function Greeting({ ready }: { ready: Ready }) {
  return (
    <div className={cx(SMITHS, "space-y-1")}>
      <p>Hi! How can I help you with your {ready.appName ? `${ready.appName} ` : ""}app?</p>
    </div>
  );
}

/**
 * Smith's presentation of the app (smith-first.md §3): the parts said so far, each one message
 * with a way to the places of Behavior it covers; while it goes on, Next and Skip as chips.
 */
function Presentation({
  parts,
  going,
  onNext,
  onSkip,
  onJump,
}: {
  parts: Part[];
  going: boolean;
  onNext: () => void;
  onSkip: () => void;
  onJump: (concept: string) => void;
}) {
  return (
    <ol aria-label="What the app is" className="space-y-3">
      {parts.map((p, i) => (
        <li key={p.part} data-part={p.part} className={cx(SMITHS, "space-y-2")}>
          <p>{p.text}</p>
          <div className="flex flex-wrap gap-1.5">
            {p.concepts[0] && (
              <button
                type="button"
                onClick={() => onJump(p.concepts[0] as string)}
                className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted hover:border-accent hover:text-accent"
              >
                Show me
              </button>
            )}
            {going && i === parts.length - 1 && (
              <>
                <button
                  type="button"
                  onClick={onNext}
                  className="rounded-full border border-accent px-2.5 py-0.5 text-xs text-accent hover:bg-accent-soft"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={onSkip}
                  className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted hover:border-accent hover:text-accent"
                >
                  Skip
                </button>
              </>
            )}
          </div>
        </li>
      ))}
      {!going && (
        <li className={SMITHS} data-part="end">
          That is your app. Tell me what to change, or ask me anything about how it works.
        </li>
      )}
    </ol>
  );
}

/** The hosted beta's facts (smith-first.md §8). */
export interface Beta {
  until?: string;
  invite?: string;
  guide?: string;
}

/** Whole minutes until `until`, counted again every half minute; none without it. */
function useMinutesLeft(until: string | undefined): number | undefined {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, [until]);
  if (!until || Number.isNaN(Date.parse(until))) return undefined;
  return Math.max(0, Math.ceil((Date.parse(until) - now) / 60_000));
}

/** "Ask for an invite": the invite page, the email filled in by the service where it knows it. */
function InviteChip({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-full border border-accent px-2.5 py-0.5 text-xs text-accent hover:bg-accent-soft"
    >
      Ask for an invite
    </a>
  );
}

/**
 * The beta in Smith's words: what it is and the tester guide; in a sandbox how long it lasts and
 * how to keep the app, again at fifteen minutes left, and at its end.
 */
function BetaLines({ beta, left }: { beta: Beta; left: number | undefined }) {
  const guide = beta.guide && (
    <a href={beta.guide} target="_blank" rel="noreferrer" className="text-accent underline">
      the tester guide
    </a>
  );
  return (
    <>
      <div className={cx(SMITHS, "space-y-2")} data-beta="intro">
        <p>
          Smithable is in a private beta.{" "}
          {guide ? <>Everything a tester needs is in {guide}.</> : null}
          {beta.until && left !== undefined
            ? ` This is a sandbox, open until ${new Date(beta.until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}: ask for an invite to keep what you make.`
            : ""}
        </p>
        {left !== undefined && beta.invite && <InviteChip href={beta.invite} />}
      </div>
      {left !== undefined && left <= 15 && left > 0 && (
        <p className={SMITHS} data-beta="soon">
          {left} minutes of the sandbox are left. Copy your description now if you want to keep it,
          and ask for an invite to keep your apps.
        </p>
      )}
      {left === 0 && (
        <p className={SMITHS} data-beta="ended">
          The sandbox has ended and is being removed. Copy your description if you want it; ask for
          an invite to keep your apps.
        </p>
      )}
    </>
  );
}

/** The ready prompts, under the box: resting while words are in it. */
function ReadyChips({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (prompt: "next" | "what" | "publish" | "add") => void;
}) {
  const chips: ["next" | "what" | "publish" | "add", string][] = [
    ["next", "What should I do next?"],
    ["add", "Help me add…"],
    ["what", "What does this app do?"],
    ["publish", "How do I publish?"],
  ];
  return (
    <fieldset aria-label="Ready prompts" disabled={disabled} className="flex flex-wrap gap-1.5">
      <legend className="sr-only">Ready prompts</legend>
      {chips.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onPick(id)}
          className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-50"
        >
          {label}
        </button>
      ))}
    </fieldset>
  );
}

/** The answer to the ready prompt picked, Smith's by rule, shown until another request. */
function ReadyAnswer({ shown, ready }: { shown: "next" | "publish"; ready: Ready }) {
  return (
    <>
      {shown === "next" && (
        <section aria-label="What to do next" className={cx(SMITHS, "space-y-1")}>
          {ready.notes.length === 0 ? (
            <p>Nothing stands out: the app's checks have no advice. Try it in the preview.</p>
          ) : (
            ready.notes.slice(0, 5).map((n) => (
              <p key={`${n.line}:${n.message}`} className="flex items-baseline gap-2">
                <span className="flex-1">{n.message}</span>
                {n.fix && (
                  <Button
                    variant="ghost"
                    className="h-6 shrink-0"
                    onClick={() => n.fix && ready.apply(n.fix.op, n.fix.args)}
                  >
                    Apply
                  </Button>
                )}
              </p>
            ))
          )}
        </section>
      )}
      {shown === "publish" && (
        <section aria-label="How to publish" className={SMITHS}>
          {ready.home ? (
            <p>
              On smithable.ai it is one step:{" "}
              <a href={ready.home} className="text-accent underline">
                Publish and share
              </a>{" "}
              gives the app its address, with sign-in and backups.
            </p>
          ) : (
            <p>
              On your own machine an app is published as a container:{" "}
              <a
                href="https://docs.smithable.ai/self-host.html"
                target="_blank"
                rel="noreferrer"
                className="text-accent underline"
              >
                Self-hosting
              </a>{" "}
              says how, with its Release checks.
            </p>
          )}
        </section>
      )}
    </>
  );
}

/** Words an operation the Builder's way, where it can. */
export type Words = (op: string, args: Record<string, unknown>) => string | undefined;

export function ProposalView({
  proposal,
  words,
  busy,
  onApply,
  onCancel,
  onEdit,
  onOption,
  onRefine,
}: {
  proposal: Proposal;
  words?: Words;
  busy: boolean;
  onApply: () => void;
  onCancel: () => void;
  onEdit?: (prefill: Prefill) => void;
  onOption?: (option: string) => void;
  /** The proposal asked again with a few more words, as the model's question does. */
  onRefine?: (more: string) => void;
}) {
  const [more, setMore] = useState("");
  const editable =
    proposal.kind === "change"
      ? proposal.operations.find((o) => PREFILLED.includes(o.op) && o.args.route === undefined)
      : undefined;
  const custom =
    proposal.kind === "change" ? proposal.operations.flatMap((o) => customFile(o.op, o.args)) : [];
  return (
    <section
      aria-label="Proposal"
      aria-live="polite"
      className="space-y-3 rounded-md border border-line p-3"
    >
      {proposal.usage && <p className="text-xs text-quiet">{plainUsage(proposal.usage)}</p>}
      {proposal.kind === "change" && (
        <>
          <p className="text-sm font-medium">Proposed change</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {proposal.operations.map((o) => (
              <li key={o.description}>
                {words?.(o.op, o.args) ?? o.description}
                {o.destructive && <span className="text-red-700"> (loses data)</span>}
                {onEdit && PREFILLED.includes(o.op) && o.args.route === undefined && (
                  <button
                    type="button"
                    className="ml-2 text-xs text-accent underline"
                    onClick={() => onEdit({ op: o.op, args: o.args })}
                  >
                    Edit in a form
                  </button>
                )}
              </li>
            ))}
          </ol>
          {custom.length > 0 && <CustomCode files={custom} />}
          <div className="flex flex-wrap gap-2">
            <Button onClick={onApply} disabled={busy}>
              Apply
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={busy}>
              Discard
            </Button>
            {onEdit && editable && (
              <Button
                variant="ghost"
                onClick={() => onEdit({ op: editable.op, args: editable.args })}
                disabled={busy}
              >
                Change it
              </Button>
            )}
          </div>
          {onRefine && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (more.trim()) onRefine(more.trim());
              }}
            >
              <Input
                aria-label="Refine the proposal"
                placeholder="Say more, e.g. only for enterprise customers"
                value={more}
                onChange={(e) => setMore(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" variant="ghost" disabled={busy || !more.trim()}>
                Refine
              </Button>
            </form>
          )}
        </>
      )}
      {proposal.kind === "question" && (
        <>
          <p className="text-sm">{proposal.question}</p>
          <div className="flex flex-wrap gap-2">
            {proposal.options.map((option) => (
              <Button
                key={option}
                variant="ghost"
                className="border border-line"
                disabled={!onOption}
                onClick={() => onOption?.(option)}
              >
                {option}
              </Button>
            ))}
          </div>
        </>
      )}
      {proposal.kind === "answer" && (
        <p className="text-sm" role="status">
          {proposal.text}
        </p>
      )}
      {proposal.kind === "none" && <p className="text-sm">{proposal.reason}</p>}
      {proposal.kind === "failed" && <p className="text-sm text-red-700">{proposal.message}</p>}
    </section>
  );
}

/**
 * The usage line in No code's words: whether a model was needed, and which. Code mode shows the
 * engine's own line (the tier, tokens and cost).
 */
function plainUsage(usage: string): string {
  if (!usage || usage.startsWith("Generator") || usage === "No model was used")
    return "No AI needed.";
  const model = /\(([^)]+)\)/.exec(usage)?.[1];
  return model ? `Made with ${model}.` : "";
}
