import { humanize, SECTION_LOOKS } from "@smithable/core";
import { type CSSProperties, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Spec } from "../engine";
import type { Selection } from "../preview";
import { OverlayPositionControl, useOverlayPosition } from "../StudioOverlay";
import { Button, Select, Tabs, useMedia } from "../ui";
import type { Run } from "./ChangeForms";
import { SectionChoice } from "./Look";

export function selectedButton(selection: Selection | undefined, spec: Spec) {
  if (!selection || !spec.ir) return;
  const picked = /^text:pages\.([^.]+)\.([^.]+)\.(button|secondButton)$/.exec(selection.concept);
  if (!picked) return;
  const [, pageId, sectionName, key] = picked;
  const page = spec.ir.pages.find((item) => item.id === pageId);
  const hero = page?.sections.find((section) => section.kind === "hero");
  if (!page || hero?.name !== sectionName || hero.kind !== "hero") return;
  const second = key === "secondButton";
  const label =
    (typeof selection.label === "string" && selection.label.trim()) ||
    (second ? "Second button" : "Button");
  return {
    label,
    page: pageId,
    section: sectionName,
    key,
    target: (second ? hero.secondButton : hero.button) ?? "none",
    destinations: spec.ir.pages.map(({ id }): [string, string] => [
      id,
      spec.content?.pages[id]?.title ?? humanize(id),
    ]),
    layout: spec.ux?.pages[pageId]?.looks?.[sectionName]?.layout,
  };
}

export function SelectedButton({
  button,
  run,
  close,
  host,
  position,
  reveal,
}: {
  button: NonNullable<ReturnType<typeof selectedButton>>;
  run: Run;
  close: () => void;
  host?: HTMLDivElement | null;
  position?: CSSProperties;
  reveal: (sheetTop: number) => void;
}) {
  const [tab, setTab] = useState<"look" | "text" | "behavior">("look");
  const [layout, setLayout] = useState<string>();
  const [text, setText] = useState(button.label);
  const [target, setTarget] = useState(button.target);
  const [saving, setSaving] = useState(false);
  const heading = useId();
  const control = useId();
  const panel = useRef<HTMLDivElement>(null);
  const narrow = useMedia("(max-width: 1023px)");
  const standalone = host === undefined;
  const movement = useOverlayPosition("selection", panel, standalone && !narrow);
  useLayoutEffect(() => {
    const sheet = panel.current;
    if (!narrow || !standalone || !sheet) return;
    const align = () => reveal(sheet.getBoundingClientRect().top);
    align();
    const observer = new ResizeObserver(align);
    observer.observe(sheet);
    window.addEventListener("resize", align);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", align);
    };
  }, [narrow, standalone, reveal]);
  const layouts = SECTION_LOOKS.hero?.layout;
  const meaningful =
    tab === "look"
      ? layout !== undefined && layout !== String(button.layout ?? "inherit")
      : tab === "text"
        ? Boolean(text.trim() && text.trim() !== button.label)
        : target !== button.target;
  if (host === null) return null;
  const form = (
    <form
      aria-labelledby={heading}
      className="space-y-3 p-3"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || saving) return;
        event.stopPropagation();
        close();
      }}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!meaningful || saving) return;
        setSaving(true);
        try {
          const ok =
            tab === "look"
              ? await run("setSectionLook", {
                  page: button.page,
                  section: button.section,
                  key: "layout",
                  value: layout,
                })
              : tab === "text"
                ? await run("setText", {
                    path: ["pages", button.page, button.section, button.key],
                    text: text.trim(),
                  })
                : await run("setHeroButtons", { page: button.page, [button.key]: target });
          if (ok) close();
        } finally {
          setSaving(false);
        }
      }}
    >
      {standalone ? (
        <header className="flex items-center gap-1">
          <h2 id={heading} className="min-w-0 flex-1 text-sm font-semibold">
            {button.label}
          </h2>
          {!narrow && <OverlayPositionControl label="selection" movement={movement} />}
          <button
            type="button"
            aria-label="Close selection"
            title="Close selection"
            disabled={saving}
            className="grid size-8 shrink-0 place-items-center rounded text-muted hover:bg-subtle disabled:opacity-40"
            onClick={close}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
      ) : (
        <h2 id={heading} className="text-sm font-semibold">
          {button.label}
        </h2>
      )}
      <Tabs
        tabs={[
          ["look", "Look"],
          ["text", "Text"],
          ["behavior", "What it does"],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "look" && Array.isArray(layouts) && (
        <SectionChoice
          page={button.page}
          section={button.section}
          name="layout"
          label="Hero layout"
          values={layouts}
          current={button.layout}
          value={layout}
          set={setLayout}
        />
      )}
      {tab === "text" && (
        <label htmlFor={control} className="block space-y-1 text-sm">
          <span>Button text</span>
          <input
            id={control}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="block h-8 w-full rounded border border-line bg-panel px-2"
          />
        </label>
      )}
      {tab === "behavior" && (
        <label htmlFor={control} className="flex items-center justify-between gap-2 text-sm">
          <span>Opens</span>
          <Select
            id={control}
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            options={[
              ["none", button.key === "secondButton" ? "Hide second button" : "Default page"],
              ...button.destinations,
            ]}
          />
        </label>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={close} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !meaningful}>
          Apply
        </Button>
      </div>
    </form>
  );
  return host ? (
    createPortal(form, host)
  ) : (
    <div
      ref={panel}
      data-studio-overlay="selection"
      className="fixed inset-x-1.5 bottom-1.5 z-30 max-h-[65dvh] overflow-auto overscroll-contain rounded-2xl border border-line bg-panel shadow-xl lg:inset-x-auto lg:bottom-auto lg:w-80 lg:overflow-visible"
      style={movement.position ?? position}
    >
      {narrow && (
        <div
          aria-hidden="true"
          className="sticky top-0 z-10 flex justify-center bg-panel pt-3 pb-1"
        >
          <span className="h-1 w-9 rounded-full bg-line-strong" />
        </div>
      )}
      {form}
    </div>
  );
}
