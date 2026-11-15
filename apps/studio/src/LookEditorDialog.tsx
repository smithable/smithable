import { LookEditor, type LookEditorHost, type Start } from "@smithable/look-editor";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Project } from "./api";
import type { Run } from "./builder/ChangeForms";
import { ThemeSettings } from "./builder/Look";
import { PendingEdits, usePendingEdits } from "./builder/pending-edit";
import { UxSource } from "./builder/UxSource";
import type { Spec } from "./engine";
import { Tabs } from "./ui";
import "@smithable/look-editor/styles.css";

export default function LookEditorDialog({
  project: initialProject,
  liveProject,
  spec,
  run,
  liveBusy,
  initialTarget,
  path,
  onClose,
}: {
  project: Project;
  liveProject: Project;
  spec: Spec;
  run: Run;
  liveBusy: boolean;
  initialTarget?: string | null;
  path: string;
  onClose: () => void;
}) {
  const [project, setProject] = useState(initialProject);
  const [instance, setInstance] = useState(0);
  const [settingsInstance, setSettingsInstance] = useState(0);
  const [tab, setTab] = useState<"settings" | "customise">("settings");
  const [target, setTarget] = useState<string | null>(initialTarget ?? null);
  const [draft, setDraft] = useState<{ theme?: string; target: string | null; path: string }>();
  const draftTarget = useRef<string | null>(null);
  const edits = usePendingEdits();
  const dialog = useRef<HTMLDialogElement>(null);
  const dirty = useRef(false);
  const busy = useRef(false);
  const [isBusy, setBusy] = useState(false);
  const livePending = useRef(0);
  const [liveRunning, setLiveRunning] = useState(false);
  const runLive: Run = async (...args) => {
    livePending.current++;
    setLiveRunning(true);
    try {
      return await run(...args);
    } finally {
      livePending.current--;
      setLiveRunning(livePending.current > 0);
    }
  };
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  const close = () => {
    if (busy.current || liveBusy || livePending.current) return;
    if (
      (dirty.current || edits.pending()) &&
      !window.confirm("Discard these unsaved look edits and close?")
    )
      return;
    dialog.current?.close();
    onClose();
  };
  const startDraft = (theme?: string) => {
    if (busy.current || liveBusy || livePending.current) return;
    if (
      draft &&
      dirty.current &&
      !window.confirm("Discard this unsaved look draft and start another?")
    )
      return;
    setProject(liveProject);
    draftTarget.current = target;
    setDraft({
      ...(theme ? { theme } : {}),
      target,
      path: target ? (spec.ir?.pages.find((page) => page.id === target)?.route ?? path) : path,
    });
    setInstance((value) => value + 1);
    setTab("customise");
  };
  const host = useMemo<LookEditorHost>(
    () => ({
      kind: "studio",
      onDirtyChange(value) {
        dirty.current = value;
      },
      onBusyChange(value) {
        busy.current = value;
        setBusy(value);
      },
      async onReopenProject() {
        if (busy.current || livePending.current) return false;
        if (
          (dirty.current || edits.pending()) &&
          !window.confirm("Discard these unsaved look edits and reopen the current project?")
        )
          return false;
        const current = await api.project();
        let scope = draftTarget.current;
        let previewPath = draft?.path ?? path;
        if (scope) {
          const response = await fetch(`/api/look?path=${encodeURIComponent(previewPath)}`);
          if (!response.ok)
            throw new Error("The current project could not be opened. Retry its connection.");
          const context = (await response.json()) as Start & { lookProject?: string };
          if (context.lookProject !== current.lookProject)
            throw new Error("The project changed again. Retry opening it.");
          const landing = context.look?.ir.pages.find(
            (page) => page.id === scope && page.pattern.kind === "landing",
          );
          if (!landing) {
            if (
              !window.confirm(
                "This draft's landing page no longer exists. Open a new draft for the whole app instead?",
              )
            )
              return false;
            scope = null;
            previewPath = "/";
          } else previewPath = landing.route;
        }
        setProject(current);
        setDraft((value) => value && { target: scope, path: previewPath });
        draftTarget.current = scope;
        dirty.current = false;
        setInstance((value) => value + 1);
        setSettingsInstance((value) => value + 1);
        return true;
      },
      async request(route, init) {
        const context = async () => {
          const response = await fetch(
            `/api/look?path=${encodeURIComponent(draft?.path ?? path)}`,
            {
              signal: init?.signal,
            },
          );
          if (!response.ok) return response;
          const value = await response.json();
          // The context's projectId is the preview's identity, for the frames; lookProject is
          // the project's, which must still be the one this dialog opened.
          return value.lookProject === project.lookProject
            ? Response.json(value)
            : Response.json(
                { error: "The project changed. Keep this draft or reopen the current project." },
                { status: 409 },
              );
        };
        if (route === "/api/start") return context();
        if (route === "/api/look-ticket")
          // With the project this dialog opened: a dialog left open from a replaced project
          // gets no ticket for the new one's frames.
          return fetch(route, {
            ...init,
            headers: { ...Object.fromEntries(new Headers(init?.headers)), "x-smithable": "1" },
            body: JSON.stringify({
              ...(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>),
              lookProject: project.lookProject,
            }),
          });
        if (route === "/api/apply" || route === "/api/save") {
          // The editor's precondition and request id travel beside the operation's arguments.
          const { expectedRevision, requestId, ...args } = JSON.parse(
            String(init?.body ?? "{}"),
          ) as Record<string, unknown>;
          const result =
            route === "/api/apply"
              ? await api.applyLook("applyTheme", args, project.lookProject ?? "", {
                  ...(typeof expectedRevision === "string" ? { expectedRevision } : {}),
                  ...(typeof requestId === "string" ? { requestId } : {}),
                })
              : await api.applyLook("addTheme", args, project.lookProject ?? "");
          if (!result.ok)
            return Response.json(
              { ok: false, output: result.output, error: result.output },
              { status: 409 },
            );
          const fresh = await context();
          const value = await fresh.json();
          const generation =
            route === "/api/apply"
              ? await fetch("/api/look-generation").then((r) => r.json())
              : undefined;
          return route === "/api/apply"
            ? Response.json({ ...result, look: value.look, generation: generation?.generation })
            : Response.json({ saved: `themes/${String(args.name)}.yml` });
        }
        return Response.json(
          { error: "This editor uses the current Studio project." },
          { status: 404 },
        );
      },
    }),
    [path, draft?.path, project.lookProject, edits.pending],
  );
  return (
    <dialog
      ref={dialog}
      className="look-editor-dialog"
      aria-label="Look"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-panel p-2">
        <span className="min-w-0 text-sm font-medium wrap-break-word">
          Look · {tab === "settings" ? liveProject.name : project.name}
        </span>
        <button
          type="button"
          disabled={isBusy || liveBusy || liveRunning}
          onClick={close}
          className="shrink-0 rounded border border-line px-3 py-1 text-sm disabled:opacity-50"
        >
          Close look editor
        </button>
      </div>
      <fieldset
        disabled={isBusy || liveBusy || liveRunning}
        className="shrink-0 border-b border-line px-3 py-2"
      >
        <Tabs
          tabs={[
            ["settings", "Theme and settings"],
            ["customise", "Customise"],
          ]}
          value={tab}
          onChange={(next) => {
            if (isBusy || liveBusy || livePending.current) return;
            if (next === "customise" && !draft) startDraft();
            else setTab(next);
          }}
        />
      </fieldset>
      <PendingEdits.Provider value={edits.report}>
        <div hidden={tab !== "settings"} className="min-h-0 flex-1 overflow-auto">
          <fieldset disabled={isBusy || liveBusy || liveRunning}>
            <UxSource text={liveProject.files.ux} ux={spec.ux}>
              <ThemeSettings
                key={settingsInstance}
                spec={spec}
                run={runLive}
                themes={liveProject.themes}
                ownThemes={liveProject.ownThemes}
                target={target}
                onTarget={setTarget}
                onCustomise={startDraft}
              />
            </UxSource>
          </fieldset>
        </div>
        <div hidden={tab !== "customise"} className="min-h-0 flex-1">
          {draft && (
            <LookEditor
              key={instance}
              host={host}
              initialTheme={draft.theme}
              initialTarget={draft.target}
              showGallery={false}
              onTargetChange={(page) => {
                draftTarget.current = page;
              }}
            />
          )}
        </div>
      </PendingEdits.Provider>
    </dialog>
  );
}
