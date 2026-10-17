// The creation wizard (docs/design/studio-v3.md §4): a kind of record, a page or an action
// described in a few words, then the change Smithable makes of it as a form (its name, its fields
// with their types), each part editable, and Create. Nothing is written before Create. The same
// flow in Code (from the editor's suggestions) and in Behavior (its Add): one look, one set of
// words. Esc closes it; Dismiss goes back to the words; Ask Smith for help hands them to Smith.
import { useEffect, useRef, useState } from "react";
import { api, type Proposal } from "../api";
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
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    box.current?.focus();
  }, []);
  const propose = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const next = await api.ask(`${asked}${text.trim()}`);
      setProposal(next);
      setOperations(next.kind === "change" ? next.operations : []);
    } catch (error) {
      setProposal({ kind: "failed", message: (error as Error).message, usage: "", id: "" });
    } finally {
      setBusy(false);
    }
  };
  const create = async () => {
    if (proposal?.kind !== "change") return;
    setBusy(true);
    const edited = JSON.stringify(operations) !== JSON.stringify(proposal.operations);
    // As proposed, one change; edited, each operation as the form has it.
    let ok = true;
    if (!edited) ok = (await api.applyProposal(proposal.id).catch(() => ({ ok: false }))).ok;
    else for (const o of operations) if (ok) ok = await run(o.op, o.args);
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
                    ? `No operation can do this: ${proposal.reason}`
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
              />
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: the proposal's operations by their place
              <p key={i} className="text-sm">
                {words?.(o.op, o.args) ?? o.description}
                {o.destructive && <span className="text-red-700"> (loses data)</span>}
              </p>
            ),
          )}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void create()}>
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
}: {
  args: Record<string, unknown>;
  onArgs: (args: Record<string, unknown>) => void;
}) {
  const fields = Object.entries((args.fields ?? {}) as Record<string, unknown>);
  const setFields = (next: [string, unknown][]) =>
    onArgs({ ...args, fields: Object.fromEntries(next.filter(([name]) => name.trim())) });
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
      {fields.map(([name, type], i) => (
        // A field by its name, which a row's own box changes: the row is made again with it.
        <div key={name} className="flex items-center gap-2 text-xs">
          <input
            aria-label={`Field ${i + 1}`}
            defaultValue={name}
            onBlur={(e) =>
              setFields(fields.map((f, at) => (at === i ? [e.target.value, f[1]] : f)))
            }
            className="h-7 w-28 rounded-md border border-line px-2 text-sm"
          />
          <input
            aria-label={`Type of ${name}`}
            defaultValue={typeof type === "string" ? type : JSON.stringify(type)}
            onBlur={(e) =>
              setFields(
                fields.map((f, at) =>
                  at === i ? [f[0], typeof type === "string" ? e.target.value : type] : f,
                ),
              )
            }
            disabled={typeof type !== "string"}
            className="h-7 flex-1 rounded-md border border-line px-2 font-mono text-xs"
          />
          <button
            type="button"
            aria-label={`Leave out ${name}`}
            onClick={() => setFields(fields.filter((_, at) => at !== i))}
            className="text-quiet hover:text-red-700"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
