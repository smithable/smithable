// Messages from the preview editor in the app's page (packages/cli/src/preview-editor.ts).
export type PreviewMessage =
  | { type: "ready" }
  | {
      type: "select";
      concept: string;
      part: "field" | "column" | null;
      page: string | null;
      columns: string[] | null;
    }
  | { type: "columns"; page: string; columns: string[] };

export type Selection = Extract<PreviewMessage, { type: "select" }>;

export function isPreviewMessage(data: unknown): data is PreviewMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { source?: string }).source === "smithable-preview"
  );
}
