import { humanize, SECTION_LOOKS } from "@smithable/core";
import { type CSSProperties, useId, useLayoutEffect, useRef, useState } from "react";
import type { Spec } from "../engine";
import type { Selection } from "../preview";
import { useMedia } from "../ui";
import type { Run } from "./ChangeForms";

/** A hero's layouts by what they look like (docs/spec/v0.1.md, sections); the two across the width say so. */
const HERO_LAYOUTS: Record<string, string> = {
  split: "Picture beside text",
  centered: "Text over picture",
  plain: "Text only",
  cover: "Full width, brand color",
  photo: "Full width photo",
  inset: "Picture as a card",
  stage: "Beside a list",
  tiles: "Picture with tiles",
};
/** The looks a section's form offers, in this order: the ones that change its arrangement. */
const KEYS: Record<string, string> = {
  layout: "Layout",
  columns: "Columns",
  image: "Picture side",
  height: "Height",
  band: "Background",
};
const HEIGHTS: Record<string, string> = { auto: "Content's", full: "Full window" };

/** A landing section picked in the preview ("section:<page>.<section>"), with the looks it takes. */
export function selectedSection(selection: Selection | undefined, spec: Spec) {
  const picked = /^section:([^.]+)\.(.+)$/.exec(selection?.concept ?? "");
  if (!picked || !spec.ir) return;
  const [, page = "", name = ""] = picked;
  const section = spec.ir.pages
    .find((item) => item.id === page)
    ?.sections.find((item) => item.name === name);
  if (!section) return;
  const looks = SECTION_LOOKS[section.kind] ?? {};
  const look = (spec.ux?.pages[page]?.looks?.[name] ?? {}) as Record<string, unknown>;
  const layout = String(look.layout ?? (Array.isArray(looks.layout) ? looks.layout[0] : ""));
  const choices = Object.keys(KEYS).flatMap((key) => {
    const values = looks[key];
    if (!Array.isArray(values)) return [];
    // A hero's picture has a side only beside its text.
    if (section.kind === "hero" && key === "image" && !["split", "inset"].includes(layout))
      return [];
    const current =
      look[key] ?? (key === "band" ? "none" : key === "height" ? undefined : values[0]);
    return [
      { key, values: values.map(String), current: current === undefined ? "" : String(current) },
    ];
  });
  return {
    page,
    section: name,
    kind: section.kind,
    label: selection?.label?.trim() || humanize(name),
    choices,
  };
}

const named = (kind: string, key: string, value: string) =>
  (kind === "hero" && key === "layout" ? HERO_LAYOUTS[value] : undefined) ??
  (key === "height" ? HEIGHTS[value] : undefined) ??
  humanize(value);

/**
 * A small form beside a landing section picked in the preview: its arrangement's choices, each
 * applied at once as one setSectionLook (Undo steps back), and the same selection to Smith. Placed
 * next to the selection by Studio, with nothing drawn between them; a sheet at the foot on a phone.
 */
export function SelectedSection({
  section,
  run,
  close,
  ask,
  position,
  reveal,
}: {
  section: NonNullable<ReturnType<typeof selectedSection>>;
  run: Run;
  close: () => void;
  ask: () => void;
  position?: CSSProperties;
  reveal: (sheetTop: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const heading = useId();
  const panel = useRef<HTMLDivElement>(null);
  const narrow = useMedia("(max-width: 1023px)");
  useLayoutEffect(() => {
    const sheet = panel.current;
    if (!narrow || !sheet) return;
    const align = () => reveal(sheet.getBoundingClientRect().top);
    align();
    const observer = new ResizeObserver(align);
    observer.observe(sheet);
    return () => observer.disconnect();
  }, [narrow, reveal]);
  const choose = async (key: string, value: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await run("setSectionLook", { page: section.page, section: section.section, key, value });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      ref={panel}
      role="dialog"
      aria-labelledby={heading}
      data-studio-overlay="selection"
      className="fixed inset-x-1.5 bottom-1.5 z-30 max-h-[50dvh] space-y-3 overflow-auto overscroll-contain rounded-2xl border border-line bg-panel p-3 shadow-xl lg:inset-x-auto lg:bottom-auto lg:w-80"
      style={narrow ? undefined : position}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        close();
      }}
    >
      <header className="flex items-center gap-1">
        <h2 id={heading} className="min-w-0 flex-1 truncate text-sm font-semibold">
          {section.label}
        </h2>
        <button
          type="button"
          className="h-8 shrink-0 rounded px-2 text-sm text-muted hover:bg-subtle"
          onClick={ask}
        >
          Ask Smith
        </button>
        <button
          type="button"
          aria-label="Close selection"
          title="Close selection"
          className="grid size-8 shrink-0 place-items-center rounded text-muted hover:bg-subtle"
          onClick={close}
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>
      {section.choices.length === 0 && (
        <p className="text-sm text-muted">
          This section has no arrangement to choose. Ask Smith to change it.
        </p>
      )}
      {section.choices.map(({ key, values, current }) => (
        <fieldset key={key} className="space-y-1">
          <legend className="text-xs text-muted">{KEYS[key]}</legend>
          <div className="flex flex-wrap gap-1">
            {values.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={value === current}
                disabled={busy}
                className="rounded border border-line px-2 py-1 text-sm hover:bg-subtle disabled:opacity-60 aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-medium"
                onClick={() => value !== current && void choose(key, value)}
              >
                {named(section.kind, key, value)}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

type Box = { left: number; right: number; top: number; bottom: number };
/**
 * Where a form of `width` by `height` goes next to a selection's box (both on the screen): to its
 * right, else its left, else below it, else above it, within the screen and under Studio's bar
 * (`top`); a box that leaves no room anywhere (a hero across the window) has it inside, at the foot of
 * what shows of it. Never connected to the box by a line (Johan, 2026-11-21).
 */
export function beside(
  box: Box,
  screen: { width: number; height: number; top: number },
  width: number,
  height: number,
) {
  const gap = 12;
  const fitsX = (left: number) => left >= gap && left + width <= screen.width - gap;
  const fitsY = (top: number) => top >= screen.top && top + height <= screen.height - gap;
  const clampX = (left: number) => Math.max(gap, Math.min(screen.width - gap - width, left));
  const clampY = (top: number) => Math.max(screen.top, Math.min(screen.height - gap - height, top));
  if (fitsX(box.right + gap)) return { left: box.right + gap, top: clampY(box.top) };
  if (fitsX(box.left - gap - width)) return { left: box.left - gap - width, top: clampY(box.top) };
  const centered = clampX((box.left + box.right - width) / 2);
  if (fitsY(box.bottom + gap)) return { left: centered, top: box.bottom + gap };
  if (fitsY(box.top - gap - height)) return { left: centered, top: box.top - gap - height };
  return {
    left: clampX(box.right - gap - width),
    top: clampY(Math.min(box.bottom, screen.height) - gap - height),
  };
}
