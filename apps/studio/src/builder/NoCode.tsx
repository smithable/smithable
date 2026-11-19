// The No code window (docs/design/studio-v3.md §1): Behavior (every setting of the spec), Look,
// Who can and Content (the texts, with Languages under them). What the preview reports in it
// lands here: a part picked in Select opens Behavior at it, columns dragged and texts changed in
// place are made as changes.
import { channelsOf, formatFormula, humanize, kebab, type ModelIR } from "@smithable/core";
import { describeChange } from "@smithable/index";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "../api";
import type { Spec } from "../engine";
import {
  advancePreviewContext,
  isPreviewMessage,
  type Place,
  previewFollowContext,
  type Selection,
} from "../preview";
import { keptPage } from "../shared";
import { Button, Panel, Tabs } from "../ui";
import { ActionPicture } from "./ActionPicture";
import { AddEntryForm } from "./AddEntryForm";
import type { Run } from "./ChangeForms";
import { CodeFiles, ImportRecords, OwnCode } from "./EntryTools";
import { ExamplesTable } from "./ExamplesTable";
import { Languages } from "./Languages";
import { ChoiceTones, ContentIdentity, PageLayout } from "./Look";
import { OutgoingTemplate } from "./OutgoingTemplate";
import { PendingEdits, usePendingEdits } from "./pending-edit";
import { PreviewNavigation, pageForPreviewPath } from "./preview-follow";
import { ReferenceCreationProvider } from "./ReferenceCreationProvider";
import { SpecForm } from "./SpecForm";
import { entryOf, type OpenPart } from "./summary-tab";
import { TimerForm } from "./TimerForm";
import { UxSource } from "./UxSource";
import { WhoCan } from "./WhoCan";
import { Wizard, type WizardKind } from "./Wizard";

export type SubView = "behavior" | "layout" | "who" | "content";
const SUB_VIEWS: SubView[] = ["behavior", "layout", "who", "content"];

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

/**
 * Where a value picked in the preview comes from (A 231): a record's field or its formula, so it
 * is changed in the records or the formula, never written over as text.
 */
function ValueOrigin({ models, concept }: { models: ModelIR[]; concept: string }) {
  const [model = "", name = ""] = concept.slice("field:".length).split(".");
  const of = models.find((m) => m.name === model);
  const field = of?.fields.find((f) => f.name === name);
  if (!of || !field) return null;
  const whose = `each ${humanize(model).toLowerCase()}'s ${humanize(field.name).toLowerCase()}`;
  return (
    <p
      data-value-origin
      className="basis-full rounded border border-line bg-panel px-2 py-1 text-xs text-muted"
    >
      {field.formula
        ? `The value picked in the preview is ${whose}, worked out by its formula ${formatFormula(field.formula)}: change the formula here to change it.`
        : `The value picked in the preview is ${whose}, kept in its record: change it in the app's records; the field is set here.`}
    </p>
  );
}

/** The event that opens a part of the app in Behavior (Smith's answer leads there). */
export const OPEN_PART = "smithable:open-part";
export type { OpenPart };

