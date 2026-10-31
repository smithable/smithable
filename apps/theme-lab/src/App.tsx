// The theme lab (docs/design/theme-lab.md §3): the theme file as controls and as text, one of a
// real app's pages in a frame at full size (the page, the mode and the width chosen; the phone
// beside it on request), the fit lines and the problems under it. A change
// computes the theme's CSS here and posts it to every frame (the preview's runtime swaps it in);
// nothing is regenerated until Save adds the theme.
import { themeCss } from "@smithable/adapter-tanstack";
import {
  BUILT_IN_THEMES,
  contrast,
  deriveTokens,
  emptyUx,
  FONT_WEIGHTS,
  FONTS,
  hardToRead,
  hexOf,
  parseTheme,
  SHADOWS,
  STYLE_VALUES,
  type ThemeIR,
  themeFit,
} from "@smithable/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { Guide, guideFirst } from "./Guide";
import { getField, setField, themeText } from "./theme-text";

type Frames = { label: string; path: string }[];

interface Start {
  preview: string;
  frames: Frames;
  /** The starters the switch offers, and the one shown (none when the app was given). */
  starters: string[];
  starter?: string;
  /** Public mode: every starter's saved pages, so the switch needs no server. */
  sets?: Record<string, Frames>;
  themes: { name: string; text: string }[];
  project: boolean;
  target: string;
}

/** What each motion setting moves, beside its control; "Show the motion" plays it. */
const MOTION_NOTES = {
  none: "Nothing moves: notices, rows, dialogs and pages appear at once.",
  subtle:
    "Notices, new rows and dialogs ease in, under a fifth of a second; the landing page stays still.",
  lively:
    "As subtle with a little bounce, and the landing page's sections rise into view as they scroll in; the hero's picture settles once.",
};

/** On docs.smithable.ai (`pnpm site`): the exported pages beside it, no server, Save downloads. */
const PUBLIC = import.meta.env.VITE_THEME_LAB === "public";

/** The common widths; the frame's edge drags to any width between them. */
const SIZES = [
  ["Phone", 390],
  ["Tablet", 820],
  ["Laptop", 1280],
  ["Desktop", 1600],
] as const;
const PHONE = 390;
const GAP = 16;

