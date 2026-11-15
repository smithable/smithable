import type { Diagnostic } from "@smithable/core";
import { Button } from "./ui";

// Additive validator metadata; older engines still get a plain fallback and their Code details.
export type PresentedDiagnostic = Diagnostic & {
  plain?: { message: string; path: (string | number)[] };
};
const KINDS: Record<string, string> = {
  timers: "timer",
  models: "kind of record",
  pages: "page",
  actions: "action",
  outgoing: "message",
};

export function ValidationNotice({
  diagnostics,
  code,
  onOpen,
  onDismiss,
}: {
  diagnostics: PresentedDiagnostic[];
  code: boolean;
  onOpen: (diagnostic: PresentedDiagnostic) => void;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="alert"
      data-validation-notice
      className="space-y-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm"
    >
      {diagnostics.map((d) => {
        const kind = KINDS[String(d.plain?.path[0])] ?? "setting";
        const details = `${d.file}:${d.line}:${d.column} — ${d.message}${d.hint ? `\n${d.hint}` : ""}`;
        return (
          <div key={`${d.file}:${d.line}:${d.column}:${d.code}:${d.message}`} className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1 whitespace-pre-wrap">
                {code
                  ? details
                  : (d.plain?.message ??
                    "A setting in this app needs attention before it can run.")}
              </span>
              {d.plain?.path.length ? (
                <Button variant="ghost" onClick={() => onOpen(d)}>
                  Open {kind}
                </Button>
              ) : null}
            </div>
            {!code && (
              <details>
                <summary className="cursor-pointer text-xs">Code details</summary>
                <p className="mt-1 whitespace-pre-wrap font-mono text-xs">{details}</p>
              </details>
            )}
          </div>
        );
      })}
      {onDismiss && (
        <Button variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      )}
    </div>
  );
}
