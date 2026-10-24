// The No code window (docs/design/studio-v3.md §1): Behavior (every setting of the spec), Look,
// Who can and Content (the texts, with Languages under them). What the preview reports in it
// lands here: a part picked in Select opens Behavior at it, columns dragged and texts changed in
// place are made as changes.
import { describeChange, type SummarySection, summarize } from "@smithable/index";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "../api";
import type { Spec } from "../engine";
import { isPreviewMessage, type Place, type Selection } from "../preview";
import { Panel, Tabs } from "../ui";
import { swipe } from "../windows";
import type { Run } from "./ChangeForms";
import { ImportRecords, OwnCode } from "./EntryTools";
import { Languages } from "./Languages";
import { Look } from "./Look";
import { SpecForm } from "./SpecForm";
import { WhoCan } from "./WhoCan";
import { Wizard, type WizardKind } from "./Wizard";

export type SubView = "behavior" | "look" | "who" | "content";
const SUB_VIEWS: SubView[] = ["behavior", "look", "who", "content"];

/** A part picked in the preview, as the sub view and the place in its file it opens at. */
function placeOf(s: Selection | undefined): { sub: SubView; path: string[] } | undefined {
  const [kind = "", name = ""] = s?.concept.split(/:(.*)/s) ?? [];
  const [model = "", field] = name.split(".");
  if (kind === "field" && field)
    return { sub: "behavior", path: ["models", model, "fields", field] };
  if (kind === "model") return { sub: "behavior", path: ["models", name] };
  if (kind === "page") return { sub: "behavior", path: ["pages", name] };
  if (kind === "action") return { sub: "behavior", path: ["actions", name] };
  if (kind === "text") return { sub: "content", path: name.split(".") };
  return undefined;
}

/** The event that opens a part of the app in Behavior (Smith's answer leads there). */
export const OPEN_PART = "smithable:open-part";

/** Where a summary's part is set: its entry in Behavior, or Who can for sign-in and access. */
function entryOf(concept: string): { sub: SubView; path: string[] } | undefined {
  const [kind = "", name = ""] = concept.split(/:(.*)/s);
  const area = {
    model: "models",
    action: "actions",
    query: "queries",
    outgoing: "outgoing",
    timer: "timers",
    incoming: "incoming",
    page: "pages",
  }[kind];
  if (area) return { sub: "behavior", path: [area, name] };
  if (kind === "app" || kind === "pages") return { sub: "behavior", path: [kind] };
  if (kind === "auth") return { sub: "who", path: [] };
  return undefined;
}

/**
 * The app in plain words (studio-v3.md §5, Johan 2026-10-17): summarize()'s sentences at the
 * top of Behavior, the first parts shown and the rest behind Show all. Each sentence leads to
 * the entry it was made from; nothing here is edited.
 */
function Summary({
  sections,
  onJump,
}: {
  sections: SummarySection[];
  onJump: (at: { sub: SubView; path: string[] }) => void;
}) {
  const [all, setAll] = useState(false);
  // Folded, a few lines, so what follows the description is in view (Johan, 2026-10-23).
  const SECTIONS = 2;
  const SENTENCES = 3;
  const shown = all ? sections : sections.slice(0, SECTIONS);
  const more =
    sections.length > SECTIONS || shown.some((section) => section.sentences.length > SENTENCES);
  const jump = (at: { sub: SubView; path: string[] } | undefined, text: string, key: string) =>
    at ? (
      <button
        key={key}
        type="button"
        className="text-left hover:text-accent hover:underline"
        onClick={() => onJump(at)}
      >
        {text}
      </button>
    ) : (
      <span key={key}>{text}</span>
    );
  return (
    <section aria-label="The app in words" className="space-y-3 border-b border-line p-4 text-sm">
      {shown.map((section) => {
        const at = entryOf(section.concept);
        return (
          <div key={section.concept} className="space-y-1">
            <h3 className="font-medium">{jump(at, section.title, "title")}</h3>
            {(all ? section.sentences : section.sentences.slice(0, SENTENCES)).map(
              (sentence, i) => {
                // A field's own line leads to the field; the others to their part.
                const field = section.fields?.find((f) => f.text === sentence.replace(/^- /, ""));
                const to =
                  field && at ? { sub: at.sub, path: [...at.path, "fields", field.field] } : at;
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a section's sentences are by their place
                  <p key={i}>{jump(to, sentence.replace(/^- /, ""), `s${i}`)}</p>
                );
              },
            )}
          </div>
        );
      })}
      {more && (
        <button
          type="button"
          className="text-xs text-accent underline"
          onClick={() => setAll(!all)}
        >
          {all ? "Show less" : "Show all"}
        </button>
      )}
    </section>
  );
}

