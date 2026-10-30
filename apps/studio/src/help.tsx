// Help in Studio (backlog A 204, Johan 2026-10-30): a tooltip for what fits a line, and for what
// is hard to grasp a small question mark that opens a card with a paragraph in Studio's words and
// links into the docs. The words live in this table (as the guide's in guide.ts), so a language
// translates them later. Esc or a click outside closes the card.
import { type ReactNode, useEffect, useId, useRef, useState } from "react";

const DOCS = "https://docs.smithable.ai";

export interface Help {
  title: string;
  text: string;
  links: [string, string][];
}

export const HELP = {
  formula: {
    title: "A formula",
    text: "A formula works a value out from the record's other fields when the button is pressed, like a spreadsheet's: TODAY() for today's date, ROUND(total * 0.25, 2) for a quarter of the total, IF(paid, 0, total) to choose. A formula has parentheses; anything else is a value as written. It is checked when the change is made: a field it names must exist, and what it gives must fit the field it fills.",
    links: [
      ["Formulas in the spec", `${DOCS}/spec.html#formulas`],
      ["Buttons that change a record", `${DOCS}/actions.html`],
    ],
  },
  condition: {
    title: "For records with",
    text: "The button shows only on records that fit every row, and the app refuses it on the others. A choice fits when the record has one of the values ticked; a reference can want nobody, anybody, or for a reference to a person, the one signed in or anyone else. A calculated field is read as the record is loaded.",
    links: [["Conditions on an action", `${DOCS}/spec.html#standard-actions`]],
  },
  merge: {
    title: "Merge rules",
    text: "When records are merged, each field follows its rule: keep the kept record's value, take another's, add the amounts up, join the texts, or ask when the records differ. References to the merged records move to the one that stays.",
    links: [["Merging records", `${DOCS}/spec.html#merging-records`]],
  },
  contract: {
    title: "What the code may touch",
    text: "A custom action's contract names the kinds of record its code reads and writes, and the mail or calls its work may set off. The code is handed only those, so code that reaches further fails its type check: a fence, not a wall. Without one the code may reach anything the person may.",
    links: [["Custom actions", `${DOCS}/spec.html#actions`]],
  },
  aiPolicy: {
    title: "Where a model may run",
    text: "The AI policy says where Smith's model may run: only on this machine, only in the EU, or the best one configured. A project or an organization switches EU-only on as a guarantee; nothing said means the best model configured.",
    links: [["AI in Smithable", `${DOCS}/ai.html`]],
  },
  publish: {
    title: "Publishing",
    text: "Publishing gives the app an address people can open, with sign-in and backups. What you add or change here is the preview's: the published app starts empty, and changes reach it when you publish again.",
    links: [["Self-hosting", `${DOCS}/self-host.html`]],
  },
  code: {
    title: "What goes here?",
    text: "The editor lists what can be written where the cursor is: the keys a place takes, and after a key its values. Ctrl-Space (⌃Space on a Mac) opens the same list as you type.",
    links: [["The spec reference", `${DOCS}/spec.html`]],
  },
} satisfies Record<string, Help>;

export type HelpTopic = keyof typeof HELP;

/**
 * The question mark beside a hard control: a card over the page with the topic's paragraph and
 * links, and `children` (the editor's list of what fits) after them.
 */
export function HelpMark({
  topic,
  onOpen,
  children,
}: {
  topic: HelpTopic;
  /** Opened (the editor shows its list at the cursor). */
  onOpen?: () => void;
  children?: ReactNode;
}) {
  const help: Help = HELP[topic];
  const [open, setOpen] = useState(false);
  const mark = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (!mark.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <span ref={mark} className="relative inline-flex">
      <button
        type="button"
        aria-label={help.title}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        title={help.title}
        // Keeps the focus (an editor's cursor) where it is.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}
        className="flex size-5 shrink-0 items-center justify-center rounded-full border border-line text-[11px] font-semibold text-muted hover:border-accent hover:text-accent"
      >
        ?
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={help.title}
          className="absolute top-full right-0 z-[60] mt-1.5 w-72 space-y-2 rounded-lg border border-line bg-panel p-3 text-left text-sm font-normal text-fg shadow-lg"
        >
          <h3 className="font-semibold">{help.title}</h3>
          <p className="text-fg-soft">{help.text}</p>
          {children}
          <ul className="space-y-0.5 text-xs">
            {help.links.map(([label, href]) => (
              <li key={href}>
                <a href={href} target="_blank" rel="noreferrer" className="text-accent underline">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}
