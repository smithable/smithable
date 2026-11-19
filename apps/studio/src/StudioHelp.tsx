import { useState } from "react";
import { StudioOverlay } from "./StudioOverlay";
import { Button } from "./ui";

const hints = [
  {
    id: "address",
    title: "Open a page by address",
    text: "Select the page name in the toolbar to type or paste an address in this app.",
  },
  {
    id: "smith",
    title: "Keep the preview in view",
    text: "Select Smith’s face to open his conversation. Select it again to return to the preview.",
  },
  {
    id: "changes",
    title: "Find an earlier change",
    text: "Open Changes between Undo and Redo to see what you’ve done.",
  },
] as const;

const HINTS = "smithable:help-dismissed-hints";

export function StudioHelp({
  narrow,
  onClose,
  onGuide,
  onFeedback,
}: {
  narrow: boolean;
  onClose: () => void;
  onGuide?: () => void;
  onFeedback: () => void;
}) {
  const [quick, showQuick] = useState(false);
  const [dismissed, dismiss] = useState<string[]>(() => {
    try {
      const kept: unknown = JSON.parse(localStorage.getItem(HINTS) ?? "[]");
      return Array.isArray(kept) ? kept.filter((id): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  });
  const hiddenHints = (next: string[]) => {
    dismiss(next);
    try {
      localStorage.setItem(HINTS, JSON.stringify(next));
    } catch {}
  };
  const available = hints.filter((hint) => !dismissed.includes(hint.id));
  const actionClass =
    "flex min-h-11 w-full items-center justify-between gap-4 border-b border-line px-2 text-left text-sm hover:bg-subtle";
  return (
    <StudioOverlay name="help" title="Help" narrow={narrow} onClose={onClose}>
      <div className="p-3">
        <button
          type="button"
          className={actionClass}
          aria-expanded={quick}
          onClick={() => showQuick(!quick)}
        >
          Quick hints{" "}
          <span aria-hidden="true" className="text-xs text-muted">
            {quick ? "▾" : "Browse →"}
          </span>
        </button>
        {quick && (
          <div className="space-y-2 border-b border-line bg-subtle p-3">
            {available.length ? (
              <ul className="space-y-2">
                {available.map((hint) => (
                  <li key={hint.id} className="space-y-1 rounded-md bg-panel p-3 text-sm">
                    <h3 className="font-medium">{hint.title}</h3>
                    <p className="text-muted">{hint.text}</p>
                    <button
                      type="button"
                      className="text-xs font-medium text-accent hover:underline"
                      aria-label={`Dismiss hint: ${hint.title}`}
                      onClick={() => hiddenHints([...dismissed, hint.id])}
                    >
                      Dismiss
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No hints to show.</p>
            )}
            {dismissed.length > 0 && (
              <Button variant="ghost" onClick={() => hiddenHints([])}>
                Show dismissed hints
              </Button>
            )}
          </div>
        )}
        {onGuide && (
          <button type="button" className={actionClass} onClick={onGuide}>
            Tour Studio{" "}
            <span aria-hidden="true" className="text-xs text-muted">
              Start →
            </span>
          </button>
        )}
        <button type="button" className={actionClass} onClick={onFeedback}>
          Leave feedback{" "}
          <span aria-hidden="true" className="text-xs text-muted">
            Write →
          </span>
        </button>
        <a
          href="https://docs.smithable.ai/start.html"
          target="_blank"
          rel="noreferrer"
          className={actionClass}
        >
          Studio documentation{" "}
          <span aria-hidden="true" className="text-xs text-muted">
            Open ↗
          </span>
        </a>
      </div>
    </StudioOverlay>
  );
}
