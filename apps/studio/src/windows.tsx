// Studio’s fixed pane order keeps the preview mounted as the side panes open and close.
import { useEffect, useState } from "react";

export type WindowId = "nocode" | "code" | "preview" | "smith" | "changes";
/**
 * No code and Code are the sub-tabs of one window, the view for changing the
 * app by hand (smith-first.md §6; Summary T962), named by the one open; nothing calls it
 * "manual" on the screen.
 */
export type ManualView = "nocode" | "code";
/** Whether a window is one of that view's sub-tabs. */
export const isManualView = (window: string | undefined): window is ManualView =>
  window === "nocode" || window === "code";
/** A slot holds one window, Smith with Changes under it, or the view with No code and Code. */
export type SlotContent = "manual" | "preview" | "smith" | "changes" | "smith+changes";

export const WINDOW_NAMES: Record<SlotContent | WindowId, string> = {
  nocode: "No code",
  code: "Code",
  manual: "No code and Code",
  preview: "Preview",
  smith: "Smith",
  changes: "Changes",
  "smith+changes": "Smith, with Changes under it",
};

const MANUAL = "smithable:settings-view";

export function useManualView(): [ManualView, (view: ManualView) => void] {
  const [view, setView] = useState<ManualView>(() => {
    try {
      const saved = localStorage.getItem(MANUAL);
      if (isManualView(saved ?? undefined)) return saved as ManualView;
      const old = JSON.parse(localStorage.getItem("smithable:windows") ?? "null");
      if (isManualView(old?.manual)) return old.manual;
      if (old?.manual === "summary") return "nocode";
      return Array.isArray(old?.slots) ? (old.slots.find(isManualView) ?? "nocode") : "nocode";
    } catch {
      return "nocode";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(MANUAL, view);
    } catch {}
  }, [view]);
  return [view, setView];
}

const SETTINGS_OPEN = "smithable:settings-open";

export function useSettingsOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_OPEN);
      if (saved !== null) return saved === "1";
      const legacy = JSON.parse(localStorage.getItem("smithable:windows") ?? "null");
      return (
        legacy?.layout === "three" && Array.isArray(legacy.slots) && legacy.slots.includes("manual")
      );
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_OPEN, open ? "1" : "0");
    } catch {}
  }, [open]);
  return [open, setOpen];
}

export function keptChangesBesideSmith() {
  try {
    const legacy = JSON.parse(localStorage.getItem("smithable:windows") ?? "null");
    return Array.isArray(legacy?.slots) && legacy.slots.includes("smith+changes");
  } catch {
    return false;
  }
}

export function gridOf(slots: (0 | 1 | 2)[], contents: SlotContent[]): React.CSSProperties {
  const area = (s: number) => "abc"[s];
  // Three side by side: Smith (or Changes) is a column of its own width, the preview and No code
  // or Code share the rest.
  const narrow = (s: number) => {
    const c = contents[s];
    return c === "smith" || c === "changes" || c === "smith+changes";
  };
  const widths = slots.map((s) =>
    slots.length === 3 && narrow(s)
      ? "24rem"
      : slots.length === 3
        ? contents[s] === "preview"
          ? "55fr"
          : "45fr"
        : s === 2
          ? "22rem"
          : s === 0 && slots.includes(1)
            ? "45fr"
            : "55fr",
  );
  return {
    gridTemplateAreas: `"${slots.map(area).join(" ")}"`,
    gridTemplateColumns: slots.length === 1 ? "1fr" : widths.join(" "),
    gridTemplateRows: "minmax(0, 1fr)",
  };
}

/** A phone can show Changes beneath Smith; Changes stays reachable from the toolbar. */
export interface PhoneSettings {
  changesUnderSmith: boolean;
}
const PHONE = "smithable:phone";

export function usePhoneSettings(): [PhoneSettings, (next: PhoneSettings) => void] {
  const [settings, setSettings] = useState<PhoneSettings>(() => {
    try {
      const kept = JSON.parse(localStorage.getItem(PHONE) ?? "null");
      return { changesUnderSmith: kept?.changesUnderSmith === true };
    } catch {
      return { changesUnderSmith: false };
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(PHONE, JSON.stringify(settings));
    } catch {}
  }, [settings]);
  return [settings, setSettings];
}

export type PhoneWindow = "smith" | "preview" | "manual";

/** Each phone pane is reached by the edge arrows in this order. */
export const phoneWindows: readonly PhoneWindow[] = ["smith", "preview", "manual"];
