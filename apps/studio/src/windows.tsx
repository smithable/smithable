// Studio's five windows and how they are laid out (docs/design/studio-v3.md §1, §8): the top bar
// chooses a layout, small rectangles without names; which window goes in which slot is a
// setting. Kept per device. The windows are drawn in one grid in a fixed order and only placed
// by it, so moving one never makes another again (the preview's frame keeps its page).
import { useEffect, useRef, useState } from "react";
import { Button, cx, Select } from "./ui";

export type WindowId = "nocode" | "code" | "preview" | "smith" | "changes";
/** A slot holds one window, or Smith with Changes under it. */
export type SlotContent = WindowId | "smith+changes";
export type Layout = "one" | "two" | "three" | "three-below";

export const WINDOW_NAMES: Record<SlotContent, string> = {
  nocode: "No code",
  code: "Code",
  preview: "Preview",
  smith: "Smith",
  changes: "Changes",
  "smith+changes": "Smith, with Changes under it",
};

/** How many slots each layout has, and its name for the bar's buttons. */
export const LAYOUTS: [Layout, number, string][] = [
  ["one", 1, "One window"],
  ["two", 2, "Two windows side by side"],
  ["three", 3, "Three windows side by side"],
  ["three-below", 3, "Two windows, a third below"],
];

export interface Arrangement {
  layout: Layout;
  slots: [SlotContent, SlotContent, SlotContent];
}

const DEFAULT: Arrangement = { layout: "two", slots: ["nocode", "preview", "smith+changes"] };
const KEY = "smithable:windows";

/** The arrangement kept in this browser, and a way to change it. */
export function useArrangement(): [Arrangement, (next: Arrangement) => void] {
  const [arrangement, setArrangement] = useState<Arrangement>(() => {
    try {
      const kept = JSON.parse(localStorage.getItem(KEY) ?? "null") as Arrangement | null;
      return kept?.slots?.length === 3 && LAYOUTS.some(([l]) => l === kept.layout) ? kept : DEFAULT;
    } catch {
      return DEFAULT;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(arrangement));
    } catch {}
  }, [arrangement]);
  return [arrangement, setArrangement];
}

/** The slots a layout shows, without those hidden for a while by the preview's arrows. */
export function shownSlots(
  layout: Layout,
  hidden: { left: boolean; right: boolean },
): (0 | 1 | 2)[] {
  const count = LAYOUTS.find(([l]) => l === layout)?.[1] ?? 2;
  const slots = ([0, 1, 2] as const).slice(0, count);
  return slots.filter(
    (s) =>
      !(hidden.left && s === 0 && count > 1) && !(hidden.right && s === 2 && layout === "three"),
  );
}

/**
 * The grid for the slots shown: each slot its area, a ("a"), b and c. Side by side the first
 * window and the preview share the room and a third is a narrow column; below, the third is a
 * row across the foot.
 */
export function gridOf(layout: Layout, slots: (0 | 1 | 2)[]): React.CSSProperties {
  const area = (s: number) => "abc"[s] as string;
  if (layout === "three-below" && slots.includes(2)) {
    const top = slots.filter((s) => s !== 2);
    return {
      gridTemplateAreas: `"${top.map(area).join(" ")}" "${top.map(() => "c").join(" ")}"`,
      gridTemplateColumns: top.length === 2 ? "45fr 55fr" : "1fr",
      gridTemplateRows: "minmax(0, 3fr) minmax(0, 2fr)",
    };
  }
  const widths = slots.map((s) =>
    s === 2 ? "22rem" : s === 0 && slots.includes(1) ? "45fr" : "55fr",
  );
  return {
    gridTemplateAreas: `"${slots.map(area).join(" ")}"`,
    gridTemplateColumns: slots.length === 1 ? "1fr" : widths.join(" "),
    gridTemplateRows: "minmax(0, 1fr)",
  };
}

/** A small picture of a layout: its windows as rectangles. */
function LayoutPicture({ layout }: { layout: Layout }) {
  const rects: Record<Layout, [number, number, number, number][]> = {
    one: [[1, 1, 22, 14]],
    two: [
      [1, 1, 10, 14],
      [12, 1, 11, 14],
    ],
    three: [
      [1, 1, 7, 14],
      [9, 1, 8, 14],
      [18, 1, 5, 14],
    ],
    "three-below": [
      [1, 1, 10, 8],
      [12, 1, 11, 8],
      [1, 10, 22, 5],
    ],
  };
  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden="true">
      {rects[layout].map(([x, y, w, h]) => (
        <rect
          key={`${x},${y}`}
          x={x}
          y={y}
          width={w}
          height={h}
          rx={1}
          className="fill-none stroke-current"
        />
      ))}
    </svg>
  );
}

