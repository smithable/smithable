// The preview editor (ARCHITECTURE §10.3): a Vite plugin that `smithable studio` adds to the
// app's own Vite config for the preview only. It injects a small runtime into the page that,
// in select mode, outlines the part of the spec under the pointer, reports a click to Studio,
// and lets table columns be dragged. The app's own builds never include it.
import { createHash, timingSafeEqual } from "node:crypto";

/** The runtime, run in the preview page inside Studio's iframe. */
export const RUNTIME = `
if (typeof window !== "undefined" && window.parent !== window) {
  let selecting = false;
  // In Studio's Code mode a text is not changed in place: Studio opens its line instead.
  let code = false;
  let hovered = null;
  let dragged = null;
  const style = document.createElement("style");
  style.textContent =
    "[data-sm-hover]{outline:2px dashed #3b5bdb!important;outline-offset:2px;cursor:pointer!important}" +
    "[data-sm-selected]{outline:2px solid #3b5bdb!important;outline-offset:2px}" +
    "[data-sm-part=column][draggable=true]{cursor:grab!important}" +
    "html[data-sm-selecting] [data-sm-concept]{cursor:pointer!important}" +
    "html[data-sm-selecting] [data-sm-text]:hover{outline:2px dashed #e8590c!important;outline-offset:2px;cursor:text!important}" +
    // Being edited: an outline only, so the text keeps its own colors (a hero's white title on a pale box could not be read).
    "[data-sm-text][contenteditable=true]{outline:2px solid #e8590c!important;outline-offset:2px}" +
    // What the last change touched, outlined briefly and fading (motion.md 9a); still, without motion.
    "@keyframes sm-flash{from{outline-color:#e8590c}to{outline-color:transparent}}" +
    "[data-sm-flash]{outline:3px solid #e8590c!important;outline-offset:3px;animation:sm-flash 1.6s ease-out forwards}" +
    "@media (prefers-reduced-motion:reduce){[data-sm-flash]{animation:none}}";
  document.head.append(style);
  // Studio's origin, learned from its first message; until then only "ready" and "errored"
  // (which carry nothing of the app) go out, to any origin.
  let studio = null;
  const post = (message) => {
    const target = studio ?? (message.type === "ready" || message.type === "errored" ? "*" : null);
    if (target) window.parent.postMessage({ source: "smithable-preview", ...message }, target);
  };
  const markedAt = (element) => (element instanceof Element ? element.closest("[data-sm-concept]") : null);
  const clear = (attribute) => document.querySelectorAll("[" + attribute + "]").forEach((e) => e.removeAttribute(attribute));
  const fieldOf = (element) => element.dataset.smConcept.split(".")[1];

  // What a change touched: its field, table or form, or text, flashed once. What the page does
  // not show yet (a renamed field, until the update reaches the page) flashes when it appears.
  const flashing = new WeakMap();
  const flash = (element) => {
    clearTimeout(flashing.get(element));
    element.setAttribute("data-sm-flash", "");
    flashing.set(element, setTimeout(() => element.removeAttribute("data-sm-flash"), 1600));
  };
  let watching = null;
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.data?.type !== "smithable:highlight") return;
    studio = event.origin;
    // Studio hears when the page has flashed (with the key it sent), so a change is flashed
    // once however often the page reloads for it, and never lost to a reload without it.
    const key = event.data.key ?? null;
    const done = (elements) => {
      elements.forEach(flash);
      post({ type: "flashed", key });
    };
    const selector = (event.data.concepts ?? [])
      .map((concept) =>
        concept.startsWith("text:")
          ? '[data-sm-text="' + CSS.escape(concept.slice(5)) + '"]'
          : '[data-sm-concept="' + CSS.escape(concept) + '"]',
      )
      .join(",");
    if (!selector) return;
    watching?.disconnect();
    const found = document.querySelectorAll(selector);
    if (found.length) return done(found);
    const observer = new MutationObserver(() => {
      const now = document.querySelectorAll(selector);
      if (!now.length) return;
      observer.disconnect();
      done(now);
    });
    watching = observer;
    // A renamed field may keep its element and change only its marker.
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributeFilter: ["data-sm-concept", "data-sm-text"],
    });
    // A page that never shows it (the field is on another page) stops watching after a minute;
    // a regeneration under load can take longer than a few seconds to reach the page.
    setTimeout(() => observer.disconnect(), 60000);
  });

  // A theme tried on without a regeneration (docs/design/theme-lab.md §3): the theme lab or
  // Studio sends the CSS themeCss writes, and it replaces the app's own until the page reloads.
  // Only from the page this preview is in, and only from this machine. The fonts' bare imports
  // become the paths Vite serves them at (every app has all seven).
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.data?.type !== "smithable:theme-css") return;
    if (!/^https?:\\/\\/(localhost|127\\.0\\.0\\.1|\\[::1\\])(:\\d+)?$/.test(event.origin)) return;
    if (typeof event.data.css !== "string") return;
    let sheet = document.getElementById("sm-theme");
    if (!sheet) {
      sheet = document.createElement("style");
      sheet.id = "sm-theme";
    }
    sheet.textContent = event.data.css.replace(
      /@import "(@fontsource-variable\\/[a-z0-9-]+)";/g,
      '@import "/node_modules/$1/index.css";',
    );
    // Last in the head, so its variables win over the app's theme.css.
    document.head.append(sheet);
    // A frame shown in one mode (the theme lab's light and dark frames): every rule for the dark
    // color scheme then always applies, or never, whatever the visitor's own setting.
    // A rule that pairs the scheme with another condition (a width) loses that condition: the
    // kit has none.
    if (event.data.mode === "light" || event.data.mode === "dark") {
      scheme = event.data.mode;
      applyScheme();
    }
  });
  let scheme = "";
  const applyScheme = () => {
    const walk = (rules) => {
      for (const rule of rules) {
        if (rule.media) {
          if (rule.smScheme === undefined && rule.media.mediaText.includes("prefers-color-scheme: dark"))
            rule.smScheme = rule.media.mediaText;
          if (rule.smScheme !== undefined)
            rule.media.mediaText = scheme === "dark" ? "all" : "not all";
        }
        if (rule.cssRules) walk(rule.cssRules);
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        walk(sheet.cssRules);
      } catch {}
    }
  };
  // The theme lab signs itself in through the app's development sign-in (a button for each
  // role, there only in development): asked from the page this preview is in on this machine,
  // the sign-in page clicks the role's button once it is ready.
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.data?.type !== "smithable:dev-sign-in") return;
    if (!/^https?:\\/\\/(localhost|127\\.0\\.0\\.1|\\[::1\\])(:\\d+)?$/.test(event.origin)) return;
    const started = Date.now();
    const tryClick = () => {
      const buttons = [...document.querySelectorAll("[data-dev-role]")];
      const button =
        buttons.find((b) => b.dataset.devRole === event.data.role) ?? buttons[0];
      if (document.body.dataset.hydrated === "true" && button) button.click();
      else if (Date.now() - started < 20000) setTimeout(tryClick, 200);
    };
    tryClick();
  });
  // The theme lab shows a theme's motion: the page scrolls slowly to its end and back, so what
  // moves as it comes into view moves (same parent-and-machine rule).
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.data?.type !== "smithable:motion-tour") return;
    if (!/^https?:\\/\\/(localhost|127\\.0\\.0\\.1|\\[::1\\])(:\\d+)?$/.test(event.origin)) return;
    const end = document.documentElement.scrollHeight - window.innerHeight;
    const started = Date.now();
    const step = () => {
      const done = Math.min((Date.now() - started) / 5000, 1);
      window.scrollTo(0, end * done);
      if (done < 1) setTimeout(step, 16);
      else setTimeout(() => window.scrollTo(0, 0), 1500);
    };
    step();
  });
  // Sheets the page adds later (a route's own styles) follow the same mode.
  new MutationObserver(() => scheme && applyScheme()).observe(document.head, { childList: true });

  window.addEventListener("message", (event) => {
    // Only the page this preview is in: Studio.
    if (event.source !== window.parent || event.data?.type !== "smithable:select-mode") return;
    studio = event.origin;
    report();
    selecting = Boolean(event.data.on);
    code = Boolean(event.data.code);
    // Visible to people (a cursor) and to tests: the page is in select mode.
    document.documentElement.toggleAttribute("data-sm-selecting", selecting);
    clear("data-sm-hover");
    if (!selecting) clear("data-sm-selected");
    // Out of select mode the attribute goes, not false: the page may not have hydrated yet.
    document
      .querySelectorAll("[data-sm-part=column]")
      .forEach((th) => (selecting ? (th.draggable = true) : th.removeAttribute("draggable")));
  });
  document.addEventListener("mouseover", (event) => {
    if (!selecting) return;
    hovered?.removeAttribute("data-sm-hover");
    hovered = markedAt(event.target);
    hovered?.setAttribute("data-sm-hover", "");
    if (hovered?.dataset.smPart === "column") hovered.draggable = true;
  }, true);
  // A text marked with its place in smithable.content.yml is changed in place: Enter or
  // leaving it saves, Escape cancels.
  document.addEventListener("click", (event) => {
    if (!selecting) return;
    const text = event.target instanceof Element ? event.target.closest("[data-sm-text]") : null;
    if (!text || text.isContentEditable) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (code) {
      clear("data-sm-selected");
      text.setAttribute("data-sm-selected", "");
      post({ type: "select", concept: "text:" + text.dataset.smText, part: null, page: null, columns: null });
      return;
    }
    const before = text.textContent;
    text.contentEditable = "true";
    text.focus();
    document.getSelection().selectAllChildren(text);
    const done = (save) => {
      text.contentEditable = "false";
      text.removeEventListener("keydown", keys);
      text.removeEventListener("blur", blur);
      const after = text.textContent.trim();
      if (save && after && after !== before.trim()) post({ type: "text", path: text.dataset.smText, text: after });
      else text.textContent = before;
    };
    const keys = (e) => {
      if (e.key === "Enter") { e.preventDefault(); done(true); }
      if (e.key === "Escape") done(false);
    };
    const blur = () => done(true);
    text.addEventListener("keydown", keys);
    text.addEventListener("blur", blur);
  }, true);
  document.addEventListener("click", (event) => {
    if (!selecting) return;
    const marked = markedAt(event.target);
    event.preventDefault();
    event.stopPropagation();
    if (!marked) return;
    clear("data-sm-selected");
    marked.setAttribute("data-sm-selected", "");
    // A column comes with its table's columns, so Studio can hide it or change their order.
    const columns = marked.dataset.smPart === "column"
      ? [...marked.closest("tr").querySelectorAll("[data-sm-part=column]")].map(fieldOf)
      : null;
    post({ type: "select", concept: marked.dataset.smConcept, part: marked.dataset.smPart ?? null, page: marked.dataset.smPage ?? null, columns });
  }, true);
  // Dropping a column header on another moves it there.
  document.addEventListener("dragstart", (event) => {
    const marked = markedAt(event.target);
    if (selecting && marked?.dataset.smPart === "column") dragged = marked;
  });
  document.addEventListener("dragover", (event) => {
    if (dragged && markedAt(event.target)?.dataset.smPart === "column") event.preventDefault();
  });
  document.addEventListener("drop", (event) => {
    const target = markedAt(event.target);
    if (!dragged || target?.dataset.smPart !== "column" || target === dragged) return;
    event.preventDefault();
    const headers = [...target.closest("tr").querySelectorAll("[data-sm-part=column]")];
    const order = headers.filter((h) => h !== dragged);
    order.splice(order.indexOf(target) + (headers.indexOf(dragged) < headers.indexOf(target) ? 1 : 0), 0, dragged);
    post({ type: "columns", page: target.dataset.smPage, columns: order.map(fieldOf) });
    dragged = null;
  });
  // Ctrl+Z (Cmd+Z) outside a text field undoes the last change, as it does in Studio.
  document.addEventListener("keydown", (event) => {
    const t = event.target;
    const typing = t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z" && !typing) {
      event.preventDefault();
      post({ type: "undo" });
    }
    // Ctrl+R (Cmd+R) in the preview reloads the preview alone, not Studio around it.
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "r") {
      event.preventDefault();
      location.reload();
    }
  });
  // The place on a page survives Studio loading it again after a change (studio-v2 §2): its
  // scroll, kept with its address, is put back once the page is hydrated and long enough.
  const PLACE = "smithable:place";
  const here = () => location.pathname + location.search;
  let saving;
  window.addEventListener(
    "scroll",
    () => {
      clearTimeout(saving);
      saving = setTimeout(() => {
        try {
          sessionStorage.setItem(PLACE, JSON.stringify({ path: here(), y: window.scrollY }));
        } catch {}
      }, 150);
    },
    { passive: true },
  );
  try {
    const kept = JSON.parse(sessionStorage.getItem(PLACE) ?? "null");
    if (kept?.y > 0 && kept.path === here()) {
      const until = Date.now() + 5000;
      const restore = () => {
        const fits = document.documentElement.scrollHeight - window.innerHeight >= kept.y;
        if ((document.body.dataset.hydrated === "true" && fits) || Date.now() > until)
          window.scrollTo(0, kept.y);
        else setTimeout(restore, 100);
      };
      restore();
    }
  } catch {}
  // The page the preview is on, for Studio's address bar: after every navigation, including
  // the app's own (the router uses the History API) and Back.
  const report = () => post({ type: "navigated", path: location.pathname + location.search });
  for (const name of ["pushState", "replaceState"]) {
    const original = history[name];
    history[name] = function (...args) {
      const result = original.apply(this, args);
      report();
      return result;
    };
  }
  window.addEventListener("popstate", report);
  // The owner sees the preview signed in as an administrator: whenever it shows the sign-in page,
  // once its buttons work, the development "Sign in as admin" is pressed, also after a session
  // was lost (the server started again, a checkpoint's database put back). Only after the owner
  // pressed Sign out in it does the sign-in page stay, to try another role, for the browser session.
  const SIGNED_OUT = "smithable:signed-out";
  document.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.('[data-part="sign-out"]'))
        try {
          sessionStorage.setItem(SIGNED_OUT, "1");
        } catch {}
    },
    true,
  );
  const signIn = setInterval(() => {
    if (location.pathname !== "/sign-in") return clearInterval(signIn);
    if (document.body.dataset.hydrated !== "true") return;
    clearInterval(signIn);
    try {
      if (sessionStorage.getItem(SIGNED_OUT)) return;
    } catch {
      return;
    }
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Sign in as admin")?.click();
  }, 100);
  // A page whose stylesheet did not come (the theme's variables are missing once it has loaded)
  // says so: the dev server can keep failing it until it starts again (Studio review finding 3).
  const styled = () => {
    setTimeout(() => {
      if (!getComputedStyle(document.documentElement).getPropertyValue("--font-body").trim())
        post({ type: "unstyled" });
    }, 1500);
  };
  if (document.readyState === "complete") styled();
  else window.addEventListener("load", styled, { once: true });
  // A page that crashed while the app was taking in a change (the root's error page: a loader
  // or a server function met the dev server mid-rebuild) is loaded again once the server
  // answers, up to three times for an address, and does not say it is ready, so Studio keeps
  // the last good page on screen meanwhile; the fourth time the error is shown as it is.
  const CRASHES = "smithable:crashes";
  const crashes = () => {
    try {
      return JSON.parse(sessionStorage.getItem(CRASHES) || "{}");
    } catch {
      return {};
    }
  };
  const crashed = document.querySelectorAll("[data-kit=error]").length > 0;
  const tries = crashed ? (crashes()[location.pathname] || 0) + 1 : 0;
  if (crashed) {
    try {
      sessionStorage.setItem(CRASHES, JSON.stringify({ ...crashes(), [location.pathname]: tries }));
    } catch {}
    post({ type: "errored", tries });
  } else if (crashes()[location.pathname]) {
    try {
      const { [location.pathname]: _, ...rest } = crashes();
      sessionStorage.setItem(CRASHES, JSON.stringify(rest));
    } catch {}
  }
  if (crashed && tries <= 3) {
    let asking = false;
    const retry = setInterval(() => {
      if (asking) return;
      asking = true;
      const answers = window.fetch ? window.fetch("/health").then((r) => r.ok, () => false) : Promise.resolve(true);
      answers.then((ok) => {
        asking = false;
        if (!ok) return;
        clearInterval(retry);
        location.reload();
      });
    }, 1500);
  } else post({ type: "ready" });
}
`;

