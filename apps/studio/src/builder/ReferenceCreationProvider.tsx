import { humanize, type SpecIR } from "@smithable/core";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "../api";
import { Ask, type Words } from "./Ask";
import type { Run } from "./ChangeForms";
import { usePendingEdit } from "./pending-edit";
import { type CreateReference, ReferenceCreation } from "./reference-creation";
import { Wizard, type WizardKind } from "./Wizard";

type ModelNotice = Pick<Project, "ai" | "aiEu" | "aiPrivacy">;

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
  modelNotice,
  children,
}: {
  project?: string;
  ir?: SpecIR;
  run: Run;
  words?: Words;
  onStart: () => void;
  modelNotice?: ModelNotice;
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
          modelNotice={modelNotice}
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
  modelNotice,
  onClose,
  onCreated,
}: {
  kind: WizardKind;
  created?: string;
  models: SpecIR["models"];
  run: Run;
  words?: Words;
  modelNotice?: ModelNotice;
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const committing = useRef(false);
  const [help, setHelp] = useState<string>();
  const [helpApplying, setHelpApplying] = useState(false);
  const helpLauncher = useRef<HTMLButtonElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (help !== undefined) back.current?.focus();
    else helpLauncher.current?.focus();
  }, [help]);
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
        if (committing.current) return;
        if (help !== undefined) setHelp(undefined);
        else onClose();
      }}
      className="m-auto max-h-[90vh] w-[min(42rem,92vw)] overflow-auto rounded-lg bg-panel text-fg shadow-xl backdrop:bg-black/40"
    >
      {created ? (
        <div className="space-y-3 p-4">
          <p role="status">Created {humanize(created)}. Updating the choices in your form…</p>
          <button type="button" onClick={onClose} className="rounded border border-line px-3 py-1">
            Keep current selection
          </button>
        </div>
      ) : (
        <>
          <div hidden={help !== undefined}>
            <Wizard
              kind={kind}
              models={models}
              run={run}
              words={words}
              onClose={onClose}
              onCreated={onCreated}
              onBusyChange={onBusyChange}
              onAskForHelp={(text, button) => {
                helpLauncher.current = button;
                setHelp(text);
              }}
            />
          </div>
          {help !== undefined && (
            <section aria-label="Smith help" className="flex h-[min(70dvh,36rem)] min-h-0 flex-col">
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <h3 className="text-sm font-semibold">Ask Smith</h3>
                <button
                  ref={back}
                  type="button"
                  disabled={helpApplying}
                  onClick={() => setHelp(undefined)}
                  className="rounded border border-line px-3 py-1 text-sm hover:bg-subtle disabled:opacity-50"
                >
                  Back to creation
                </button>
              </div>
              <Ask
                {...modelNotice}
                helpRequest={help}
                words={words}
                onApplyingChange={(applying) => {
                  committing.current = applying;
                  setHelpApplying(applying);
                }}
              />
            </section>
          )}
        </>
      )}
    </dialog>
  );
}
