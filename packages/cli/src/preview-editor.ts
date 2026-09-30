// The preview editor (ARCHITECTURE §10.3): a Vite plugin that `smithable studio` adds to the
// app's own Vite config for the preview only. It injects a small runtime into the page that,
// in select mode, outlines the part of the spec under the pointer, reports a click to Studio,
// and lets table columns be dragged. The app's own builds never include it.

/** The runtime, run in the preview page inside Studio's iframe. */
const RUNTIME = `
if (typeof window !== "undefined" && window.parent !== window) {
  let selecting = false;
  let hovered = null;
  let dragged = null;
  const style = document.createElement("style");
  style.textContent =
    "[data-sm-hover]{outline:2px dashed #3b5bdb!important;outline-offset:2px;cursor:pointer!important}" +
    "[data-sm-selected]{outline:2px solid #3b5bdb!important;outline-offset:2px}" +
    "[data-sm-part=column][draggable=true]{cursor:grab!important}" +
    "html[data-sm-selecting] [data-sm-concept]{cursor:pointer!important}" +
    "html[data-sm-selecting] [data-sm-text]:hover{outline:2px dashed #e8590c!important;outline-offset:2px;cursor:text!important}" +
    "[data-sm-text][contenteditable=true]{outline:2px solid #e8590c!important;outline-offset:2px;background:#fff4e6}";
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

  window.addEventListener("message", (event) => {
    // Only the page this preview is in: Studio.
    if (event.source !== window.parent || event.data?.type !== "smithable:select-mode") return;
    studio = event.origin;
    report();
    selecting = Boolean(event.data.on);
    // Visible to people (a cursor) and to tests: the page is in select mode.
    document.documentElement.toggleAttribute("data-sm-selecting", selecting);
    clear("data-sm-hover");
    if (!selecting) clear("data-sm-selected");
    document.querySelectorAll("[data-sm-part=column]").forEach((th) => (th.draggable = selecting));
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
