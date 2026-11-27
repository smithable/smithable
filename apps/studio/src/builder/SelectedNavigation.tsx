import { humanize } from "@smithable/core";
import { type CSSProperties, useId, useState } from "react";
import type { Spec } from "../engine";
import type { Selection } from "../preview";
import { Button, Select } from "../ui";
import type { Run } from "./ChangeForms";

export function selectedNavigation(selection: Selection | undefined, spec: Spec) {
  if (!selection || !spec.ir) return;
  const navigation = spec.ux?.navigation ?? "sidebar";
  if (selection.concept === "navigation:workspace") {
    const page = spec.ir.pages.find(({ id }) => id === selection.page);
    return {
      kind: "workspace",
      label: "App navigation",
      value: navigation,
      navigation,
      // A page with a frame of its own (landing, onboarding) keeps it: no choice for it alone.
      ...(page && !["landing", "onboarding"].includes(page.pattern.kind)
        ? { page: page.id, frame: spec.ux?.pages[page.id]?.frame }
        : {}),
    } as const;
  }
  const landing = /^navigation:landing\.([\w-]+)$/.exec(selection.concept);
  if (landing) {
    const page = spec.ir.pages.find(({ id }) => id === landing[1]);
    if (page?.pattern.kind !== "landing") return;
    return {
      kind: "landing",
      label: "Top bar",
      page: page.id,
      value: spec.ux?.pages[page.id]?.header?.position ?? "sticky",
      navigation,
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

/** The menu's places for the whole app (setMenuLayout) and a page's frames (setFrame), T1695. */
const PLACES: [string, string][] = [
  ["sidebar", "Side menu"],
  ["topbar", "Top menu"],
  ["topbar-centered", "Top menu centred"],
];
const FRAMES: [string, string][] = [
  ["site", "Public page: top menu and footer"],
  ["app", "Workspace page: the app's menu"],
];

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
  const pageFrame = part.kind === "workspace" && "page" in part ? part : undefined;
  const [scope, setScope] = useState<"app" | "page" | "default">(pageFrame?.frame ? "page" : "app");
  const [frame, setFrame] = useState<string>(pageFrame?.frame ?? "site");
  const [place, setPlace] = useState<string>(part.kind === "item" ? "" : part.navigation);
  const heading = useId();
  const control = useId();
  const description = useId();
  const wanted = value.trim();
  // What Apply runs: each an operation, in order.
  const changes: [string, Record<string, unknown>, string][] = [];
  const [saved, setSaved] = useState<string>();
  if (part.kind === "item") {
    if (wanted && wanted !== part.value)
      changes.push([
        "setText",
        { path: ["pages", part.page, "title"], text: wanted },
        "the menu item's text",
      ]);
  } else {
    if (part.kind === "landing" && value !== part.value)
      changes.push([
        "setSectionLook",
        { page: part.page, section: "header", key: "position", value },
        "the top bar's scrolling",
      ]);
    if (scope === "app" && place !== part.navigation)
      changes.push(["setMenuLayout", { navigation: place }, "the menu for the whole app"]);
    if (pageFrame && scope === "page" && frame !== pageFrame.frame)
      changes.push(["setFrame", { page: pageFrame.page, frame }, "this page's menu"]);
    if (pageFrame?.frame && scope === "default")
      changes.push(["setFrame", { page: pageFrame.page, frame: "default" }, "this page's menu"]);
  }
  const canSave = changes.length > 0 && !saving;
  const scopes = (
    <fieldset className="space-y-1 text-sm">
      <legend className="mb-1">
        {part.kind === "landing" ? "Menu on workspace pages" : "Menu"}
      </legend>
      {(
        [
          ["app", "Whole app"],
          ...(pageFrame
            ? [
                ["page", "Only this page"],
                ["default", "Default"],
              ]
            : []),
        ] as [typeof scope, string][]
      ).map(([id, label]) => (
        <label key={id} className="flex items-center gap-2">
          <input
            type="radio"
            name={`${heading}-scope`}
            checked={scope === id}
            onChange={() => setScope(id)}
          />
          {label}
        </label>
      ))}
      {scope === "app" ? (
        <Select
          aria-label="Menu for the whole app"
          value={place}
          onChange={(event) => setPlace(event.target.value)}
          options={PLACES}
        />
      ) : scope === "page" ? (
        <Select
          aria-label="Menu for this page"
          value={frame}
          onChange={(event) => setFrame(event.target.value)}
          options={FRAMES}
        />
      ) : (
        <p className="text-xs text-quiet">
          Landing pages and public articles are public pages; the rest are workspace pages.
        </p>
      )}
    </fieldset>
  );
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
          // One Apply may be two changes: when the second is refused, say the first stays.
          const done: string[] = [];
          for (const [name, args, what] of changes) {
            if (!(await run(name, args))) {
              if (done.length) setSaved(`Saved ${done.join(" and ")}; ${what} was not changed.`);
              return;
            }
            done.push(what);
          }
          close();
        } finally {
          setSaving(false);
        }
      }}
    >
      <h2 id={heading} className="text-sm font-semibold">
        {part.label}
      </h2>
      {part.kind === "landing" ? (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value === "sticky"}
              onChange={(event) => setValue(event.target.checked ? "sticky" : "scrolling")}
            />
            Stays at the top when scrolling
          </label>
          {scopes}
        </>
      ) : part.kind === "workspace" ? (
        scopes
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
      {saved && (
        <p role="status" className="text-xs text-quiet">
          {saved}
        </p>
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
