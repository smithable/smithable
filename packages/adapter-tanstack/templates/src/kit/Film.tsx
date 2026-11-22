import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "#/lib/utils";
import { AiMarked, type PictureKind } from "./AiMark";
import { w } from "./words";

/**
 * A hero's film (docs/design/section-film.md): a short silent loop over its picture, which stays
 * under it and is all that shows until the film plays. It gets its file only while in view, in a
 * visible tab, for a visitor who asked neither for less motion nor to save data and has not paused
 * it; it shows from its first frame played, and on any failure the picture shows again. Written
 * only into an app with a film; the page hands it to the hero.
 */
export function Film({
  src,
  generated,
  kind,
  framed,
}: {
  src: string;
  /** Made by an AI: the film's own origin, marked while it plays where the picture is marked. */
  generated?: boolean;
  kind?: PictureKind;
  /** Over a picture shown whole (split, inset): the film carries its own mark while it plays. */
  framed?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  // Nothing before the page runs scripts: static pages, print and no-script visitors get the picture.
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    const v = video.current;
    if (!v || failed) return;
    const less = matchMedia("(prefers-reduced-motion: reduce)");
    const saving =
      (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true;
    let inView = false;
    const update = () => {
      if (less.matches || saving) {
        v.pause();
        setPlaying(false);
        return;
      }
      if (inView && !paused && document.visibilityState === "visible") {
        if (!v.getAttribute("src")) v.src = src;
        v.play().catch(() => setFailed(true));
      } else v.pause();
    };
    const seen = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? false;
      update();
    });
    seen.observe(v);
    less.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      seen.disconnect();
      less.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [src, paused, failed]);
  if (!ready || failed) return null;
  const film = (
    <video
      ref={video}
      muted
      loop
      playsInline
      aria-hidden
      tabIndex={-1}
      data-part="film"
      data-playing={playing ? "" : undefined}
      onPlaying={() => setPlaying(true)}
      onError={() => setFailed(true)}
      className={cn(
        "absolute inset-0 size-full object-cover transition-opacity duration-500 print:hidden",
        framed ? "rounded-[inherit]" : "-z-10",
        playing ? "opacity-100" : "opacity-0",
      )}
    />
  );
  return (
    <>
      {framed && generated ? (
        <AiMarked
          generated={generated}
          kind={kind}
          full
          className={cn("absolute inset-0 z-20 print:hidden", !playing && "invisible")}
        >
          {film}
        </AiMarked>
      ) : (
        film
      )}
      {(playing || paused) && (
        <button
          type="button"
          data-part="film-pause"
          aria-label={paused ? w.playFilm : w.pauseFilm}
          onClick={() => {
            const v = video.current;
            if (paused) setPaused(false);
            else {
              v?.pause();
              setPaused(true);
            }
          }}
          className={cn(
            "absolute bottom-3 z-30 flex size-10 items-center justify-center rounded-full bg-black/70 text-white outline-none hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black print:hidden",
            // Clear of the picture's mark (bottom right) and of the shortcuts over the hero's foot.
            framed ? "left-3" : "right-3 [[data-shortcuts]_&]:bottom-16",
          )}
        >
          {paused ? (
            <Play aria-hidden className="size-5" />
          ) : (
            <Pause aria-hidden className="size-5" />
          )}
        </button>
      )}
    </>
  );
}
