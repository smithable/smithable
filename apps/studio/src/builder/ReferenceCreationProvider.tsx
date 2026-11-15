import { humanize, type SpecIR } from "@smithable/core";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { Words } from "./Ask";
import type { Run } from "./ChangeForms";
import { usePendingEdit } from "./pending-edit";
import { type CreateReference, ReferenceCreation } from "./reference-creation";
import { Wizard, type WizardKind } from "./Wizard";

interface Request {
  id: number;
  kind: WizardKind;
  project: string;
  resolve: (name: string | undefined) => void;
}

/** Keeps the requesting form mounted until complete creation returns a real current choice. */
export function ReferenceCreationProvider({
  project,
  ir,
  run,
  words,
  onStart,
  children,
}: {
  project?: string;
  ir?: SpecIR;
  run: Run;
  words?: Words;
  onStart: () => void;
  children: ReactNode;
}) {
  const [request, setRequest] = useState<Request>();
  const [created, setCreated] = useState<string>();
  const active = useRef<Request>(undefined);
  const sequence = useRef(0);
  const latest = useRef({ project, ir, onStart });
  latest.current = { project, ir, onStart };
  usePendingEdit(Boolean(request));
  const finish = useCallback((value: Request, name?: string) => {
    if (active.current !== value) return;
    active.current = undefined;
    setRequest(undefined);
    setCreated(undefined);
    value.resolve(name);
  }, []);
  const createReference = useCallback<CreateReference>(
    (kind) =>
      new Promise((resolve) => {
        const { project, ir, onStart } = latest.current;
        if (active.current || !project || !ir) return resolve(undefined);
        onStart();
        const value = { id: ++sequence.current, kind, project, resolve };
        active.current = value;
        setCreated(undefined);
        setRequest(value);
      }),
    [],
  );
  useEffect(
    () => () => {
      active.current?.resolve(undefined);
      active.current = undefined;
    },
    [],
  );
  useEffect(() => {
    if (!request) return;
    if (request.project !== project) return finish(request);
    if (!created || !ir) return;
    const exists =
      request.kind === "model"
        ? ir.models.some((item) => item.name === created)
        : request.kind === "page"
          ? ir.pages.some((item) => item.id === created)
          : ir.actions.some((item) => item.name === created);
    if (exists) finish(request, created);
  }, [request, created, ir, project, finish]);
  return (
    <ReferenceCreation.Provider value={ir && project ? createReference : undefined}>
      {children}
      {request && (
        <CreationDialog
          key={request.id}
          kind={request.kind}
          created={created}
          models={ir?.models ?? []}
          run={run}
          words={words}
          onClose={() => finish(request)}
          onCreated={(name) => {
            if (active.current === request) setCreated(name);
          }}
        />
      )}
    </ReferenceCreation.Provider>
  );
}

function CreationDialog({
  kind,
  created,
  models,
  run,
  words,
  onClose,
  onCreated,
}: {
  kind: WizardKind;
  created?: string;
  models: SpecIR["models"];
  run: Run;
  words?: Words;
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const committing = useRef(false);
  const onBusyChange = useCallback((value: boolean) => {
    committing.current = value;
  }, []);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label="Create and select"
      onCancel={(event) => {
        event.preventDefault();
        if (!committing.current) onClose();
      }}
      className="m-auto max-h-[90vh] w-[min(42rem,92vw)] overflow-auto rounded-lg bg-panel text-fg shadow-xl backdrop:bg-black/40"
    >
      {created ? (
        <div className="space-y-3 p-4">
          <p role="status">Created {humanize(created)}. Updating the choices in your form…</p>
          <button type="button" onClick={onClose} className="rounded border border-line px-3 py-1">
            Return to the form
          </button>
        </div>
      ) : (
        <Wizard
          kind={kind}
          models={models}
          run={run}
          words={words}
          onClose={onClose}
          onCreated={onCreated}
          onBusyChange={onBusyChange}
        />
      )}
    </dialog>
  );
}
