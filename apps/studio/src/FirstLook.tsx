import { stageThemeSelection } from "@smithable/core";
import { useEffect, useRef, useState } from "react";
import { api, type PictureStyles, type Project } from "./api";
import { SMITHS } from "./builder/chat-style";
import { SmithFace } from "./builder/SmithFace";
import type { Spec } from "./engine";
import { keepLook, type LookChange } from "./first-look";
import { letGoTriedTheme, tryThemeInPreview } from "./preview";
import { ThemeCards } from "./ThemeCards";
import { Button, cx } from "./ui";

/**
 * The first visit's picker: a theme card is only tried on in the preview, its CSS put into the
 * page, with no operation (T1164); picture cards use complete sets. Keep makes the changes, the
 * picture style and one setTheme; Cancel makes none. Look in the toolbar opens LookPanel instead.
 */
export function FirstLook({
  project,
  spec,
  preset,
  aiBadge,
  onRefresh,
  onClose,
}: {
  project: Project;
  spec: Spec;
  preset: string;
  aiBadge: boolean;
  onRefresh: () => Promise<void>;
  onClose: (options: { error?: string }) => void;
}) {
  const [selected, setSelected] = useState(preset);
  // The adapter writes a theme's CSS; it is loaded beside the picker, as the look editor loads it.
  const [adapter] = useState(() => import("@smithable/adapter-tanstack"));
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
  // The card shows chosen at the click; the preview follows as soon as the CSS is written.
  const tried = useRef(0);
  const choose = async (theme: string) => {
    setSelected(theme);
    setError(undefined);
    const turn = ++tried.current;
    try {
      const { themeCss } = await adapter;
      if (turn !== tried.current || !spec.ir) return;
      const { ux } = stageThemeSelection(
        {
          ir: spec.ir,
          uxText: project.files.ux ?? "",
          themes: project.ownThemes,
          ...(spec.auth ? { auth: spec.auth } : {}),
        },
        { preset: theme },
      );
      tryThemeInPreview(themeCss(ux, project.ownThemes));
    } catch (reason) {
      if (turn === tried.current) setError((reason as Error).message);
    }
  };
  // Whatever closes the picker without Keep (Cancel, Escape, leaving the app) takes the tried
  // theme off the preview.
  const kept = useRef(false);
  useEffect(() => () => letGoTriedTheme(!kept.current), []);
  const finish = async (keep: boolean, style = selectedStyle) => {
    if (closing) return;
    if (!keep) {
      onClose({});
      return;
    }
    setClosing(true);
    const lookProject = project.lookProject ?? "";
    const changingPictures = Boolean(
      pictureStep && style && style !== pictures?.current && pictures?.offer,
    );
    const steps: ((revision: string) => Promise<LookChange>)[] = [];
    if (changingPictures)
      steps.push((revision) =>
        api.choosePictureStyle(style as string, revision, lookProject, pictures?.offer ?? ""),
      );
    if (selected !== preset)
      steps.push((revision) => api.chooseTheme(selected, revision, lookProject));
    try {
      await keepLook(project.revision ?? "", steps);
    } catch (reason) {
      const message = (reason as Error).message;
      if (changingPictures) setPictureError(message);
      else setError(message);
      setClosing(false);
      await onRefresh();
      return;
    }
    // With nothing changed no new page comes, so the tried theme is taken off this one.
    kept.current = steps.length > 0;
    await onRefresh();
    onClose({});
  };
  return (
    <section
      role="dialog"
      aria-label="Choose a look"
      aria-labelledby="first-look-title"
      aria-busy={closing}
      className="first-look"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          void finish(false);
        }
      }}
    >
      <div className="shrink-0 border-b border-line p-4">
        <div className="flex items-center gap-2">
          <SmithFace mood="pointing" />
          <h2 ref={heading} id="first-look-title" tabIndex={-1} className="text-lg font-semibold">
            Choose a look
          </h2>
        </div>
        <p className={cx(SMITHS, "mt-2 max-w-full")}>Hi, I’m Smith. Let’s give your app a look.</p>
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
            <h3 className="mb-3 text-sm font-medium">Which look feels right?</h3>
            <fieldset disabled={closing}>
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
            <h3 className="mb-3 text-sm font-medium">Choose an image style</h3>
            <p className="mb-3 text-sm text-muted">
              The same subjects, in another style. Pictures change only when you keep this look.
            </p>
            <fieldset disabled={closing}>
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
        {closing && (
          <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted">
            <SmithFace mood="working" />
            Keeping your look…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
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
          Cancel
        </Button>
      </div>
    </section>
  );
}
