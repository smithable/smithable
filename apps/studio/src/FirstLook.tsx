import { useEffect, useRef, useState } from "react";
import { api, type PictureStyles, type Project } from "./api";
import { ThemePreview } from "./first-look";
import { ThemeCards } from "./ThemeCards";
import { Button, cx } from "./ui";

/** Themes preview live; picture cards use complete sets, applied once when kept. */
export function FirstLook({
  project,
  preset,
  automatic,
  aiBadge,
  onRefresh,
  onClose,
}: {
  project: Project;
  preset: string;
  automatic: boolean;
  aiBadge: boolean;
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
  const [pictures, setPictures] = useState<PictureStyles>();
  const [pictureStep, setPictureStep] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string>();
  const [pictureError, setPictureError] = useState<string>();
  useEffect(() => {
    let active = true;
    api.pictureStyles(project.lookProject ?? "").then(
      (result) => {
        if (!active) return;
        setPictures(result);
        setSelectedStyle(result.current);
      },
      (reason: Error) => {
        if (active) setPictures({ styles: [], error: reason.message });
      },
    );
    return () => {
      active = false;
    };
  }, [project.lookProject]);
  const havePictures = Boolean(pictures?.offer && pictures.styles.length);
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
  const finish = async (keep: boolean, settings = false, style = selectedStyle) => {
    if (closing) return;
    setClosing(true);
    let refusal = error;
    const changingPictures =
      keep && !settings && pictureStep && style && style !== pictures?.current && pictures?.offer;
    try {
      await session.finish(
        keep,
        changingPictures
          ? (revision) =>
              api.choosePictureStyle(
                style as string,
                revision,
                project.lookProject ?? "",
                pictures?.offer ?? "",
              )
          : undefined,
      );
    } catch (reason) {
      if (changingPictures) {
        setPictureError((reason as Error).message);
        setClosing(false);
        await onRefresh();
        return;
      }
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
          Try a theme in your app, then choose a picture style when a complete set is available.
          Skip puts back the opening look.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {havePictures && (
          <fieldset className="mb-3 flex gap-2" aria-label="Look steps">
            <Button variant="ghost" disabled={closing} onClick={() => setPictureStep(false)}>
              Theme
            </Button>
            <Button variant="ghost" disabled={closing} onClick={() => setPictureStep(true)}>
              Pictures
            </Button>
          </fieldset>
        )}
        {!pictureStep ? (
          <>
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
            {!pictures && (
              <p role="status" className="mt-3 text-sm text-muted">
                Reading picture styles…
              </p>
            )}
            {pictures?.error && <p className="mt-3 text-sm text-muted">{pictures.error}</p>}
          </>
        ) : (
          <>
            <h3 className="mb-3 text-sm font-medium">Pictures</h3>
            <p className="mb-3 text-sm text-muted">
              The same subjects, in another style.{" "}
              {automatic
                ? "Pictures change only when you keep this look."
                : "Choose a style to apply it and keep this look."}
            </p>
            <fieldset disabled={closing || Boolean(error)}>
              <ul aria-label="Picture styles" className="space-y-3">
                {pictures?.styles.map((style) => (
                  <li key={style.id}>
                    <button
                      type="button"
                      aria-label={`Use ${style.name} pictures`}
                      aria-pressed={selectedStyle === style.id}
                      className={cx(
                        "w-full overflow-hidden rounded-md border text-left",
                        selectedStyle === style.id
                          ? "border-accent ring-2 ring-accent/40"
                          : "border-line hover:border-line-strong",
                      )}
                      onClick={() => {
                        setSelectedStyle(style.id);
                        setPictureError(undefined);
                        if (!automatic) void finish(true, false, style.id);
                      }}
                    >
                      <span className="grid grid-cols-3 gap-1 p-2">
                        {style.previews.map((picture) => (
                          <img
                            key={picture.src}
                            src={picture.src}
                            alt={picture.alt}
                            className="h-20 w-full rounded object-cover"
                            width={120}
                            height={80}
                          />
                        ))}
                      </span>
                      <span className="block p-3 text-sm">
                        <span className="font-medium">{style.name}</span>
                        {pictures.current === style.id && (
                          <span className="ml-2 text-xs text-accent">In use</span>
                        )}
                        <span className="mt-1 block text-muted">{style.line}</span>
                        <span className="mt-1 block text-xs text-quiet">
                          {style.generated === 0
                            ? "Photographs by people"
                            : style.generated === style.total
                              ? "Made by an image model"
                              : `${style.generated} of ${style.total} made by an image model`}
                        </span>
                        {style.kept > 0 && (
                          <span className="mt-1 block text-xs">
                            {style.kept} of your own{" "}
                            {style.kept === 1 ? "picture stays" : "pictures stay"}.
                          </span>
                        )}
                      </span>
                    </button>
                    <details className="mt-1 text-xs text-muted">
                      <summary className="cursor-pointer">More</summary>
                      {aiBadge
                        ? "Pictures made by an image model carry a mark in this app."
                        : "The mark for pictures made by an image model is off in this app."}{" "}
                      Photographs keep their credit.
                    </details>
                  </li>
                ))}
              </ul>
            </fieldset>
            {pictureError && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {pictureError}
              </p>
            )}
          </>
        )}
        {pictures?.current && !pictures.styles.some((style) => style.id === pictures.current) && (
          <p className="mt-3 text-sm text-muted">
            Your current picture style is no longer offered. The app keeps its pictures.
          </p>
        )}
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
        <Button
          disabled={closing}
          onClick={() => {
            if (havePictures && !pictureStep) setPictureStep(true);
            else void finish(true);
          }}
        >
          {havePictures && !pictureStep ? "Next: Pictures" : "Keep this look"}
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
