import { useCallback, useEffect, useRef, useState } from "react";

const words = {
  "smith-hidden": "Click Smith to bring him back.",
  selection: "All settings shows more for what you selected.",
  "change-applied": "Undo in the top bar puts the app back.",
  "settings-opened": "No code changes the app. Code shows its files.",
  "look-kept": "Look opens this again when you want another theme.",
  "publish-opened": "Check what has changed before you publish.",
};

export type Hint = keyof typeof words;

const key = (hint: Hint) => `smithable:seen-hint:${hint}`;

export function useStudioHint() {
  const seen = useRef(new Set<Hint>());
  const [active, setActive] = useState<Hint>();
  const dismiss = useCallback(() => setActive(undefined), []);
  const reveal = useCallback((hint: Hint) => {
    if (seen.current.has(hint)) return;
    seen.current.add(hint);
    try {
      if (localStorage.getItem(key(hint))) return;
      localStorage.setItem(key(hint), "1");
    } catch {}
    setActive(hint);
  }, []);
  const reset = () => {
    seen.current.clear();
    try {
      for (const hint of Object.keys(words) as Hint[]) localStorage.removeItem(key(hint));
    } catch {}
    dismiss();
  };
  return { active, reveal, dismiss, reset };
}

export function StudioHint({
  at,
  active,
  dismiss,
  returnFocus,
}: {
  at: Hint | readonly Hint[];
  active?: Hint;
  dismiss: () => void;
  returnFocus?: () => void;
}) {
  const shown = active && (typeof at === "string" ? active === at : at.includes(active));
  return (
    <>
      <span role="status" className="sr-only">
        {shown && words[active]}
      </span>
      {shown && (
        <HintButton key={active} text={words[active]} dismiss={dismiss} returnFocus={returnFocus} />
      )}
    </>
  );
}

function HintButton({
  text,
  dismiss,
  returnFocus,
}: {
  text: string;
  dismiss: () => void;
  returnFocus?: () => void;
}) {
  const remaining = useRef(Math.max(6000, Math.ceil(text.length / 15) * 1000));
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (hovered || focused) return;
    const started = performance.now();
    const timer = setTimeout(dismiss, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (performance.now() - started));
    };
  }, [dismiss, focused, hovered]);

  return (
    <button
      type="button"
      data-studio-hint
      className="block w-max max-w-[80vw] rounded-md border border-line bg-panel px-3 py-2 text-left text-sm text-fg shadow-lg hover:bg-subtle focus-visible:outline-2 focus-visible:outline-accent"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={(event) => {
        const target = event.currentTarget
          .closest("[data-studio-hint-anchor]")
          ?.querySelector<HTMLElement>(
            '[data-studio-hint-target], [role="tab"][aria-selected="true"]',
          );
        dismiss();
        if (returnFocus) returnFocus();
        else target?.focus();
      }}
    >
      {text}
    </button>
  );
}
