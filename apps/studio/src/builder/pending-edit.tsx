import {
  type ComponentProps,
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Input } from "../ui";

/** Local edits are independent of the last saved project and of the focused control. */
export const PendingEdits = createContext<(id: string, pending: boolean) => void>(() => {});

export function usePendingEdit(pending: boolean) {
  const report = useContext(PendingEdits);
  const id = useId();
  useLayoutEffect(() => {
    report(id, pending);
    return () => report(id, false);
  }, [id, pending, report]);
}

export function usePendingEdits() {
  const edits = useRef(new Set<string>());
  const [version, change] = useState(0);
  const report = useCallback((id: string, pending: boolean) => {
    if (edits.current.has(id) === pending) return;
    if (pending) edits.current.add(id);
    else edits.current.delete(id);
    change((n) => n + 1);
  }, []);
  const pending = useCallback(() => edits.current.size > 0, []);
  return { report, pending, version };
}

/** A blur-saved input still has a local draft if its operation refuses the value. */
export function PendingInput({
  defaultValue = "",
  onChange,
  ...props
}: Omit<ComponentProps<typeof Input>, "value">) {
  const shown = String(defaultValue);
  const [text, setText] = useState(shown);
  const [seen, setSeen] = useState(shown);
  if (shown !== seen) {
    setSeen(shown);
    if (text === seen) setText(shown);
  }
  usePendingEdit(text.trim() !== shown.trim());
  return (
    <Input
      {...props}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        onChange?.(event);
      }}
    />
  );
}
