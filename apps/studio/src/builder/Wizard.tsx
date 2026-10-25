// The creation wizard (docs/design/studio-v3.md §4): a kind of record, a page or an action
// described in a few words, then the change Smithable makes of it as a form (its name, its fields
// with their types), each part editable, and Create. Nothing is written before Create. The same
// flow in Code (from the editor's suggestions) and in Behavior (its Add): one look, one set of
// words. Esc closes it; Dismiss goes back to the words; Ask Smith for help hands them to Smith.
import { useEffect, useRef, useState } from "react";
import { api, type Proposal } from "../api";
import { plainRefusal } from "../refusal";
import { Button } from "../ui";
import type { Words } from "./Ask";
import type { Run } from "./ChangeForms";

export type WizardKind = "model" | "page" | "action";

const KINDS: Record<WizardKind, { title: string; asked: string; placeholder: string }> = {
  model: {
    title: "Add a kind of record",
    asked: "Add a kind of record: ",
    placeholder:
      "A kind of record and what it holds, e.g. customers with a name, email and phone; only staff may change them",
  },
  page: {
    title: "Add a page",
    asked: "Add a page: ",
    placeholder: "A page and what it shows, e.g. a list of orders by status that sales can open",
  },
  action: {
    title: "Add an action",
    asked: "Add an action: ",
    placeholder: "A button and what it does, e.g. on an order, mark it shipped when it is placed",
  },
};

/** The event that hands words to Smith (the wizard's Ask Smith for help). */
export const ASK_SMITH = "smithable:ask-smith";
/** Where the words wait for a Smith not yet on screen, who takes them as he comes. */
export const HANDED = "smithable:ask-handed";

/** Hands words to Smith: kept for him, and said to him if he is there. */
export function handToSmith(text: string) {
  try {
    sessionStorage.setItem(HANDED, text);
  } catch {}
  window.dispatchEvent(new CustomEvent(ASK_SMITH, { detail: text }));
}

type Operation = Extract<Proposal, { kind: "change" }>["operations"][number];

