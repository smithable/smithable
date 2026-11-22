import { FONTS, humanize } from "@smithable/core";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { parseDocument } from "yaml";
import { api, type PictureStyles, type Project } from "./api";
import type { Spec } from "./engine";
import { LookSession } from "./first-look";
import { ThemeCards } from "./ThemeCards";
import { Button, cx, Select } from "./ui";

/** The settings Look shows, each a key of smithable.ux.yml's theme (look.md §1). */
const SETTINGS = {
  font: ["theme", "brand", "font"],
  density: ["theme", "density"],
  primary: ["theme", "brand", "primary"],
} as const;
type Setting = keyof typeof SETTINGS;
const OWN = "";

/**
 * Look (T1145): the whole app's most used look settings beside the running preview, each applied
 * at once through the operation layer. Close keeps them; Cancel undoes this panel's own changes
 * and refuses when another writer changed the app in between. Customise opens the theme lab.
 */
export function LookPanel({
  project,
  spec,
  place,
  onRefresh,
  onClose,
}: {
  project: Project;
  spec: Spec;
  place: "left" | "right" | "sheet";
  onRefresh: () => Promise<void>;
  onClose: (options: { error?: string; customize?: boolean }) => void;
}) {
  const lookProject = project.lookProject ?? "";
  const authored = (text: string | undefined, setting: Setting) => {
    const value = parseDocument(text ?? "").getIn(SETTINGS[setting]);
    return value === undefined || value === null ? OWN : String(value);
  };
  const [session] = useState(
    () =>
      new LookSession(
        {
          values: {
            preset: spec.ux?.theme.preset,
            font: authored(project.files.ux, "font"),
            density: authored(project.files.ux, "density"),
            primary: authored(project.files.ux, "primary"),
          },
          revision: project.revision ?? "",
        },
        (change, revision) => api.undoThemeChoice(change, revision, lookProject),
      ),
  );
  const [pictures, setPictures] = useState<PictureStyles>();
  useEffect(() => {
    let active = true;
    api.pictureStyles(lookProject).then(
      (result) => {
        if (!active) return;
        setPictures(result);
        if (result.current) session.know("pictures", result.current);
      },
      (reason: Error) => {
        if (active) setPictures({ styles: [], error: reason.message });
      },
    );
    return () => {
      active = false;
    };
  }, [lookProject, session]);
  const [pending, setPending] = useState(0);
  const [closing, setClosing] = useState(false);
  // A brand color still waiting out its pause when Look closes is dropped, not applied.
  const closed = useRef(false);
  const [error, setError] = useState<string>();
  const heading = useRef<HTMLHeadingElement>(null);
  // It hangs under Studio's header, whatever rows the header shows.
  const [top, setTop] = useState(0);
  useLayoutEffect(() => {
    const header = document.querySelector("[data-studio-header]");
    if (!header) return;
    const measure = () => setTop(header.getBoundingClientRect().bottom);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  // Focus goes back to what opened Look (its toolbar button) when the panel closes, also when
  // Customise opens the editor, so the editor gives it back there in turn.
  useEffect(() => {
    const previous = document.activeElement;
    heading.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  const change = async (
    key: string,
    value: string,
    apply: (
      revision: string,
    ) => Promise<{ ok: boolean; output: string; change?: string; revision?: string }>,
  ) => {
    if (closed.current) return;
    setPending((n) => n + 1);
    setError(undefined);
    try {
      await session.set(key, value, apply);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      await onRefresh();
      setPending((n) => n - 1);
    }
  };
  const setTheme = (key: Setting | "preset", value: string) =>
    change(key, value, (revision) =>
      value === OWN
        ? api.lookChange("resetThemeOverride", { key }, revision, lookProject)
        : api.lookChange("setTheme", { [key]: value }, revision, lookProject),
    );
  const close = async (keep: boolean, customize = false) => {
    if (closing) return;
    closed.current = true;
    setClosing(true);
    let refusal: string | undefined;
    try {
      await session.finish(keep);
    } catch (reason) {
      refusal = `Cancel could not restore the opening look: ${(reason as Error).message} Review the changes in Changes.`;
    }
    await onRefresh();
    onClose({ ...(refusal ? { error: refusal } : {}), customize });
  };
  const id = useId();
  const ux = project.files.ux;
  const preset = spec.ux?.theme.preset ?? "";
  const styles = pictures?.offer ? pictures.styles : [];
  const busy = closing || session.refused;
  return (
    <aside
      aria-labelledby={`${id}-title`}
      aria-busy={pending > 0 || closing}
      data-look-panel={place}
      className={cx("look-panel", `look-panel-${place}`)}
      style={place === "sheet" ? undefined : { top }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          void close(true);
        }
      }}
    >
      <div className="flex shrink-0 items-start justify-between gap-2 px-4 pt-4">
        <div>
          <h2 ref={heading} id={`${id}-title`} tabIndex={-1} className="text-lg font-semibold">
            Look
          </h2>
          <p className="text-sm text-muted">Whole app</p>
        </div>
        <button
          type="button"
          aria-label="Close Look"
          title="Close Look"
          disabled={closing}
          className="grid size-8 place-items-center rounded-md text-muted hover:bg-subtle hover:text-fg"
          onClick={() => void close(true)}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-3">
        <fieldset disabled={busy} className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">
            Theme <span className="font-normal text-muted">· {humanize(preset)}</span>
          </legend>
          <div className="max-h-[17rem] overflow-auto rounded-md">
            <ThemeCards
              themes={project.themes}
              preset={preset}
              onChoose={(theme) => void setTheme("preset", theme)}
            />
          </div>
        </fieldset>
        <fieldset disabled={busy} className="space-y-3">
          <legend className="sr-only">Whole app settings</legend>
          {styles.length > 0 && (
            <Row label="Image type" htmlFor={`${id}-pictures`}>
              <Select
                id={`${id}-pictures`}
                value={pictures?.current ?? ""}
                options={[
                  ...(pictures?.current && styles.some((s) => s.id === pictures.current)
                    ? []
                    : [["", "Current pictures"] as [string, string]]),
                  ...styles.map((s) => [s.id, s.name] as [string, string]),
                ]}
                onChange={(event) => {
                  const style = event.target.value;
                  if (!style) return;
                  // A new object re-renders the select, so a refused style shows the kept one.
                  void change("pictures", style, (revision) =>
                    api.choosePictureStyle(style, revision, lookProject, pictures?.offer ?? ""),
                  ).then(() =>
                    api.pictureStyles(lookProject).then(
                      (result) => setPictures({ ...result }),
                      () => undefined,
                    ),
                  );
                }}
              />
            </Row>
          )}
          <Row label="Font" htmlFor={`${id}-font`}>
            <Select
              id={`${id}-font`}
              value={authored(ux, "font")}
              options={[[OWN, "Theme's own"], ...FONTS.map((f) => [f, f] as [string, string])]}
              onChange={(event) => void setTheme("font", event.target.value)}
            />
          </Row>
          <Row label="Density" htmlFor={`${id}-density`}>
            <Select
              id={`${id}-density`}
              value={authored(ux, "density")}
              options={[
                [OWN, "Theme's own"],
                ["comfortable", "Comfortable"],
                ["standard", "Standard"],
                ["compact", "Compact"],
              ]}
              onChange={(event) => void setTheme("density", event.target.value)}
            />
          </Row>
          <BrandColor
            id={`${id}-primary`}
            value={authored(ux, "primary")}
            onChange={(color) => void setTheme("primary", color)}
          />
        </fieldset>
        {pictures?.error && <p className="text-sm text-muted">{pictures.error}</p>}
        {pending > 0 && (
          <p role="status" className="text-sm text-muted">
            Updating your preview…
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
            {session.refused && " Close Look and open it again to read the app again."}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line p-4">
        <Button variant="ghost" disabled={closing} onClick={() => void close(false)}>
          Cancel
        </Button>
        <Button disabled={closing} onClick={() => void close(true, true)}>
          Customise
        </Button>
      </div>
    </aside>
  );
}

function Row({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

/** The brand color, applied when the picker settles rather than at every step of a drag. */
function BrandColor({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (color: string) => void;
}) {
  const [shown, setShown] = useState(value || "#2563eb");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => setShown(value || "#2563eb"), [value]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <label htmlFor={id}>Brand color</label>
      <span className="flex items-center gap-2">
        {value !== OWN && (
          <button
            type="button"
            className="rounded px-1 text-xs text-accent hover:bg-subtle"
            onClick={() => onChange(OWN)}
          >
            Theme's own
          </button>
        )}
        <input
          id={id}
          type="color"
          value={shown}
          className="h-8 w-12 cursor-pointer rounded border border-line bg-panel"
          onChange={(event) => {
            const color = event.target.value;
            setShown(color);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => onChange(color), 400);
          }}
        />
      </span>
    </div>
  );
}
