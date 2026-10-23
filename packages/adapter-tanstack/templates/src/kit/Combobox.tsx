// Smithable app kit: a searchable choice of a related record (the WAI-ARIA combobox pattern).
// Type to filter, arrow keys to move, Enter to choose, Escape to close.
import { ChevronDown, X } from "lucide-react";
import { useId, useState } from "react";
import { fieldClassName } from "#/components/ui/input";
import { cn } from "#/lib/utils";
import { w } from "./words";

interface ComboboxProps {
  id: string;
  /** The chosen record's id as text, or "" for none. */
  value: string;
  /** A choice's detail is a line under its name, and is searched too (record-names.md §3). */
  options: { value: string | number; label: string; detail?: string }[];
  required: boolean;
  invalid: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
}

export function Combobox({
  id,
  value,
  options,
  required,
  invalid,
  describedBy,
  onChange,
}: ComboboxProps) {
  const list = useId();
  const labelOf = (v: string) => options.find((o) => String(o.value) === v)?.label ?? "";
  const [text, setText] = useState(() => labelOf(value));
  // A choice made from outside (a time picker choosing who) shows as if it were typed here.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setText(labelOf(value));
  }
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const typed = text !== labelOf(value);
  const shown = typed
    ? options.filter((o) =>
        `${o.label} ${o.detail ?? ""}`.toLowerCase().includes(text.trim().toLowerCase()),
      )
    : options;

  const choose = (v: string) => {
    onChange(v);
    setText(labelOf(v));
    setOpen(false);
  };
  const close = () => {
    setOpen(false);
    // Leaving the field: empty text clears an optional choice; otherwise the choice stays.
    if (text.trim() === "" && !required) choose("");
    else setText(labelOf(value));
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (shown.length ? (i + step + shown.length) % shown.length : 0));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      const option = shown[active];
      if (option) choose(String(option.value));
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setText(labelOf(value));
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={list}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${list}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder={w.search}
        className={cn(fieldClassName, "h-control pr-18")}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={onKeyDown}
      />
      <div className="absolute inset-y-0 right-1 flex items-center">
        {value && !required && (
          <button
            type="button"
            aria-label={w.clear}
            className="flex size-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose("")}
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
        <ChevronDown
          aria-hidden
          className="pointer-events-none mr-2 size-4 text-muted-foreground"
        />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-card py-1 shadow-lg">
          <div id={list} role="listbox" aria-label={w.options}>
            {shown.map((option, i) => (
              <div
                key={option.value}
                id={`${list}-${i}`}
                role="option"
                tabIndex={-1}
                aria-selected={String(option.value) === value}
                className={cn(
                  "cursor-pointer px-3 py-2 text-sm aria-selected:font-semibold",
                  i === active && "bg-hover",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(String(option.value));
                }}
              >
                {option.label}
                {option.detail && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {option.detail}
                  </span>
                )}
              </div>
            ))}
          </div>
          {shown.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {options.length ? w.nothingMatchesText(text.trim()) : w.nothingToChooseYet}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
