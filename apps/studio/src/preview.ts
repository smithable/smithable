// Messages from the preview editor in the app's page (packages/cli/src/preview-editor.ts).
export type PreviewMessage =
  | { type: "ready" }
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
  | { type: "undo" };

export type Selection = Extract<PreviewMessage, { type: "select" }>;

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