const ID = "virtual:smithable-editor";

/** The Vite plugin: serves the runtime and imports it from the app's router module. */
/** The parts of Vite's dev server the plugin uses. */
interface DevServer {
  watcher: { on(event: string, listener: () => void): void };
  /** Node's HTTP server under the dev server; none in middleware mode. */
  httpServer?: UpgradeServer | null;
  /** Vite's environments (client, ssr), each with the channel to its hot-reload clients. */
  environments?: Record<string, { hot: { send: (...args: unknown[]) => void } }>;
  middlewares: {
    use(
      path: string,
      handler: (req: unknown, res: { end(body: string): void }) => void | Promise<void>,
    ): void;
    use(handler: Middleware): void;
  };
}

/** A connect middleware, as Vite's dev server takes them: every request, before Vite's own. */
/** What the guard reads and strips of a request: its headers, parsed and raw. */
export interface GuardedRequest {
  headers: Record<string, string | string[] | undefined>;
  rawHeaders?: string[];
  /** Node's per-name lists of the same headers (headersDistinct), kept apart from `headers`. */
  headersDistinct?: Record<string, string[] | undefined>;
}

export type Middleware = (
  req: GuardedRequest,
  res: {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body: string): void;
  },
  next: () => void,
) => void;

/** The setting the preview's process gets: the token's SHA-256 as hex, never the token itself. */
export const PREVIEW_TOKEN_DIGEST = "SMITHABLE_PREVIEW_TOKEN_SHA256";

