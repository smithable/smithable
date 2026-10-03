// Smithable app kit: a button that runs an action on a record, then shows the record as it is now.
import { useState } from "react";
import { Button } from "#/components/ui/button";

export function ActionButton({ label, onRun }: { label: string; onRun: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  return (
    <span data-kit="action-button" className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setFailure(undefined);
          try {
            await onRun();
          } catch (error) {
            setFailure(error instanceof Error ? error.message : "Something went wrong.");
          }
          setBusy(false);
        }}
      >
        {label}
      </Button>
      {failure && (
        <span role="alert" className="text-sm text-destructive">
          {failure}
        </span>
      )}
    </span>
  );
}
