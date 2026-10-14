// "Your app": the app in plain language, a map to its parts (docs/design/studio-v2.md §5).
// A click on a part opens its properties, the same panel Code mode has, where each control is
// an operation; "In my words" rewords a part for this session only and never changes the app;
// the add buttons open the Change tab's forms, filled in with their group.
import type { SummarySection } from "@smithable/index";
import { useEffect, useState } from "react";
import type { Spec } from "../engine";
import { Properties } from "../properties";
import { Button, cx } from "../ui";
import type { Prefill, Run } from "./ChangeForms";

/** Headings for the summary's groups of sections, and what their add button adds. */
const GROUPS: Record<string, { title: string; add?: [string, Prefill] }> = {
  model: { title: "Records", add: ["Add a record", { op: "addModel", args: {} }] },
  pages: { title: "Pages", add: ["Add a page", { op: "addPage", args: {} }] },
  action: { title: "Actions", add: ["Add an action", { op: "addAction", args: {} }] },
  outgoing: { title: "Who is told" },
  query: { title: "Queries" },
  auth: { title: "Sign-in and access" },
};
const kind = (concept: string) => concept.split(":")[0] ?? "";

/**
 * A part in the user's own words, kept for the session. `before` is the summary it was
 * written against: when a change moves the summary on, the generated sentences come back.
 */
