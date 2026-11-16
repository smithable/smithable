import { useRef, useState } from "react";
import { usePendingEdit } from "./pending-edit";

/** Numeric settings keep invalid input local, and keep an atomic parent Save blocked. */
export function NumberBox({
  label,
  value,
  min,
  max,
  integer,
  onCommit,
  onDraft,
}: {
  label: string;
  value: unknown;
  min?: number;
  max?: number;
  integer: boolean;
  onCommit: (value: unknown) => Promise<boolean>;
  /** Only supplied by the existing local draft writer, never by a backend writer. */
  onDraft?: (value: unknown) => void;
}) {
  const shown = typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  const [seen, setSeen] = useState(shown);
  const [settled, setSettled] = useState(shown);
  const [text, setText] = useState(shown);
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const writing = useRef(false);
  const dirty = text !== settled || invalid;
  if (!dirty && seen !== shown) {
    setSeen(shown);
    setSettled(shown);
    setText(shown);
  }
  usePendingEdit(dirty || busy || Boolean(problem));
  const commit = async () => {
    if (writing.current || !dirty) return;
    const box = input.current;
    if (!box) return;
    if (!box.validity.valid) {
      setProblem(box.validationMessage);
      return;
    }
    const next = text === "" ? undefined : Number(text);
    if (next !== undefined && !Number.isFinite(next)) {
      setProblem("Enter a number.");
      return;
    }
    if (next === value) {
      const accepted = next === undefined ? "" : String(next);
      setText(accepted);
      setSettled(accepted);
      setProblem(undefined);
      return;
    }
    writing.current = true;
    setBusy(true);
    try {
      if (await onCommit(next)) {
        const accepted = next === undefined ? "" : String(next);
        setText(accepted);
        setSettled(accepted);
        setProblem(undefined);
      } else setProblem("This value was not applied. Check it and try again.");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="space-y-1">
      <input
        ref={input}
        aria-label={label}
        type="number"
        inputMode={integer ? "numeric" : "decimal"}
        step={integer ? 1 : "any"}
        min={min}
        max={max}
        value={text}
        disabled={busy}
        placeholder="Not set"
        className="h-8 w-full rounded-md border border-line bg-panel px-2 text-sm"
        onChange={(event) => {
          setText(event.target.value);
          setInvalid(!event.target.validity.valid);
          setProblem(undefined);
          onDraft?.(
            event.target.validity.valid
              ? event.target.value === ""
                ? undefined
                : event.target.valueAsNumber
              : Number.NaN,
          );
        }}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") void commit();
        }}
      />
      {(dirty || problem) && (
        <button
          type="button"
          onPointerDown={(event) => event.preventDefault()}
          className="text-xs underline"
          disabled={busy}
          onClick={() => {
            const restored = onDraft ? settled : shown;
            setText(restored);
            setSettled(restored);
            setSeen(restored);
            setInvalid(false);
            setProblem(undefined);
            onDraft?.(restored === "" ? undefined : Number(restored));
          }}
        >
          Reset value
        </button>
      )}
      {problem && (
        <p role="alert" className="text-xs text-quiet">
          {problem}
        </p>
      )}
    </div>
  );
}