/** The token's SHA-256, as the preview compares it. */
export const tokenDigest = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Whether a request carries Studio's token. The preview knows only the token's digest (the
 * daemon gives it `SMITHABLE_PREVIEW_TOKEN_SHA256`), so the app's own code running in the preview
 * cannot read the token and use it on Studio; both sides are compared as digests, so the compare
 * takes the same time whatever is given.
 */
function carriesToken(
  headers: Record<string, string | string[] | undefined>,
  digestHex: string | undefined,
): boolean {
  if (!digestHex) return false;
  const given = headers["x-smithable-studio-token"];
  if (typeof given !== "string") return false;
  const wanted = Buffer.from(digestHex, "hex");
  const got = Buffer.from(tokenDigest(given), "hex");
  return wanted.length === got.length && timingSafeEqual(wanted, got);
}

/**
 * Behind a proxy (`smithable studio --host` with SMITHABLE_STUDIO_TOKEN) the preview's dev server
 * listens on the host's interface like Studio does, so it takes the same token on every request:
 * the proxy adds it, and nothing else on the network reaches the app's pages or its data. Without
 * the digest to compare with, nothing is served at all (closed, never open by mistake).
 */
const TOKEN_HEADER = "x-smithable-studio-token";

/**
 * The token out of the request once it is checked, parsed and raw, so neither Vite nor the app's
 * own code running in the preview (a route, a middleware) can read it and use it on Studio.
 */