interface Wording {
  text: string;
  before: string;
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
  onAdd,
  onWho,
  onLook,
}: {
  app: string;
  sections: SummarySection[];
  spec: Spec;
  run: Run;
  /** Opens the Change tab's form for an addition, filled in. */
  onAdd: (prefill: Prefill) => void;
  /** Opens the Who can tab with a column marked: a role's name, or "anyone". */
  onWho: (column: string) => void;
  /** Opens the Look tab, where a list's columns and a form's fields are set. */
  onLook: () => void;
}) {
  const [wording, setWording] = useState(() => loadWording(app));
  const [updated, setUpdated] = useState<string[]>([]);
  // The part whose properties are open, e.g. "field:Customer.email".
  const [open, setOpen] = useState<string>();
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(app), JSON.stringify(wording));
    } catch {}
  }, [app, wording]);
  // A change moved a reworded part on: its generated sentences come back, marked updated.
  useEffect(() => {
    const replaced = Object.entries(wording)
      .filter(
        ([concept, w]) =>
          sections.find((s) => s.concept === concept)?.sentences.join("\n") !== w.before,
      )
      .map(([concept]) => concept);
    if (!replaced.length) return;
    setWording((w) => Object.fromEntries(Object.entries(w).filter(([c]) => !replaced.includes(c))));
    setUpdated(replaced);
  }, [sections, wording]);

  const heading = (group: string) => {
    const g = GROUPS[group];
    if (!g) return null;
    return (
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-line pb-1">
        <h2 className="text-xs font-semibold tracking-wide text-quiet uppercase">{g.title}</h2>
        {g.add && (
          <button
            type="button"
            className="text-xs font-medium text-accent"
            onClick={() => onAdd(g.add?.[1] as Prefill)}
          >
            {g.add[0]}
          </button>
        )}
      </div>
    );
  };
  // Advice the app is fine without (docs/design/advice.md), each with its one-click way.
  const notes = (spec.diagnostics ?? []).filter((d) => d.severity === "note");
  return (
    <div data-guide="summary" className="space-y-5 p-4">
      {notes.length > 0 && (
        <section
          aria-label="Worth considering"
          className="space-y-2 rounded-md border border-line p-3"
        >
          <h2 className="text-xs font-semibold tracking-wide text-quiet uppercase">
            Worth considering
          </h2>
          <ul className="space-y-1.5 text-sm">
            {notes.map((d) => (
              <li key={`${d.line}:${d.column}:${d.code}`} className="flex items-baseline gap-2">
                <span className="flex-1">{d.message}</span>
                {d.fix && (
                  <Button
                    variant="ghost"
                    className="h-6 shrink-0 border border-line text-xs"
                    onClick={() => d.fix && void run(d.fix.op, d.fix.args)}
                  >
                    Apply
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {sections.map((s, i) => (
        <section key={s.concept} aria-label={s.title}>
          {kind(sections[i - 1]?.concept ?? "") !== kind(s.concept) && heading(kind(s.concept))}
          <Part
            section={s}
            spec={spec}
            run={run}
            // A part named like its group (Pages) needs no heading of its own.
            titled={s.title !== GROUPS[kind(s.concept)]?.title}
            wording={wording[s.concept]?.text}
            updated={updated.includes(s.concept)}
            open={open}
            onOpen={(concept) => setOpen((o) => (o === concept ? undefined : concept))}
            onAdd={onAdd}
            onWho={onWho}
            onLook={onLook}
            onWording={(text) =>
              setWording((w) => {
                const { [s.concept]: _, ...rest } = w;
                return text === undefined
                  ? rest
                  : { ...rest, [s.concept]: { text, before: s.sentences.join("\n") } };
              })
            }
          />
        </section>
      ))}
      {/* Groups that have nothing yet still have their add button. */}
      {!sections.some((s) => kind(s.concept) === "action") && heading("action")}
    </div>
  );
}

/** The concept a line of a part is about: a model's field, or a page in the pages list. */
function conceptOf(
  section: SummarySection,
  line: string,
  index: number,
  spec: Spec,
): string | undefined {
  const item = /^[-•*]\s+(.*)$/.exec(line)?.[1];
  // Access: a role's line, or what anyone may do, opens that column of the Who can tab.
  if (section.concept === "auth") {
    if (line.startsWith("Open to anyone")) return "who:anyone";
    const role = item && /^([a-z][a-zA-Z0-9]*)[ :]/.exec(item)?.[1];
    return role && spec.auth?.roles.some((r) => r.name === role) ? `who:${role}` : undefined;
  }
  if (item === undefined) return undefined;
  if (kind(section.concept) === "model") {
    const field = section.fields?.find((f) => f.text === item);
    return field ? `field:${section.concept.slice("model:".length)}.${field.field}` : undefined;
  }
  if (section.concept === "pages") {
    const page = spec.ir?.pages[index];
    return page ? `page:${page.id}` : undefined;
  }
  return undefined;
}

function Part({
  section,
  spec,
  run,
  titled,
  wording,
  updated,
  open,
  onOpen,
  onAdd,
  onWho,
  onLook,
  onWording,
}: {
  section: SummarySection;
  spec: Spec;
  run: Run;
  titled: boolean;
  wording?: string;
  updated: boolean;
  open?: string;
  onOpen: (concept: string) => void;
  onAdd: (prefill: Prefill) => void;
  onWho: (column: string) => void;
  onLook: () => void;
  onWording: (text: string | undefined) => void;
}) {
  const generated = section.sentences.join("\n");
  const [draft, setDraft] = useState<string>();
  const model =
    kind(section.concept) === "model" ? section.concept.slice("model:".length) : undefined;
  // Under the heading "Customers", "Customers have:" would only repeat it.
  const lines = (titled ? generated.replace(`${section.title} have:\n`, "") : generated).split(
    "\n",
  );
  let item = -1;
  const concepts = lines.map((line) => {
    if (/^[-•*]\s+/.test(line)) item++;
    return conceptOf(section, line, item, spec);
  });
  const properties = (concept: string) =>
    open === concept && (
      <div className="my-2 rounded-md border border-line bg-surface">
        <Properties key={concept} concept={concept} spec={spec} run={run} onLook={onLook} />
      </div>
    );

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {titled &&
            // A kind of record or an action opens its properties (an action's button and help).
            (model || section.concept.startsWith("action:") ? (
              <button
                type="button"
                className="hover:text-accent"
                aria-expanded={open === section.concept}
                onClick={() => onOpen(section.concept)}
              >
                {section.title}
              </button>
            ) : (
              section.title
            ))}
          {updated && <span className="ml-2 text-xs font-normal text-accent">updated</span>}
        </h3>
        {draft === undefined && section.concept !== "auth" && (
          <button
            type="button"
            className="text-xs text-quiet hover:text-accent"
            onClick={() => setDraft(wording ?? generated)}
          >
            In my words
          </button>
        )}
      </div>
      {properties(section.concept)}
      {draft !== undefined ? (
        <div className="space-y-2">
          <textarea
            aria-label={`${section.title}, in your words`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.max(3, draft.split("\n").length + 1)}
            className="block w-full rounded-md border border-line-strong bg-panel px-2 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <p className="text-xs text-quiet">
            Only the wording, for you: it changes nothing in the app. To change the app, click a
            part above, or describe the change in the Changes tab.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                onWording(draft === generated ? undefined : draft);
                setDraft(undefined);
              }}
            >
              Keep my words
            </Button>
            <Button variant="ghost" onClick={() => setDraft(undefined)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : wording !== undefined ? (
        <>
          <Lines text={wording} />
          <button
            type="button"
            className="mt-1 text-xs text-quiet hover:text-accent"
            onClick={() => onWording(undefined)}
          >
            Back to the generated text
          </button>
        </>
      ) : (
        <Lines
          text={lines.join("\n")}
          item={(text, index) => {
            const concept = concepts[index];
            return concept ? (
              <>
                <button
                  type="button"
                  className={cx(
                    // A button stays inline-block whatever its display, and sits on its last
                    // line: aligned to the top, a wrapped entry keeps its bullet on its first.
                    "text-left align-top hover:text-accent",
                    open === concept && "font-medium text-accent",
                  )}
                  aria-expanded={concept.startsWith("who:") ? undefined : open === concept}
                  onClick={() =>
                    concept.startsWith("who:")
                      ? onWho(concept.slice("who:".length))
                      : onOpen(concept)
                  }
                >
                  {text}
                </button>
                {properties(concept)}
              </>
            ) : (
              text
            );
          }}
        />
      )}
      {model && (
        <button
          type="button"
          className="mt-1 text-xs font-medium text-accent"
          onClick={() => onAdd({ op: "addField", args: { model } })}
        >
          Add a field
        </button>
      )}
    </div>
  );
}

/** Sentences as paragraphs, and runs of "- " lines as a bulleted list. */
function Lines({
  text,
  item,
}: {
  text: string;
  /** A line's content, given its index in `text` (default: the text itself). */
  item?: (text: string, index: number) => React.ReactNode;
}) {
  // Each line with its index in `text`, so `item` knows which one it renders.
  type Line = { text: string; index: number };
  const blocks: (Line | Line[])[] = [];
  const show = (line: Line) => (item ? item(line.text, line.index) : line.text);
  text.split("\n").forEach((raw, index) => {
    const bullet = /^[-•*]\s+(.*)$/.exec(raw)?.[1];
    const last = blocks.at(-1);
    if (bullet === undefined) blocks.push({ text: raw, index });
    else if (Array.isArray(last)) last.push({ text: bullet, index });
    else blocks.push([{ text: bullet, index }]);
  });
  return (
    <div className="space-y-1 text-sm leading-relaxed text-fg-soft">
      {blocks.map((block, i) =>
        Array.isArray(block) ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the blocks have no identity of their own
          <ul key={i} className="list-disc space-y-0.5 pl-5">
            {block.map((line) => (
              <li key={line.index}>{show(line)}</li>
            ))}
          </ul>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: the blocks have no identity of their own
          <p key={i}>{show(block)}</p>
        ),
      )}
    </div>
  );
}
