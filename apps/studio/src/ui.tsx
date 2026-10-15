// Small building blocks for the Studio's own interface.
import { cloneElement, type ReactElement, type ReactNode, useEffect, useId, useState } from "react";

export function cx(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-accent text-white hover:bg-accent/90",
        variant === "ghost" && "text-fg-soft hover:bg-subtle",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-600/90",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** A visible label for one control, associated with it by id. */
export function Label({
  text,
  children,
  hint,
  problem,
}: {
  text: string;
  children: ReactElement<{ id?: string; "aria-invalid"?: boolean }>;
  hint?: string;
  /** What is wrong with the value as typed, said under it in place of the hint. */
  problem?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-muted">
        {text}
      </label>
      {cloneElement(children, { id, ...(problem ? { "aria-invalid": true } : {}) })}
      {problem ? (
        <p className="text-xs text-red-700">{problem}</p>
      ) : (
        hint && <p className="text-xs text-quiet">{hint}</p>
      )}
    </div>
  );
}

/** A checkbox with its words, and a tooltip saying what it does (also read out as its description). */
export function Check({
  text,
  tip,
  checked,
  onChange,
  className,
}: {
  text: string;
  tip: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <>
      <label className={cx("flex items-center gap-2", className)} title={tip}>
        <input
          type="checkbox"
          checked={checked}
          aria-describedby={id}
          onChange={(e) => onChange(e.target.checked)}
        />
        {text}
      </label>
      <span id={id} className="sr-only">
        {tip}
      </span>
    </>
  );
}

const control =
  "block h-8 w-full rounded-md border border-line-strong bg-panel px-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(control, props.className)} />;
}

export function Select({
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { options: (string | [string, string])[] }) {
  return (
    <select {...props} className={cx(control, props.className)}>
      {options.map((o) => {
        const [value, label] = typeof o === "string" ? [o, o] : o;
        return (
          <option key={value} value={value}>
            {label}
          </option>
        );
      })}
    </select>
  );
}

export function Panel({
  title,
  actions,
  children,
  className,
  busy,
  panel,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Its content is about to change (aria-busy), e.g. a preview that will reload. */
  busy?: boolean;
  /** Its name in a phone's row of panels (data-panel). */
  panel?: string;
}) {
  return (
    <section
      data-panel={panel}
      aria-busy={busy || undefined}
      className={cx("flex min-h-0 min-w-0 flex-col border-line bg-panel", className)}
    >
      {title !== undefined && (
        <header className="flex h-10 shrink-0 items-center justify-between border-b border-line px-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-quiet">{title}</h2>
          {actions}
        </header>
      )}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  );
}

/** The ARIA tabs pattern: one tab in the Tab order, arrow keys (and Home, End) move between them. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  /** Each tab's value and label, and the guide's name for it (data-guide), if it has one. */
  tabs: [T, string, string?][];
  value: T;
  onChange: (value: T) => void;
}) {
  const move = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const at = tabs.findIndex(([id]) => id === value);
    const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const next = (to + tabs.length) % tabs.length;
    onChange(tabs[next][0]);
    (e.currentTarget.children[next] as HTMLElement).focus();
  };
  return (
    <div role="tablist" className="flex gap-1" onKeyDown={move}>
      {tabs.map(([id, label, guide]) => (
        <button
          key={id}
          data-guide={guide}
          type="button"
          role="tab"
          aria-selected={value === id}
          tabIndex={value === id ? 0 : -1}
          onClick={() => onChange(id)}
          className={cx(
            "h-7 rounded-md px-2.5 text-xs font-medium",
            value === id ? "bg-fg text-panel" : "text-muted hover:bg-subtle",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Whether a media query matches, following the window as it changes. */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const change = () => setMatches(list.matches);
    list.addEventListener("change", change);
    return () => list.removeEventListener("change", change);
  }, [query]);
  return matches;
}