/** Behavior's Add for a kind of record, a page or an action: the creation wizard, not a name. */
function AddByWizard({
  kind,
  run,
  words,
}: {
  kind: WizardKind;
  run: Run;
  words: (op: string, args: Record<string, unknown>) => string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const label = { model: "Add a kind of record…", page: "Add a page…", action: "Add an action…" }[
    kind
  ];
  return open ? (
    <Wizard kind={kind} run={run} words={words} onClose={() => setOpen(false)} />
  ) : (
    <button type="button" className="text-xs text-accent underline" onClick={() => setOpen(true)}>
      {label}
    </button>
  );
}

export function NoCode({
  project,
  spec,
  run,
  place,
  onPlace,
}: {
  project: Project;
  spec: Spec;
  run: Run;
  /** Where the person was, and a way to say where they are now (App.tsx). */
  place: Place["nocode"];
  onPlace: (place: Place["nocode"]) => void;
}) {
  const [sub, setSubState] = useState<SubView>(() =>
    SUB_VIEWS.includes(place.sub as SubView) ? (place.sub as SubView) : "behavior",
  );
  const setSub = (next: SubView) => {
    setSubState(next);
    onPlace({ sub: next });
  };
  const [opened, setOpened] = useState(() => placeOf(place.selection)?.path);
  const words = (op: string, args: Record<string, unknown>) =>
    spec.ir ? describeChange(op, args, spec.ir, spec.content) : undefined;
  const sections = useMemo(
    () => (spec.ir ? summarize(spec.ir, spec.auth, spec.content, spec.plugins, spec.ux) : []),
    [spec],
  );
  // A sentence of the summary opens its entry and brings it into view.
  const jumpTo = (at: { sub: SubView; path: string[] }) => {
    setSub(at.sub);
    setOpened(at.path);
    requestAnimationFrame(() =>
      document
        .querySelector(`[data-path='${JSON.stringify(at.path)}']`)
        ?.scrollIntoView({ block: "start", behavior: "smooth" }),
    );
  };
  // The preview reports what was clicked in Select, columns dragged to a new place and texts
  // changed in place.
  const runRef = useRef(run);
  runRef.current = run;
  const pick = useRef<(s: Selection) => void>(() => {});
  pick.current = (s) => {
    const at = placeOf(s);
    if (!at) return;
    setSubState(at.sub);
    setOpened(at.path);
    onPlace({ sub: at.sub, selection: s });
  };
  // A part named elsewhere (Smith's "What does this app do?") opens here.
  const jumpRef = useRef(jumpTo);
  jumpRef.current = jumpTo;
  useEffect(() => {
    const open = (e: Event) => {
      const at = entryOf((e as CustomEvent<string>).detail);
      if (at) jumpRef.current(at);
    };
    window.addEventListener(OPEN_PART, open);
    return () => window.removeEventListener(OPEN_PART, open);
  }, []);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isPreviewMessage(e)) return;
      if (e.data.type === "select") pick.current(e.data);
      if (e.data.type === "columns")
        void runRef.current("setColumns", { page: e.data.page, columns: e.data.columns });
      if (e.data.type === "text")
        void runRef.current("setText", { path: e.data.path.split("."), text: e.data.text });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return (
    <Panel
      className="h-full"
      title={
        // A swipe across the tabs goes to the next sub view (a phone, studio-v3.md §8).
        <div
          {...swipe(
            () => setSub(SUB_VIEWS[(SUB_VIEWS.indexOf(sub) + 1) % SUB_VIEWS.length] ?? "behavior"),
            () =>
              setSub(
                SUB_VIEWS[(SUB_VIEWS.indexOf(sub) + SUB_VIEWS.length - 1) % SUB_VIEWS.length] ??
                  "behavior",
              ),
          )}
        >
          <Tabs
            tabs={[
              ["behavior", "Behavior", "behavior"],
              ["look", "Look", "look"],
              ["who", "Who can"],
              ["content", "Content"],
            ]}
            value={sub}
            onChange={setSub}
          />
        </div>
      }
    >
      {sub === "behavior" ? (
        <>
          <Summary sections={sections} onJump={jumpTo} />
          <SpecForm
            // A new pick opens the form afresh down to it.
            key={JSON.stringify(opened ?? null)}
            files={project.files}
            run={run}
            ir={spec.ir}
            open={opened}
            adder={(path) => {
              const kind = (
                { models: "model", pages: "page", actions: "action" } as Record<string, WizardKind>
              )[String(path[0])];
              return path.length === 1 && kind ? (
                <AddByWizard kind={kind} run={run} words={words} />
              ) : undefined;
            }}
            tools={(path) => {
              const [area, name] = path;
              if (path.length !== 2 || typeof name !== "string") return undefined;
              if (area === "models") return <ImportRecords model={name} run={run} />;
              if (area === "pages")
                return (
                  <OwnCode
                    page={name}
                    own={Boolean(
                      project.concepts
                        .find((c) => c.concept === `page:${name}`)
                        ?.files.some((f) => f.path.startsWith("src/custom/pages/")),
                    )}
                  />
                );
              return undefined;
            }}
          />
        </>
      ) : sub === "look" ? (
        <Look spec={spec} run={run} themes={project.themes} />
      ) : sub === "who" ? (
        <WhoCan spec={spec} run={run} authText={project.files.auth} />
      ) : (
        <div className="divide-y divide-line">
          <SpecForm
            key={JSON.stringify(opened ?? null)}
            files={project.files}
            run={run}
            ir={spec.ir}
            parts={["content"]}
            open={opened}
          />
          <section aria-label="Languages">
            <h2 className="px-4 pt-4 text-xs font-semibold tracking-wide text-quiet uppercase">
              Languages
            </h2>
            <Languages spec={spec} run={run} />
          </section>
        </div>
      )}
    </Panel>
  );
}
