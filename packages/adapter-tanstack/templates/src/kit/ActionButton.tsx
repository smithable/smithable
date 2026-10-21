// Smithable app kit: a button that runs an action on a record, then shows the record as it is now.
// An action that asks for values opens a dialog with the form's own fields first.
import { useRef, useState } from "react";
import type { z } from "zod";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { ModelForm } from "./ModelForm";
import type { AppUi, ModelUi, Options } from "./model";
import { tx, w } from "./words";

export function ActionButton({
  label: own,
  help: ownHelp,
  concept,
  onRun,
  ask,
}: {
  label: string;
  /** What it does, in the app's words (the content file's help): the tooltip and the dialog's line. */
  help?: string;
  /** The action in the app description ("action:identified"), for the preview editor: development only. */
  concept?: string;
  /** Runs the action, with the asked values when it asks for any. */
  onRun: (values?: Record<string, unknown>) => Promise<unknown>;
  /** What the action asks for: the dialog's fields, their schema, and the record they start from. */
  ask?: {
    ui: ModelUi;
    schema: z.ZodType;
    initial: Record<string, unknown>;
    app: AppUi;
    /** The choices of the references it asks for, loaded when the dialog opens. */
    loadOptions?: () => Promise<Options>;
  };
}) {
  // The app's texts in the language now (languages.md §4).
  const label = tx(own);
  const help = ownHelp && tx(ownHelp);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const dialog = useRef<HTMLDialogElement>(null);
  const [options, setOptions] = useState<Options>();
  const open = async () => {
    if (ask?.loadOptions && !options) {
      setBusy(true);
      try {
        setOptions(await ask.loadOptions());
      } catch (error) {
        setFailure(error instanceof Error ? error.message : w.somethingWentWrong);
        return;
      } finally {
        setBusy(false);
      }
    }
    dialog.current?.showModal();
  };
  const run = async () => {
    setBusy(true);
    setFailure(undefined);
    try {
      await onRun();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : w.somethingWentWrong);
    }
    setBusy(false);
  };
  return (
    <span
      data-kit="action-button"
      {...(import.meta.env.DEV && concept ? { "data-sm-concept": concept } : {})}
      className="inline-flex flex-col items-end gap-1"
    >
      <Button
        type="button"
        variant="outline"
        title={help}
        disabled={busy}
        onClick={() => (ask ? void open() : run())}
      >
        {label}
      </Button>
      {failure && (
        <span role="alert" className="text-sm text-destructive">
          {failure}
        </span>
      )}
      {ask && (
        <dialog
          ref={dialog}
          aria-label={label}
          className="m-auto w-full max-w-lg bg-transparent p-0 backdrop:bg-black/50"
        >
          <Card className="space-y-4 rounded-xl p-card text-left">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{label}</h2>
              {help && <p className="text-sm text-muted-foreground">{help}</p>}
            </div>
            <ModelForm
              ui={ask.ui}
              app={ask.app}
              schema={ask.schema}
              initial={ask.initial}
              {...(options ? { options } : {})}
              submitLabel={label}
              onSubmit={async (values) => {
                // A refusal stays in the form, which shows it; done, the dialog closes.
                await onRun(values as Record<string, unknown>);
                dialog.current?.close();
              }}
              onCancel={() => dialog.current?.close()}
            />
          </Card>
        </dialog>
      )}
    </span>
  );
}
