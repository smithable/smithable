import { FONTS, humanize, type PictureKind } from "@smithable/core";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { parseDocument } from "yaml";
import {
  BadgeNote,
  BadgeSwitch,
  badgeValue,
  kindChoices,
  ShowBadgesHere,
  startingKind,
} from "./AiBadge";
import { api, type PictureStyles, type Project } from "./api";
import { BADGE_WORDS, KIND_WORDS } from "./badge-words";
import type { Spec } from "./engine";
import { LookSession, triedThemeCss } from "./first-look";
import { letGoTriedTheme, tryThemeInPreview } from "./preview";
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
 * at once through the operation layer, except the theme: a card only tries it on in the preview,
 * as the first visit's picker does (T1164), and Apply (at the foot, once a theme is tried on) makes
 * it one setTheme. Close (X, Escape) keeps what was applied and applies a tried theme too, one Undo
 * step away (T1195); Cancel undoes this panel's own changes, a tried theme with them, and refuses
 * when another writer changed the app in between. Customize opens the theme lab on a draft of the
 * tried theme (else the app's), handing this panel's changes over so the lab's Cancel undoes all.
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
  onClose: (options: {
    error?: string;
    kept?: boolean;
    /** Customize: the lab opens on this theme with this panel's changes still undoable. */
    customize?: { theme?: string; session: LookSession };
  }) => void;
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
            aiBadge: badgeValue(spec.ux?.aiBadge),
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
  // Customize opens the editor, so the editor gives it back there in turn.
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
    if (closed.current) return false;
    setPending((n) => n + 1);
    setError(undefined);
    try {
      await session.set(key, value, apply);
      return true;
    } catch (reason) {
      setError((reason as Error).message);
      return false;
    } finally {
      await onRefresh();
      setPending((n) => n - 1);
    }
  };
  // The tried theme's CSS is written again whenever the app's other settings change, so the
  // preview shows the theme with the font, density and color as they are now.
  const [adapter] = useState(() => import("@smithable/adapter-tanstack"));
  const [tried, setTried] = useState<string>();
  const triedNow = useRef<string>(undefined);
  const applying = useRef(false);
  useEffect(() => {
    if (tried === undefined) return;
    let active = true;
    adapter.then(
      (loaded) => {
        // Not after Apply: the refresh inside it re-renders while `tried` is still set.
        if (!active || closed.current || applying.current || triedNow.current !== tried) return;
        try {
          tryThemeInPreview(triedThemeCss(loaded, spec, project, tried));
        } catch (reason) {
          setError((reason as Error).message);
        }
      },
      (reason: Error) => active && setError(reason.message),
    );
    return () => {
      active = false;
    };
  }, [adapter, tried, spec, project]);
  // Closing the panel any way takes a theme only tried on off the preview.
  useEffect(() => () => letGoTriedTheme(triedNow.current !== undefined), []);
  const choose = (theme: string) => {
    const back = theme === (spec.ux?.theme.preset ?? "");
    triedNow.current = back ? undefined : theme;
    setTried(triedNow.current);
    if (back) letGoTriedTheme(true);
  };
  const applyTried = async (): Promise<boolean> => {
    const theme = triedNow.current;
    if (!theme || applying.current) return false;
    applying.current = true;
    // This page keeps the tried look until the theme is written.
    letGoTriedTheme(false);
    try {
      if (await setTheme("preset", theme)) {
        triedNow.current = undefined;
        setTried(undefined);
        // The preview may take the new stylesheet without a new page: the tried CSS comes off,
        // or it would hide every later change.
        letGoTriedTheme(true);
        return true;
      }
    } finally {
      applying.current = false;
    }
    // Refused: the theme stays tried on, and Apply can be pressed again.
    try {
      const loaded = await adapter;
      if (triedNow.current === theme && !closed.current)
        tryThemeInPreview(triedThemeCss(loaded, spec, project, theme));
    } catch (reason) {
      setError((reason as Error).message);
    }
    return false;
  };
  const setTheme = (key: Setting | "preset", value: string) =>
    change(key, value, (revision) =>
      value === OWN
        ? api.lookChange("resetThemeOverride", { key }, revision, lookProject)
        : api.lookChange("setTheme", { [key]: value }, revision, lookProject),
    );
  const close = async (keep: boolean, customize = false) => {
    if (closed.current || applying.current) return;
    // X and Escape apply a theme only tried on; a refused one keeps the panel open, still tried.
    if (keep && !customize && triedNow.current && !(await applyTried())) return;
    closed.current = true;
    setClosing(true);
    if (customize) {
      // Nothing is finished here: the lab's Cancel undoes this session's changes, its Close keeps them.
      const theme = triedNow.current;
      await onRefresh();
      onClose({ customize: { ...(theme ? { theme } : {}), session }, kept: session.changed });
      return;
    }
    let refusal: string | undefined;
    try {
      await session.finish(keep);
    } catch (reason) {
      refusal = `Cancel could not restore the opening look: ${(reason as Error).message} Review the changes in Changes.`;
    }
    await onRefresh();
    onClose({ ...(refusal ? { error: refusal } : {}), kept: keep && session.changed });
  };
  const id = useId();
  const ux = project.files.ux;
  const preset = spec.ux?.theme.preset ?? "";
  const styles = pictures?.offer ? pictures.styles : [];
  // The kind of pictures comes before their style (picture-kinds.md §1): the kind shown is the
  // one chosen here, else the current style's.
  const [chosenKind, setKind] = useState<PictureKind>();
  const kind = chosenKind ?? startingKind(styles, pictures?.current);
  const ofKind = kindChoices(styles).find((c) => c.kind === kind)?.styles ?? [];
  const busy = closing || session.refused;
  // The theme in use first, then the rest in the gallery's order (T1195): the list scrolls.
  const themes = [
    ...project.themes.filter((t) => t.name === preset),
    ...project.themes.filter((t) => t.name !== preset),
  ];
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
          <ThemeList count={themes.length}>
            <ThemeCards themes={themes} preset={tried ?? preset} inUse={preset} onChoose={choose} />
          </ThemeList>
          <p aria-live="polite" className="text-sm text-muted">
            {tried && `Only the preview shows ${humanize(tried)}.`}
          </p>
        </fieldset>
        <fieldset disabled={busy} className="space-y-3">
          <legend className="sr-only">Whole app settings</legend>
          {styles.length > 0 && (
            <Row label="Kind of pictures" htmlFor={`${id}-kind`}>
              <Select
                id={`${id}-kind`}
                value={kind}
                options={kindChoices(styles).map(
                  (c) =>
                    [
                      c.kind,
                      c.styles.length
                        ? KIND_WORDS[c.kind]
                        : `${KIND_WORDS[c.kind]} (${BADGE_WORDS.notYet})`,
                    ] as [string, string],
                )}
                onChange={(event) => setKind(event.target.value as PictureKind)}
              />
            </Row>
          )}
          {styles.length > 0 && kind === "ai-realistic" && <BadgeNote />}
          {styles.length > 0 && !ofKind.length && (
            <p className="text-sm text-muted" data-kind-not-yet>
              {KIND_WORDS[kind]}: {BADGE_WORDS.notYet}.
            </p>
          )}
          {ofKind.length > 0 && (
            <Row label="Image type" htmlFor={`${id}-pictures`}>
              <Select
                id={`${id}-pictures`}
                value={pictures?.current ?? ""}
                options={[
                  ...(pictures?.current && ofKind.some((s) => s.id === pictures.current)
                    ? []
                    : [["", "Current pictures"] as [string, string]]),
                  ...ofKind.map((s) => [s.id, s.name] as [string, string]),
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
          <BadgeSwitch
            id={`${id}-ai-badge`}
            aiBadge={spec.ux?.aiBadge}
            realistic={pictures?.realistic === true}
            onChange={(value, acknowledged) =>
              void change("aiBadge", value, (revision) =>
                api.lookChange(
                  "setAiBadge",
                  { value, ...(acknowledged ? { acknowledged: true } : {}) },
                  revision,
                  lookProject,
                ),
              )
            }
          />
          <ShowBadgesHere />
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
        <span className="flex items-center gap-2">
          <Button
            variant={tried ? "ghost" : "primary"}
            disabled={closing}
            onClick={() => void close(true, true)}
          >
            Customize
          </Button>
          {tried && (
            <Button disabled={busy} onClick={() => void applyTried()}>
              Apply
            </Button>
          )}
        </span>
      </div>
    </aside>
  );
}

/**
 * The theme cards in a box that scrolls, taller than two rows, with a fade at its foot and a count
 * while more cards lie below (T1195: the first cards are the top themes, the rest a scroll away).
 */
function ThemeList({ count, children }: { count: number; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(true);
  const measure = () => {
    const el = box.current;
    if (el) setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new count of themes changes what lies below
  useLayoutEffect(measure, [count]);
  return (
    <div className="relative">
      <div
        ref={box}
        onScroll={measure}
        className="max-h-[min(26rem,45dvh)] overflow-auto rounded-md pb-1"
      >
        {children}
      </div>
      {more && (
        <div
          data-more-themes
          className="pointer-events-none absolute inset-x-0 bottom-0 flex h-12 items-end justify-center bg-linear-to-t from-panel to-transparent pb-1 text-xs text-muted"
        >
          <span className="rounded-full bg-panel px-2 py-0.5 shadow-sm">
            {count} themes · scroll for more
          </span>
        </div>
      )}
    </div>
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