/** Behavior's Add for a kind of record, a page or an action: the creation wizard, not a name. */
function AddByWizard({
  kind,
  run,
  words,
  models,
}: {
  kind: WizardKind;
  run: Run;
  words: (op: string, args: Record<string, unknown>) => string | undefined;
  models: ModelIR[];
}) {
  const [open, setOpen] = useState(false);
  const label = { model: "Add a kind of record…", page: "Add a page…", action: "Add an action…" }[
    kind
  ];
  return open ? (
    <Wizard kind={kind} run={run} words={words} models={models} onClose={() => setOpen(false)} />
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
  target,
  onTargetOpened,
  onLook,
  followingBlocked = false,
  following = true,
}: {
  project: Project;
  spec: Spec;
  run: Run;
  /** Where the person was, and a way to say where they are now (App.tsx). */
  place: Place["nocode"];
  onPlace: (place: Place["nocode"]) => void;
  target?: OpenPart;
  onTargetOpened?: () => void;
  onLook: (page?: string) => void;
  followingBlocked?: boolean;
  /** Whether the editors open the preview's page as it changes: the link button beside the
   * preview's address (shared.tsx), kept by App.tsx. */
  following?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const edits = usePendingEdits();
  const [editingMail, setEditingMail] = useState<string>();
  const mail = spec.ir?.outgoing.filter((entry) => channelsOf(entry)?.includes("mail")) ?? [];
  const [contextPage, setContextPage] = useState(place.page ?? "");
  const pending = useRef<{ page: string; context: number }>(undefined);
  const navigation = useRef(new PreviewNavigation());
  const previewPage = useRef<string>(undefined);
  const frame = useRef<number>(undefined);
  const flush = useRef(() => {});
  const initialFollow = useRef(!target && !place.selection && !place.page);
  const schedule = useCallback(() => {
    if (frame.current !== undefined) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      flush.current();
    });
  }, []);
  const cancelFollow = () => {
    pending.current = undefined;
    previewPage.current = undefined;
    advancePreviewContext();
  };
  const [sub, setSubState] = useState<SubView>(() =>
    place.sub === "look"
      ? "layout"
      : SUB_VIEWS.includes(place.sub as SubView)
        ? (place.sub as SubView)
        : "behavior",
  );
  const setSub = (next: SubView) => {
    cancelFollow();
    setSubState(next);
    if (next === "behavior" && sub !== "behavior" && following && contextPage)
      setOpened(["pages", contextPage]);
    onPlace({ sub: next });
  };
  const [opened, setOpened] = useState<(string | number)[] | undefined>(
    () => placeOf(place.selection)?.path ?? (place.page ? ["pages", place.page] : undefined),
  );
  // A record's value picked in the preview: its field says where the value comes from.
  const [picked, setPicked] = useState(place.selection);
  const words = (op: string, args: Record<string, unknown>) =>
    spec.ir ? describeChange(op, args, spec.ir, spec.content) : undefined;
  flush.current = () => {
    const next = pending.current;
    if (!next || !following || followingBlocked || edits.pending()) return;
    if (next.context !== previewFollowContext()) {
      pending.current = undefined;
      previewPage.current = undefined;
      return;
    }
    const node = root.current;
    if (!node?.getClientRects().length || node.contains(document.activeElement)) return;
    const bounds = node.getBoundingClientRect();
    if (
      bounds.left < -1 ||
      bounds.right > window.innerWidth + 1 ||
      bounds.bottom <= 0 ||
      bounds.top >= window.innerHeight
    )
      return;
    const transient = [
      ...document.querySelectorAll<HTMLElement>(
        'dialog[open], [role="dialog"], [role="menu"], [role="listbox"]',
      ),
    ].some(
      (element) =>
        element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true",
    );
    if (transient) return;
    pending.current = undefined;
    setContextPage(next.page);
    const alreadyOpen =
      sub === "behavior" &&
      contextPage === next.page &&
      opened?.[0] === "pages" &&
      opened[1] === next.page;
    onPlace({ page: next.page, ...(alreadyOpen ? {} : { selection: undefined }) });
    if (sub === "behavior" && !alreadyOpen) setOpened(["pages", next.page]);
  };
  const enqueue = useRef<(path: string) => void>(() => {});
  enqueue.current = (path) => {
    if (!following || !spec.ir) return;
    const page = pageForPreviewPath(spec.ir, path, spec.content?.languages);
    if (!page) {
      pending.current = undefined;
      previewPage.current = undefined;
      return;
    }
    if (previewPage.current === page) return;
    previewPage.current = page;
    pending.current = { page, context: previewFollowContext() };
    schedule();
  };
  // Linking again (the button beside the preview's address) opens the page the preview shows;
  // unlinking drops what was waiting to open.
  const linked = useRef(following);
  useEffect(() => {
    if (linked.current === following) return;
    linked.current = following;
    cancelFollow();
    if (!following || !spec.ir) return;
    const page = pageForPreviewPath(spec.ir, keptPage(), spec.content?.languages);
    previewPage.current = page;
    if (page) pending.current = { page, context: previewFollowContext() };
    schedule();
  });
  // Flush only after all draft/focus/transient guards have settled, never in a blur handler.
  useEffect(() => {
    if (pending.current) schedule();
  });
  useEffect(() => {
    const changed = () => schedule();
    const receive = (event: MessageEvent) => {
      if (!isPreviewMessage(event)) return;
      const path = navigation.current.receive(event.data, previewFollowContext());
      if (path !== undefined) enqueue.current(path);
    };
    // A popup can close after its blur event (for example the preview address suggestions).
    // Observe its actual removal/visibility change so a deferred page does not stay stuck.
    const transients = new MutationObserver(() => {
      if (pending.current) schedule();
    });
    transients.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open", "hidden", "aria-hidden", "data-state", "class", "style"],
    });
    window.addEventListener("message", receive);
    window.addEventListener("scroll", changed, true);
    for (const type of ["focusout", "click", "keyup", "resize", "transitionend"])
      window.addEventListener(type, changed);
    if (initialFollow.current) enqueue.current(keptPage());
    return () => {
      transients.disconnect();
      window.removeEventListener("message", receive);
      window.removeEventListener("scroll", changed, true);
      for (const type of ["focusout", "click", "keyup", "resize", "transitionend"])
        window.removeEventListener(type, changed);
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [schedule]);
  // A sentence of the summary opens its entry and brings it into view.
  const jumpTo = (at: { sub: SubView; path: (string | number)[] }) => {
    cancelFollow();
    if (at.path[0] === "pages" && typeof at.path[1] === "string") {
      setContextPage(at.path[1]);
      onPlace({ page: at.path[1], selection: undefined });
    }
    setSub(at.sub);
    setOpened([...at.path]);
  };
  // Reopening the same target keeps the form's drafts. For a refused addition, its enclosing
  // section is the nearest thing that exists; open it and its ancestors after the render.
  useEffect(() => {
    if (!opened?.length) return;
    const nodes = [...document.querySelectorAll<HTMLElement>("[data-path]")];
    for (let length = opened.length; length > 0; length--) {
      const path = JSON.stringify(opened.slice(0, length));
      const target = nodes.find((node) => node.dataset.path === path);
      if (!target) continue;
      for (let node: HTMLElement | null = target; node; node = node.parentElement) {
        if (node instanceof HTMLDetailsElement) node.open = true;
      }
      target.scrollIntoView({ block: "start", behavior: "smooth" });
      break;
    }
  }, [opened]);
  // The preview reports what was clicked in Select, columns dragged to a new place and texts
  // changed in place.
  const runRef = useRef(run);
  runRef.current = run;
  const pick = useRef<(s: Selection) => void>(() => {});
  pick.current = (s) => {
    const at = placeOf(s);
    if (!at) return;
    cancelFollow();
    setSubState(at.sub);
    setOpened(at.path);
    setPicked(s);
    onPlace({ sub: at.sub, selection: s });
  };
  // A part named elsewhere (Smith's "What does this app do?") opens here.
  const openPart = (part: OpenPart) => {
    if (typeof part !== "string" && part.file.split(/[\\/]/).at(-1) === "smithable.ux.yml") {
      if (part.path[0] === "tones" && typeof part.path[1] === "string") {
        const [model, field] = part.path[1].split(".");
        if (model && field) jumpTo({ sub: "behavior", path: ["models", model, "fields", field] });
      } else if (part.path[0] === "pages" && part.path[2] !== "theme") {
        jumpTo({ sub: "layout", path: part.path });
      } else {
        cancelFollow();
        onLook(part.path[0] === "pages" ? String(part.path[1]) : undefined);
      }
      return;
    }
    const at = entryOf(part);
    if (at) jumpTo(at);
  };
  const jumpRef = useRef(openPart);
  jumpRef.current = openPart;
  useEffect(() => {
    const open = (e: Event) => {
      jumpRef.current((e as CustomEvent<OpenPart>).detail);
    };
    window.addEventListener(OPEN_PART, open);
    return () => window.removeEventListener(OPEN_PART, open);
  }, []);
  // An explicit target waits in App's state until this window is mounted.
  useEffect(() => {
    if (target === undefined) return;
    jumpRef.current(target);
    onTargetOpened?.();
  }, [target, onTargetOpened]);
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
    <PendingEdits.Provider value={edits.report}>
      <ReferenceCreationProvider
        project={project.lookProject}
        ir={spec.ir}
        run={run}
        words={words}
        onStart={cancelFollow}
      >
        <div ref={root} className="h-full min-h-0" data-no-code>
          <Panel
            className="h-full"
            title={
              <div>
                <Tabs
                  tabs={[
                    ["behavior", "Behavior", "behavior"],
                    ["layout", "Layout"],
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
                <SpecForm
                  // A new pick opens the form afresh down to it.
                  key={JSON.stringify(opened ?? null)}
                  files={project.files}
                  run={run}
                  ir={spec.ir}
                  open={opened}
                  adder={(path) => {
                    if (path.length === 1 && path[0] === "timers" && spec.ir)
                      return <TimerForm ir={spec.ir} run={run} />;
                    if (
                      path.length === 1 &&
                      spec.ir &&
                      ["outgoing", "payments", "incoming", "queries"].includes(String(path[0]))
                    )
                      return (
                        <AddEntryForm
                          area={path[0] as "outgoing" | "payments" | "incoming" | "queries"}
                          project={project}
                          ir={spec.ir}
                          plugins={spec.plugins}
                          run={run}
                        />
                      );
                    const kind = (
                      { models: "model", pages: "page", actions: "action" } as Record<
                        string,
                        WizardKind
                      >
                    )[String(path[0])];
                    return path.length === 1 && kind ? (
                      <AddByWizard
                        kind={kind}
                        run={run}
                        words={words}
                        models={spec.ir?.models ?? []}
                      />
                    ) : undefined;
                  }}
                  tools={(path) => {
                    const [area, name] = path;
                    if (area === "models" && path[2] === "fields" && path.length === 4)
                      return (
                        <>
                          {spec.ir &&
                            picked?.part === "value" &&
                            picked.concept === `field:${name}.${path[3]}` && (
                              <ValueOrigin models={spec.ir.models} concept={picked.concept} />
                            )}
                          <ChoiceTones
                            spec={spec}
                            run={run}
                            model={String(name)}
                            field={String(path[3])}
                          />
                        </>
                      );
                    if (path.length !== 2 || typeof name !== "string") return undefined;
                    if (area === "models") return <ImportRecords model={name} run={run} />;
                    // A part's own code (what-it-does.md §3): its files under src/custom, as the index found them.
                    // Its own kind of file only (an action's under actions/), not code that uses it.
                    const codeOf = (concept: string, folder: string) =>
                      project.concepts
                        .find((c) => c.concept === concept)
                        ?.files.map((f) => f.path)
                        .filter((p) => p.startsWith(`src/custom/${folder}/`)) ?? [];
                    if (area === "queries")
                      return (
                        <CodeFiles
                          files={codeOf(`query:${name}`, "queries")}
                          dir={project.localDir}
                        />
                      );
                    if (
                      area === "incoming" &&
                      spec.ir?.incoming.find((i) => i.name === name)?.custom
                    )
                      return (
                        <CodeFiles
                          files={[`src/custom/incoming/${kebab(name)}.ts`]}
                          dir={project.localDir}
                        />
                      );
                    // A custom action: the picture its contract draws (intents.md §7), and its examples (§6).
                    const custom = spec.ir?.actions.find((a) => a.name === name && a.custom);
                    if (area === "actions" && spec.ir && custom?.custom)
                      return (
                        <div className="space-y-3">
                          <ActionPicture
                            ir={spec.ir}
                            action={name}
                            onOpen={(concept) => {
                              const at = entryOf(concept);
                              if (at) jumpTo(at);
                            }}
                          />
                          <ExamplesTable examples={custom.examples ?? []} />
                          <CodeFiles
                            files={codeOf(`action:${name}`, "actions")}
                            dir={project.localDir}
                          />
                        </div>
                      );
                    if (area === "pages")
                      return (
                        <>
                          <button
                            type="button"
                            className="rounded border border-line px-2 py-1 text-xs"
                            onClick={() => jumpTo({ sub: "layout", path: ["pages", String(name)] })}
                          >
                            Page layout
                          </button>
                          <OwnCode
                            page={name}
                            files={codeOf(`page:${name}`, "pages")}
                            dir={project.localDir}
                            own={Boolean(
                              project.concepts
                                .find((c) => c.concept === `page:${name}`)
                                ?.files.some((f) => f.path.startsWith("src/custom/pages/")),
                            )}
                          />
                        </>
                      );
                    return undefined;
                  }}
                />
              </>
            ) : sub === "layout" ? (
              <UxSource text={project.files.ux} ux={spec.ux}>
                <PageLayout
                  spec={spec}
                  run={run}
                  page={contextPage}
                  onBehavior={(page) => jumpTo({ sub: "behavior", path: ["pages", page] })}
                  onContent={(page) => jumpTo({ sub: "content", path: ["pages", page] })}
                  onPage={(page) => {
                    cancelFollow();
                    setContextPage(page);
                    onPlace({ page });
                  }}
                />
              </UxSource>
            ) : sub === "who" ? (
              <WhoCan spec={spec} run={run} authText={project.files.auth} />
            ) : (
              <div className="divide-y divide-line">
                <ContentIdentity spec={spec} run={run} />
                {mail.length > 0 && (
                  <section aria-label="Mail templates" className="space-y-2 p-4">
                    <h2 className="text-xs font-semibold tracking-wide text-quiet uppercase">
                      Mail templates
                    </h2>
                    <ul className="space-y-1">
                      {mail.map((entry) => (
                        <li key={entry.name}>
                          <Button variant="ghost" onClick={() => setEditingMail(entry.name)}>
                            Edit mail template for {humanize(entry.name)}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {editingMail && spec.ir && mail.some((entry) => entry.name === editingMail) && (
                  <OutgoingTemplate
                    key={editingMail}
                    entry={editingMail}
                    ir={spec.ir}
                    auth={spec.auth}
                    contentText={project.files.content}
                    samples={project.samples ?? {}}
                    run={run}
                    onClose={() => setEditingMail(undefined)}
                  />
                )}
                <SpecForm
                  key={JSON.stringify(opened ?? null)}
                  files={project.files}
                  run={run}
                  ir={spec.ir}
                  parts={["content"]}
                  omit={["logo", "language", "languages"]}
                  open={opened}
                  omitEntry={(path) =>
                    path.length === 2 &&
                    path[0] === "outgoing" &&
                    mail.some((entry) => entry.name === path[1])
                  }
                  tools={(path) =>
                    spec.ir &&
                    path.length === 2 &&
                    path[0] === "outgoing" &&
                    typeof path[1] === "string" &&
                    !mail.some((entry) => entry.name === path[1]) ? (
                      <OutgoingTemplate
                        key={path[1]}
                        entry={path[1]}
                        ir={spec.ir}
                        auth={spec.auth}
                        contentText={project.files.content}
                        samples={project.samples ?? {}}
                        run={run}
                      />
                    ) : undefined
                  }
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
        </div>
      </ReferenceCreationProvider>
    </PendingEdits.Provider>
  );
}