export function App() {
  const [start, setStart] = useState<Start>();
  const [text, setText] = useState(() => themeText(BUILT_IN_THEMES[0] as ThemeIR));
  const [page, setPage] = useState<string>();
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [width, setWidth] = useState(1280);
  const [beside, setBeside] = useState(false);
  const [grey, setGrey] = useState(false);
  const [signedIn, setSignedIn] = useState(PUBLIC);
  const [saved, setSaved] = useState<string>();
  // The guide (A 158): by itself once in a browser when the pages are in, again from its button.
  const [guiding, setGuiding] = useState(false);
  // A starter being made (local mode): its name while the lab waits, or what went wrong.
  const [making, setMaking] = useState<string>();
  // Each new app is signed in again; the fallback below waits for it anew.
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (PUBLIC)
      void fetch("start.json")
        .then((r) => r.json())
        .then(({ starters }: { starters: { name: string; frames: Frames }[] }) =>
          setStart({
            preview: new URL(".", location.href).href.replace(/\/$/, ""),
            frames: starters[0]?.frames ?? [],
            starters: starters.map((s) => s.name),
            starter: starters[0]?.name,
            sets: Object.fromEntries(starters.map((s) => [s.name, s.frames])),
            themes: [],
            project: false,
            target: "",
          }),
        );
    else
      void fetch("/api/start")
        .then((r) => r.json())
        .then(setStart);
  }, []);

  // Once the pages are in and the frames signed in, so every place the guide points at is drawn.
  const ready = signedIn && !!start?.frames.length;
  useEffect(() => {
    if (ready && guideFirst()) setGuiding(true);
  }, [ready]);

  const name = /^name:\s*(\S+)/m.exec(text)?.[1] ?? "my-theme";
  const { theme, diagnostics } = useMemo(
    // Every colour applies; text that may be hard to read is said, never refused (Johan, 2026-10-24).
    () => parseTheme({ path: `themes/${name}.yml`, text }),
    [name, text],
  );
  const errors = diagnostics.filter((d) => d.severity === "error");
  // A background on the wrong side (dark in light mode, pale in dark) cannot read with the
  // cards that mode makes; a refusal then says so first, in those words.
  const wrongSide = (["light", "dark"] as const).find((m) => {
    const bg = writtenColor(text, m, "background");
    return bg !== undefined && (textOn(bg) === "#ffffff") === (m === "light");
  });
  // A theme the checks refuse (a primary too close to its background) has no IR, but the
  // controls must stay so the person can change it back: they show the last theme that passed,
  // with the refusal beside them; the frames keep that theme's CSS too. (Johan, 2026-10-17:
  // choosing a colour made the controls disappear.)
  const lastGood = useRef<ThemeIR | undefined>(undefined);
  if (theme) lastGood.current = theme;
  const shown = theme ?? lastGood.current;
  const css = useMemo(
    () =>
      theme
        ? // The theme's own density and motion, as a ux file that names only the theme gets them.
          themeCss(
            {
              ...emptyUx(),
              theme: { preset: theme.name, density: theme.density, motion: theme.motion },
            },
            [theme],
          )
        : undefined,
    [theme],
  );

  // Every frame gets the CSS when it changes, and a frame that (re)loads gets it when it is ready.
  const frames = useRef(new Set<HTMLIFrameElement>());
  // "Show the motion" reloads the landing frames, which then scroll through once.
  const [replay, setReplay] = useState(0);
  const touring = useRef(false);
  const toured = useRef(new Set<string>());
  const origin = start && new URL(start.preview).origin;
  useEffect(() => {
    if (!css || !origin) return;
    for (const frame of frames.current)
      frame.contentWindow?.postMessage({ type: "smithable:theme-css", css, mode }, origin);
  }, [css, origin, mode]);
  useEffect(() => {
    const heard = (event: MessageEvent) => {
      if (event.origin !== origin || event.data?.source !== "smithable-preview") return;
      const from = event.source as Window;
      if (event.data.type === "ready") {
        // The frame's mode: the app's dark rules follow it, not the visitor's setting.
        const frame = [...frames.current].find((f) => f.contentWindow === from);
        if (frame?.dataset.signIn !== undefined)
          from.postMessage({ type: "smithable:dev-sign-in", role: "admin" }, origin);
        if (css) from.postMessage({ type: "smithable:theme-css", css, mode }, origin);
        if (touring.current && frame?.dataset.frame?.startsWith("Landing")) {
          from.postMessage({ type: "smithable:motion-tour" }, origin);
          // Once per click: a later reload of the frame (a save, Vite's own) does not tour again.
          toured.current.add(frame.dataset.frame);
          if (toured.current.size === (beside ? 2 : 1)) touring.current = false;
        }
        // Asked for its place, the page says where it is (and from then on, each move).
        from.postMessage({ type: "smithable:select-mode", on: false }, origin);
      }
      if (event.data.type === "navigated" && event.data.path !== "/sign-in") setSignedIn(true);
    };
    window.addEventListener("message", heard);
    return () => window.removeEventListener("message", heard);
  }, [css, origin, mode, beside]);
  // The frames open once the app has signed the lab in (its development sign-in, as an admin).
  useEffect(() => {
    if (round < 0) return;
    const later = setTimeout(() => setSignedIn(true), 20000);
    return () => clearTimeout(later);
  }, [round]);
  // Another starter: public mode has its pages already; locally the lab makes its app, a few
  // seconds, on the same address, then signs in to it.
  const switchTo = async (name: string) => {
    if (!start || name === start.starter) return;
    setPage(undefined);
    const set = start.sets?.[name];
    if (set) return setStart({ ...start, starter: name, frames: set });
    setMaking(name);
    setSignedIn(false);
    const answer = await fetch("/api/starter", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => r.json() as Promise<{ frames?: Frames; error?: string }>);
    if (!answer.frames) return setMaking(`Not switched: ${answer.error}`);
    setStart({ ...start, starter: name, frames: answer.frames });
    setMaking(undefined);
    setRound((n) => n + 1);
  };

  const set = (path: (string | number)[], value: unknown) => {
    setText((t) => setField(t, path, value));
    setSaved(undefined);
  };
  const save = async () => {
    if (PUBLIC) {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([text], { type: "text/yaml" }));
      link.download = `${name}.yml`;
      link.click();
      URL.revokeObjectURL(link.href);
      return setSaved(`Downloaded ${name}.yml: add it to a project with addTheme.`);
    }
    const answer = await fetch("/api/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, text }),
    }).then((r) => r.json() as Promise<{ saved?: string; error?: string }>);
    setSaved(answer.saved ? `Saved: ${answer.saved}` : `Not saved: ${answer.error}`);
  };
  const startFrom = (value: string) => {
    const own = start?.themes.find((t) => `own:${t.name}` === value);
    const builtIn = BUILT_IN_THEMES.find((t) => t.name === value);
    if (own) setText(own.text);
    else if (builtIn) setText(themeText(builtIn));
    setSaved(undefined);
  };

  // The frame at 100 %, scaled down only as much as the stage needs (both frames alike), and as
  // tall as the stage; its right edge drags the width.
  const stage = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ width: 1200, height: 700 });
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setRoom({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const scale = Math.min(1, (room.width - GAP * 2) / (width + (beside ? PHONE + GAP : 0)));
  const height = Math.round(room.height / scale);
  const drag = (down: React.PointerEvent<HTMLDivElement>) => {
    const from = down.clientX;
    const was = width;
    const edge = down.currentTarget;
    edge.setPointerCapture(down.pointerId);
    const move = (event: PointerEvent) =>
      setWidth(Math.round(Math.min(1920, Math.max(320, was + (event.clientX - from) / scale))));
    const up = () => {
      edge.removeEventListener("pointermove", move);
      edge.removeEventListener("pointerup", up);
    };
    edge.addEventListener("pointermove", move);
    edge.addEventListener("pointerup", up);
  };
  const onStage = start?.frames.find((f) => f.label === page) ?? start?.frames[0];
  const frame = (phone: boolean) =>
    start &&
    onStage && (
      <div
        className="frame"
        style={{ width: (phone ? PHONE : width) * scale, height: room.height }}
      >
        <iframe
          key={`${start.starter}-${round}-${onStage.path}-${onStage.label === "Landing" ? replay : 0}`}
          title={`${onStage.label}, ${mode}${phone ? ", phone" : ""}`}
          src={`${start.preview}${onStage.path}`}
          data-frame={`${onStage.label}-${mode}${phone ? "-phone" : ""}`}
          data-mode={mode}
          style={{
            width: phone ? PHONE : width,
            height,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
          }}
          ref={(f) => {
            if (!f) return;
            frames.current.add(f);
            return () => void frames.current.delete(f);
          }}
        />
      </div>
    );
  return (
    <div className="lab">
      <header>
        <strong>Theme lab</strong>
        {!!start?.starters.length && (
          <label>
            App{" "}
            <select
              aria-label="App"
              value={start.starter}
              disabled={!!making && !making.startsWith("Not ")}
              onChange={(e) => void switchTo(e.target.value)}
            >
              {start.starters.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        )}
        <label data-guide="start">
          Start from theme{" "}
          <select onChange={(e) => startFrom(e.target.value)} defaultValue="modern">
            <optgroup label="Built in">
              {BUILT_IN_THEMES.map((t) => (
                <option key={t.name}>{t.name}</option>
              ))}
            </optgroup>
            {!!start?.themes.length && (
              <optgroup label="This project's">
                {start.themes.map((t) => (
                  <option key={t.name} value={`own:${t.name}`}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <label>
          Name{" "}
          <input aria-label="Name" value={name} onChange={(e) => set(["name"], e.target.value)} />
        </label>
        <button
          type="button"
          disabled={!signedIn}
          onClick={() => {
            setPage("Landing");
            touring.current = true;
            toured.current.clear();
            setReplay((n) => n + 1);
          }}
        >
          Show the motion
        </button>
        <button
          type="button"
          data-guide="save"
          disabled={!theme || errors.length > 0}
          onClick={save}
        >
          {PUBLIC ? "Download" : start?.project ? "Save to the project" : "Save theme"}
        </button>
        {saved && <span role="status">{saved}</span>}
        <button type="button" className="guide-open" onClick={() => setGuiding(true)}>
          Guide
        </button>
      </header>
      {guiding && <Guide onEnd={() => setGuiding(false)} />}
      <aside data-guide="controls">
        {shown && <Controls theme={shown} text={text} set={set} mode={mode} />}
      </aside>
      <main>
        {start && !signedIn && !making && (
          <iframe
            key={round}
            title="Signing in"
            hidden
            data-sign-in
            src={`${start.preview}/sign-in`}
            ref={(f) => {
              if (!f) return;
              frames.current.add(f);
              return () => void frames.current.delete(f);
            }}
          />
        )}
        <div className="bar">
          <fieldset aria-label="Page" data-guide="page">
            {start?.frames.map((f) => (
              <button
                type="button"
                key={f.label}
                aria-pressed={f === onStage}
                onClick={() => setPage(f.label)}
              >
                {f.label}
              </button>
            ))}
          </fieldset>
          <fieldset aria-label="Mode" data-guide="mode">
            {(["light", "dark"] as const).map((m) => (
              <button type="button" key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>
                {m === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </fieldset>
          <fieldset aria-label="Width" data-guide="width">
            {SIZES.map(([label, w]) => (
              <button
                type="button"
                key={label}
                aria-pressed={width === w}
                onClick={() => setWidth(w)}
              >
                {label} {w}
              </button>
            ))}
          </fieldset>
          <span data-width>
            {width} px{scale < 1 && `, shown at ${Math.round(scale * 100)} %`}
          </span>
          <label>
            <input type="checkbox" checked={beside} onChange={(e) => setBeside(e.target.checked)} />{" "}
            Phone beside
          </label>
          <label>
            <input type="checkbox" checked={grey} onChange={(e) => setGrey(e.target.checked)} />{" "}
            Greyscale
          </label>
        </div>
        <div ref={stage} className={grey ? "stage grey" : "stage"}>
          {making && (
            <p role="status" className="making">
              {making.startsWith("Not ") ? making : `Making the ${making} app…`}
            </p>
          )}
          {signedIn && frame(false)}
          {signedIn && onStage && (
            // A pointer's drag; the width buttons are the keyboard's way.
            <div className="edge" title="Drag to change the width" onPointerDown={drag} />
          )}
          {signedIn && beside && frame(true)}
        </div>
        <section className="notes" data-guide="notes">
          {errors.length > 0 && (
            // Only a file that cannot make a theme (a colour that is no colour): never a choice of colours.
            <p className="avoid">
              Not applied yet: the pages show the last theme that worked. What to fix:
            </p>
          )}
          {theme &&
            hardToReadIn(theme).map((line) => (
              <p key={line} className="avoid" data-warning="">
                {line}
              </p>
            ))}
          {wrongSide && (
            <p className="avoid">
              {wrongSide === "light"
                ? "Light mode usually has a light background; with a dark one, some text may be hard to read."
                : "Dark mode usually has a dark background; with a light one, some text may be hard to read."}
            </p>
          )}
          {errors.map((d) => (
            <p key={`${d.line}-${d.message}`} className="avoid">
              {d.message}
            </p>
          ))}
          {shown &&
            themeFit(shown).map((fit) => (
              <p key={fit.rule} className={fit.verdict} data-fit={fit.rule}>
                {fit.text}
              </p>
            ))}
        </section>
        <label className="file">
          themes/{name}.yml
          <textarea
            spellCheck={false}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSaved(undefined);
            }}
          />
        </label>
      </main>
    </div>
  );
}

/** The theme's pairs that may not read, one plain sentence each: a warning, never a refusal. */
const hardToReadIn = (theme: ThemeIR): string[] => [
  ...new Set((["light", "dark"] as const).flatMap((mode) => hardToRead(theme[mode], mode))),
];

/** A colour as the file writes it, as hex; undefined when absent or not a colour. */
function writtenColor(text: string, mode: "light" | "dark", token: string): string | undefined {
  const raw = getField(text, [mode, token]);
  return typeof raw === "string" && /^(#[0-9a-f]{6}|oklch\()/i.test(raw) ? hexOf(raw) : undefined;
}

/** The text that reads best on a background: white on a dark one, ink on a pale one. */
const textOn = (bg: string) =>
  contrast("#ffffff", bg) >= contrast("#101522", bg) ? "#ffffff" : "#101522";

/** The fields, grouped as the file is. Each shows the theme's value and writes the file's. */
function Controls({
  theme,
  text,
  set,
  mode,
}: {
  theme: ThemeIR;
  /** The mode on screen: its own colours are the ones shown and changed (Johan, 2026-10-25). */
  mode: "light" | "dark";
  /** The file as it is: a colour the checks refused is shown as written, so it can be picked again. */
  text: string;
  set: (path: (string | number)[], value: unknown) => void;
}) {
  const choice = (label: string, path: string[], value: string, values: readonly string[]) => (
    <label key={path.join(".")}>
      {label}
      <select aria-label={label} value={value} onChange={(e) => set(path, e.target.value)}>
        {values.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  );
  type Token = "primary" | "background" | "card" | "foreground";
  const written = (mode: "light" | "dark", token: Token) => writtenColor(text, mode, token);
  const shownColor = (mode: "light" | "dark", token: Token) =>
    written(mode, token) ?? hexOf(theme[mode][token]);
  // The text follows the colours it sits on, as before (A 160): a new background or surface
  // changes it to the one that reads when the chosen one no longer does. Unticked, the chosen
  // text colour stays, and the warnings above say where it is hard to read.
  const [follows, setFollows] = useState(true);
  const color = (mode: "light" | "dark", token: Token, label: string) => (
    <label key={`${mode}.${token}`}>
      {label}
      <input
        type="color"
        aria-label={label}
        value={shownColor(mode, token)}
        onChange={(e) =>
          token === "background"
            ? background(mode, e.target.value)
            : token === "card"
              ? surface(mode, e.target.value)
              : set([mode, token], e.target.value)
        }
      />
    </label>
  );
  // A new background or surface: the colours that sit on the background are derived from it
  // again (the surfaces too, unless chosen), and the text follows when it should. The text is
  // one colour on the background and on the surfaces (cards, menus, forms), so it follows to the
  // one of white and ink that reads on both best.
  const background = (mode: "light" | "dark", value: string) => {
    set([mode, "background"], value);
    for (const token of ["muted", "border", "accent"]) set([mode, token], undefined);
    // The surfaces as they will be: chosen, or derived from the new background.
    const card =
      written(mode, "card") ??
      hexOf(deriveTokens({ ...theme[mode], background: value, card: undefined }, mode).card);
    follow(mode, value, card);
  };
  const surface = (mode: "light" | "dark", value: string) => {
    set([mode, "card"], value);
    follow(mode, shownColor(mode, "background"), value);
  };
  const follow = (mode: "light" | "dark", bg: string, card: string) => {
    const reads = (fg: string) => Math.min(contrast(fg, bg), contrast(fg, card));
    if (!follows || reads(shownColor(mode, "foreground")) >= 4.5) return;
    set([mode, "foreground"], reads("#ffffff") >= reads("#101522") ? "#ffffff" : "#101522");
  };
  // The weights the headings' font has (a weight outside them is refused).
  const [lightest, heaviest] = FONT_WEIGHTS[
    (theme.style.headingFont ?? theme.font) as keyof typeof FONT_WEIGHTS
  ] ?? [100, 900];
  const inRange = (w: number) => w >= lightest && w <= heaviest;
  // A new font for the headings: a weight it lacks moves to the nearest it has.
  const font = (which: "body" | "heading", name: string | undefined) => {
    set(["fonts", which], name);
    const heading = which === "heading" ? (name ?? theme.font) : (theme.style.headingFont ?? name);
    const [low, high] = FONT_WEIGHTS[heading as keyof typeof FONT_WEIGHTS] ?? [100, 900];
    const weight = theme.style.headings.weight;
    if (weight < low || weight > high)
      set(["headings", "weight"], Math.min(Math.max(weight, low), Math.min(high, 800)));
  };
  const shadow = Object.entries(SHADOWS).find(([, css]) => css === theme.shadow)?.[0] ?? "none";
  return (
    <>
      <fieldset>
        <legend>Colours ({mode === "light" ? "light mode" : "dark mode"})</legend>
        {color(mode, "primary", "Primary")}
        {color(mode, "background", "Background")}
        {color(mode, "card", "Surfaces (cards, menus, forms)")}
        {color(mode, "foreground", "Text")}
        <label>
          <input type="checkbox" checked={follows} onChange={(e) => setFollows(e.target.checked)} />{" "}
          Text colour follows the others
        </label>
        <p className="hint">
          {follows
            ? "The text changes to white or ink when a background or surface would make it hard to read."
            : "The text stays as chosen; a warning above says where it is hard to read."}{" "}
          The text is one colour on the background and the surfaces; text on the primary colour
          (buttons) is a second one, white or ink, whichever reads on it.
        </p>
      </fieldset>
      <fieldset>
        <legend>Fonts</legend>
        <label>
          Body
          <select
            aria-label="Body font"
            value={theme.font}
            onChange={(e) => font("body", e.target.value)}
          >
            {FONTS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          Headings
          <select
            aria-label="Heading font"
            value={theme.style.headingFont ?? ""}
            onChange={(e) => font("heading", e.target.value || undefined)}
          >
            <option value="">the body font</option>
            {FONTS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          Labels
          <select
            aria-label="Labels font"
            value={theme.style.labelsFont ?? ""}
            onChange={(e) => set(["fonts", "labels"], e.target.value || undefined)}
          >
            <option value="">the body font</option>
            {FONTS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
      </fieldset>
      {(Object.keys(STYLE_VALUES) as (keyof typeof STYLE_VALUES)[]).map((group) => (
        <fieldset key={group}>
          <legend>{group[0]?.toUpperCase() + group.slice(1)}</legend>
          {group === "headings" && (
            <label>
              weight
              <select
                aria-label="Heading weight"
                value={theme.style.headings.weight}
                onChange={(e) => set(["headings", "weight"], Number(e.target.value))}
              >
                {[300, 400, 500, 600, 700, 800, 900].filter(inRange).map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </select>
            </label>
          )}
          {Object.entries(STYLE_VALUES[group]).map(([key, values]) =>
            choice(
              key,
              [group, key],
              String((theme.style[group] as Record<string, unknown>)[key]),
              values,
            ),
          )}
        </fieldset>
      ))}
      <fieldset>
        <legend>Shape and motion</legend>
        <label>
          radius
          <input value={theme.radius} onChange={(e) => set(["radius"], e.target.value)} />
        </label>
        {choice("shadow", ["shadow"], shadow, Object.keys(SHADOWS))}
        {choice("density", ["density"], theme.density, ["comfortable", "standard", "compact"])}
        {choice("motion", ["motion"], theme.motion, ["none", "subtle", "lively"])}
        {choice("texture", ["texture"], theme.style.texture, ["none", "grain", "paper"])}
        {choice("modes", ["modes"], theme.modes, ["both", "light", "dark"])}
        <p className="hint" data-motion-note>
          {MOTION_NOTES[theme.motion]}
        </p>
        <label>
          chroma
          <input
            type="number"
            min={0}
            max={0.4}
            step={0.01}
            value={theme.chroma}
            onChange={(e) => set(["chroma"], Number(e.target.value))}
          />
        </label>
      </fieldset>
    </>
  );
}