export function stripToken(req: GuardedRequest): void {
  delete req.headers[TOKEN_HEADER];
  // Node keeps a second, per-name view of the headers; it is read lazily and then kept.
  if (req.headersDistinct) delete req.headersDistinct[TOKEN_HEADER];
  if (!req.rawHeaders) return;
  for (let i = req.rawHeaders.length - 2; i >= 0; i -= 2)
    if (req.rawHeaders[i]?.toLowerCase() === TOKEN_HEADER) req.rawHeaders.splice(i, 2);
}

export function tokenGuard(digestHex: string | undefined): Middleware {
  return (req, res, next) => {
    if (carriesToken(req.headers, digestHex)) {
      stripToken(req);
      return next();
    }
    res.statusCode = digestHex ? 401 : 503;
    res.setHeader("content-type", "text/plain");
    res.end(digestHex ? "The preview needs Studio's token." : "The preview has no token to check.");
  };
}

/** What the guard needs of the dev server's HTTP server: its upgrade listeners, to wrap. */
export interface UpgradeServer {
  listeners(event: string): ((...args: unknown[]) => void)[];
  removeAllListeners(event: string): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  once(event: string, listener: () => void): void;
}

/**
 * WebSocket upgrades (hot reload, and what a client may ask the dev server over it) do not pass
 * the middlewares: once the server listens, its upgrade listeners are wrapped so an upgrade
 * without the token is refused before any of them sees it. The proxy sends the token on
 * upgrades as on requests. What this cannot cover: a listener a plugin adds to the HTTP server
 * itself after it listens, or on its request event ahead of the middlewares, sees the request
 * first; the generated apps and Vite add none, and the preview's process never holds the token
 * itself, only its digest.
 */