/** The top bar's layouts, and the gear for which window goes where. */
export function LayoutBar({
  arrangement,
  onChange,
}: {
  arrangement: Arrangement;
  onChange: (next: Arrangement) => void;
}) {
  const [settings, setSettings] = useState(false);
  return (
    <div data-guide="layout" className="flex items-center gap-1">
      <fieldset className="flex rounded-md bg-subtle p-0.5">
        <legend className="sr-only">Layout</legend>
        {LAYOUTS.map(([layout, , name]) => {
          const chosen = arrangement.layout === layout;
          return (
            <label
              key={layout}
              title={name}
              className={cx(
                "flex h-7 cursor-pointer items-center rounded px-1.5 has-focus-visible:ring-2 has-focus-visible:ring-accent/30",
                chosen ? "bg-panel text-fg shadow-xs" : "text-muted",
              )}
            >
              <input
                type="radio"
                name="layout"
                aria-label={name}
                className="sr-only"
                checked={chosen}
                onChange={() => onChange({ ...arrangement, layout })}
              />
              <LayoutPicture layout={layout} />
            </label>
          );
        })}
      </fieldset>
      <button
        type="button"
        aria-label="Which window goes where"
        title="Which window goes where"
        onClick={() => setSettings(true)}
        className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-subtle"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-2.5a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4L10.7 6a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6Z"
            className="fill-none stroke-current"
            strokeWidth="1.5"
          />
        </svg>
      </button>
      {settings && (
        <WindowSettings
          arrangement={arrangement}
          onChange={onChange}
          onClose={() => setSettings(false)}
        />
      )}
    </div>
  );
}

const SLOT_NAMES = ["The first window", "The second window", "The third window"];

/** Which window each slot holds: the gear's dialog. */
function WindowSettings({
  arrangement,
  onChange,
  onClose,
}: {
  arrangement: Arrangement;
  onChange: (next: Arrangement) => void;
  onClose: () => void;
}) {
  const options = Object.entries(WINDOW_NAMES) as [SlotContent, string][];
  // The browser's own modal dialog: Escape closes it and the focus stays inside.
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label="Which window goes where"
      onClose={onClose}
      className="m-auto mt-24 w-[min(24rem,92vw)] rounded-lg bg-panel p-0 text-fg shadow-xl backdrop:bg-black/30"
    >
      <div className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Which window goes where</h2>
        <p className="text-xs text-muted">
          The bar at the top chooses how many windows are shown; here, which window is in each
          place, from the left (the third goes under the first two in the last layout).
        </p>
        {SLOT_NAMES.map((name, i) => (
          <div key={name} className="space-y-1 text-xs">
            <p className="font-medium">{name}</p>
            <Select
              aria-label={name}
              value={arrangement.slots[i]}
              onChange={(e) => {
                const slots = [...arrangement.slots] as Arrangement["slots"];
                slots[i] = e.target.value as SlotContent;
                onChange({ ...arrangement, slots });
              }}
              options={options}
            />
          </div>
        ))}
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </dialog>
  );
}

/** A phone's choices (studio-v3.md §8): whether Code is offered, whether Changes is Smith's. */
export interface PhoneSettings {
  code: boolean;
  changesUnderSmith: boolean;
}
const PHONE = "smithable:phone";

export function usePhoneSettings(): [PhoneSettings, (next: PhoneSettings) => void] {
  const [settings, setSettings] = useState<PhoneSettings>(() => {
    try {
      return {
        code: false,
        changesUnderSmith: true,
        ...JSON.parse(localStorage.getItem(PHONE) ?? "{}"),
      };
    } catch {
      return { code: false, changesUnderSmith: true };
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(PHONE, JSON.stringify(settings));
    } catch {}
  }, [settings]);
  return [settings, setSettings];
}

/** A phone's main windows, in their order: No code, Preview, Smith, then Changes and Code if set. */
export const phoneWindows = (s: PhoneSettings): WindowId[] => [
  "nocode",
  "preview",
  "smith",
  ...(s.changesUnderSmith ? [] : (["changes"] as const)),
  ...(s.code ? (["code"] as const) : []),
];

/**
 * A sideways swipe on an element (a phone's header switches the window, a tab bar the sub view):
 * a finger moved mostly sideways by 50 pixels or more.
 */
export function swipe(onNext: () => void, onPrevious: () => void) {
  let start: { x: number; y: number } | undefined;
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start = t ? { x: t.clientX, y: t.clientY } : undefined;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const t = e.changedTouches[0];
      if (!start || !t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      start = undefined;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0) onNext();
      else onPrevious();
    },
  };
}

/** The gear on a phone: whether Code is offered, whether Changes goes under Smith. */
export function PhoneSettingsButton({
  settings,
  onChange,
}: {
  settings: PhoneSettings;
  onChange: (next: PhoneSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  return (
    <>
      <button
        type="button"
        aria-label="Phone settings"
        title="Phone settings"
        onClick={() => setOpen(true)}
        className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-subtle"
      >
        ⚙
      </button>
      {open && (
        <dialog
          ref={dialog}
          aria-label="Phone settings"
          onClose={() => setOpen(false)}
          className="m-auto w-[min(24rem,92vw)] rounded-lg bg-panel p-0 text-fg shadow-xl backdrop:bg-black/30"
        >
          <div className="space-y-3 p-4 text-sm">
            <h2 className="font-semibold">On a phone</h2>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.code}
                onChange={(e) => onChange({ ...settings, code: e.target.checked })}
              />
              Show Code among the windows
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.changesUnderSmith}
                onChange={(e) => onChange({ ...settings, changesUnderSmith: e.target.checked })}
              />
              Changes under Smith (swipe below to switch)
            </label>
            <div className="flex justify-end">
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
