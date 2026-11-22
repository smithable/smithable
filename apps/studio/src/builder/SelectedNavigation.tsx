import { humanize } from "@smithable/core";
import { type CSSProperties, useId, useState } from "react";
import type { Spec } from "../engine";
import type { Selection } from "../preview";
import { Button, Select } from "../ui";
import type { Run } from "./ChangeForms";

export function selectedNavigation(selection: Selection | undefined, spec: Spec) {
  if (!selection || !spec.ir) return;
  if (selection.concept === "navigation:workspace")
    return {
      kind: "workspace",
      label: "App navigation",
      value: spec.ux?.navigation ?? "sidebar",
    } as const;
  const landing = /^navigation:landing\.([\w-]+)$/.exec(selection.concept);
  if (landing) {
    const page = spec.ir.pages.find(({ id }) => id === landing[1]);
    if (page?.pattern.kind !== "landing") return;
    return {
      kind: "landing",
      label: "Top bar",
      page: page.id,
      value: spec.ux?.pages[page.id]?.header?.position ?? "sticky",
    } as const;
  }
  if (selection.part !== "menu-item") return;
  const item = /^text:pages\.([\w-]+)\.title$/.exec(selection.concept);
  const page = item && spec.ir.pages.find(({ id }) => id === item[1]);
  if (!page) return;
  const label =
    (typeof selection.label === "string" && selection.label.trim()) ||
    spec.content?.pages[page.id]?.title ||
    humanize(page.id);
  return { kind: "item", label, page: page.id, value: label, route: page.route } as const;
}

export function SelectedNavigation({
  part,
  run,
  close,
  go,
  position,
}: {
  part: NonNullable<ReturnType<typeof selectedNavigation>>;
  run: Run;
  close: () => void;
  go: (path: string) => void;
  position?: CSSProperties;
}) {
  const [value, setValue] = useState<string>(part.value);
  const [saving, setSaving] = useState(false);
  const heading = useId();
  const control = useId();
  const description = useId();
  const wanted = value.trim();
  const canSave = Boolean(wanted && wanted !== part.value && !saving);
  return (
    <form
      aria-labelledby={heading}
      data-studio-overlay="selection"
      className="fixed inset-x-1.5 bottom-1.5 z-30 max-h-[65dvh] space-y-3 overflow-auto rounded-2xl border border-line bg-panel p-3 shadow-xl lg:inset-x-auto lg:bottom-auto lg:w-80"
      style={position}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !saving) {
          event.stopPropagation();
          close();
        }
      }}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!canSave) return;
        setSaving(true);
        try {
          const ok =
            part.kind === "landing"
              ? await run("setSectionLook", {
                  page: part.page,
                  section: "header",
                  key: "position",
                  value: wanted,
                })
              : part.kind === "workspace"
                ? await run("setMenuLayout", { navigation: wanted })
                : await run("setText", { path: ["pages", part.page, "title"], text: wanted });
          if (ok) close();
        } finally {
          setSaving(false);
        }
      }}
    >
      <h2 id={heading} className="text-sm font-semibold">
        {part.label}
      </h2>
      {part.kind === "landing" ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value === "sticky"}
            onChange={(event) => setValue(event.target.checked ? "sticky" : "scrolling")}
          />
          Stays at the top when scrolling
        </label>
      ) : part.kind === "workspace" ? (
        <div className="space-y-1 text-sm">
          <label htmlFor={control}>Menu placement</label>
          <Select
            id={control}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            options={[
              ["sidebar", "Menu at the side"],
              ["topbar", "Across the top"],
              ["topbar-centered", "Across the top, centred"],
            ]}
          />
        </div>
      ) : (
        <div className="space-y-1 text-sm">
          <label htmlFor={control}>Menu item text</label>
          <input
            id={control}
            aria-describedby={description}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="block h-8 w-full rounded border border-line bg-panel px-2"
          />
          <p id={description} className="text-xs text-quiet">
            This also changes the page title.
          </p>
        </div>
      )}
      <div className="flex justify-end gap-2">
        {part.kind === "item" && (
          <Button type="button" variant="ghost" disabled={saving} onClick={() => go(part.route)}>
            Open page
          </Button>
        )}
        <Button type="button" variant="ghost" disabled={saving} onClick={close}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSave}>
          Apply
        </Button>
      </div>
    </form>
  );
}
