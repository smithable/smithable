// Describe a change in your own words: a model proposes operations, which apply at once when
// they lose no data (Undo takes them back); one that deletes data is shown first and waits
// for Apply (ARCHITECTURE §9.4).
import { useEffect, useRef, useState } from "react";
import { api, type Proposal } from "../api";
import { Button, Label } from "../ui";
import { PREFILLED, type Prefill } from "./ChangeForms";

/**
 * `onEdit` opens a proposed operation in the Change tab, with its values filled in. While the
 * app is being made (`making`), a request is kept for later instead (`waiting`, in Studio's
 * server); once the app is in place each is taken in turn, as if typed then.
 */
export function Ask({
  example,
  onDone,
  onEdit,
  words,
  making = false,
  waiting = [],
}: {
  /** The box's example, in the app's own words. */
  example?: string;
  /** A change was made. */
  onDone?: () => void;
  onEdit: (prefill: Prefill) => void;
  words?: Words;
  making?: boolean;
  waiting?: string[];
}) {
  const [request, setRequest] = useState("");
  const [proposal, setProposal] = useState<Proposal>();
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

  const propose = async (text: string) => {
    setBusy(true);
    setOutput("");
    try {
      const proposed = await api.ask(text);
      if (proposed.kind === "change" && !proposed.operations.some((o) => o.destructive)) {
        const result = await api.applyProposal(proposed.id);
        const done = proposed.operations.map((o) => words?.(o.op, o.args) ?? o.description);
        setOutput(
          result.ok ? `Done: ${done.join("; ")}. ${plainUsage(proposed.usage)}` : result.output,
        );
        if (result.ok) {
          setRequest("");
          onDone?.();
        }
      } else setProposal(proposed);
    } catch (error) {
      setOutput((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const apply = async () => {
    if (!proposal) return;
    setBusy(true);
    try {
      const result = await api.applyProposal(proposal.id);
      setOutput(result.output);
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
      <form
        data-guide="change"
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
            className="block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
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
              className="flex items-center gap-2 text-sm text-neutral-600"
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
          onCancel={() => setProposal(undefined)}
          onEdit={onEdit}
          onOption={(option) => {
            const detailed = `${request.trim()} (${option})`;
            setRequest(detailed);
            void propose(detailed);
          }}
        />
      )}
      {output && <p className="text-sm text-neutral-600">{output}</p>}
    </div>
  );
}

/** A proposed change in plain language, with Apply; or the model's question or refusal. */
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
}: {
  proposal: Proposal;
  words?: Words;
  busy: boolean;
  onApply: () => void;
  onCancel: () => void;
  onEdit?: (prefill: Prefill) => void;
  onOption?: (option: string) => void;
}) {
  return (
    <section
      aria-label="Proposal"
      aria-live="polite"
      className="space-y-3 rounded-md border border-neutral-200 p-3"
    >
      {proposal.usage && <p className="text-xs text-neutral-500">{plainUsage(proposal.usage)}</p>}
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
          <div className="flex gap-2">
            <Button onClick={onApply} disabled={busy}>
              Apply
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          </div>
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
                className="border border-neutral-200"
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
