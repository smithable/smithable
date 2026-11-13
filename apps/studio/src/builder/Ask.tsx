// Describe a change in your own words: a model proposes operations, and every proposal is shown
// first, in the summary's words, and waits for Apply (Johan, 2026-10-11: one click more is the
// design); Discard, Change it in the forms, or Refine it in a few more words (ARCHITECTURE §9.4).

import type { Diagnostic } from "@smithable/core";
import type { Part, SummarySection } from "@smithable/index";
import { Fragment, useEffect, useRef, useState } from "react";
import { type Assumption, api, type Proposal, type TraceEntry } from "../api";
import type { GuideLine } from "../GuideTour";
import { lastLine } from "../history";
import { usageReceipt } from "../receipt";
import { SpeechControls } from "../speech/SpeechControls";
import { useSpeech } from "../speech/useSpeech";
import { Button, cx, Input } from "../ui";
import { useVerified, Verified } from "../Verified";
import { PREFILLED, type Prefill } from "./ChangeForms";
import { CHIP, CHIP_MAIN, MINE, SMITHS } from "./chat-style";
import { CustomCode, customFile } from "./custom-code";
import { asksTheDocs, type DocsHit, docsIndex, searchDocs } from "./docs-search";
import { useHistoryFlow } from "./HistoryFlow";
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
  ai,
  assumptions = [],
  show,
  stage = "window",
  previewRuns = false,
  onClose,
  beta,
  guide,
  onDone,
  onEdit,
  words,
  making = false,
  waiting = [],
  trace,
  ready,
  peopleRunning = false,
  onShowChanges,
  onFeedback,
  speech: speechProviders = [],
}: {
  /** Where Smith may hear and speak, from the host's policy layer (smith-speech.md §3). */
  speech?: { name: "browser" | "service"; onDeviceOnly?: true }[];
  /** Opens Leave feedback (A 242), with the words said to Smith when there are some. */
  onFeedback?: (prefill: string) => void;
  /** Opens the Changes window, at a change when one is given (ask-flows.md §8). */
  onShowChanges?: (id?: string) => void;
  /** Whether the sample users are running: a bare "stop" is then said to them. */
  peopleRunning?: boolean;
  /** The guide's stop, said as Smith's line with Next and Skip (smith-first.md §7). */
  guide?: GuideLine;
  /** The hosted beta, said in Smith's words (smith-first.md §8). */
  beta?: Beta;
  /** Smith's presentation of the app, as far as it has gone (usePresentation). */
  show?: Showing;
  /**
   * Where the thread is: the overlay a new project opens on, the floating panel, or a window
   * (smith-first.md §12.1, §12.3).
   */
  stage?: "overlay" | "panel" | "window";
  /** The preview runs: the overlay's last part offers Show me the app. */
  previewRuns?: boolean;
  /** Show me the app: the overlay closes. */
  onClose?: () => void;
  /** What the draft assumed, asked at the part each concerns (smith-first.md §4). */
  assumptions?: Assumption[];
  /** Where Smith's requests may go, for his AI notice (legal-1.0 U6); empty: no model in use. */
  ai?: string[];
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
    // The sample users are the preview's, not the spec's: "let them run" and "stop" are said
    // to Smith and done at once, with no change to confirm (sample-users.md §5).
    const command = peopleCommand(text, peopleRunning);
    if (command) {
      setBusy(true);
      try {
        const state = await api.peopleDo(command);
        const reply =
          state.stopped ??
          (command === "pause"
            ? 'They stopped. Say "let them run" when you want them back.'
            : command === "everything"
              ? "They are trying everything now: every move with the values the rules allow and forbid, one after another. Open Sample users for what they find, or say stop."
              : "They are using the app now, each at their own pace: open Sample users to watch what they do, or say stop.");
        if (trace) say(text, reply);
        else setOutput(reply);
        setRequest("");
      } catch (error) {
        setOutput((error as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    setOutput("");
    setLocal(undefined);
    setDocs(undefined);
    // Smith looks in the docs for every request (studio-v3.md §2, T755): the parts found go with
    // it so the model answers from them (A 152), and are shown beside the answer to a question.
    // Only the latest question's hits are shown, however the index's loading falls.
    const asked = ++docsAsked.current;
    const question = asksTheDocs(text);
    let found: DocsHit[] = [];
    if (trace) {
      const searched = docsIndex().then(
        (index) => {
          const hits = searchDocs(index, text);
          if (question && asked === docsAsked.current) setDocs(hits);
          return hits;
        },
        () => {
          if (question && asked === docsAsked.current) setDocs("unreachable");
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
              : next.kind === "paused"
                ? pausedWords(next.paused)
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
  // The history read by rule (ask-flows.md §8): what have I changed, undo, milestones.
  const history = useHistoryFlow({
    trace,
    words,
    onDone,
    onShow: onShowChanges,
    propose: (text) => {
      setRequest(text);
      void propose(text);
    },
  });
  // Right after a request's changes applied, "Undo that" is offered until the next thing is sent.
  const [justApplied, setJustApplied] = useState(false);
  // Speech (smith-speech.md, step 1): what is heard goes into the box, and is sent a moment
  // after listening ends unless the box is touched meanwhile.
  const sendLater = useRef<ReturnType<typeof setTimeout>>(undefined);
  const requestNow = useRef(request);
  requestNow.current = request;
  const sendNow = useRef<() => void>(() => {});
  const speech = useSpeech(
    speechProviders,
    (text) => {
      if (!text) return;
      clearTimeout(sendLater.current);
      const next = requestNow.current.trim() ? `${requestNow.current.trim()} ${text}` : text;
      requestNow.current = next;
      setRequest(next);
    },
    (heard) => {
      if (!heard) return;
      clearTimeout(sendLater.current);
      sendLater.current = setTimeout(() => sendNow.current(), 1500);
    },
  );
  const speechNow = useRef(speech);
  speechNow.current = speech;
  // Hold Ctrl+Shift+Space to talk anywhere in Studio (the preview's keys are its own page's);
  // a repeat is ignored, and letting go of any of the three, or leaving the tab, releases.
  // The keys are listened to once; the speech is read through a ref, so a hold that changes the
  // settings (the first use) does not lose its release.
  useEffect(() => {
    let held = false;
    const speech = () => speechNow.current;
    const down = (e: KeyboardEvent) => {
      if (!(e.ctrlKey && e.shiftKey && e.code === "Space")) return;
      e.preventDefault();
      if (e.repeat || held) return;
      held = true;
      speech().listen(true);
    };
    const up = (e: KeyboardEvent) => {
      if (
        !held ||
        !["Space", "ControlLeft", "ControlRight", "ShiftLeft", "ShiftRight"].includes(e.code)
      )
        return;
      held = false;
      speech().release();
    };
    const away = () => {
      if (held) speech().release();
      held = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", away);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", away);
    };
  }, []);
  const apply = async () => {
    if (!proposal) return;
    setBusy(true);
    try {
      const result = await api.applyProposal(proposal.id);
      // The app moved since it was proposed: the same proposal, with what it does now, asked again.
      if (result.stale && proposal.kind === "change") {
        // What it did before is not what it does now: without a new answer, none is shown.
        const { verification: _old, ...rest } = proposal;
        setProposal({
          ...rest,
          ...(result.verification ? { verification: result.verification } : {}),
        });
        setOutput(result.output);
        return;
      }
      const done =
        proposal.kind === "change"
          ? proposal.operations.map((o) => words?.(o.op, o.args) ?? o.description)
          : [];
      setOutput(
        result.ok && done.length
          ? `Done: ${done.join("; ")}. ${usageReceipt(proposal.usage, "by")}.`
          : result.output,
      );
      setProposal(undefined);
      if (result.ok) {
        setRequest("");
        setJustApplied(true);
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
  // The presentation (smith-first.md §3, §12.1), held by Studio so it outlives the panel's moves.
  const parts = show?.parts ?? [];
  const partsSaid = show?.said ?? 0;
  const presenting = show?.going ?? false;
  const overlay = stage === "overlay";
  // A question asked again from the ready prompts (smith-first.md §4).
  const [reasked, setReasked] = useState<Assumption>();
  const answer = (a: Assumption, option: string) => {
    show?.settle(a, option);
    setReasked(undefined);
    const text = `${a.question} ${option}`;
    setRequest(text);
    void propose(text);
  };
  // The ready prompts rest during the presentation and the guide (smith-first.md §12.6).
  const quiet = overlay || presenting || Boolean(guide);
  const leftOpen = !quiet && partsSaid >= parts.length ? (show?.leftOpen ?? []) : [];
  // The preview started to run during the presentation: said with the next part, or at once
  // after the last (smith-first.md §12.1).
  const runsAt = show?.runsAt;
  const runsLine =
    overlay && runsAt !== undefined && (partsSaid > runsAt || runsAt >= parts.length);
  // biome-ignore lint/correctness/useExhaustiveDependencies: when the conversation grows
  useEffect(() => {
    const box = scroller.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [grown, proposal, busy, docs, output, local, waiting.length, guide, partsSaid]);
  const lastPart = overlay && presenting && partsSaid >= parts.length;
  const mood: Mood = guide
    ? "pointing"
    : runsLine && runsAt !== undefined && (partsSaid === runsAt + 1 || runsAt >= parts.length)
      ? "proud"
      : lastPart && !previewRuns
        ? "working"
        : presenting && parts[partsSaid - 1]
          ? (parts[partsSaid - 1]?.expression ?? "pointing")
          : left !== undefined && left <= 15 && !busy && !proposal
            ? left <= 0
              ? "sad"
              : "impatient"
            : busy || making || history.busy
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
  const box = useRef<HTMLTextAreaElement>(null);
  const send = () => {
    if (!request.trim()) return;
    clearTimeout(sendLater.current);
    speech.stopSpeaking();
    setJustApplied(false);
    // "I want to leave feedback", "feedback: <words>": the feedback panel, by rule (A 242).
    const said = feedbackRequest(request.trim());
    if (said !== undefined && onFeedback) {
      setRequest("");
      onFeedback(said);
      return;
    }
    if (!making && history.interrupt(request.trim())) {
      setRequest("");
      return;
    }
    if (!making && history.take(request.trim())) {
      setRequest("");
      setLocal(undefined);
      setOutput("");
      return;
    }
    if (making)
      void api.waiting({ add: request.trim() }).then(
        () => setRequest(""),
        (error: Error) => setOutput(error.message),
      );
    else void propose(followUp(request.trim(), last.current));
  };
  // Esc stops Smith speaking when the focus is in his panel, and does nothing else then (§2.1).
  const panel = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the hook's state as it is now
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !speech.speaking) return;
      if (!panel.current?.contains(document.activeElement)) return;
      e.preventDefault();
      e.stopPropagation();
      speech.stopSpeaking();
    };
    window.addEventListener("keydown", esc, true);
    return () => window.removeEventListener("keydown", esc, true);
  }, [speech.speaking]);
  sendNow.current = () => {
    if (!busy) send();
  };
  // Smith says aloud what he writes, where sound is on (§5): his greeting once, then each new
  // line of the thread, a proposal and its question, and what he answers by himself.
  // The lines after the last one heard, by their time and words; the thread as it first loads is
  // only marked, never read out.
  const lines = trace ? threadLines(trace, said, words) : undefined;
  const lastHeard = useRef<string | undefined>(undefined);
  const newestLine = lines?.at(-1);
  const lastKey = newestLine ? `${newestLine.at}|${newestLine.reply}` : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new last line is the signal
  useEffect(() => {
    if (!lines) return;
    const keys = lines.map((l) => `${l.at}|${l.reply}`);
    if (lastHeard.current !== undefined) {
      const from = keys.indexOf(lastHeard.current);
      for (const line of lines.slice(from + 1)) speech.speak(line.reply);
    }
    lastHeard.current = keys.at(-1) ?? "";
  }, [lastKey]);
  const greeted = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when a voice is there
  useEffect(() => {
    if (greeted.current || !speech.canSpeak || !ready || making) return;
    greeted.current = true;
    speech.speak(greetingText(ready.appName, partsSaid > 0, true).join(" "));
  }, [speech.canSpeak, Boolean(ready), making]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new proposal is the signal
  useEffect(() => {
    if (proposal?.kind === "change")
      speech.speak(
        `I propose: ${proposal.operations.map((o) => words?.(o.op, o.args) ?? o.description).join(". ")}.`,
      );
    else if (proposal?.kind === "question") speech.speak(proposal.question);
  }, [proposal?.id]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new answer is the signal
  useEffect(() => {
    if (output) speech.speak(output);
  }, [output]);

  return (
    <div ref={panel} className="flex min-h-0 flex-1 flex-col">
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
        {/* Whenever Smith can be asked, the app being made included (legal-1.0 U6). */}
        {ai && <AiNotice to={ai} />}
        {ready && !making && (
          <Greeting ready={ready} presenting={partsSaid > 0} sound={speech.canSpeak} />
        )}
        {beta && !making && <BetaLines beta={beta} left={left} />}
        {/* The presentation where it was said: after the lines before it, before the ones since. */}
        {trace && <Thread trace={trace} said={said} words={words} upTo={show?.startedAt} />}
        {ready && !making && show && partsSaid > 0 && (
          <Presentation
            parts={parts.slice(0, partsSaid)}
            going={presenting}
            last={partsSaid >= parts.length}
            overlay={overlay}
            runsAt={runsLine ? runsAt : undefined}
            previewRuns={previewRuns}
            onNext={show.next}
            onSkip={show.stop}
            onShow={onClose}
            questions={(part) => assumptions.filter((a) => a.part === part)}
            settled={show.settled}
            onKeep={(a) => show.settle(a, a.chosen)}
            onAnswer={answer}
          />
        )}
        {trace && show?.startedAt && (
          <Thread trace={trace} said={said} words={words} since={show.startedAt} />
        )}
        {reasked && (
          <AssumptionLine
            a={reasked}
            onKeep={(a) => {
              show?.settle(a, a.chosen);
              setReasked(undefined);
            }}
            onAnswer={answer}
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
          <div
            key={`${guide.stop.anchor}|${guide.stop.text}`}
            data-guide-card={guide.stop.anchor}
            className={cx(SMITHS, "space-y-2")}
          >
            <p className="text-xs text-quiet">
              {guide.at + 1} of {guide.count}
            </p>
            <p className="font-medium">{guide.stop.title}</p>
            <p>{guide.stop.text}</p>
            <div className="flex flex-wrap gap-1.5">
              {guide.chips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.act}
                  className={chip.main ? CHIP_MAIN : CHIP}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {history.view}
        {/* A ready prompt's answer comes last, where the thread is scrolled to (A 200). */}
        {ready && !making && local && <ReadyAnswer shown={local} ready={ready} />}
      </div>
      <form
        className="shrink-0 space-y-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="flex items-end gap-2">
          {/* Made anew when the face changes, so it bounces (smith-first.md §12.2). */}
          <SmithFace key={mood} mood={mood} />
          <textarea
            ref={box}
            aria-label="Describe a change, or ask a question"
            value={request}
            onChange={(e) => {
              // Any touch of the box keeps a spoken message from going by itself.
              clearTimeout(sendLater.current);
              setRequest(e.target.value);
            }}
            onPointerDown={() => clearTimeout(sendLater.current)}
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
        {speechProviders.length > 0 || speech.why ? <SpeechControls speech={speech} /> : null}
        {overlay || presenting
          ? parts.length > 1 && <PartDots at={partsSaid} count={parts.length} />
          : ready &&
            !making &&
            !quiet &&
            !history.waiting && (
              <ReadyChips
                history={
                  trace && lastLine(trace)
                    ? ["What have I changed?", justApplied ? "Undo that" : "Undo the last change"]
                    : []
                }
                onFeedback={onFeedback ? () => onFeedback("") : undefined}
                onSay={(text) => {
                  setJustApplied(false);
                  setLocal(undefined);
                  history.take(text);
                }}
                // Words in the box are a request of their own: the prompts rest until it is sent.
                disabled={busy || Boolean(request.trim())}
                resting={!busy && Boolean(request.trim())}
                leftOpen={leftOpen}
                onReask={setReasked}
                onPick={(prompt) => {
                  // The box gets the start of the request and the cursor after it.
                  if (prompt === "add") {
                    setRequest("Help me add ");
                    setTimeout(() => {
                      const at = box.current;
                      at?.focus();
                      at?.setSelectionRange(at.value.length, at.value.length);
                    });
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

/**
 * The thread: the change log read as a conversation, oldest first, with what this tab's session
 * asked that left no change. Nothing new is stored but those lines.
 */
function Thread({
  trace,
  said,
  words,
  upTo,
  since,
}: {
  trace: TraceEntry[];
  said: Said[];
  words?: Words;
  /** Only the lines up to this time, or after it. */
  upTo?: string;
  since?: string;
}) {
  const lines = threadLines(trace, said, words).filter(
    (l) => (!upTo || l.at <= upTo) && (!since || l.at > since),
  );
  // What the newest change verified, under Smith's line for it (change-verified.md §5.2).
  const newest = trace[0] && !trace[0].isUndo && !trace[0].undone ? trace[0].id : "";
  const [verified, setVerified] = useVerified(newest ? [newest] : []);
  // Nothing yet: the greeting opens the conversation.
  if (!lines.length) return null;
  return (
    <ol aria-label="Thread" className="space-y-3">
      {lines.map((line) => (
        // A change's own id: two lines alike in the same second must not share a key, or the
        // verified line is drawn under the wrong one.
        <li key={`${"id" in line ? line.id : ""}|${line.at}|${line.reply}`} className="space-y-1">
          {line.request && <p className={MINE}>{line.request}</p>}
          <p className={SMITHS}>{line.reply}</p>
          {"id" in line && line.id === newest && verified[newest] && (
            <div className="mr-auto max-w-[85%] px-3">
              <Verified
                verification={verified[newest]}
                newest
                onTested={(v) => setVerified(newest, v)}
              />
            </div>
          )}
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
        id: t.id,
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
  /** The service's state, said at publishing (legal-1.0 U4), with its Acceptable Use Policy. */
  data?: "test" | "live";
  aup?: string;

  /** Applies a note's fix through the operation path, as any change. */
  apply: (op: string, args: Record<string, unknown>) => void;
}

/**
 * What a line says to the sample users, when it is that: let them run, or stop them. A bare
 * "stop" is theirs only while they run; otherwise it is said to Smith.
 */
export function peopleCommand(
  text: string,
  running = false,
): "run" | "everything" | "pause" | undefined {
  const said = text
    .toLowerCase()
    .replace(/^(please|ok|okay|now)[, ]+/, "")
    .replace(/[\s.!]+$/, "")
    .replace(/,? please$/, "");
  const who = "(them|the sample users|the people|sample users|people)";
  if (
    new RegExp(
      `^(let ${who} (run|go|loose)|(start|run) ${who}|show (me )?${who} (using|in use)( it| the app)?)$`,
    ).test(said)
  )
    return "run";
  // Trying everything (sample-users.md §3a): every move's variants, for faults.
  if (/^(try|test) everything$/.test(said) || new RegExp(`^let ${who} try everything$`).test(said))
    return "everything";
  if (new RegExp(`^(stop|pause) ${who}$`).test(said)) return "pause";
  if (running && /^(stop|pause)$/.test(said)) return "pause";
  return undefined;
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
/** Smith's first words, which he says aloud too where sound is on (smith-speech.md §2). */
export function greetingText(appName: string | undefined, presenting: boolean, sound: boolean) {
  return [
    presenting
      ? "Hi! I'm Smith. I build this app with you; here is what it is, part by part."
      : `Hi! How can I help you with your ${appName ? `${appName} ` : ""}app?`,
    ...(sound
      ? ["You hear me as I write: the speaker button turns my voice off and on, and Esc stops me."]
      : []),
  ];
}

function Greeting({
  ready,
  presenting,
  sound,
}: {
  ready: Ready;
  presenting: boolean;
  sound: boolean;
}) {
  return (
    <div className={cx(SMITHS, "space-y-1")}>
      {greetingText(ready.appName, presenting, sound).map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

/**
 * Smith's presentation of the app (smith-first.md §3): the parts said so far, each one message,
 * with its questions after it. On the overlay (§12.1) the current part has Next, and the last
 * Show me the app once the preview runs; in the thread, Next and Skip.
 */
function Presentation({
  parts,
  going,
  last,
  overlay,
  runsAt,
  previewRuns,
  onNext,
  onSkip,
  onShow,
  questions,
  settled,
  onKeep,
  onAnswer,
}: {
  parts: Part[];
  going: boolean;
  /** The last part is said. */
  last: boolean;
  overlay: boolean;
  /** How many parts were said when the preview started to run: its line comes after them. */
  runsAt: number | undefined;
  previewRuns: boolean;
  onNext: () => void;
  onSkip: () => void;
  onShow?: () => void;
  /** The draft's assumptions at a part, asked after it. */
  questions: (part: string) => Assumption[];
  /** The questions answered, with the answer. */
  settled: Map<string, string>;
  onKeep: (a: Assumption) => void;
  onAnswer: (a: Assumption, option: string) => void;
}) {
  const runs = (
    <li className={SMITHS} data-part="runs">
      Your app runs behind me.
    </li>
  );
  return (
    <ol
      aria-label="What the app is"
      aria-live={overlay ? "polite" : undefined}
      className="space-y-3"
    >
      {parts.map((p, i) => {
        const current = going && i === parts.length - 1;
        const open = questions(p.part).some((a) => !settled.has(a.question));
        return (
          <Fragment key={p.part}>
            {runsAt === i && runs}
            <li className="space-y-3">
              <div data-part={p.part} className={cx(SMITHS, "space-y-2")}>
                <p>{p.text}</p>
                {current && !overlay && (
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={onNext} className={CHIP_MAIN}>
                      Next
                    </button>
                    <button type="button" onClick={onSkip} className={CHIP}>
                      Skip
                    </button>
                  </div>
                )}
                {current && overlay && i < parts.length - 1 && !open && (
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={onNext} className={CHIP_MAIN}>
                      Next
                    </button>
                  </div>
                )}
              </div>
              {questions(p.part).map((a) => (
                <AssumptionLine
                  key={a.question}
                  a={a}
                  answered={settled.get(a.question)}
                  onKeep={onKeep}
                  onAnswer={onAnswer}
                />
              ))}
            </li>
          </Fragment>
        );
      })}
      {runsAt !== undefined && runsAt >= parts.length && runs}
      {overlay && going && last && (
        // The last part said: the way out, once there is an app to show.
        <li className={cx(SMITHS, "space-y-2")} data-part="last">
          {previewRuns ? (
            <button type="button" onClick={onShow} className={CHIP_MAIN}>
              Show me the app
            </button>
          ) : (
            <p>A moment, the app is still being made.</p>
          )}
        </li>
      )}
      {!going && (
        <li className={SMITHS} data-part="end">
          That is your app. Tell me what to change, or ask me anything about how it works.
        </li>
      )}
    </ol>
  );
}

/** Where the presentation is, as dots under the thread ("3 of 5"), filling as the parts come. */
function PartDots({ at, count }: { at: number; count: number }) {
  return (
    <p className="flex items-center justify-center gap-1.5">
      <span className="sr-only">
        Part {at} of {count}
      </span>
      {Array.from({ length: count }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: the dots are positions
          key={i}
          aria-hidden="true"
          className={cx(
            "size-1.5 rounded-full transition-colors",
            i < at ? "bg-accent" : "bg-line-strong",
          )}
        />
      ))}
    </p>
  );
}

/**
 * One of the draft's assumptions, asked (smith-first.md §4): the question, what the draft went
 * with, the other answers as chips, and Keep it. An answer is a change proposed as any other;
 * once answered the other options fold away and the answer stays as a tag (§12.2).
 */
function AssumptionLine({
  a,
  answered,
  onKeep,
  onAnswer,
}: {
  a: Assumption;
  answered?: string;
  onKeep: (a: Assumption) => void;
  onAnswer: (a: Assumption, option: string) => void;
}) {
  if (answered !== undefined)
    return (
      <div data-assumption={a.part} data-answered className={cx(SMITHS, "space-y-1.5")}>
        <p>{a.question}</p>
        <span className="inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent">
          {answered}
        </span>
      </div>
    );
  return (
    <div data-assumption={a.part} className={cx(SMITHS, "space-y-2")}>
      <p>{a.question}</p>
      <p className="text-muted">
        I went with: <strong className="font-medium text-fg">{a.chosen}</strong>
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onKeep(a)} className={CHIP_MAIN}>
          Keep it
        </button>
        {a.options
          .filter((o) => o !== a.chosen)
          .map((o) => (
            <button key={o} type="button" onClick={() => onAnswer(a, o)} className={CHIP}>
              {o}
            </button>
          ))}
      </div>
    </div>
  );
}

/** Smith's presentation as Studio holds it (usePresentation). */
export interface Showing {
  parts: Part[];
  /** How many parts are said. */
  said: number;
  /** Whether it is going on: the next part comes by itself after a moment to read. */
  going: boolean;
  /** The draft's questions answered, with the answer (Keep it is the draft's own). */
  settled: Map<string, string>;
  /** Those nobody answered, once the presentation is over: the ready prompts offer them. */
  leftOpen: Assumption[];
  /** How many parts were said when the preview started to run during the overlay. */
  runsAt?: number;
  /** When it started: the thread's lines from then on come after it. */
  startedAt?: string;
  start: () => void;
  next: () => void;
  stop: () => void;
  settle: (a: Assumption, answer: string) => void;
  /** The preview started to run: Smith says so with the next part. */
  markRuns: () => void;
}

/**
 * The presentation's state, held by Studio so the thread can move between the overlay, the
 * floating panel and the window without losing it (smith-first.md §12.3). A part follows after a
 * moment, unless a question at it waits; on the overlay the last part waits for the person's
 * word (`hold`), elsewhere the presentation ends after it.
 */
export function usePresentation(parts: Part[], assumptions: Assumption[], hold: boolean): Showing {
  const [said, setSaid] = useState(0);
  const [going, setGoing] = useState(false);
  const [settled, setSettled] = useState<Map<string, string>>(() => new Map());
  const [runsAt, setRunsAt] = useState<number>();
  const [startedAt, setStartedAt] = useState<string>();
  const next = () => {
    if (said < parts.length) setSaid(said + 1);
    else setGoing(false);
  };
  const waits = assumptions.some(
    (a) => a.part === parts[said - 1]?.part && !settled.has(a.question),
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: each part once, and again once its question is settled
  useEffect(() => {
    if (!going || waits || (hold && said >= parts.length)) return;
    const later = setTimeout(next, 4000);
    return () => clearTimeout(later);
  }, [going, said, waits, hold]);
  return {
    parts,
    said,
    going,
    settled,
    leftOpen: going ? [] : assumptions.filter((a) => !settled.has(a.question)),
    ...(runsAt === undefined ? {} : { runsAt }),
    ...(startedAt ? { startedAt } : {}),
    start: () => {
      setStartedAt(new Date().toISOString());
      setSaid(1);
      setGoing(true);
      setRunsAt(undefined);
    },
    next,
    stop: () => setGoing(false),
    settle: (a, answer) => setSettled((m) => new Map(m).set(a.question, answer)),
    markRuns: () => setRunsAt((r) => r ?? said),
  };
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
    // Counted from now, not from when the panel opened: the beta file may come later.
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, [until]);
  if (!until || Number.isNaN(Date.parse(until))) return undefined;
  return Math.max(0, Math.ceil((Date.parse(until) - now) / 60_000));
}

/** "Ask for an invite": the invite page, the email filled in by the service where it knows it. */
function InviteChip({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={CHIP_MAIN}>
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

/** The ready prompts, under the box: resting while words are in it, and saying so. */
function ReadyChips({
  disabled,
  resting = false,
  onPick,
  leftOpen = [],
  onReask,
  history = [],
  onSay,
  onFeedback,
}: {
  /** The chip that opens Leave feedback (A 242). */
  onFeedback?: () => void;
  /** The history's chips when a line is still in place (ask-flows.md §8), said as if typed. */
  history?: string[];
  onSay?: (text: string) => void;
  disabled: boolean;
  /** Off for the words in the box, which the person is told. */
  resting?: boolean;
  /** The draft's assumptions nobody answered: offered again ("You left open: …"). */
  leftOpen?: Assumption[];
  onReask?: (a: Assumption) => void;
  onPick: (prompt: "next" | "publish" | "add") => void;
}) {
  const chips: ["next" | "publish" | "add", string][] = [
    ["next", "What should I do next?"],
    ["add", "Help me add…"],
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
          className={cx(CHIP, "disabled:pointer-events-none disabled:opacity-50")}
        >
          {label}
        </button>
      ))}
      {history.map((text) => (
        <button
          key={text}
          type="button"
          onClick={() => onSay?.(text)}
          className={cx(CHIP, "disabled:pointer-events-none disabled:opacity-50")}
        >
          {text}
        </button>
      ))}
      {onFeedback && (
        <button type="button" onClick={onFeedback} className={CHIP}>
          Leave feedback
        </button>
      )}
      {leftOpen.map((a) => (
        <button
          key={a.question}
          type="button"
          onClick={() => onReask?.(a)}
          className={cx(CHIP, "disabled:pointer-events-none disabled:opacity-50")}
        >
          You left open: {a.question}
        </button>
      ))}
      {resting && <p className="w-full text-xs text-quiet">Send or clear the box to use these.</p>}
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
          ) : null}
          {ready.home && ready.data && <PublishState data={ready.data} aup={ready.aup} />}
          {ready.home ? null : (
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

/**
 * That Smith is AI, at the first interaction and on (legal-1.0 U6, the AI Act's Article 50):
 * answers may be wrong, and where the question and the records it needs may be sent. With no
 * model configured Smith answers by rule, and says nothing leaves Studio.
 */
function AiNotice({ to }: { to: string[] }) {
  return (
    <p data-part="ai-notice" className="rounded-md bg-subtle px-3 py-2 text-xs text-muted">
      {to.length
        ? `AI assistant — answers may be wrong. What you ask, with the app's files and this conversation, may be sent to ${to.join(" or ")}. Do not include prohibited sensitive information.`
        : "No AI model is in use here: Smith answers by rule, and nothing you type leaves Studio."}
    </p>
  );
}

/**
 * The service's state at publishing, as it is (legal-1.0 U4): test hosting only while the service
 * refuses real data, or live within the Acceptable Use Policy.
 */
export function PublishState({ data, aup }: { data: "test" | "live"; aup?: string | undefined }) {
  const policy = aup ? (
    <a href={aup} target="_blank" rel="noreferrer" className="text-accent underline">
      Acceptable Use Policy
    </a>
  ) : (
    "Acceptable Use Policy"
  );
  return data === "test" ? (
    <p data-part="publish-state" data-state="test">
      Test hosting only. Use fictional data. Do not collect real bookings, customer records or
      mailbox messages. Public demo visitors may still generate technical logs, which are covered by
      the stated privacy arrangements.
    </p>
  ) : (
    <p data-part="publish-state" data-state="live">
      Visitors will be able to use the public pages and forms. Real data is permitted within the{" "}
      {policy}. Review access rules, your app's privacy notice and any AI features before
      publishing. This plan has no contractual uptime SLA. Keep an export of important data.
    </p>
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
      <p data-receipt className="text-xs text-quiet">
        {usageReceipt(
          proposal.usage,
          proposal.kind === "change"
            ? "proposed"
            : proposal.kind === "answer"
              ? "answered"
              : "nothing",
        )}
      </p>
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
          {(proposal.verification?.consequences.length ?? 0) > 0 && (
            // What it will do to what is there now (change-verified.md §5.2), above Apply.
            <section aria-label="What it will do" className="space-y-1 text-sm">
              <p className="font-medium">What it will do</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {proposal.verification?.consequences.map((c) => (
                  <li key={`${c.about}:${c.says}`}>
                    {c.says}
                    {c.undo === "none" && <span className="text-red-700"> (cannot be undone)</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
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
      {proposal.kind === "paused" && (
        <p className="text-sm" role="status" data-paused={proposal.paused.reason}>
          {pausedWords({ ...proposal.paused, invite: undefined })}
          {proposal.paused.invite && (
            <>
              {" "}
              <a
                href={proposal.paused.invite}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Invite someone
              </a>
            </>
          )}
        </p>
      )}
    </section>
  );
}

/**
 * Free building paused (T746), said in Smith's place, not as an error: what happened, when it
 * continues in the person's own time, and that changes made by rule still work.
 */
export function pausedWords(paused: {
  reason: "day" | "month" | "shared";
  until: string;
  invite?: string;
}): string {
  // The date in full: a month's pause may lift weeks away.
  const until = new Date(paused.until).toLocaleString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const why =
    paused.reason === "shared"
      ? "Free building with a model is paused for everyone for a while"
      : `You have used this ${paused.reason}'s free building with a model`;
  return `${why}. It continues ${until}. Changes I can make by rule, without a model, still work: try a plain one, like adding a field.${paused.invite ? ` Invite someone: ${paused.invite}` : ""}`;
}

/**
 * A request to leave feedback, read by rule (A 242): the words to start the panel with (empty for
 * "I want to leave feedback"), or undefined when it is not one.
 */
export function feedbackRequest(text: string): string | undefined {
  // "palaute:" is feedback in Finnish (T731); Swedish says feedback too.
  const words = /^(?:feedback|palaute)\s*:\s*([\s\S]+)$/i.exec(text);
  if (words) return (words[1] ?? "").trim();
  if (
    /^(?:i(?:'d| would)? (?:want|like) to |can i |let me |i want to |please )?(?:leave|give|send) (?:you |some |my )?feedback[.!?]*$/i.test(
      text,
    )
  )
    return "";
  return undefined;
}
