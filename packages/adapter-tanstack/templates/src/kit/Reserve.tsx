// Smithable app kit: the reservation block. On a record with places (a session), a signed-in
// person books one in a step, sees that they are booked, and cancels; visitors are asked to
// sign in. The places are checked again where the booking is written: two people cannot both
// take the last one. To change it, copy this file into src/custom/components/ and edit the copy.
import { CircleAlert, CircleCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "#/components/ui/button";

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
  bookLabel = "Book a place",
  cancelLabel = "Cancel booking",
}: {
  /** The record whose places these are (the session). */
  id: number;
  load: (options: { data: number }) => Promise<Places | null>;
  book: (options: { data: number }) => Promise<unknown>;
  /** Deletes the viewer's booking. */
  cancel: (options: { data: number }) => Promise<unknown>;
  bookLabel?: string;
  cancelLabel?: string;
}) {
  const [places, setPlaces] = useState<Places | null>();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState<string>();
  useEffect(() => {
    load({ data: id }).then(setPlaces, () => setPlaces(null));
  }, [id, load]);
  if (places === undefined)
    return <p className="text-sm text-muted-foreground">Checking places…</p>;
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
          ? "Sorry, the last place was just taken."
          : message.startsWith("Too many ")
            ? message
            : "Something went wrong. Please try again.",
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
    <div className="space-y-3">
      <p className="font-semibold tabular-nums">
        {full
          ? "Full"
          : `${places.left} of ${places.max} ${places.max === 1 ? "place" : "places"} left`}
      </p>
      {places.mine !== undefined ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-success">
            <CircleCheck aria-hidden className="size-5 shrink-0" />
            You're booked
          </p>
          {asking ? (
            <div className="flex flex-wrap items-center gap-2">
              <span>Cancel your booking?</span>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => run(() => cancel({ data: places.mine as number }))}
              >
                Yes, cancel it
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setAsking(false)}
              >
                Keep it
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => setAsking(true)}>
              {cancelLabel}
            </Button>
          )}
        </div>
      ) : !places.signedIn ? (
        <a
          href={`/sign-in?redirect=${encodeURIComponent(here)}`}
          className={buttonVariants({ variant: "default" })}
        >
          Sign in to book
        </a>
      ) : places.canBook && !full ? (
        <Button type="button" disabled={busy} onClick={() => run(() => book({ data: id }))}>
          {busy ? "Booking…" : bookLabel}
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
