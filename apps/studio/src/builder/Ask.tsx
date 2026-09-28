// Describe a change in your own words: a model proposes operations, which apply at once when
// they lose no data (Undo takes them back); one that deletes data is shown first and waits
// for Apply (ARCHITECTURE §9.4).
import { useState } from "react";
import { api, type Proposal } from "../api";
import { Button, Label } from "../ui";
import { PREFILLED, type Prefill } from "./ChangeForms";

/** `onEdit` opens a proposed operation in Manual, with its values filled in. */
export function Ask({ onEdit, words }: { onEdit: (prefill: Prefill) => void; words?: Words }) {
  const [request, setRequest] = useState("");
  const [proposal, setProposal] = useState<Proposal>();
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState("");

  const propose = async (text: string) => {
    setBusy(true);
    setOutput("");
    const proposed = await api.ask(text);
    if (proposed.kind === "change" && !proposed.operations.some((o) => o.destructive)) {
      const result = await api.applyProposal();
      const done = proposed.operations.map((o) => words?.(o.op, o.args) ?? o.description);
      setOutput(result.ok ? `Done: ${done.join("; ")}. ${proposed.usage}` : result.output);
      if (result.ok) setRequest("");
    } else setProposal(proposed);
    setBusy(false);
  };
  const apply = async () => {
    setBusy(true);
    const result = await api.applyProposal();
    setOutput(result.output);
    setProposal(undefined);
    if (result.ok) setRequest("");
    setBusy(false);
  };

  return (
    <div className="space-y-4 p-4">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (request.trim()) void propose(request.trim());
        }}
      >
        <Label text="Describe a change" hint="For example: customers should have a mobile number.">
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={3}
            className="block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </Label>
        <Button type="submit" disabled={busy || !request.trim()}>
          {busy && !proposal ? "Working…" : "Make the change"}
        </Button>
      </form>
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
    <section aria-label="Proposal" className="space-y-3 rounded-md border border-neutral-200 p-3">
      {proposal.usage && <p className="text-xs text-neutral-500">{proposal.usage}</p>}
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
                    Edit in Manual
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
      {proposal.kind === "none" && (
        <p className="text-sm">No operation can do this: {proposal.reason}</p>
      )}
      {proposal.kind === "failed" && <p className="text-sm text-red-700">{proposal.message}</p>}
    </section>
  );
}
