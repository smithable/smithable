// "Your app": the app in plain language, and each part of it editable in the same words.
// A change to a model's list of fields is read back without AI; anything else goes to the
// model as the before and after of that one part. Either way it is a proposal first.
import { findOperation } from "@smithable/core";
import { readSummaryEdit, type SummarySection } from "@smithable/index";
import { useEffect, useState } from "react";
import { api, type Proposal } from "../api";
import type { Spec } from "../engine";
import { Button } from "../ui";
import { ProposalView, type Words } from "./Ask";
import type { Run } from "./ChangeForms";

/** Headings for the summary's groups of sections (models, actions, queries). */
const GROUPS: Record<string, string> = {
  model: "Records",
  pages: "Pages",
  action: "Actions",
  query: "Queries",
  auth: "Sign-in and access",
};
const kind = (concept: string) => concept.split(":")[0] ?? "";

/**
 * A part in the user's own words, kept for the session: `before` is the summary it was
 * written against, `after` the summary once the change arrived. When the summary moves on
 * from `after` (a change from elsewhere), the generated sentences come back.
 */
interface Wording {
  text: string;
  before: string;
  after?: string;
}

const storageKey = (app: string) => `smithable:wording:${app}`;
function loadWording(app: string): Record<string, Wording> {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(app)) ?? "{}");
  } catch {
    return {};
  }
}

export function AppSummary({
  app,
  sections,
  spec,
  run,
  words,
}: {
  app: string;
  sections: SummarySection[];
  spec: Spec;
  run: Run;
  words: Words;
}) {
  const [wording, setWording] = useState(() => loadWording(app));
  const [updated, setUpdated] = useState<string[]>([]);
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(app), JSON.stringify(wording));
    } catch {}
  }, [app, wording]);
  // Follow the summary: the user's own change arriving, or another one replacing their words.
  useEffect(() => {
    let changed = false;
    const next = { ...wording };
    const replaced: string[] = [];
    for (const [concept, w] of Object.entries(wording)) {
      const now = sections.find((s) => s.concept === concept)?.sentences.join("\n");
      if (now === undefined) {
        delete next[concept];
        changed = true;
      } else if (now !== w.before && w.after === undefined) {
        next[concept] = { ...w, after: now };
        changed = true;
      } else if (w.after !== undefined && now !== w.after) {
        delete next[concept];
        replaced.push(concept);
        changed = true;
      }
    }
    // Settles in one more run: the second finds nothing to change.
    if (changed) setWording(next);
    if (replaced.length) setUpdated(replaced);
  }, [sections, wording]);

  return (
    <div className="space-y-5 p-4">
      {sections.map((s, i) => (
        <section key={s.concept} aria-label={s.title}>
          {GROUPS[kind(s.concept)] && kind(sections[i - 1]?.concept ?? "") !== kind(s.concept) && (
            <h2 className="mb-3 border-b border-neutral-200 pb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              {GROUPS[kind(s.concept)]}
            </h2>
          )}
          <Part
            section={s}
            spec={spec}
            run={run}
            words={words}
            // A part named like its group (Pages) needs no heading of its own.
            titled={s.title !== GROUPS[kind(s.concept)]}
            wording={wording[s.concept]?.text}
            updated={updated.includes(s.concept)}
            onApplied={(text) =>
              setWording((w) => ({ ...w, [s.concept]: { text, before: s.sentences.join("\n") } }))
            }
          />
        </section>
      ))}
    </div>
  );
}

/** A proposal made here: operations read without AI, or the model's. */
type Suggestion =
  | { kind: "local"; operations: { op: string; args: Record<string, unknown> }[] }
  | { kind: "model"; proposal: Proposal };

