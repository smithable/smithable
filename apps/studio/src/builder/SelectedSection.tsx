import { humanize, SECTION_LOOKS, sectionTakesPicture, stagePage } from "@smithable/core";
import { type CSSProperties, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { api } from "../api";
import type { Spec } from "../engine";
import { LookSession } from "../first-look";
import type { Selection } from "../preview";
import { Button, useMedia } from "../ui";
import { SectionPicture } from "./SectionPicture";
import { SectionSketch } from "./SectionSketch";

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
  mark: "Heading",
};
const HEIGHTS: Record<string, string> = {
  default: "Layout's own",
  auto: "Content's",
  full: "Full window",
};

/** A landing section picked in the preview ("section:<page>.<section>"), with the looks it takes. */
export function selectedSection(selection: Selection | undefined, spec: Spec) {
  const picked = /^section:([^.]+)\.(.+)$/.exec(selection?.concept ?? "");
  if (!picked || !spec.ir) return;
  const [, page = "", name = ""] = picked;
  const sections = spec.ir.pages.find((item) => item.id === page)?.sections;
  const section =
    sections?.find((item) => item.name === name) ??
    (name === "@footer" ? sections?.find((item) => item.kind === "footer") : undefined);
  if (!section) return;
  const sectionName = section.name;
  const looks = SECTION_LOOKS[section.kind] ?? {};
  const look = (spec.ux?.pages[page]?.looks?.[sectionName] ?? {}) as Record<string, unknown>;
  const layout = String(look.layout ?? (Array.isArray(looks.layout) ? looks.layout[0] : ""));
  // A hero's tiles are its two or three shortcuts, and its stage a list everyone sees: a layout
  // the section cannot take is not offered (T1196), unless it is the one it has.
  const ir = spec.ir;
  const shortcuts = (section as { shortcuts?: string[] }).shortcuts?.length ?? 0;
  const applies = (key: string, value: string) =>
    section.kind !== "hero" ||
    key !== "layout" ||
    value === layout ||
    (value === "tiles"
      ? shortcuts >= 2 && shortcuts <= 3
      : value !== "stage" || Boolean(stagePage(ir)));
  const landings =
    section.kind === "footer" ? ir.pages.filter((item) => item.pattern.kind === "landing") : [];
  const siteHome =
    landings.find((item) => spec.auth?.public.pages.includes(item.id)) ?? landings[0];
  const contactName = siteHome?.sections.find((item) => item.kind === "contact")?.name;
  const contact =
    siteHome && contactName ? spec.content?.pages[siteHome.id]?.sections?.[contactName] : undefined;
  const choices = Object.keys(KEYS).flatMap((key) => {
    const all = looks[key];
    if (!Array.isArray(all)) return [];
    if (key === "mark" && !spec.content?.logo)
      return look.mark === "logo" ? [{ key, values: ["title"], current: "logo" }] : [];
    if (
      section.kind === "footer" &&
      ![contact?.address, contact?.phone, contact?.email, contact?.hours].some(Boolean)
    )
      return layout === "contactBand" ? [{ key, values: ["standard"], current: layout }] : [];
    const values = all.filter((value) => applies(key, String(value)));
    // A hero's picture has a side only beside its text.
    if (section.kind === "hero" && key === "image" && !["split", "inset"].includes(layout))
      return [];
    // Unsaid, a height is the layout's own: a choice of its own ("default" removes the look).
    if (key === "height")
      return [
        {
          key,
          values: ["default", ...values.map(String)],
          current: String(look[key] ?? "default"),
        },
      ];
    const current = look[key] ?? (key === "band" ? "none" : values[0]);
    return [{ key, values: values.map(String), current: String(current) }];
  });
  const content = spec.content?.pages[page]?.sections?.[sectionName];
  const itemPictures =
    section.kind === "features"
      ? (content?.items ?? []).map((item, index) => ({
          index,
          label: typeof item.title === "string" ? item.title : `Feature ${index + 1}`,
          image:
            typeof item.image === "object" && !Array.isArray(item.image) ? item.image : undefined,
        }))
      : [];
  return {
    page,
    section: sectionName,
    kind: section.kind,
    label: selection?.label?.trim() || humanize(sectionName),
    choices,
    // A section with a picture of its own, and the one it has (none: the section shows its text).
    itemPictures,
    picture: sectionTakesPicture(section.kind) ? { image: content?.image } : undefined,
  };
}

