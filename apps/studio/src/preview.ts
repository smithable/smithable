import type { EditableFile, SpecIR } from "@smithable/core";

// Messages from the preview editor in the app's page (packages/cli/src/preview-editor.ts).
export type PreviewMessage =
  | { type: "ready" }
  /** The page has flashed what a change touched; `key` is the one Studio sent with it. */
  | { type: "flashed"; key: string | null }
  /** The page the preview is on now, e.g. "/customers/12". */
  | { type: "navigated"; path: string }
  | {
      type: "select";
      concept: string;
      part: "field" | "column" | null;
      page: string | null;
      columns: string[] | null;
    }
  | { type: "columns"; page: string; columns: string[] }
  /** A text changed in place; `path` is its place in smithable.content.yml, dot-separated. */
  | { type: "text"; path: string; text: string }
  /** Ctrl+Z in the preview, outside a text field. */
  | { type: "undo" }
  /** The page loaded without its stylesheet (the theme's variables are missing). */
  | { type: "unstyled" };

export type Selection = Extract<PreviewMessage, { type: "select" }>;

/**
 * Where someone was in each window (docs/design/studio-v3.md), kept for the browser tab's
 * session: a reload comes back to it.
 */
export interface Place {
  /** No code: its sub view, and the part last picked in the preview. */
  nocode: { sub?: string; selection?: Selection };
  /** Code: the file open in the editor. */
  code: { file?: EditableFile };
  /** A phone's one window (studio-v3.md §8). */
  window?: string;
}

/** The preview's window and origin, set by the Preview panel: only they are listened to. */
let previewWindow: Window | null = null;
let previewOrigin = "";
export function setPreview(window: Window | null, url: string) {
  previewWindow = window;
  previewOrigin = new URL(url, location.href).origin;
}
export const previewTarget = () => previewOrigin || "*";

/** A message from the preview's own frame and origin, not from any other window. */
export function isPreviewMessage(e: MessageEvent): e is MessageEvent<PreviewMessage> {
  return (
    e.source !== null &&
    e.source === previewWindow &&
    e.origin === previewOrigin &&
    typeof e.data === "object" &&
    e.data !== null &&
    (e.data as { source?: string }).source === "smithable-preview"
  );
}

/**
 * What a change touched, as the preview marks it: a field ("field:Customer.phone"), a model's
 * table or form ("model:Customer") or a text ("text:pages.home.hero.title"). The preview flashes
 * them once it has reloaded with the change.
 */
export function touched(
  operation: { op: string; args: Record<string, unknown> } | undefined,
): string[] {
  if (!operation) return [];
  const { op, args } = operation;
  const model = typeof args.model === "string" ? args.model : undefined;
  if (op === "setText" && Array.isArray(args.path)) return [`text:${args.path.join(".")}`];
  if (model && typeof args.field === "string" && /Field|Label|Help/.test(op))
    return [`field:${model}.${args.field}`];
  if (model && op === "renameField" && typeof args.to === "string")
    return [`field:${model}.${args.to}`];
  if (model && /^(addModel|setCapacity|setModelLabel|setOwner)/.test(op)) return [`model:${model}`];
  // A grant names the kinds of record (or pages) it is about.
  if (op === "grant" && Array.isArray(args.names) && typeof args.what === "string")
    return (args.names as string[])
      .filter((n) => n !== "all" && n !== "none")
      .map((n) => (args.what === "pages" ? `page:${n}` : `model:${n}`));
  return [];
}

/**
 * A generated module without components, read by the pages for its words (`pages.ts`, a model's
 * module, `app.ts`): the preview's dev server passes its hot update, and the components that
 * read it show the new text in place (words-once.md §3), so a change that rewrote only such
 * modules needs no reload. The same test as the preview plugin's.
 */
const WORDS_MODULE = /^src\/generated\/[a-z0-9-]+\.ts$/;

/**
 * Whether a change touches the page the preview is on (`path`), so it is loaded again: false
 * only when sure it does not: a change that rewrote only words modules (`rewritten`, the
 * generated files it changed), whichever page is shown; a change to a field, a record's text or
 * a page's text of another kind of record or page than the ones it shows (with those its links
 * name). Everything else (the menu, the look, access, an undo, a change made by hand) loads it
 * again.
 */
export function touchesPage(
  operation: { op: string; args: Record<string, unknown> } | undefined,
  path: string,
  ir: SpecIR | undefined,
  rewritten?: string[],
): boolean {
  if (rewritten?.length && rewritten.every((file) => WORDS_MODULE.test(file))) return false;
  if (!operation || !ir) return true;
  const { op, args } = operation;
  const bare = path.split(/[?#]/)[0] || "/";
  const page = ir.pages
    .filter((p) => p.route === bare || (p.route !== "/" && bare.startsWith(`${p.route}/`)))
    .sort((a, b) => b.route.length - a.route.length)[0];
  if (!page) return true;
  const pattern = page.pattern;
  const own =
    "model" in pattern
      ? [pattern.model]
      : (pattern.kind === "data" || pattern.kind === "review") && !pattern.all
        ? pattern.models
        : undefined;
  // A landing page, a dashboard, all the data: whatever changes may be on it.
  if (!own) return true;
  const shown = new Set(own);
  for (const name of own)
    for (const f of ir.models.find((m) => m.name === name)?.fields ?? [])
      if (f.type.kind === "relation") shown.add(f.type.model);
  const model = typeof args.model === "string" ? args.model : undefined;
  if (op === "addModel") return false;
  if (model && /^(add|change|remove|rename)Field$|^setFieldRules$/.test(op))
    return shown.has(model);
  if (op === "setText" && Array.isArray(args.path)) {
    const [area, name] = args.path as string[];
    if (area === "models" && name) return shown.has(name);
    // A page's title is in every page's menu; its other texts are on the page alone.
    if (area === "pages" && name) return name === page.id || args.path[2] === "title";
  }
  return true;
}
