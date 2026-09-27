// Describe a change in your own words: a model proposes operations, shown in plain language,
// and nothing changes until you apply them (ARCHITECTURE §9.4).
import { useState } from "react";
import { api, type Proposal } from "../api";
import { Button, Label } from "../ui";

export function Ask() {
  const [request, setRequest] = useState("");
  const [proposal, setProposal] = useState<Proposal>();
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState("");

  const propose = async (text: string) => {
    setBusy(true);
    setOutput("");
    setProposal(await api.ask(text));
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
          {busy && !proposal ? "Thinking…" : "Suggest"}
        </Button>
      </form>
      {proposal && (
        <section
          aria-label="Proposal"
          className="space-y-3 rounded-md border border-neutral-200 p-3"
        >
          <p className="text-xs text-neutral-500">{proposal.usage}</p>
          {proposal.kind === "change" && (
            <>
              <p className="text-sm font-medium">Proposed change</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {proposal.operations.map((o) => (
                  <li key={o.description}>
                    {o.description}
                    {o.destructive && <span className="text-red-700"> (loses data)</span>}
                  </li>
                ))}
              </ol>
              <div className="flex gap-2">
                <Button onClick={apply} disabled={busy}>
                  Apply
                </Button>
                <Button variant="ghost" onClick={() => setProposal(undefined)} disabled={busy}>
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
                    onClick={() => {
                      const detailed = `${request.trim()} (${option})`;
                      setRequest(detailed);
                      void propose(detailed);
                    }}
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
      )}
      {output && <p className="text-sm text-neutral-600">{output}</p>}
    </div>
  );
}
