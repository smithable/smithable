// "Your app": the app in plain language, and each part of it editable in the same words.
// A change to a model's list of fields is read back without AI; anything else goes to the
// model as the before and after of that one part. Either way it is a proposal first.
import { findOperation } from "@smithable/core";
import { readSummaryEdit, type SummarySection } from "@smithable/index";
import { useEffect, useState } from "react";
import { api, type Proposal } from "../api";
import type { Spec } from "../engine";
import { Button } from "../ui";
import { ProposalView } from "./Ask";
import type { Run } from "./ChangeForms";

/** Headings for the summary's groups of sections (models, actions, queries). */
const GROUPS: Record<string, string> = { model: "Records", action: "Actions", query: "Queries" };
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
}: {
  app: string;
  sections: SummarySection[];
  spec: Spec;
  run: Run;
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
  wording,
  updated,
  onApplied,
}: {
  section: SummarySection;
  spec: Spec;
  run: Run;
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
    if (operations) return setSuggestion({ kind: "local", operations });
    setBusy(true);
    const request = `In the app's plain-language summary, the user rewrote the part "${section.title}" (${section.concept}).\nIt said:\n${section.sentences.join("\n")}\nIt should now say:\n${text}\nChange the app so that it matches the new text.`;
    setSuggestion({ kind: "model", proposal: await api.ask(request) });
    setBusy(false);
  };
  const apply = async () => {
    if (!suggestion || draft === undefined) return;
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
      onApplied(draft);
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
          {section.title}
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
        shown.split("\n").map((sentence) => (
          <p key={sentence} className="text-sm leading-relaxed text-neutral-700">
            {sentence}
          </p>
        ))
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
                {busy ? "Thinking…" : "Suggest"}
              </Button>
              <Button variant="ghost" onClick={close} disabled={busy}>
                Cancel
              </Button>
            </div>
          )}
          {proposal && (
            <ProposalView
              proposal={proposal}
              busy={busy}
              onApply={() => void apply()}
              onCancel={() => setSuggestion(undefined)}
            />
          )}
          {note && <p className="text-sm text-neutral-600">{note}</p>}
        </div>
      )}
    </div>
  );
}
