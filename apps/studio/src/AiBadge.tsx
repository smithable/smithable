// The AI badge in Studio (docs/design/picture-kinds.md §1, §3, §4): the kind of pictures before
// their style, the line and overlay beside realistic ones, the app's badge switch with its
// confirmation, and "Show AI badges here", a way of looking kept per person (no operation).
import { PICTURE_KINDS, type PictureKind } from "@smithable/core";
import { useEffect, useId, useRef, useState } from "react";
import { BADGE_WORDS } from "./badge-words";
import { badgesShownHere, showBadgesInPreview } from "./preview";
import { Button, Select } from "./ui";

type Styled = { id: string; kind?: PictureKind; generated: number };

/** A style's kind: the library's own word, else a style without AI pictures is photographs. */
export const styleKind = (style: Styled): PictureKind =>
  style.kind ?? (style.generated === 0 ? "photograph" : "ai-realistic");

/** The three kinds, always in place, each with the offered styles of it (none: "not yet"). */
export const kindChoices = <S extends Styled>(styles: S[]) =>
  PICTURE_KINDS.map((kind) => ({ kind, styles: styles.filter((s) => styleKind(s) === kind) }));

/** The kind shown first: the current style's, else the first kind any style offers. */
export function startingKind(styles: Styled[], current: string | undefined): PictureKind {
  const now = styles.find((s) => s.id === current);
  if (now) return styleKind(now);
  return kindChoices(styles).find((c) => c.styles.length)?.kind ?? "ai-realistic";
}

/** "An AI badge may be needed", with the question mark that opens what it means. */
export function BadgeNote() {
  const [open, setOpen] = useState(false);
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted" data-ai-badge-note>
      {BADGE_WORDS.mayBeNeeded}
      <button
        type="button"
        aria-label={BADGE_WORDS.explain}
        title={BADGE_WORDS.explain}
        className="grid size-5 place-items-center rounded-full border border-line text-xs hover:bg-subtle"
        onClick={() => setOpen(true)}
      >
        ?
      </button>
      {open && <BadgeOverlay onClose={() => setOpen(false)} />}
    </p>
  );
}

function BadgeOverlay({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const shown = dialog.current;
    if (shown && !shown.open) shown.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={heading}
      className="m-auto w-[min(32rem,92vw)] rounded-lg bg-panel p-5 text-sm text-fg shadow-xl backdrop:bg-black/30"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id={heading} className="mb-3 text-base font-semibold">
        {BADGE_WORDS.overlayTitle}
      </h2>
      <ol className="list-decimal space-y-2 pl-5">
        {BADGE_WORDS.overlay.map((line, i) => (
          <li key={line}>
            {line}
            {i === 1 && BADGE_WORDS.rule && (
              <>
                {" "}
                <a href={BADGE_WORDS.rule} target="_blank" rel="noreferrer" className="underline">
                  {BADGE_WORDS.rule}
                </a>
              </>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-4 flex justify-end">
        <Button onClick={onClose}>{BADGE_WORDS.close}</Button>
      </div>
    </dialog>
  );
}

/** What a style's card says of the badge, by the app's switch and the style's kind. */
export function badgeLine(aiBadge: boolean | undefined, kind: PictureKind): string | undefined {
  if (kind === "photograph") return undefined;
  if (aiBadge === false) return BADGE_WORDS.markOff;
  if (aiBadge === true) return BADGE_WORDS.marked;
  return kind === "ai-realistic" ? BADGE_WORDS.markedByKind : BADGE_WORDS.drawnUnmarked;
}

export type BadgeValue = "on" | "off" | "default";
export const badgeValue = (aiBadge: boolean | undefined): BadgeValue =>
  aiBadge === undefined ? "default" : aiBadge ? "on" : "off";

/**
 * The app's badge: by kind (the key unsaid), on, or off. Off while realistic AI pictures are placed
 * asks first and sends the acknowledgement; the operation refuses it without one.
 */
export function BadgeSwitch({
  id,
  aiBadge,
  realistic,
  onChange,
}: {
  id: string;
  aiBadge: boolean | undefined;
  realistic: boolean;
  onChange: (value: BadgeValue, acknowledged: boolean) => void;
}) {
  const [asking, setAsking] = useState(false);
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="flex items-center gap-1.5">
          {BADGE_WORDS.switchLabel}
        </label>
        <Select
          id={id}
          value={asking ? "off" : badgeValue(aiBadge)}
          options={[
            ["default", BADGE_WORDS.byKind],
            ["on", BADGE_WORDS.on],
            ["off", BADGE_WORDS.off],
          ]}
          onChange={(event) => {
            const value = event.target.value as BadgeValue;
            if (value === "off" && realistic) return setAsking(true);
            setAsking(false);
            onChange(value, false);
          }}
        />
      </div>
      {asking && (
        <div role="alertdialog" aria-label={BADGE_WORDS.switchLabel} className="space-y-2">
          <p>{BADGE_WORDS.confirmOff}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAsking(false)}>
              {BADGE_WORDS.confirmOffNo}
            </Button>
            <Button
              onClick={() => {
                setAsking(false);
                onChange("off", true);
              }}
            >
              {BADGE_WORDS.confirmOffYes}
            </Button>
          </div>
        </div>
      )}
      <BadgeNote />
    </div>
  );
}

/** "Show AI badges here": the preview then shows exactly what will be published. */
export function ShowBadgesHere() {
  const [on, setOn] = useState(badgesShownHere);
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={on}
        onChange={(event) => {
          const shown = event.target.checked;
          setOn(shown);
          showBadgesInPreview(shown);
        }}
      />
      {BADGE_WORDS.showHere}
    </label>
  );
}
