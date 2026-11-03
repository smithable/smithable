import { LookEditor, type LookEditorHost } from "@smithable/look-editor";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Project } from "./api";
import "@smithable/look-editor/styles.css";

export default function LookEditorDialog({
  project,
  path,
  onClose,
}: {
  project: Project;
  path: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const dirty = useRef(false);
  const busy = useRef(false);
  const [isBusy, setBusy] = useState(false);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  const close = () => {
    if (busy.current) return;
    if (dirty.current && !window.confirm("Discard this unsaved look draft and close?")) return;
    dialog.current?.close();
    onClose();
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
      async request(route, init) {
        const context = async () => {
          const response = await fetch(`/api/look?path=${encodeURIComponent(path)}`, {
            signal: init?.signal,
          });
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
          return fetch(route, {
            ...init,
            headers: { ...Object.fromEntries(new Headers(init?.headers)), "x-smithable": "1" },
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
    [path, project.lookProject],
  );
  return (
    <dialog
      ref={dialog}
      className="look-editor-dialog"
      aria-label="Edit look"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-panel p-2">
        <span className="text-sm font-medium">Edit look · {project.name}</span>
        <button
          type="button"
          disabled={isBusy}
          onClick={close}
          className="rounded border border-line px-3 py-1 text-sm disabled:opacity-50"
        >
          Close look editor
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <LookEditor host={host} />
      </div>
    </dialog>
  );
}