const named = (kind: string, key: string, value: string) =>
  (kind === "hero" && key === "layout" ? HERO_LAYOUTS[value] : undefined) ??
  (kind === "footer" && key === "layout"
    ? value === "contactBand"
      ? "Contact band"
      : "Standard footer"
    : undefined) ??
  (key === "height" ? HEIGHTS[value] : undefined) ??
  humanize(value);

/** The form's width on the desk, as its class says (lg:w-[26rem]): its drawings, four to a row. */
export const SECTION_FORM_WIDTH = 416;

/**
 * A form beside a landing section picked in the preview: its arrangement's choices as small
 * drawings, like the theme cards (T1196). A choice is tried on at once in the preview, as one
 * setSectionLook per kind of choice (a second layout replaces the first); Apply, the X, Escape or
 * picking something else keeps them, and Cancel undoes them all, back to the section as it was
 * (fact decisions.studio-try-then-apply). Placed next to the selection by Studio when it fits
 * there; a sheet at the foot on a phone.
 */
export function SelectedSection({
  section,
  project,
  refresh,
  close,
  ask,
  position,
  measured,
  reveal,
}: {
  section: NonNullable<ReturnType<typeof selectedSection>>;
  /** The project as the form opened on it: Cancel undoes from its revision on. */
  project: { revision?: string; lookProject?: string };
  /** Reads the project again after a change, so the form and the preview show it. */
  refresh: () => Promise<void>;
  close: () => void;
  ask: () => void;
  position?: CSSProperties;
  /** Its height as drawn, each time it changes, so the screen places it by that, not a guess. */
  measured?: (height: number) => void;
  reveal: (sheetTop: number) => void;
}) {
  const lookProject = project.lookProject ?? "";
  const [session] = useState(
    () =>
      new LookSession(
        {
          values: {
            ...Object.fromEntries(section.choices.map((c) => [c.key, c.current])),
            picture: pictureValue(section.picture?.image),
            ...Object.fromEntries(
              section.itemPictures.map(({ index, image }) => [
                `picture:${index}`,
                pictureValue(image),
              ]),
            ),
          },
          revision: project.revision ?? "",
        },
        (change, revision) => api.undoThemeChoice(change, revision, lookProject),
      ),
  );
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState<string>();
  const running = useRef(false);
  // Another section picked while an answer is awaited replaces this form (its key): what comes
  // after the answer then leaves the new selection alone.
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  // A failed read leaves the form as it was, usable; the preview catches up on the next change.
  const reread = () => refresh().catch(() => undefined);
  const heading = useId();
  const panel = useRef<HTMLDivElement>(null);
  const narrow = useMedia("(max-width: 1023px)");
  // The click that picked the section left focus in the preview: the form takes it, so Escape closes.
  useEffect(() => panel.current?.focus({ preventScroll: true }), []);
  useLayoutEffect(() => {
    const sheet = panel.current;
    if (!narrow || !sheet) return;
    const align = () => reveal(sheet.getBoundingClientRect().top);
    align();
    const observer = new ResizeObserver(align);
    observer.observe(sheet);
    return () => observer.disconnect();
  }, [narrow, reveal]);
  // On the desk: placed by its height as drawn (a hero's rows of drawings are taller than a
  // list's), and never taller than the screen leaves it, scrolling inside instead (T1179).
  useLayoutEffect(() => {
    const form = panel.current;
    if (narrow || !form || !measured) return;
    const tell = () => measured(Math.ceil(form.getBoundingClientRect().height));
    tell();
    const observer = new ResizeObserver(tell);
    observer.observe(form);
    return () => observer.disconnect();
  }, [narrow, measured]);
  const choose = (key: string, value: string) =>
    attempt(key, value, (revision) =>
      api.lookChange(
        "setSectionLook",
        { page: section.page, section: section.section, key, value },
        revision,
        lookProject,
      ),
    );
  // A picture replaced, removed or described is tried on like a layout: Cancel puts it back, and
  // an uploaded file leaves with the change that brought it.
  const choosePicture = (
    args: { src?: string; alt?: string },
    file?: { path: string; data: string },
    item?: number,
  ) =>
    attempt(
      item === undefined ? "picture" : `picture:${item}`,
      pictureValue(args.src ? { src: args.src, alt: args.alt ?? "" } : undefined),
      (revision) =>
        api.lookChange(
          "setSectionPicture",
          { page: section.page, section: section.section, ...args, item },
          revision,
          lookProject,
          file,
        ),
    );
  const attempt = async (
    key: string,
    value: string,
    apply: (revision: string) => ReturnType<typeof api.lookChange>,
  ) => {
    // A file read after the form was closed is not sent: what was kept or undone stays so.
    if (running.current || !mounted.current) return;
    running.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await session.set(key, value, apply);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setChanged(session.changed);
      await reread();
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const cancel = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await session.finish(false);
    } catch (reason) {
      // Some were undone before one could not be: the preview shows what is left.
      await reread();
      running.current = false;
      if (!mounted.current) return;
      setBusy(false);
      setChanged(session.changed);
      setError(
        `Cancel could not restore the section: ${(reason as Error).message} Review the changes in Changes.`,
      );
      return;
    }
    await reread();
    running.current = false;
    if (mounted.current) close();
  };
  const keep = () => {
    if (!running.current) close();
  };
  return (
    <div
      ref={panel}
      role="dialog"
      tabIndex={-1}
      aria-labelledby={heading}
      aria-busy={busy}
      data-studio-overlay="selection"
      className="fixed inset-x-1.5 bottom-1.5 z-[55] flex max-h-[60dvh] flex-col rounded-2xl border border-line bg-panel shadow-xl focus:outline-none lg:inset-x-auto lg:bottom-auto lg:max-h-[calc(100dvh-5.5rem)] lg:w-[26rem]"
      style={narrow ? undefined : position}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        keep();
      }}
    >
      <header className="flex items-center gap-1 px-3 pt-3">
        <h2 id={heading} className="min-w-0 flex-1 truncate text-sm font-semibold">
          {section.label}
        </h2>
        <button
          type="button"
          className="h-8 shrink-0 rounded px-2 text-sm text-muted hover:bg-subtle"
          onClick={ask}
        >
          Describe another change
        </button>
        <button
          type="button"
          aria-label="Close selection"
          title="Close selection"
          className="grid size-8 shrink-0 place-items-center rounded text-muted hover:bg-subtle"
          onClick={keep}
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-auto overscroll-contain px-3 py-2">
        {section.choices.length === 0 && !section.picture && (
          <p className="text-sm text-muted">
            This section has no arrangement to choose. Describe the change to Smith instead.
          </p>
        )}
        {section.choices.map(({ key, values, current }) => (
          <fieldset key={key} className="space-y-1">
            <legend className="text-xs text-muted">{KEYS[key]}</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {values.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={value === current}
                  disabled={busy}
                  className="rounded-md border border-line p-1 text-left text-xs leading-tight hover:bg-subtle disabled:opacity-60 aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-medium aria-pressed:ring-2 aria-pressed:ring-accent/40"
                  onClick={() => value !== current && void choose(key, value)}
                >
                  <SectionSketch kind={section.kind} choice={key} value={value} />
                  <span className="mt-1 block">{named(section.kind, key, value)}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        {section.picture && (
          <SectionPicture
            key={pictureValue(section.picture.image)}
            page={section.page}
            section={section.section}
            image={section.picture.image}
            label={
              ["text", "callToAction", "features"].includes(section.kind)
                ? "Background picture"
                : undefined
            }
            change={(args, file) => void choosePicture(args, file)}
            busy={busy}
          />
        )}
        {section.itemPictures.map(({ index, label, image }) => (
          <SectionPicture
            key={`${index}:${pictureValue(image)}`}
            page={section.page}
            section={`${section.section}-${index + 1}`}
            label={`${label} picture`}
            image={image}
            change={(args, file) => void choosePicture(args, file, index)}
            busy={busy}
          />
        ))}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
      {(section.choices.length > 0 || section.picture) && (
        <footer className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
          <p aria-live="polite" className="min-w-0 text-xs text-muted">
            {changed
              ? "Cancel puts the section back as it was."
              : "Pick one to see it in the preview."}
          </p>
          <span className="flex shrink-0 gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => void cancel()}>
              Cancel
            </Button>
            {changed && (
              <Button variant="primary" disabled={busy} onClick={keep}>
                Apply
              </Button>
            )}
          </span>
        </footer>
      )}
    </div>
  );
}

/** A section picture as one value of the form's session: its file and what it shows. */
const pictureValue = (image: { src: string; alt?: string } | undefined) =>
  image ? `${image.src}\n${image.alt ?? ""}` : "";

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
