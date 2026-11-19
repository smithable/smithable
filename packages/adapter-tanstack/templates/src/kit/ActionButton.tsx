// Smithable app kit: a button that runs an action on a record, then shows the record as it is now.
// An action that asks for values opens a dialog with the form's own fields first; one that asks
// before it runs (record-documents.md §6) puts its question first, filled from the record as it is.
import { useRef, useState } from "react";
import type { z } from "zod";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { ModelForm } from "./ModelForm";
import { type AppUi, type ModelUi, type Options, textMarker } from "./model";
import { tx, w } from "./words";

export function ActionButton({
  label: own,
  help: ownHelp,
  concept,
  onRun,
  ask,
  confirm,
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
  /**
   * Asks before it runs: the content file's text, its {placeholders} filled with what `load`
   * gives (the record as it is now, its values written out), else the label and the title. A
   * message that would reach nobody is said instead, and the action is not offered.
   */
  confirm?: {
    text?: string;
    load?: () => Promise<{ values: Record<string, string> } | { noRecipient: true }>;
  };
}) {
  // The app's texts in the language now (languages.md §4).
  const label = tx(own);
  const help = ownHelp && tx(ownHelp);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const dialog = useRef<HTMLDialogElement>(null);
  const [options, setOptions] = useState<Options>();
  const asking = useRef<HTMLDialogElement>(null);
  const [question, setQuestion] = useState<{ text: string; offered: boolean }>();
  const confirmFirst = async () => {
    setBusy(true);
    setFailure(undefined);
    try {
      const got = confirm?.load ? await confirm.load() : { values: {} as Record<string, string> };
      setQuestion(
        "noRecipient" in got
          ? { text: w.asksFirst.noRecipient, offered: false }
          : {
              text: confirm?.text
                ? fill(tx(confirm.text), got.values)
                : w.asksFirst.question(label, got.values.title),
              offered: true,
            },
      );
      asking.current?.showModal();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : w.somethingWentWrong);
    } finally {
      setBusy(false);
    }
  };
  const go = () => (ask ? void open() : run());
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
      // A worked-out value the mail names, with no value (record-documents.md §3).
      const missing = error instanceof Error && /^no-value:(.+)$/.exec(error.message)?.[1];
      setFailure(
        missing
          ? w.noValue(missing)
          : error instanceof Error
            ? error.message
            : w.somethingWentWrong,
      );
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
        onClick={() => (confirm ? void confirmFirst() : go())}
      >
        {/* Its words are the content file's: changed in place in the preview (A 169). */}
        <span {...(concept ? textMarker(`actions.${concept.slice("action:".length)}.label`) : {})}>
          {label}
        </span>
      </Button>
      {failure && (
        <span role="alert" className="text-sm text-destructive">
          {failure}
        </span>
      )}
      {confirm && (
        <dialog
          ref={asking}
          aria-label={label}
          className="m-auto w-full max-w-md bg-transparent p-0 backdrop:bg-black/50"
        >
          <Card className="space-y-4 rounded-xl p-card text-left">
            <h2 className="text-lg font-semibold">{label}</h2>
            <p className="text-sm">{question?.text}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => asking.current?.close()}>
                {question?.offered ? w.cancel : w.asksFirst.close}
              </Button>
              {question?.offered && (
                <Button
                  type="button"
                  onClick={() => {
                    asking.current?.close();
                    go();
                  }}
                >
                  {label}
                </Button>
              )}
            </div>
          </Card>
        </dialog>
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

/** The {placeholders} of a question filled; one not given is left empty. */
function fill(text: string, values: Record<string, string>): string {
  return text.replace(/\{([^{}]+)\}/g, (_, path: string) =>
    Object.hasOwn(values, path.trim()) ? (values[path.trim()] ?? "") : "",
  );
}
