// A change's verification in Studio (docs/design/change-verified.md §5.2, A 236): the one line,
// which opens the checks behind it and the consequences, and "Test it", which runs the next
// depth on the newest revision. Read from the result kept for the change's revision.
import type { Verification } from "@smithable/core";
import { useEffect, useState } from "react";
import { api } from "./api";
import { cx } from "./ui";
import { checkLines, nextDepth, verifiedLine } from "./verified";

/** The verification kept for each of these changes, by id, read again when they change. */
export function useVerified(
  ids: string[],
): [Record<string, Verification>, (id: string, v: Verification) => void] {
  const [found, setFound] = useState<Record<string, Verification>>({});
  const key = ids.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: the ids' text is the signal
  useEffect(() => {
    if (!key) return;
    let current = true;
    api.verified(key.split(",")).then(
      (v) => current && setFound(v),
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [key]);
  return [found, (id, v) => setFound((f) => ({ ...f, [id]: v }))];
}

export function Verified({
  verification,
  newest = false,
  onTested,
}: {
  verification: Verification;
  /** The newest change: "Test it" runs the next depth on it. */
  newest?: boolean;
  onTested?: (v: Verification) => void;
}) {
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [said, setSaid] = useState("");
  const depth = newest ? nextDepth(verification) : undefined;
  const failed = verification.checks.some((c) => c.state === "failed");
  return (
    <div data-verified className="text-xs">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cx("text-left hover:underline", failed ? "text-red-700" : "text-muted")}
      >
        {verifiedLine(verification)}
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          <ul aria-label="What was checked" className="space-y-0.5 text-muted">
            {checkLines(verification).map((c) => (
              <li key={c.id} className={c.state === "failed" ? "text-red-700" : undefined}>
                {c.text}
              </li>
            ))}
          </ul>
          {verification.consequences.length > 0 && (
            <ul aria-label="What it did" className="list-disc pl-4 text-muted">
              {verification.consequences.map((c) => (
                <li key={`${c.about}:${c.says}`}>{c.says}</li>
              ))}
            </ul>
          )}
          {depth && (
            <button
              type="button"
              disabled={testing}
              className="rounded border border-line px-2 py-0.5 text-accent hover:border-accent disabled:opacity-50"
              onClick={() => {
                setTesting(true);
                setSaid("");
                void api
                  .verify(depth)
                  .then(
                    (r) => {
                      // Tested on the newest revision: filed under this change only when it is that.
                      if (r.verification?.revision === verification.revision)
                        onTested?.(r.verification);
                      else if (r.verification)
                        setSaid("A newer change came since; it was tested instead.");
                      else setSaid(r.output ?? "");
                    },
                    (e: Error) => setSaid(e.message),
                  )
                  .finally(() => setTesting(false));
              }}
            >
              {testing ? "Testing…" : "Test it"}
            </button>
          )}
          {said && <p className="text-red-700">{said}</p>}
        </div>
      )}
    </div>
  );
}
