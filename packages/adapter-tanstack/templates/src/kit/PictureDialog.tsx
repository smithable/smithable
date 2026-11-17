// Smithable app kit: a picture shown whole. Previous and next when there are several (a landing
// page's gallery, a record's pictures). To change it, copy this file into src/custom/components/
// and edit the copy.
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { buttonVariants } from "#/components/ui/button";
import { AiMarked } from "./AiMark";
import { w } from "./words";

/** Shared full-image view: native focus/Escape plus gallery previous/next. */
export function PictureDialog({
  dialog,
  pictures,
  open,
  show,
}: {
  dialog: React.RefObject<HTMLDialogElement | null>;
  pictures: { image: { src: string; alt: string; generated?: boolean }; caption?: string }[];
  open: number;
  show: (index: number) => void;
}) {
  const current = pictures[open];
  return (
    <dialog
      ref={dialog}
      aria-label={current?.image.alt}
      className="m-auto max-h-[92vh] w-[min(1200px,94vw)] bg-transparent p-0 backdrop:bg-black/85"
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") show(open + 1);
        if (e.key === "ArrowLeft") show(open - 1);
      }}
    >
      {current && (
        <figure className="relative">
          {/* As wide as the picture, so the mark sits on its corner. */}
          <AiMarked generated={current.image.generated} full className="mx-auto w-fit">
            <img
              src={current.image.src}
              alt={current.image.alt}
              className="mx-auto block max-h-[80vh] max-w-full rounded-lg object-contain"
            />
          </AiMarked>
          {current.caption && (
            <figcaption className="mt-3 text-center text-white">{current.caption}</figcaption>
          )}
          <div className="mt-3 flex justify-center gap-2">
            {pictures.length > 1 && (
              <button
                type="button"
                aria-label={w.previousPicture}
                className={buttonVariants({ variant: "secondary", size: "icon" })}
                onClick={() => show(open - 1)}
              >
                <ChevronLeft aria-hidden />
              </button>
            )}
            <button
              type="button"
              aria-label={w.close}
              className={buttonVariants({ variant: "secondary", size: "icon" })}
              onClick={() => dialog.current?.close()}
            >
              <X aria-hidden />
            </button>
            {pictures.length > 1 && (
              <button
                type="button"
                aria-label={w.nextPicture}
                className={buttonVariants({ variant: "secondary", size: "icon" })}
                onClick={() => show(open + 1)}
              >
                <ChevronRight aria-hidden />
              </button>
            )}
          </div>
        </figure>
      )}
    </dialog>
  );
}
