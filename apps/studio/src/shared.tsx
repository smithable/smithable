// Parts both modes show: the app's preview and the change trace (ARCHITECTURE §9.7).

import type { SpecPlugin, Verification } from "@smithable/core";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, type ChangeDetail, type TraceEntry } from "./api";
import { type PartChange, summaryDiff } from "./builder/change-diff";
import { entryText, grouped, numbers, restores, summary as summaryOf } from "./history";
import { isPreviewMessage, previewFollowContext, previewTarget, setPreview } from "./preview";
import { ReportDialog } from "./Report";
import { receipt } from "./receipt";
import { Button, cx, Input, Panel } from "./ui";
import { useVerified, Verified } from "./Verified";

/** How long the note that the preview's records are samples stays before it closes by itself. */
const SAMPLES_NOTICE_MS = 15_000;

const PAGE_KEY = "smithable:preview-page";
/** The page the preview is on, e.g. "/customers/12". */
export const keptPage = () => {
  try {
    return sessionStorage.getItem(PAGE_KEY) ?? "/";
  } catch {
    return "/";
  }
};

type PreviewWidth = "desktop" | "tablet" | "phone";
const WIDTH_KEY = "smithable:preview-width";
/** A tablet's and a phone's width in CSS pixels, as the app's own breakpoints see them. */
const WIDTHS: Record<Exclude<PreviewWidth, "desktop">, number> = { tablet: 820, phone: 390 };
const WIDTH_LABELS: Record<PreviewWidth, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  phone: "Phone",
};
const WIDTH_TITLES: Record<PreviewWidth, string> = {
  desktop: "The app as wide as this pane",
  tablet: "The app as a tablet shows it (820 px)",
  phone: "The app as a phone shows it (390 px)",
};

/** Frames stay on the preview's origin and keep its mounted path on a proxy. */
function previewFrameSource(base: string, path: string) {
  try {
    const preview = new URL(base, window.location.origin);
    if (preview.protocol !== "https:" && preview.protocol !== "http:") return "about:blank";
    // Encode path text while keeping escapes which already came from a URL.
    const encoded = encodeURI(path.startsWith("/") ? path : `/${path}`).replace(
      /%25([0-9a-f]{2})/gi,
      "%$1",
    );
    return `${preview.origin}${preview.pathname.replace(/\/$/, "")}${encoded}`;
  } catch {
    return "about:blank";
  }
}

/** Matches a declared route, including its named path segments. */
function matchesRoute(path: string, route: string) {
  const target = path.split("/").filter(Boolean);
  const parts = route.split("/").filter(Boolean);
  return (
    parts.length === target.length &&
    parts.every((part, index) => part.startsWith("$") || part === target[index])
  );
}

