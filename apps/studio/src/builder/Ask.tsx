// Describe a change in your own words: a model proposes operations, and every proposal is shown
// first, in the summary's words, and waits for Apply (Johan, 2026-10-11: one click more is the
// design); Discard, Change it in the forms, or Refine it in a few more words (ARCHITECTURE §9.4).
import { useEffect, useRef, useState } from "react";
import { api, type Proposal, type TraceEntry } from "../api";
import { Button, Input, Label } from "../ui";
import { PREFILLED, type Prefill } from "./ChangeForms";
import { CustomCode, customFile } from "./custom-code";
import { ASK_SMITH, HANDED } from "./Wizard";

/**
 * Smith's box and thread (docs/design/studio-v3.md §2). `onEdit`, where given, opens a proposed
 * operation in a form with its values filled in. While the
 * app is being made (`making`), a request is kept for later instead (`waiting`, in Studio's
 * server); once the app is in place each is taken in turn, as if typed then.
 */
/** Where the words box keeps a request not yet sent. */
const DRAFT = "smithable:ask-draft";
/** Where the thread keeps what left no change (answers, questions, discarded proposals). */
const SAID = "smithable:ask-said";

/** A line of the thread the change log does not hold: what was asked, and what came of it. */
interface Said {
  at: string;
  request: string;
  reply: string;
}
const readSaid = (): Said[] => {
  try {
    return JSON.parse(sessionStorage.getItem(SAID) ?? "[]") as Said[];
  } catch {
    return [];
  }
};

export function Ask({
  example,
  onDone,
  onEdit,
  words,
  making = false,
  waiting = [],
  trace,
}: {
  /** The box's example, in the app's own words. */
  example?: string;
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
  const [said, setSaidState] = useState(readSaid);
  const say = (request: string, reply: string) => {
    const next = [...said, { at: new Date().toISOString(), request, reply }].slice(-40);
    setSaidState(next);
    try {
      sessionStorage.setItem(SAID, JSON.stringify(next));
    } catch {}
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
    try {
      const next = await api.ask(text);
      setProposal(next);
      // An answer or a refusal is the end of that request: it goes into the thread.
      const reply =
        next.kind === "answer"
          ? next.text
          : next.kind === "none"
            ? `No operation can do this: ${next.reason}`
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

  return (
    <div className="space-y-4 p-4">
      {trace && <Thread trace={trace} said={said} words={words} />}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!request.trim()) return;
          if (making)
            void api.waiting({ add: request.trim() }).then(
              () => setRequest(""),
              (error: Error) => setOutput(error.message),
            );
          else void propose(request.trim());
        }}
      >
        <Label
          text="Describe a change, or ask a question"
          hint={
            example ??
            "For example: customers should have a mobile number. Or: who can delete orders?"
          }
        >
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={2}
            className="block w-full rounded-md border border-line-strong bg-panel px-2 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </Label>
        <Button type="submit" disabled={busy || !request.trim()}>
          {making
            ? "Make it once the app is there"
            : busy && !proposal
              ? "Working…"
              : "Make the change"}
        </Button>
      </form>
      {waiting.length > 0 && (
        <ul aria-label="Waiting" className="space-y-1">
          {waiting.map((text, i) => (
            <li
              // The same request may wait twice: the text and how many alike came before.
              key={`${text}#${waiting.slice(0, i).filter((t) => t === text).length}`}
              className="flex items-center gap-2 text-sm text-muted"
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
      {proposal && (
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
      )}
      {output && <p className="text-sm text-muted">{output}</p>}
    </div>
  );
}

/**
 * The thread: the change log read as a conversation, oldest first, with what this tab's session
 * asked that left no change. Nothing new is stored but those lines.
 */
function Thread({ trace, said, words }: { trace: TraceEntry[]; said: Said[]; words?: Words }) {
  const lines = [
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
  if (!lines.length) return <p className="text-sm text-quiet">Nothing asked or changed yet.</p>;
  return (
    <ol aria-label="Thread" className="space-y-2 text-sm">
      {lines.map((line) => (
        <li key={`${line.at}|${line.reply}`} className="space-y-1">
          {line.request && <p className="ml-6 rounded-md bg-subtle px-2 py-1">{line.request}</p>}
          <p className="text-muted">{line.reply}</p>
        </li>
      ))}
    </ol>
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
      {proposal.kind === "none" && (
        <p className="text-sm">No operation can do this: {proposal.reason}</p>
      )}
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
