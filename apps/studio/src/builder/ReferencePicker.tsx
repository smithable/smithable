import { useId, useState } from "react";
import type { ReferenceOption } from "./reference-options";

type Value = string | string[] | undefined;
export interface ReferencePickerProps {
  label: string;
  options: readonly ReferenceOption[];
  value: Value;
  multiple?: boolean;
  /** Only supply an unset choice when this spec key may be removed. */
  unset?: string;
  disabled?: boolean;
  onChange: (value: Value) => Promise<boolean>;
  /** An existing complete creation flow, not a name box that writes an empty entry. */
  create?: { label: string; open: () => void };
}

/** Closed reference choices: searching never writes a name that does not exist. */
export function ReferencePicker({
  label,
  options,
  value,
  multiple = false,
  unset,
  disabled = false,
  onChange,
  create,
}: ReferencePickerProps) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const selected = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const selectedOne = typeof value === "string" ? value : "";
  const unknown = selected.filter((item) => !options.some((option) => option.value === item));
  const filtered = options.filter(
    (option) =>
      (!multiple || !selected.includes(option.value)) &&
      (!search.trim() ||
        `${option.label} ${option.value}`
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase())),
  );
  const commit = async (next: Value) => {
    if (busy || disabled) return;
    setBusy(true);
    setError(undefined);
    try {
      if (await onChange(next)) setSearch("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };
  const move = (index: number, step: number) => {
    const next = [...selected];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    void commit(next);
  };
  // Guard integration is intentionally left to the shared pending-edit contract once merged.
  return (
    <fieldset disabled={disabled || busy} className="space-y-2" aria-label={label}>
      {options.length >= 12 && (
        <input
          type="search"
          aria-label={`Find ${label}`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-7 w-full rounded-md border border-line bg-panel px-2 text-sm"
        />
      )}
      {multiple && selected.length > 0 && (
        <ol className="space-y-1">
          {selected.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: written lists may already contain duplicate names
            <li key={`${index}:${item}`} className="flex items-center gap-1 text-sm">
              <span>{options.find((option) => option.value === item)?.label ?? item}</span>
              {unknown.includes(item) && <span className="text-muted">(not available)</span>}
              <button
                type="button"
                aria-label={`Move ${item} earlier`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${item} later`}
                disabled={index === selected.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`Remove ${item}`}
                onClick={() => void commit(selected.filter((_, at) => at !== index))}
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}
      <label className="block space-y-1 text-sm" htmlFor={id}>
        {multiple ? `Add to ${label}` : label}
        <select
          id={id}
          value={multiple ? "" : selectedOne}
          className="h-7 w-full rounded-md border border-line bg-panel px-2 text-sm"
          onChange={(event) => {
            const next = event.target.value;
            if (!next) {
              if (!multiple && unset) void commit(undefined);
              return;
            }
            if (!options.some((option) => option.value === next)) return;
            if (multiple) {
              if (!selected.includes(next)) void commit([...selected, next]);
            } else void commit(next);
          }}
        >
          <option value="" disabled={multiple || !unset}>
            {multiple ? "Choose one to add" : (unset ?? "Choose a reference")}
          </option>
          {!multiple && selectedOne && !filtered.some((option) => option.value === selectedOne) && (
            <option value={selectedOne} disabled={unknown.includes(selectedOne)}>
              {options.find((option) => option.value === selectedOne)?.label ?? selectedOne}
              {unknown.includes(selectedOne) ? " (not available)" : ""}
            </option>
          )}
          {filtered.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {filtered.length === 0 && <p className="text-xs text-muted">No matching references.</p>}
      {!multiple && unknown.length > 0 && (
        <p role="status" className="text-xs text-muted">
          The saved reference is not available. Choose its replacement explicitly.
        </p>
      )}
      {create && (
        <button type="button" className="text-sm underline" onClick={create.open}>
          {create.label}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
