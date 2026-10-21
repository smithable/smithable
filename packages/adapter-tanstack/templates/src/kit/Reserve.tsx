// Smithable app kit: the reservation block. On a record with places (a session), a signed-in
// person books one in a step, sees that they are booked, and cancels; visitors are asked to
// sign in. The places are checked again where the booking is written: two people cannot both
// take the last one. To change it, copy this file into src/custom/components/ and edit the copy.
import { CircleAlert, CircleCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "#/components/ui/button";
import { AppLink } from "./AppLink";
import { w } from "./words";

export interface Places {
  left: number;
  max: number;
  /** The viewer's own booking, if they have one. */
  mine?: number;
  canBook: boolean;
  signedIn: boolean;
}

export function Reserve({
  id,
  load,
  book,
  cancel,
  bookLabel = w.bookAPlace,
  cancelLabel = w.cancelBooking,
  fullLabel = w.full,
  bookedLabel = w.youAreBooked,
}: {
  /** The record whose places these are (the session). */
  id: number;
  load: (options: { data: number }) => Promise<Places | null>;
  book: (options: { data: number }) => Promise<unknown>;
  /** Deletes the viewer's booking. */
  cancel: (options: { data: { id: number } }) => Promise<unknown>;
  bookLabel?: string;
  cancelLabel?: string;
  fullLabel?: string;
  bookedLabel?: string;
}) {
  const [places, setPlaces] = useState<Places | null>();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState<string>();
  useEffect(() => {
    load({ data: id }).then(setPlaces, () => setPlaces(null));
  }, [id, load]);
  if (places === undefined)
    return <p className="text-sm text-muted-foreground">{w.checkingPlaces}</p>;
  if (places === null) return null;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setFailure(undefined);
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setFailure(
        message === "full"
          ? w.lastPlaceTaken
          : message === "closed"
            ? w.bookingClosed
            : message === "cancel-closed"
              ? w.cancellingClosed
              : message.startsWith(w.tooMany("\0").split("\0")[0] ?? "")
                ? message
                : w.tryAgain,
      );
    } finally {
      setAsking(false);
      setPlaces(await load({ data: id }).catch(() => null));
      setBusy(false);
    }
  };
  // Back to this page after signing in.
  const here =
    typeof window === "undefined" ? "/" : window.location.pathname + window.location.search;
  const full = places.left === 0;

  return (
    <div data-kit="reserve" className="space-y-3">
      <p className="font-semibold tabular-nums">
        {full ? fullLabel : w.placesLeft(places.left, places.max)}
      </p>
      {places.mine !== undefined ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-success">
            <CircleCheck aria-hidden className="size-5 shrink-0" />
            {bookedLabel}
          </p>
          {asking ? (
            <div className="flex flex-wrap items-center gap-2">
              <span>{w.cancelYourBooking}</span>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => run(() => cancel({ data: { id: places.mine as number } }))}
              >
                {w.yesCancelIt}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setAsking(false)}
              >
                {w.keepIt}
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => setAsking(true)}>
              {cancelLabel}
            </Button>
          )}
        </div>
      ) : !places.signedIn ? (
        <AppLink
          href={`/sign-in?redirect=${encodeURIComponent(here)}`}
          className={buttonVariants({ variant: "default" })}
        >
          {w.signInToBook}
        </AppLink>
      ) : places.canBook && !full ? (
        <Button type="button" disabled={busy} onClick={() => run(() => book({ data: id }))}>
          {busy ? w.booking : bookLabel}
        </Button>
      ) : null}
      {failure && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <CircleAlert aria-hidden className="size-4 shrink-0" />
          {failure}
        </p>
      )}
    </div>
  );
}
