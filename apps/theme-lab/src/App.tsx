// The theme lab (docs/design/theme-lab.md §3): the theme file as controls and as text, a real
// app's pages in frames in light and dark, the fit lines and the problems under them. A change
// computes the theme's CSS here and posts it to every frame (the preview's runtime swaps it in);
// nothing is regenerated until Save adds the theme.
import { themeCss } from "@smithable/adapter-tanstack";
import {
  BUILT_IN_THEMES,
  emptyUx,
  FONT_WEIGHTS,
  FONTS,
  hexOf,
  parseTheme,
  SHADOWS,
  STYLE_VALUES,
  type ThemeIR,
  themeFit,
} from "@smithable/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { getField, setField, themeText } from "./theme-text";

interface Start {
  preview: string;
  frames: { label: string; path: string }[];
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

const SIZES = {
  desktop: { width: 1280, height: 820, scale: 0.42 },
  phone: { width: 390, height: 780, scale: 0.6 },
};

export function App() {
  const [start, setStart] = useState<Start>();
  const [text, setText] = useState(() => themeText(BUILT_IN_THEMES[0] as ThemeIR));
  const [size, setSize] = useState<keyof typeof SIZES>("desktop");
  const [grey, setGrey] = useState(false);
  const [signedIn, setSignedIn] = useState(PUBLIC);
  const [saved, setSaved] = useState<string>();
  useEffect(() => {
    if (PUBLIC)
      void fetch("start.json")
        .then((r) => r.json())
        .then(({ frames }) =>
          setStart({
            preview: new URL(".", location.href).href.replace(/\/$/, ""),
            frames,
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

  const name = /^name:\s*(\S+)/m.exec(text)?.[1] ?? "my-theme";
  const { theme, diagnostics } = useMemo(
    () => parseTheme({ path: `themes/${name}.yml`, text }),
    [name, text],
  );
  const errors = diagnostics.filter((d) => d.severity === "error");
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
      frame.contentWindow?.postMessage(
        { type: "smithable:theme-css", css, mode: frame.dataset.mode },
        origin,
      );
  }, [css, origin]);
  useEffect(() => {
    const heard = (event: MessageEvent) => {
      if (event.origin !== origin || event.data?.source !== "smithable-preview") return;
      const from = event.source as Window;
      if (event.data.type === "ready") {
        // The frame's mode: the app's dark rules follow it, not the visitor's setting.
        const frame = [...frames.current].find((f) => f.contentWindow === from);
        const mode = frame?.dataset.mode;
        if (frame?.dataset.signIn !== undefined)
          from.postMessage({ type: "smithable:dev-sign-in", role: "admin" }, origin);
        if (css) from.postMessage({ type: "smithable:theme-css", css, mode }, origin);
        if (touring.current && frame?.dataset.frame?.startsWith("Landing")) {
          from.postMessage({ type: "smithable:motion-tour" }, origin);
          // Once per click: a later reload of the frame (a save, Vite's own) does not tour again.
          toured.current.add(frame.dataset.frame);
          if (toured.current.size === 2) touring.current = false;
        }
        // Asked for its place, the page says where it is (and from then on, each move).
        from.postMessage({ type: "smithable:select-mode", on: false }, origin);
      }
      if (event.data.type === "navigated" && event.data.path !== "/sign-in") setSignedIn(true);
    };
    window.addEventListener("message", heard);
    return () => window.removeEventListener("message", heard);
  }, [css, origin]);
  // The frames open once the app has signed the lab in (its development sign-in, as an admin).
  useEffect(() => {
    const later = setTimeout(() => setSignedIn(true), 20000);
    return () => clearTimeout(later);
  }, []);

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

  const { width, height, scale } = SIZES[size];
  return (
    <div className="lab">
      <header>
        <strong>Theme lab</strong>
        <label>
          Start from{" "}
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
        <label>
          <input
            type="checkbox"
            checked={size === "phone"}
            onChange={(e) => setSize(e.target.checked ? "phone" : "desktop")}
          />{" "}
          Phone
        </label>
        <label>
          <input type="checkbox" checked={grey} onChange={(e) => setGrey(e.target.checked)} />{" "}
          Greyscale
        </label>
        <button
          type="button"
          disabled={!signedIn}
          onClick={() => {
            touring.current = true;
            toured.current.clear();
            setReplay((n) => n + 1);
          }}
        >
          Show the motion
        </button>
        <button type="button" disabled={!theme || errors.length > 0} onClick={save}>
          {PUBLIC
            ? "Download"
            : `Save${start ? (start.project ? " to the project" : ` to ${start.target}/themes`) : ""}`}
        </button>
        {saved && <span role="status">{saved}</span>}
      </header>
      <aside>{shown && <Controls theme={shown} text={text} set={set} />}</aside>
      <main>
        {start && !signedIn && (
          <iframe
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
        <div className={grey ? "frames grey" : "frames"}>
          {start &&
            signedIn &&
            start.frames.flatMap((f) =>
              (["light", "dark"] as const).map((mode) => (
                <figure
                  key={`${f.path}-${mode}-${f.label === "Landing" ? replay : 0}`}
                  style={{ width: width * scale }}
                >
                  <figcaption>
                    {f.label}, {mode}
                  </figcaption>
                  <div style={{ height: height * scale, overflow: "hidden" }}>
                    <iframe
                      title={`${f.label}, ${mode}`}
                      src={`${start.preview}${f.path}`}
                      data-frame={`${f.label}-${mode}`}
                      data-mode={mode}
                      style={{
                        width,
                        height,
                        transform: `scale(${scale})`,
                        transformOrigin: "0 0",
                      }}
                      ref={(frame) => {
                        if (!frame) return;
                        frames.current.add(frame);
                        return () => void frames.current.delete(frame);
                      }}
                    />
                  </div>
                </figure>
              )),
            )}
        </div>
        <section className="notes">
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

/** The fields, grouped as the file is. Each shows the theme's value and writes the file's. */
function Controls({
  theme,
  text,
  set,
}: {
  theme: ThemeIR;
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
  const written = (mode: "light" | "dark", token: "primary" | "background") => {
    const raw = getField(text, [mode, token]);
    return typeof raw === "string" && /^(#[0-9a-f]{6}|oklch\()/i.test(raw) ? hexOf(raw) : undefined;
  };
  const color = (mode: "light" | "dark", token: "primary" | "background") => (
    <label key={`${mode}.${token}`}>
      {mode} {token}
      <input
        type="color"
        value={written(mode, token) ?? hexOf(theme[mode][token])}
        onChange={(e) => set([mode, token], e.target.value)}
      />
    </label>
  );
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
        <legend>Colours</legend>
        {color("light", "primary")}
        {color("light", "background")}
        {color("dark", "primary")}
        {color("dark", "background")}
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
                {[400, 500, 600, 700, 800].filter(inRange).map((w) => (
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
        {choice("density", ["density"], theme.density, ["comfortable", "compact"])}
        {choice("motion", ["motion"], theme.motion, ["none", "subtle", "lively"])}
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
