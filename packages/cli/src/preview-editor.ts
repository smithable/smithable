// The preview editor (ARCHITECTURE §10.3): a Vite plugin that `smithable studio` adds to the
// app's own Vite config for the preview only. It injects a small runtime into the page that,
// in select mode, outlines the part of the spec under the pointer, reports a click to Studio,
// and lets table columns be dragged. The app's own builds never include it.

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
  // Studio's origin, learned from its first message; until then only "ready" (which carries
  // nothing) goes out, to any origin.
  let studio = null;
  const post = (message) => {
    const target = studio ?? (message.type === "ready" ? "*" : null);
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
  // The owner opens the preview signed in as an administrator: the first time it shows the
  // sign-in page, once its buttons work, the development "Sign in as admin" is pressed. Once a
  // browser session, so after signing out the sign-in page stays to try another role.
  const signIn = setInterval(() => {
    if (location.pathname !== "/sign-in") return clearInterval(signIn);
    if (document.body.dataset.hydrated !== "true") return;
    clearInterval(signIn);
    try {
      if (sessionStorage.getItem("smithable:signed-in")) return;
      sessionStorage.setItem("smithable:signed-in", "1");
    } catch {
      return;
    }
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Sign in as admin")?.click();
  }, 100);
  setTimeout(() => clearInterval(signIn), 30000);
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
  post({ type: "ready" });
}
`;

const ID = "virtual:smithable-editor";

/** The Vite plugin: serves the runtime and imports it from the app's router module. */
/** The parts of Vite's dev server the plugin uses. */
interface DevServer {
  watcher: { on(event: string, listener: () => void): void };
  middlewares: {
    use(
      path: string,
      handler: (req: unknown, res: { end(body: string): void }) => void | Promise<void>,
    ): void;
  };
}

export function smithableEditor() {
  return {
    name: "smithable-editor",
    apply: "serve",
    /**
     * /__smithable/settled answers once the dev server has taken in the latest file changes:
     * its watcher saw them and has been quiet for 300 ms (at most 3 s). Studio waits for it
     * before reloading the preview; reloading while changed files are still being picked up
     * can leave the request hanging.
     */
    configureServer(server: DevServer) {
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

/** The wrapper config: the app's own Vite config plus the editor, for the preview only. */
export function previewConfig(publicUrl?: string, allow?: string[]): string {
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

export default mergeConfig(app, { plugins: [smithableEditor()]${extra} });
`;
}
