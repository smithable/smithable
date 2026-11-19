import { humanize, SECTION_LOOKS } from "@smithable/core";
import { type CSSProperties, useId, useState } from "react";
import { createPortal } from "react-dom";
import type { Spec } from "../engine";
import type { Selection } from "../preview";
import { Button, Select, Tabs } from "../ui";
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
}: {
  button: NonNullable<ReturnType<typeof selectedButton>>;
  run: Run;
  close: () => void;
  host?: HTMLDivElement | null;
  position?: CSSProperties;
}) {
  const [tab, setTab] = useState<"look" | "text" | "behavior">("look");
  const [layout, setLayout] = useState<string>();
  const [text, setText] = useState(button.label);
  const [target, setTarget] = useState(button.target);
  const [saving, setSaving] = useState(false);
  const heading = useId();
  const control = useId();
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
      <h2 id={heading} className="text-sm font-semibold">
        {button.label}
      </h2>
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
      className="fixed inset-x-0 bottom-0 z-30 max-h-[65dvh] overflow-auto rounded-t-xl border border-line bg-panel shadow-xl lg:inset-x-auto lg:bottom-auto lg:w-80 lg:rounded-lg"
      style={position}
    >
      {form}
    </div>
  );
}