function Part({
  section,
  spec,
  run,
  words,
  titled,
  wording,
  updated,
  onApplied,
}: {
  section: SummarySection;
  spec: Spec;
  run: Run;
  words: Words;
  titled: boolean;
  wording?: string;
  updated: boolean;
  onApplied: (text: string) => void;
}) {
  const shown = wording ?? section.sentences.join("\n");
  const [draft, setDraft] = useState<string>();
  const [suggestion, setSuggestion] = useState<Suggestion>();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const close = () => {
    setDraft(undefined);
    setSuggestion(undefined);
    setNote("");
  };

  const suggest = async (text: string) => {
    if (!spec.ir) return;
    setNote("");
    const operations = readSummaryEdit(section, text, spec.ir);
    if (operations?.length === 0) return setNote("Nothing changed.");
    let next: Suggestion;
    if (operations) next = { kind: "local", operations };
    else {
      setBusy(true);
      const request = `In the app's plain-language summary, the user rewrote the part "${section.title}" (${section.concept}).\nIt said:\n${section.sentences.join("\n")}\nIt should now say:\n${text}\nChange the app so that it matches the new text.`;
      next = { kind: "model", proposal: await api.ask(request) };
      setBusy(false);
    }
    // A change that loses no data happens at once (Undo takes it back); one that deletes
    // data is shown first.
    const safe =
      next.kind === "local"
        ? next.operations.every((o) => o.op !== "removeField")
        : next.proposal.kind === "change" && !next.proposal.operations.some((o) => o.destructive);
    if (safe) await apply(next, text);
    else setSuggestion(next);
  };
  const apply = async (suggestion: Suggestion, text: string) => {
    setBusy(true);
    let ok = true;
    if (suggestion.kind === "local") {
      // The proposal already said which changes lose data.
      for (const { op, args } of suggestion.operations) {
        ok = await run(op, args, true);
        if (!ok) break;
      }
    } else {
      const result = await api.applyProposal();
      ok = result.ok;
      if (!ok) setNote(result.output);
    }
    setBusy(false);
    if (ok) {
      onApplied(text);
      close();
    }
  };

  const local: Proposal | undefined =
    suggestion?.kind === "local" && spec.ir
      ? {
          kind: "change",
          usage: "Read without AI",
          operations: suggestion.operations.map(({ op, args }) => {
            const operation = findOperation(op);
            return {
              op,
              args,
              description: operation?.describe(args as never, spec.ir as never) ?? op,
              destructive: op === "removeField",
            };
          }),
        }
      : undefined;
  const proposal = suggestion?.kind === "model" ? suggestion.proposal : local;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {titled && section.title}
          {updated && <span className="ml-2 text-xs font-normal text-accent">updated</span>}
        </h3>
        {draft === undefined && section.concept !== "auth" && (
          <button
            type="button"
            className="text-xs text-neutral-500 hover:text-accent"
            aria-label={`Edit ${section.title}`}
            onClick={() => setDraft(shown)}
          >
            Edit
          </button>
        )}
      </div>
      {draft === undefined ? (
        // Under the heading "Customers", "Customers have:" would only repeat it.
        <Lines text={titled ? shown.replace(`${section.title} have:\n`, "") : shown} />
      ) : (
        <div className="space-y-2">
          <textarea
            aria-label={`${section.title}, in your words`}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setSuggestion(undefined);
            }}
            rows={Math.max(3, draft.split("\n").length + 1)}
            className="block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          {!proposal && (
            <div className="flex gap-2">
              <Button onClick={() => void suggest(draft)} disabled={busy || draft === shown}>
                {busy ? "Working…" : "Make the change"}
              </Button>
              <Button variant="ghost" onClick={close} disabled={busy}>
                Cancel
              </Button>
            </div>
          )}
          {proposal && (
            <ProposalView
              proposal={proposal}
              words={words}
              busy={busy}
              onApply={() => suggestion && draft !== undefined && void apply(suggestion, draft)}
              onCancel={() => setSuggestion(undefined)}
            />
          )}
          {note && <p className="text-sm text-neutral-600">{note}</p>}
        </div>
      )}
    </div>
  );
}

/** Sentences as paragraphs, and runs of "- " lines as a bulleted list. */
function Lines({ text }: { text: string }) {
  const blocks: (string | string[])[] = [];
  for (const line of text.split("\n")) {
    const item = /^[-•*]\s+(.*)$/.exec(line)?.[1];
    const last = blocks.at(-1);
    if (item === undefined) blocks.push(line);
    else if (Array.isArray(last)) last.push(item);
    else blocks.push([item]);
  }
  return (
    <div className="space-y-1 text-sm leading-relaxed text-neutral-700">
      {blocks.map((block, i) =>
        Array.isArray(block) ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the blocks have no identity of their own
          <ul key={i} className="list-disc space-y-0.5 pl-5">
            {block.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: the blocks have no identity of their own
          <p key={i}>{block}</p>
        ),
      )}
    </div>
  );
}
