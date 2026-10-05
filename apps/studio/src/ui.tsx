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
        variant === "ghost" && "text-neutral-700 hover:bg-neutral-100",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
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
      <label htmlFor={id} className="block text-xs font-medium text-neutral-600">
        {text}
      </label>
      {cloneElement(children, { id, ...(problem ? { "aria-invalid": true } : {}) })}
      {problem ? (
        <p className="text-xs text-red-700">{problem}</p>
      ) : (
        hint && <p className="text-xs text-neutral-500">{hint}</p>
      )}
    </div>
  );
}

const control =
  "block h-8 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

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
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Its content is about to change (aria-busy), e.g. a preview that will reload. */
  busy?: boolean;
}) {
  return (
    <section
      aria-busy={busy || undefined}
      className={cx("flex min-h-0 flex-col border-neutral-200 bg-white", className)}
    >
      {title !== undefined && (
        <header className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-200 px-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {title}
          </h2>
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
  tabs: [T, string][];
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
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          tabIndex={value === id ? 0 : -1}
          onClick={() => onChange(id)}
          className={cx(
            "h-7 rounded-md px-2.5 text-xs font-medium",
            value === id ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100",
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
