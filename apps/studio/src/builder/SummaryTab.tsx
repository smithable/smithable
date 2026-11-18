// The app in plain words, as its own tab beside No code and Code (T962): every section folded
// to its title with its kind's icon (Behavior's own, A 167), the first open at first; each title
// and sentence leads to its part, in No code or in Code as the person chooses.
import type { SummarySection } from "@smithable/index";
import { useState } from "react";
import { cx } from "../ui";
import { AreaIcon } from "./areas";
import { AREAS } from "./SpecForm";
import {
  fieldOf,
  openSections,
  readTarget,
  type SummaryLink,
  type SummaryTarget,
  summaryLink,
  TARGET_KEY,
  toggled,
} from "./summary-tab";

/** Sign-in and access: Who can's own icon (a lock). */
const SIGN_IN = "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4";
const AREA_OF: Record<string, string> = {
  app: "app",
  pages: "pages",
  page: "pages",
  model: "models",
  action: "actions",
  payment: "actions",
  query: "queries",
  outgoing: "outgoing",
  timer: "timers",
  incoming: "incoming",
  plugin: "app",
};
const iconOf = (concept: string) => {
  const kind = concept.split(":")[0] ?? "";
  return kind === "auth" ? SIGN_IN : (AREAS[AREA_OF[kind] ?? "app"]?.icon ?? "");
};

/** Which sections are open, kept while Studio is open (the tab may close and open again). */
let kept: string[] | undefined;

export function SummaryTab({
  sections,
  onOpen,
}: {
  sections: SummarySection[];
  onOpen: (link: NonNullable<SummaryLink>) => void;
}) {
  const [open, setOpen] = useState(() => openSections(sections, kept));
  const [target, setTargetState] = useState<SummaryTarget>(() => {
    try {
      return readTarget(localStorage.getItem(TARGET_KEY));
    } catch {
      return "nocode";
    }
  });
  const setTarget = (next: SummaryTarget) => {
    setTargetState(next);
    try {
      localStorage.setItem(TARGET_KEY, next);
    } catch {}
  };
  const toggle = (concept: string) => {
    const next = toggled(open, concept);
    kept = next;
    setOpen(next);
  };
  const link = (concept: string, text: string, field?: string) => {
    const to = summaryLink(target, concept, field);
    return to ? (
      <button
        type="button"
        className="text-left hover:text-accent hover:underline"
        onClick={() => onOpen(to)}
      >
        {text}
      </button>
    ) : (
      <span>{text}</span>
    );
  };
  return (
    <section aria-label="Summary" className="h-full space-y-3 overflow-auto p-4 text-sm">
      <fieldset className="flex items-center gap-2 text-xs text-muted">
        <legend className="sr-only">Where the links open</legend>
        <span aria-hidden="true">Open in:</span>
        {(
          [
            ["nocode", "No code"],
            ["code", "Code"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={target === value}
            aria-label={`Open links in ${label}`}
            onClick={() => setTarget(value)}
            className={cx(
              "rounded-md border border-line px-2 py-0.5",
              target === value ? "bg-accent-soft font-medium text-fg" : "hover:bg-subtle",
            )}
          >
            {label}
          </button>
        ))}
      </fieldset>
      <p className="text-xs text-muted">The app in plain words. Each line opens where it is set.</p>
      {sections.map((section) => {
        const expanded = open.includes(section.concept);
        const id = `summary-${section.concept.replace(/[^\w-]/g, "-")}`;
        return (
          <div key={section.concept} className="rounded-md border border-line">
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={id}
                aria-label={`${expanded ? "Fold" : "Unfold"} ${section.title}`}
                onClick={() => toggle(section.concept)}
                className="flex items-center gap-2"
              >
                <span aria-hidden="true" className="w-3 text-quiet">
                  {expanded ? "▾" : "▸"}
                </span>
                <AreaIcon d={iconOf(section.concept)} />
              </button>
              <h3 className="font-medium">{link(section.concept, section.title)}</h3>
            </div>
            {expanded && (
              <div id={id} className="space-y-1 border-t border-line px-3 py-2">
                {section.sentences.map((sentence, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a section's sentences are by their place
                  <p key={i}>
                    {link(section.concept, sentence.replace(/^- /, ""), fieldOf(section, sentence))}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