export function Preview({
  url,
  version,
  updating,
  selecting,
  shiftSelecting,
  inCode,
  addressHost,
  onShowPage,
  highlight,
  pages = [],
  go,
  following,
  onFollowing,
}: {
  url: string;
  version: number;
  /** A change went through and the preview is about to reload with it. */
  updating?: boolean;
  /** Select mode: clicking in the preview selects a part of the spec instead of using the app. */
  selecting?: boolean;
  /** The Shift key is held in Studio around the preview. */
  shiftSelecting?: boolean;
  /** Code mode: a text clicked in select mode goes to its line in the content file instead of
   * being changed in place. */
  inCode?: boolean;
  addressHost: HTMLElement | null;
  onShowPage: () => void;
  /** What the last change touched, flashed once in the preview (motion.md 9a); `key` names the change. */
  highlight?: { key: string; concepts: string[] };
  /** The app's pages, each its address and its title: offered under the address as it is typed. */
  pages?: [string, string][];
  /** A page to open, as the address bar would (Follow's sign-in); `key` makes it again. */
  go?: { path: string; key: number };
  /** Whether the editors open the preview's page as it changes (No code's Behavior and Layout);
   * offered beside the address only with `onFollowing`. */
  following?: boolean;
  onFollowing?: (on: boolean) => void;
}) {
  // The preview's records are samples, and a published app starts empty: said until dismissed.
  const [samples, setSamples] = useState(() => {
    try {
      return localStorage.getItem("samplesNoticeDismissed") !== "1";
    } catch {
      return true;
    }
  });
  const dismissSamples = useCallback(() => {
    setSamples(false);
    try {
      localStorage.setItem("samplesNoticeDismissed", "1");
    } catch {}
  }, []);
  // Said once, it closes by itself after a while, as dismissed; a pointer resting on it holds it
  // (fact decisions.studio-notices: only errors and what needs an action stay until pressed).
  const [holdingSamples, setHoldingSamples] = useState(false);
  useEffect(() => {
    if (!samples || holdingSamples) return;
    const timer = setTimeout(dismissSamples, SAMPLES_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [samples, holdingSamples, dismissSamples]);
  // The page the preview is on, as it reports it: a reload after a change comes back to it, and
  // so does reloading Studio (kept for the browser tab's session, like the place in each mode).
  const current = useRef(keptPage());
  const [opened, setOpened] = useState(0);
  const [previewPath, setPreviewPath] = useState(current.current);
  const [draftAddress, setDraftAddress] = useState<string>();
  const typed = draftAddress ?? previewPath;
  const frame = useRef<HTMLIFrameElement>(null);
  // Ctrl+R with the pointer over the preview reloads the preview alone (Johan, 2026-10-10); with
  // the preview focused, its page's editor does the same.
  const over = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (over.current && (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        setAttempt((n) => n + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // The app's dev server may be starting, or restarting after a change, and a frame never
  // retries a page that failed to load: the frame is made once the server answers ("Starting…"
  // until then, retried with a short backoff), and after a few minutes a Retry button.
  const [attempt, setAttempt] = useState(0);
  // A new frame after every change, Go or Retry; the server's state is for one frame.
  const frameKey = `${version}-${opened}-${attempt}`;
  const [answer, setAnswer] = useState({
    key: "",
    server: "starting" as "starting" | "up" | "down",
  });
  const server = answer.key === frameKey ? answer.server : "starting";
  // The address a frame is made with, fixed for that frame: the app's own navigation inside it
  // updates the address bar (current), and a src that followed would load the page again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new frame (frameKey) takes the page shown now
  const src = useMemo(() => previewFrameSource(url, current.current), [frameKey, url]);
  // The last page that was up stays on screen while the next one starts (a change can restart
  // the app's server for seconds), instead of an empty panel.
  // It is the last frame whose page said it was ready: one that loaded an error page while the
  // server rebuilt never replaces it, so a change shows the old page dimmed, never a white one.
  const [shown, setShown] = useState<{ key: string; src: string; opened: number }>();
  const now = useRef({ frameKey, opened, url });
  now.current = { frameKey, opened, url };
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isPreviewMessage(e) || e.data.type !== "ready") return;
      if (e.source !== frame.current?.contentWindow) return;
      const { frameKey: key, opened: at, url: base } = now.current;
      setShown({ key, src: previewFrameSource(base, current.current), opened: at });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  // Only across a change to the app: after Go the page asked for comes, not the last one (whose
  // location messages would otherwise put the old address back).
  const stale = shown && shown.key !== frameKey && shown.opened === opened ? shown : undefined;
  useEffect(() => {
    let stopped = false;
    (async () => {
      const until = Date.now() + 180_000;
      for (let wait = 250; !stopped; wait = Math.min(wait * 2, 4000)) {
        if (await answers()) return stopped || setAnswer({ key: frameKey, server: "up" });
        if (Date.now() > until) return stopped || setAnswer({ key: frameKey, server: "down" });
        await new Promise((r) => setTimeout(r, wait));
      }
    })();
    return () => {
      stopped = true;
    };
  }, [frameKey]);
  // A page that loaded without the preview editor's "ready" (the server's error page, or one
  // that stopped while loading) is loaded again: a server that no longer answers is waited for.
  const ready = useRef(false);
  // Error pages in a row: a request that arrived while the server rebuilt after a change gets
  // a 500 page, which answers but has no editor; it is loaded again, a few times.
  const errors = useRef(0);
  // A page without its stylesheet is loaded again first: one asked for while the server was
  // still rebuilding the theme's CSS has it the second time (T1164: restarting at once took the
  // hosted preview away for seconds on every theme change). A second page without it starts the
  // preview again, once for each change: one still without it after that is the app's own (a
  // broken src/custom/styles.css).
  const restyled = useRef<{ version: number; tries: number }>(undefined);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isPreviewMessage(e) || e.data.type !== "unstyled") return;
      const tries = restyled.current?.version === version ? restyled.current.tries : 0;
      if (tries >= 2) return;
      restyled.current = { version, tries: tries + 1 };
      if (tries === 0) return setAttempt((n) => n + 1);
      void api.previewRestart("unstyled").then(() => setAttempt((n) => n + 1));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [version]);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (isPreviewMessage(e) && e.data.type === "ready") {
        ready.current = true;
        errors.current = 0;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  const loaded = () => {
    ready.current = false;
    setTimeout(async () => {
      if (ready.current) return;
      if (!(await answers()) || errors.current++ < 3) setAttempt((n) => n + 1);
    }, 8000);
  };
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isPreviewMessage(e) || e.data.type !== "navigated" || e.data.path === current.current)
        return;
      const path = e.data.path;
      current.current = path;
      // Follow the frame's location without replacing an address the user is editing.
      setPreviewPath(path);
      try {
        sessionStorage.setItem(PAGE_KEY, path);
      } catch {}
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  // Tell the page's editor about select mode now, and whenever the page (re)loads.
  useEffect(() => {
    const send = () =>
      frame.current?.contentWindow?.postMessage(
        {
          type: "smithable:select-mode",
          on: Boolean(selecting),
          shift: Boolean(shiftSelecting),
          code: Boolean(inCode),
          followContext: previewFollowContext(),
        },
        previewTarget(),
      );
    send();
    const onMessage = (e: MessageEvent) => {
      if (isPreviewMessage(e) && e.data.type === "ready") send();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [selecting, shiftSelecting, inCode]);
  // What the last change touched, flashed in the page (motion.md 9a): at once, for a change the
  // page shows without reloading (a text edited in place), and again to each page that says it
  // is ready until one answers that it has flashed it. A change may reload the page more than
  // once, the first time without the new content: marking it done when sent lost the flash.
  // After a minute it is no longer news.
  // The page may say it is ready before Studio hears of the change, so the newest one is kept.
  const flashed = useRef<string | undefined>(undefined);
  // What was flashed last, on the frame for tests to read: a flash is over in 1.6 s, this stays.
  const [flashedConcepts, setFlashedConcepts] = useState<string>();
  const latest = useRef(highlight);
  const since = useRef(0);
  useEffect(() => {
    latest.current = highlight;
    if (!highlight?.concepts.length) return;
    since.current = Date.now();
    frame.current?.contentWindow?.postMessage(
      { type: "smithable:highlight", key: highlight.key, concepts: highlight.concepts },
      previewTarget(),
    );
  }, [highlight]);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isPreviewMessage(e)) return;
      if (e.data.type === "flashed") {
        if (e.data.key) {
          flashed.current = e.data.key;
          if (latest.current?.key === e.data.key)
            setFlashedConcepts(latest.current.concepts.join(" "));
        }
        return;
      }
      const now = latest.current;
      if (e.data.type !== "ready" || !now?.concepts.length) return;
      if (flashed.current === now.key || Date.now() - since.current > 60_000) return;
      (e.source as Window | null)?.postMessage(
        { type: "smithable:highlight", key: now.key, concepts: now.concepts },
        previewTarget(),
      );
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  // The address's list of the app's pages: while the field has the focus, those whose address
  // or title has what is typed (all of them for an empty field or "/"), eight at most. Our own
  // list, not a datalist, which an iPhone does not show.
  const listId = useId();
  const [listing, setListing] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [addressError, setAddressError] = useState<string>();
  const address = useRef<HTMLFieldSetElement>(null);
  const addressButton = useRef<HTMLButtonElement>(null);
  const addressInput = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(-1);
  const wanted = typed.replace(/^\//, "").toLowerCase();
  const matches = pages
    .filter(
      ([route, title]) =>
        !route.includes("$") && `${route} ${title}`.toLowerCase().includes(wanted),
    )
    .slice(0, 8);
  const open = (path: string) => {
    current.current = path.startsWith("/") ? path : `/${path}`;
    // A Go report repeats this same path, so the navigation listener has nothing to update.
    try {
      sessionStorage.setItem(PAGE_KEY, current.current);
    } catch {}
    setPreviewPath(current.current);
    setDraftAddress(undefined);
    setListing(false);
    setActive(-1);
    setOpened((n) => n + 1);
  };
  const closeAddress = useCallback((returnFocus = false) => {
    setAddressOpen(false);
    setAddressError(undefined);
    setListing(false);
    setActive(-1);
    setDraftAddress(undefined);
    if (returnFocus) addressButton.current?.focus();
  }, []);
  useEffect(() => {
    if (!addressOpen) return;
    addressInput.current?.focus();
    addressInput.current?.select();
    const outside = (event: PointerEvent) => {
      if (!address.current?.contains(event.target as Node)) closeAddress();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [addressOpen, closeAddress]);
  const openAddress = (path: string) => {
    const input = path.trim();
    let target: URL;
    try {
      if (/^(?:\/\/|[a-z][a-z0-9+.-]*:)|\\/i.test(input))
        throw new Error("Only an app path is allowed.");
      target = new URL(input.startsWith("/") ? input : `/${input}`, window.location.origin);
    } catch {
      setAddressError("Enter a local page or record address.");
      return;
    }
    const bare = target.pathname.replace(/\/$/, "") || "/";
    if (
      pages.length &&
      bare !== "/" &&
      bare !== "/sign-in" &&
      !pages.some(
        ([route]) =>
          matchesRoute(bare, route) ||
          (route !== "/" && !route.includes("$") && bare.startsWith(`${route}/`)),
      ) &&
      !/^\/(?:new|\d+(?:\/edit)?)$/.test(bare)
    ) {
      setAddressError("That page is not in this app.");
      return;
    }
    closeAddress(true);
    onShowPage();
    open(target.pathname + target.search + target.hash);
  };
  const path = previewPath.split(/[?#]/)[0] || "/";
  const pageName =
    [...pages]
      .filter(
        ([route]) => matchesRoute(path, route) || (route !== "/" && path.startsWith(`${route}/`)),
      )
      .sort(([a], [b]) => b.length - a.length)[0]?.[1] ?? (path === "/" ? "Home" : path);
  // Once each: a preview made again later (another layout) does not follow anyone again.
  const went = useRef(go?.key);
  // biome-ignore lint/correctness/useExhaustiveDependencies: asked for by go; open is the same each time in what it does
  useEffect(() => {
    if (!go || go.key === went.current) return;
    went.current = go.key;
    open(go.path);
  }, [go]);
  // Updating until the new frame is up: the last one stays meanwhile, dimmed, then is replaced.
  const reloading = updating || Boolean(stale);
  // How wide the app is shown (T216 a): the pane's width as a rule, or a tablet's or a phone's, so
  // a narrow pane beside Smith is not taken for the app; kept for this browser.
  const [width, setWidth] = useState<PreviewWidth>(() => {
    try {
      const kept = localStorage.getItem(WIDTH_KEY);
      return kept === "tablet" || kept === "phone" ? kept : "desktop";
    } catch {
      return "desktop";
    }
  });
  const showAt = (next: PreviewWidth) => {
    setWidth(next);
    try {
      localStorage.setItem(WIDTH_KEY, next);
    } catch {}
  };
  return (
    <Panel label="Preview" busy={reloading} className="h-full">
      <h2 className="sr-only">Preview</h2>
      {addressHost &&
        createPortal(
          <fieldset
            ref={address}
            aria-label="Preview page"
            className="relative flex min-w-0 items-center gap-1"
            onKeyDown={(event) => {
              if (!addressOpen || event.key !== "Escape") return;
              event.preventDefault();
              event.stopPropagation();
              closeAddress(true);
            }}
          >
            <button
              ref={addressButton}
              type="button"
              data-preview-page
              data-preview-current={previewPath}
              aria-expanded={addressOpen}
              aria-controls={`${listId}-address`}
              title="Open preview address"
              onClick={() => (addressOpen ? closeAddress() : setAddressOpen(true))}
              className="flex min-w-0 max-w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm font-semibold hover:bg-subtle"
            >
              <span className="truncate">{pageName}</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="size-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="m5 6 3 3 3-3" />
              </svg>
            </button>
            {onFollowing && (
              <button
                type="button"
                aria-pressed={Boolean(following)}
                aria-label="Link the editors to the preview"
                title={
                  following
                    ? "Linked: the editors open the page the preview shows. Click to unlink."
                    : "Not linked: the editors stay where they are. Click to open the page the preview shows."
                }
                onClick={() => onFollowing(!following)}
                className={cx(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line",
                  following ? "bg-accent-soft" : "text-quiet hover:bg-subtle",
                )}
              >
                <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none">
                  <g stroke="currentColor" strokeWidth="1.5" transform="rotate(-45 8 8)">
                    <rect x="1.5" y="5.5" width="7" height="5" rx="2.5" />
                    <rect x="7.5" y="5.5" width="7" height="5" rx="2.5" />
                  </g>
                </svg>
              </button>
            )}
            {reloading && (
              <span
                role="status"
                className="sr-only shrink-0 text-xs whitespace-nowrap text-quiet sm:not-sr-only"
              >
                Updating…
              </span>
            )}
            <div
              id={`${listId}-address`}
              className={cx(
                "absolute top-full left-0 z-[65] mt-2 w-[min(88vw,24rem)] space-y-2 rounded-md border border-line bg-panel p-2 shadow-lg",
                !addressOpen && "hidden",
              )}
            >
              {/* No form: a lone text field in a form that submits is what password managers take for
              an identity or address form (T969); Enter opens the page from the key handler. */}
              <div className="flex flex-col gap-1">
                <Input
                  ref={addressInput}
                  type="text"
                  name="preview-path"
                  inputMode="url"
                  // A phone's keyboard shows Go for Enter, the Go button's place.
                  enterKeyHint="go"
                  spellCheck={false}
                  data-1p-ignore=""
                  data-lpignore="true"
                  data-form-type="other"
                  aria-label="Preview address"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={listing && matches.length > 0}
                  aria-controls={listId}
                  aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                  autoComplete="off"
                  value={typed}
                  onChange={(e) => {
                    setDraftAddress(e.target.value);
                    setAddressError(undefined);
                    setListing(true);
                    setActive(-1);
                  }}
                  onFocus={() => setListing(true)}
                  onBlur={(event) => {
                    if (!address.current?.contains(event.relatedTarget)) setListing(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      setListing(true);
                      const step = e.key === "ArrowDown" ? 1 : -1;
                      setActive((at) => (at + step + matches.length) % Math.max(matches.length, 1));
                      return;
                    }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const chosen = matches[active];
                      openAddress(listing && chosen ? chosen[0] : typed);
                    }
                  }}
                  className="h-8 min-w-0 font-mono text-xs"
                />
                {listing && matches.length > 0 && (
                  <div
                    id={listId}
                    role="listbox"
                    aria-label="Pages"
                    className="max-h-[40dvh] overflow-auto rounded-md border border-line bg-panel py-1"
                  >
                    {matches.map(([route, title], index) => (
                      // biome-ignore lint/a11y/useKeyWithClickEvents: the keys are the address field's (a combobox)
                      <div
                        key={route}
                        id={`${listId}-${index}`}
                        role="option"
                        aria-selected={index === active}
                        tabIndex={-1}
                        // Picked before the field loses the focus (and the list with it).
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => openAddress(route)}
                        className={cx(
                          "flex cursor-pointer items-baseline gap-2 px-2 py-1 text-xs",
                          index === active ? "bg-accent-soft" : "hover:bg-subtle",
                        )}
                      >
                        <span className="font-mono">{route}</span>
                        <span className="truncate text-quiet">{title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {addressError && (
                <p role="alert" className="text-xs text-red-700">
                  {addressError}
                </p>
              )}
              <fieldset className="flex items-center rounded-md border border-line">
                <legend className="sr-only">Preview width</legend>
                {(["desktop", "tablet", "phone"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    aria-pressed={width === w}
                    title={WIDTH_TITLES[w]}
                    onClick={() => showAt(w)}
                    className={cx(
                      "h-7 px-2 text-xs first:rounded-l-md last:rounded-r-md",
                      width === w ? "bg-accent-soft font-medium" : "hover:bg-subtle",
                    )}
                  >
                    {WIDTH_LABELS[w]}
                  </button>
                ))}
              </fieldset>
            </div>
          </fieldset>,
          addressHost,
        )}
      <div data-guide="preview" className="flex h-full flex-col">
        {samples && (
          <div
            role="note"
            onPointerEnter={() => setHoldingSamples(true)}
            onPointerLeave={() => setHoldingSamples(false)}
            className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          >
            <p className="flex-1">
              The records you see are samples for trying the app. Your published app starts empty:
              what you add or change here is not published.
            </p>
            <Button variant="ghost" className="h-6" onClick={dismissSamples}>
              Dismiss
            </Button>
          </div>
        )}
        <div className="min-h-0 flex-1">
          {/* Remounted after every change, so server code and data are fresh; until the new one
              is up, the last one stays, dimmed and inert. */}
          {server === "down" || (server !== "up" && !stale) ? (
            <div role="status" className="grid h-full place-items-center p-6 text-sm text-quiet">
              {server === "starting" ? (
                <p>Starting…</p>
              ) : (
                <Stuck key={frameKey} retry={() => setAttempt((n) => n + 1)} />
              )}
            </div>
          ) : (
            <div
              data-preview-width={width}
              className="relative mx-auto h-full"
              style={width === "desktop" ? undefined : { maxWidth: WIDTHS[width] }}
              onPointerEnter={() => {
                over.current = true;
              }}
              onPointerLeave={() => {
                over.current = false;
              }}
            >
              {/* The last ready page, kept (same key, so not loaded again) until the new one is. */}
              {stale && (
                <iframe
                  key={stale.key}
                  title="Previous preview"
                  aria-hidden
                  tabIndex={-1}
                  src={stale.src}
                  // Dimmed only when the new page takes a while: a change the app takes in
                  // without restarting (an undo) reloads in about a second, with nothing to see.
                  className="pointer-events-none absolute inset-0 h-full w-full border-0 opacity-60 transition-opacity delay-500 duration-200"
                />
              )}
              {server === "up" && (
                <iframe
                  ref={(el) => {
                    frame.current = el;
                    // The one window whose messages count, recorded as the frame is (re)made.
                    setPreview(el?.contentWindow ?? null, url);
                  }}
                  key={frameKey}
                  title="App preview"
                  // The kit's copy buttons (keys, invitation links) write to the clipboard.
                  allow="clipboard-write"
                  data-flashed={flashedConcepts}
                  src={src}
                  onLoad={loaded}
                  className={cx("absolute inset-0 h-full w-full border-0", stale && "opacity-0")}
                />
              )}
              {stale && (
                <p
                  role="status"
                  className="appear-late absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-fg/80 px-3 py-1 text-xs text-panel"
                >
                  Updating the preview…
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

export function Trace({
  entries,
  words,
  plugins = [],
  onUndo,
  onMilestone,
  onSee,
  openAt,
}: {
  entries: TraceEntry[];
  /** A change to open and show (Smith's Show all or one of his lines, ask-flows.md §8). */
  openAt?: { id: string; at: number };
  /** Builder's wording of an operation: given, an opened change says what changed in the summary's words; not, it shows the files' patch. */
  words?: (op: string, args: Record<string, unknown>) => string | undefined;
  plugins?: SpecPlugin[];
  /** Undoes a change by its id (studio-v3.md §3): the X on each entry still in place. */
  onUndo?: (ids: string[]) => void;
  /** Names a change as a milestone, or (an empty name) unnames it (A 232). */
  onMilestone?: (id: string, name: string) => Promise<void>;
  /** Opens the app as it was at a change, as a copy (old-version-preview.md §4). */
  onSee?: (id: string) => void;
}) {
  const [open, setOpen] = useState<string>();
  const [onlyMilestones, setOnlyMilestones] = useState(false);
  const text = (e: TraceEntry) => entryText(e, words);
  // A request's changes in one line from what they did, oldest first (A 232); the request
  // itself is said when the entry is opened.
  const summary = (group: TraceEntry[]) => summaryOf(group, words);
  // Opened from Smith at a line: that line's group open, and in view.
  const list = useRef<HTMLOListElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when Smith asks again
  useEffect(() => {
    if (!openAt) return;
    const group = grouped(entries).find((g) => g.some((e) => e.id === openAt.id));
    const first = group?.[0]?.id;
    if (!first) return;
    setOnlyMilestones(false);
    setOpen(first);
    requestAnimationFrame(() =>
      list.current?.querySelector(`[data-change="${first}"]`)?.scrollIntoView({ block: "start" }),
    );
  }, [openAt?.at]);
  // What each line's newest change verified (change-verified.md §5.2), the latest thirty.
  const [verified, setVerified] = useVerified(
    grouped(entries)
      .slice(0, 30)
      .flatMap((g) => (g[0] ? [g[0].id] : [])),
  );
  if (entries.length === 0) return <p className="p-3 text-sm text-quiet">No changes yet.</p>;
  const named = entries.filter((e) => e.milestone && !e.undone);
  // With no milestone left (the last one unnamed), the list shows every change again.
  const filtering = onlyMilestones && named.length > 0;
  const groups = grouped(entries).filter(
    (group) => !filtering || group.some((g) => g.milestone && !g.undone),
  );
  return (
    <>
      {named.length > 0 && (
        <label className="flex items-center gap-2 px-3 py-1 text-xs text-muted">
          <input
            type="checkbox"
            checked={filtering}
            onChange={(e) => setOnlyMilestones(e.target.checked)}
          />
          Only milestones ({named.length})
        </label>
      )}
      <ol ref={list} aria-label="Change trace" className="divide-y divide-line">
        {groups.map((group) => {
          const [e] = group as [TraceEntry, ...TraceEntry[]];
          const opened = open === e.id;
          // The change in the group that carries the milestone, or the newest to be named.
          const tagged = group.find((g) => g.milestone && !g.undone) ?? e;
          const milestone = tagged.milestone;
          return (
            <li
              key={e.id}
              data-change={e.id}
              className={cx("relative px-3 py-2", e.undone && "opacity-50")}
            >
              {onUndo && !e.undone && !e.isUndo && (
                // A request's changes are undone together, the newest first.
                <button
                  type="button"
                  aria-label={`Undo: ${group.length > 1 ? summary(group) : text(e)}`}
                  title="Undo this change"
                  onClick={() => onUndo(group.map((g) => g.id))}
                  className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded text-quiet hover:bg-subtle hover:text-red-700"
                >
                  ×
                </button>
              )}
              <button
                type="button"
                aria-expanded={opened}
                onClick={() => setOpen(opened ? undefined : e.id)}
                className="block w-full pr-6 text-left"
              >
                {milestone && (
                  <span data-milestone className="block text-xs font-semibold text-accent">
                    Milestone: {milestone}
                    {tagged.number ? `, #${tagged.number}` : ""}
                  </span>
                )}
                <span className={cx("block text-sm", e.undone && "line-through")}>
                  {numbers(group) && (
                    // The space is a real one, so the line reads "#12 Added …" aloud and to tests.
                    <span data-change-number className="text-quiet">
                      {`${numbers(group)} `}
                    </span>
                  )}
                  {group.length > 1 ? summary(group) : text(e)}
                </span>
                {group.some((g) => g.undoneBy || g.undoes) && (
                  <span className="block text-xs text-quiet">
                    {e.undoes
                      ? `Undid #${e.undoes}`
                      : `Undone by ${[...new Set(group.flatMap((g) => (g.undoneBy ? [`#${g.undoneBy}`] : [])))].join(", ")}`}
                  </span>
                )}
                <span className="mt-0.5 block text-xs text-quiet">
                  {/* Both say who made it and what it cost (T721, Johan 2026-11-12); Studio adds how
                    long it took and the files. */}
                  <span data-receipt>{receipt(group)}</span> ·{" "}
                  {!words ? (
                    <>{e.ms !== undefined ? `${(e.ms / 1000).toFixed(1)} s · ` : ""}</>
                  ) : null}
                  {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {!words && e.files.length > 0 && ` · ${e.files.join(", ")}`}
                </span>
              </button>
              {verified[e.id] && (
                <div className="pr-6">
                  <Verified
                    verification={verified[e.id] as Verification}
                    newest={e.id === entries[0]?.id}
                    onTested={(v) => setVerified(e.id, v)}
                  />
                </div>
              )}
              {opened && (
                <div className="mt-2 space-y-2">
                  {e.request && <p className="text-xs text-muted">You asked: {e.request}</p>}
                  {!e.isUndo && !e.undone && (
                    <p data-undo-restores className="text-xs text-muted">
                      {restores(e, entries)}
                    </p>
                  )}
                  {onSee && e.id !== entries[0]?.id && (
                    <Button variant="ghost" className="h-7" onClick={() => onSee(e.id)}>
                      See this version
                    </Button>
                  )}
                  {onMilestone && !e.isUndo && !e.undone && (
                    <MilestoneName
                      key={milestone ?? ""}
                      name={milestone ?? ""}
                      onName={(name) => onMilestone(tagged.id, name)}
                    />
                  )}
                  {group.length > 1 && (
                    <ul className="list-disc pl-5 text-xs text-muted">
                      {[...group].reverse().map((g) => (
                        <li key={g.id}>{text(g)}</li>
                      ))}
                    </ul>
                  )}
                  {words ? (
                    <>
                      <PlainChange newest={e} oldest={group.at(-1) ?? e} plugins={plugins} />
                      <details>
                        <summary className="cursor-pointer text-xs text-accent">
                          Show the files
                        </summary>
                        <FilesChange entry={e} />
                      </details>
                    </>
                  ) : (
                    <FilesChange entry={e} />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** Names the point a change left as a milestone, renames it or takes the name away (A 232). */
function MilestoneName({
  name,
  onName,
}: {
  name: string;
  onName: (name: string) => Promise<void>;
}) {
  const [text, setText] = useState(name);
  const [busy, setBusy] = useState(false);
  const save = async (next: string) => {
    setBusy(true);
    await onName(next);
    setBusy(false);
  };
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void save(text);
      }}
    >
      <Input
        aria-label="Milestone name"
        placeholder="Name this point, e.g. First bookings"
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="h-7 flex-1 text-xs"
      />
      <Button type="submit" disabled={busy || !text.trim() || text.trim() === name}>
        {name ? "Rename" : "Name it"}
      </Button>
      {name && (
        <Button type="button" disabled={busy} onClick={() => void save("")}>
          Not a milestone
        </Button>
      )}
    </form>
  );
}

/** A change in the summary's words: the sentences that went struck through, those that came. */
function PlainChange({
  newest,
  oldest,
  plugins,
}: {
  newest: TraceEntry;
  oldest: TraceEntry;
  plugins: SpecPlugin[];
}) {
  const [parts, setParts] = useState<PartChange[]>();
  useEffect(() => {
    let current = true;
    void Promise.all([api.change(oldest.id), api.change(newest.id)]).then(
      ([first, last]) => current && setParts(summaryDiff(first.before, last.after, plugins)),
      () => current && setParts([]),
    );
    return () => {
      current = false;
    };
  }, [newest.id, oldest.id, plugins]);
  if (!parts) return <p className="text-xs text-quiet">Reading the change…</p>;
  if (!parts.length)
    return (
      <p className="text-xs text-quiet">
        Nothing the summary says changed (the look, a text, or code).
      </p>
    );
  return (
    <section aria-label="What changed" className="space-y-2 text-sm">
      {parts.map((p) => (
        <div key={p.concept}>
          <p className="text-xs font-semibold text-muted">{p.title}</p>
          {p.removed.map((l) => (
            <p key={`-${l}`} className="text-quiet line-through">
              {l.replace(/^[-•*]\s+/, "")}
            </p>
          ))}
          {p.added.map((l) => (
            <p key={`+${l}`}>{l.replace(/^[-•*]\s+/, "")}</p>
          ))}
        </div>
      ))}
    </section>
  );
}

/** A change's patch of the person's files, and the whole patch on request. */
function FilesChange({ entry }: { entry: TraceEntry }) {
  const [all, setAll] = useState(false);
  const [detail, setDetail] = useState<ChangeDetail>();
  useEffect(() => {
    let current = true;
    void api.change(entry.id, all).then(
      (d) => current && setDetail(d),
      () => current && setDetail({ patch: "", generated: 0, before: {}, after: {} }),
    );
    return () => {
      current = false;
    };
  }, [entry.id, all]);
  if (!detail) return <p className="text-xs text-quiet">Reading the change…</p>;
  return (
    <div className="space-y-1">
      <section aria-label="The change's patch">
        <pre className="max-h-96 overflow-auto rounded bg-subtle p-2 text-xs">
          {detail.patch || "No file a person edits changed."}
        </pre>
      </section>
      {!all && detail.generated > 0 && (
        <button type="button" className="text-xs text-accent" onClick={() => setAll(true)}>
          and {detail.generated} generated {detail.generated === 1 ? "file" : "files"}
        </button>
      )}
    </div>
  );
}

/**
 * Whether the preview's server answers, as Studio's own server finds:
 * a browser cannot see the status of another origin, so a hosting service's "Starting…" page
 * would pass for the app.
 */
async function answers(): Promise<boolean> {
  return api.previewAnswers().then(
    (r) => r.ok,
    () => false,
  );
}

/**
 * The preview did not answer within the wait: what Studio knows (its last log lines), starting
 * it again, and a report of it, offered as for a change that failed.
 */
function Stuck({ retry }: { retry: () => void }) {
  const [stuck, setStuck] = useState<{ log: string[]; report?: "offer" }>();
  const [reporting, setReporting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  useEffect(() => {
    api.previewStuck().then(setStuck, () => setStuck({ log: [] }));
  }, []);
  return (
    <div className="w-full max-w-xl space-y-3 text-center">
      <p>The preview is not answering.</p>
      {stuck && stuck.log.length > 0 && (
        <pre
          title="The preview's last lines"
          className="max-h-48 overflow-auto rounded-md bg-subtle p-2 text-left font-mono text-xs text-fg-soft"
        >
          {stuck.log.join("\n")}
        </pre>
      )}
      <div className="flex justify-center gap-2">
        <Button
          disabled={restarting}
          onClick={async () => {
            setRestarting(true);
            await api.previewRestart().catch(() => undefined);
            retry();
          }}
        >
          Start it again
        </Button>
        {stuck?.report === "offer" && (
          <Button variant="ghost" onClick={() => setReporting(true)}>
            Report this
          </Button>
        )}
      </div>
      {reporting && <ReportDialog onClose={() => setReporting(false)} />}
    </div>
  );
}
