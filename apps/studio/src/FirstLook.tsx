import { useEffect, useRef, useState } from "react";
import { api, type Project } from "./api";
import { ThemePreview } from "./first-look";
import { ThemeCards } from "./ThemeCards";
import { Button } from "./ui";

/** Theme-only first release. Pictures follows when its complete style sets are available. */
export function FirstLook({
  project,
  preset,
  automatic,
  onRefresh,
  onClose,
}: {
  project: Project;
  preset: string;
  automatic: boolean;
  onRefresh: () => Promise<void>;
  onClose: (options: { error?: string; settings?: boolean }) => void;
}) {
  const [session] = useState(
    () =>
      new ThemePreview(
        { preset, revision: project.revision ?? "" },
        {
          apply: (theme, revision) => api.chooseTheme(theme, revision, project.lookProject ?? ""),
          undo: (change, revision) =>
            api.undoThemeChoice(change, revision, project.lookProject ?? ""),
        },
      ),
  );
  const [selected, setSelected] = useState(preset);
  const [pending, setPending] = useState(0);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string>();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    heading.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  const choose = async (theme: string) => {
    setPending((value) => value + 1);
    try {
      await session.choose(theme);
      setSelected(theme);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      await onRefresh();
      setPending((value) => value - 1);
    }
  };
  const finish = async (keep: boolean, settings = false) => {
    if (closing) return;
    setClosing(true);
    let refusal = error;
    try {
      await session.finish(keep);
    } catch (reason) {
      refusal = `Skip could not restore the opening look: ${(reason as Error).message} Review the changes in Changes.`;
    }
    await onRefresh();
    onClose({ error: refusal, settings });
  };
  return (
    <section
      role="dialog"
      aria-label="Choose a look"
      aria-labelledby="first-look-title"
      aria-busy={pending > 0 || closing}
      className="first-look"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          void finish(false);
        }
      }}
    >
      <div className="shrink-0 border-b border-line p-4">
        <h2 ref={heading} id="first-look-title" tabIndex={-1} className="text-lg font-semibold">
          Choose a look
        </h2>
        <p className="mt-1 text-sm text-muted">
          Try a theme in your app. Keep the one you like, or skip to put back the opening look.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <h3 className="mb-3 text-sm font-medium">Theme</h3>
        <fieldset disabled={closing || Boolean(error)}>
          <ThemeCards
            themes={project.themes}
            preset={selected}
            onChoose={(theme) => {
              void choose(theme);
            }}
          />
        </fieldset>
        {pending > 0 && (
          <p role="status" className="mt-3 text-sm text-muted">
            Updating your preview…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error} Close the picker and reopen Look to read the app again.
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-line p-4">
        <Button disabled={closing} onClick={() => void finish(true)}>
          Keep this look
        </Button>
        <Button variant="ghost" disabled={closing} onClick={() => void finish(false)}>
          Skip
        </Button>
        {!automatic && (
          <Button variant="ghost" disabled={closing} onClick={() => void finish(true, true)}>
            More look settings
          </Button>
        )}
      </div>
    </section>
  );
}