export function guardUpgrades(server: UpgradeServer, digestHex: string | undefined): void {
  server.once("listening", () => {
    const inner = server.listeners("upgrade");
    server.removeAllListeners("upgrade");
    server.on("upgrade", (...args: unknown[]) => {
      const [req, socket] = args as [
        GuardedRequest,
        { write(text: string): void; destroy(): void },
      ];
      if (carriesToken(req.headers, digestHex)) {
        stripToken(req);
        for (const listener of inner) listener(...args);
        return;
      }
      socket.write(
        `HTTP/1.1 ${digestHex ? "401 Unauthorized" : "503 Service Unavailable"}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
      );
      socket.destroy();
    });
  });
}

/**
 * A generated module without components, read by the pages for its words: `pages.ts`, `app.ts`,
 * `roles.ts`, `site.ts`, a model's module (`customer.ts`); not a server module (`.server.ts`),
 * a schema or the actions' files.
 */
export const WORDS_MODULE = /\/src\/generated\/[a-z0-9-]+\.ts$/;

export function smithableEditor(options: { holdUpdates?: boolean; token?: boolean } = {}) {
  return {
    name: "smithable-editor",
    apply: "serve",
    /**
     * In Studio the dev server's own hot updates for the app's generated files are held back
     * (`holdUpdates`): the generator writes the changed files one by one, and each route file
     * among them made the dev server reload the page at once, one to four reloads in the second
     * before the change was whole, the last with a stale client module meeting the new server
     * HTML. Studio reloads the preview itself, once, when the daemon says the app has taken the
     * change in, and only when the change touches the page shown. Code the app's maker writes
     * (`src/custom/`) keeps hot reload; so does everything in the theme lab. So do the app's
     * words modules (words-once.md §3): a text change rewrites `src/generated/pages.ts`, a
     * model's module or `app.ts`, modules without components, and their hot update reaches the
     * components that read them, which show the new text in place; Studio then reloads nothing.
     */
    hotUpdate(this: unknown, update: { file: string }) {
      // Only the browser's updates are held: the server's module runner takes every change, or
      // the page Studio reloads is rendered from the module before it (an old logo, an old menu).
      const environment = (this as { environment?: { name: string } } | undefined)?.environment;
      if (environment && environment.name !== "client") return undefined;
      return options.holdUpdates &&
        !/\/src\/custom\//.test(update.file) &&
        !WORDS_MODULE.test(update.file)
        ? []
        : undefined;
    },
    /**
     * /__smithable/settled answers once the dev server has taken in the latest file changes:
     * its watcher saw them and has been quiet for 300 ms (at most 3 s). Studio waits for it
     * before reloading the preview; reloading while changed files are still being picked up
     * can leave the request hanging.
     */
    configureServer(server: DevServer) {
      // First, before Vite's own middlewares: nothing is served without the token.
      if (options.token) {
        const digest = process.env[PREVIEW_TOKEN_DIGEST] || undefined;
        server.middlewares.use(tokenGuard(digest));
        if (server.httpServer) guardUpgrades(server.httpServer, digest);
      }
      if (options.holdUpdates) holdFullReloads(server);
      let changed = 0;
      for (const event of ["add", "change", "unlink"])
        server.watcher.on(event, () => {
          changed = Date.now();
        });
      server.middlewares.use("/__smithable/settled", async (_req, res) => {
        const start = Date.now();
        const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
        // The change may still be on its way to the watcher.
        while (changed < start - 1000 && Date.now() - start < 1000) await pause(25);
        while (Date.now() - changed < 300 && Date.now() - start < 3000) await pause(25);
        res.end("settled");
      });
    },
    resolveId: (id: string) => (id === ID ? `\0${ID}` : undefined),
    load: (id: string) => (id === `\0${ID}` ? RUNTIME : undefined),
    transform: (code: string, id: string) =>
      id.endsWith("/src/router.tsx") ? `${code}\nimport "${ID}";\n` : undefined,
  };
}

/**
 * Full reloads the dev server's plugins send on their own (TanStack Start reloads every client
 * when it has generated the route tree again, on any change under src/routes) are dropped, as
 * the hot updates are (`hotUpdate` above): Studio makes the one reload. A reload for the app's
 * maker's own code (`triggeredBy` under src/custom) passes.
 */
export function holdFullReloads(server: Pick<DevServer, "environments">) {
  for (const environment of Object.values(server.environments ?? {})) {
    const send = environment.hot.send.bind(environment.hot);
    environment.hot.send = (...args: unknown[]) => {
      const payload = args[0] as { type?: string; triggeredBy?: string } | undefined;
      if (
        payload?.type === "full-reload" &&
        !(payload.triggeredBy && /\/src\/custom\//.test(payload.triggeredBy))
      )
        return;
      send(...args);
    };
  }
}

/** The wrapper config: the app's own Vite config plus the editor, for the preview only. */
export function previewConfig(
  publicUrl?: string,
  allow?: string[],
  options: { holdUpdates?: boolean; token?: boolean } = {},
): string {
  const given = (["holdUpdates", "token"] as const).filter((key) => options[key]);
  const pluginOptions = given.length ? `{ ${given.map((key) => `${key}: true`).join(", ")} }` : "";
  const plugin = new URL("./preview-editor.js", import.meta.url).pathname;
  const server: Record<string, unknown> = {};
  // Behind a proxy on its own public address, the dev server accepts that host and its
  // hot reload goes through the proxy.
  if (publicUrl) {
    const url = new URL(publicUrl);
    const https = url.protocol === "https:";
    server.allowedHosts = [url.hostname];
    server.hmr = {
      host: url.hostname,
      protocol: https ? "wss" : "ws",
      clientPort: Number(url.port || (https ? 443 : 80)),
    };
  }
  // Packages from outside the project (a prepared virtual store) may be served too.
  if (allow) server.fs = { allow };
  const extra = Object.keys(server).length ? `, server: ${JSON.stringify(server)}` : "";
  return `// Written by smithable studio for the preview; the app's own config is ../../vite.config.ts.
import { mergeConfig } from "vite";
import app from "../../vite.config.ts";
import { smithableEditor } from ${JSON.stringify(plugin)};

export default mergeConfig(app, { plugins: [smithableEditor(${pluginOptions})]${extra} });
`;
}