export function Wizard({
  kind,
  run,
  words,
  onClose,
}: {
  kind: WizardKind;
  run: Run;
  words?: Words;
  onClose: () => void;
}) {
  const { title, asked, placeholder } = KINDS[kind];
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<Proposal>();
  // The operations as the person has edited them in the form.
  const [operations, setOperations] = useState<Operation[]>([]);
  // Why the form cannot be made as it stands (two fields of one name), or why Create was refused.
  const [problem, setProblem] = useState<string>();
  const [refused, setRefused] = useState<string>();
  // The newest request: an answer to an older one (Enter, then Next) is left.
  const asking = useRef(0);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    box.current?.focus();
  }, []);
  const propose = async () => {
    if (!text.trim() || busy) return;
    const n = ++asking.current;
    setBusy(true);
    setRefused(undefined);
    setProblem(undefined);
    let next: Proposal;
    try {
      next = await api.ask(`${asked}${text.trim()}`);
    } catch (error) {
      next = { kind: "failed", message: (error as Error).message, usage: "", id: "" };
    }
    if (n !== asking.current) return;
    setProposal(next);
    setOperations(next.kind === "change" ? next.operations : []);
    setBusy(false);
  };
  const create = async () => {
    if (proposal?.kind !== "change" || problem || busy) return;
    setBusy(true);
    setRefused(undefined);
    const edited = JSON.stringify(operations) !== JSON.stringify(proposal.operations);
    // As proposed, or as edited in the form, one change (a refusal of the edited one is said in
    // the notice at the top).
    let ok = true;
    if (!edited) {
      const result = await api
        .applyProposal(proposal.id)
        .catch((e: Error) => ({ ok: false, output: e.message }));
      ok = result.ok;
      if (!ok) setRefused(plainRefusal(result.output));
    }
    // Edited, still one change: the operations as the form has them, in one batch (#703).
    else
      ok = await run("batch", { operations: operations.map((o) => ({ op: o.op, args: o.args })) });
    setBusy(false);
    if (ok) onClose();
  };
  const setArgs = (i: number, args: Record<string, unknown>) =>
    setOperations((all) => all.map((o, at) => (at === i ? { ...o, args } : o)));
  return (
    <section
      aria-label={title}
      className="space-y-2 border-b border-line bg-subtle p-3 text-sm"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <h3 className="text-xs font-semibold tracking-wide text-quiet uppercase">{title}</h3>
      {proposal?.kind !== "change" ? (
        <>
          <textarea
            ref={box}
            aria-label={`${title}, in your words`}
            placeholder={placeholder}
            value={text}
            rows={2}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void propose();
              }
            }}
            className="block w-full rounded-md border border-line-strong bg-panel px-2 py-1.5 text-sm"
          />
          {proposal && (
            <p role="status" className="text-sm text-muted">
              {proposal.kind === "question"
                ? proposal.question
                : proposal.kind === "answer"
                  ? proposal.text
                  : proposal.kind === "none"
                    ? proposal.reason
                    : proposal.kind === "failed"
                      ? proposal.message
                      : ""}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !text.trim()} onClick={() => void propose()}>
              {busy ? "Working…" : "Next"}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          {operations.map((o, i) =>
            o.op === "addModel" ? (
              <ModelForm
                // biome-ignore lint/suspicious/noArrayIndexKey: the proposal's operations by their place
                key={i}
                args={o.args}
                onArgs={(args) => setArgs(i, args)}
                onProblem={setProblem}
              />
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: the proposal's operations by their place
              <p key={i} className="text-sm">
                {words?.(o.op, o.args) ?? o.description}
                {o.destructive && <span className="text-red-700"> (loses data)</span>}
              </p>
            ),
          )}
          {(problem || refused) && (
            <p role="status" className="text-sm text-red-700">
              {problem ?? refused}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || Boolean(problem)} onClick={() => void create()}>
              Create
            </Button>
            <Button variant="ghost" onClick={() => setProposal(undefined)}>
              Dismiss
            </Button>
            <Button variant="ghost" onClick={() => handToSmith(`${asked}${text.trim()}`)}>
              Ask Smith for help
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** A new kind of record as proposed: its name, and each field with its type, editable. */
function ModelForm({
  args,
  onArgs,
  onProblem,
}: {
  args: Record<string, unknown>;
  onArgs: (args: Record<string, unknown>) => void;
  /** Two fields of one name would merge into one: said, and Create waits. */
  onProblem: (problem: string | undefined) => void;
}) {
  // The rows as the person has them, two of one name included, so nothing merges unseen.
  const [rows, setRows] = useState(() =>
    Object.entries((args.fields ?? {}) as Record<string, unknown>),
  );
  const change = (next: [string, unknown][]) => {
    setRows(next);
    const names = next.map(([name]) => name.trim()).filter(Boolean);
    const twice = names.find((name, at) => names.indexOf(name) !== at);
    onProblem(twice ? `Two fields are called ${twice}: give one of them another name.` : undefined);
    onArgs({ ...args, fields: Object.fromEntries(next.filter(([name]) => name.trim())) });
  };
  return (
    <div className="space-y-1 rounded-md border border-line bg-panel p-2">
      <label className="flex items-center gap-2 text-xs">
        <span className="w-28 text-quiet">Kind of record</span>
        <input
          aria-label="Kind of record"
          value={String(args.model ?? "")}
          onChange={(e) => onArgs({ ...args, model: e.target.value })}
          className="h-7 flex-1 rounded-md border border-line px-2 text-sm"
        />
      </label>
      {rows.map(([name, type], i) => (
        // By place: a row keeps its boxes (and the focus) while its name is typed.
        // biome-ignore lint/suspicious/noArrayIndexKey: the rows by their place
        <div key={i} className="flex items-center gap-2 text-xs">
          <input
            aria-label={`Field ${i + 1}`}
            value={name}
            onChange={(e) => change(rows.map((f, at) => (at === i ? [e.target.value, f[1]] : f)))}
            className="h-7 w-28 rounded-md border border-line px-2 text-sm"
          />
          <input
            aria-label={`Type of field ${i + 1}`}
            value={typeof type === "string" ? type : JSON.stringify(type)}
            onChange={(e) => change(rows.map((f, at) => (at === i ? [f[0], e.target.value] : f)))}
            disabled={typeof type !== "string"}
            className="h-7 flex-1 rounded-md border border-line px-2 font-mono text-xs"
          />
          <button
            type="button"
            aria-label={`Leave out field ${i + 1}`}
            onClick={() => change(rows.filter((_, at) => at !== i))}
            className="text-quiet hover:text-red-700"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
