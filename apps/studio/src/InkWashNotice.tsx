import { useEffect, useRef, useState } from "react";
import { api, type InkWashOffer, StudioRequestError } from "./api";
import { Button } from "./ui";

const keepKey = (offer: InkWashOffer) => `smithable:ink-wash-kept:${offer.binding}`;

interface InkWashNoticeProps {
  project: string;
  revision: string;
  onApplied: () => void;
}

export function InkWashNotice(props: InkWashNoticeProps) {
  const [attempt, setAttempt] = useState(0);
  return (
    <InkWashComparison
      {...props}
      key={`${props.project}:${props.revision}:${attempt}`}
      onExpired={() => setAttempt((value) => value + 1)}
    />
  );
}

function InkWashComparison({
  project,
  revision,
  onApplied,
  onExpired,
}: InkWashNoticeProps & { onExpired: () => void }) {
  const [offer, setOffer] = useState<InkWashOffer>();
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string>();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const response = await api.inkWashOffer(project, revision);
        if (!active) return;
        if (response.pending) {
          timer = setTimeout(() => void load(), 1200);
        } else if (response.offer) {
          let kept = false;
          try {
            kept = localStorage.getItem(keepKey(response.offer)) === "1";
          } catch {}
          if (!kept) setOffer(response.offer);
        }
      } catch {}
    }
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [project, revision]);

  if (!offer || offer.project !== project || offer.revision !== revision) return null;
  const keep = () => {
    try {
      localStorage.setItem(keepKey(offer), "1");
    } catch {}
    dialog.current?.close();
    setOffer(undefined);
  };
  const apply = async () => {
    setApplying(true);
    setError(undefined);
    try {
      const result = await api.applyInkWash(offer);
      if (!result.ok) throw new Error(result.output);
      dialog.current?.close();
      setOffer(undefined);
      onApplied();
    } catch (error) {
      if (error instanceof StudioRequestError && error.status === 409) {
        onExpired();
      } else {
        setError(error instanceof Error ? error.message : "These pictures could not be applied.");
      }
    } finally {
      setApplying(false);
    }
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-4 py-2 text-sm">
        <p role="status">Pictures to match your theme are ready</p>
        <Button onClick={() => dialog.current?.showModal()}>Compare pictures</Button>
      </div>
      <dialog
        ref={dialog}
        aria-label="Compare theme pictures"
        className="m-auto max-h-[85dvh] w-[min(92vw,42rem)] overflow-auto rounded-xl border border-line bg-panel p-4 text-fg backdrop:bg-black/50"
      >
        <h2 className="mb-3 font-semibold">Compare theme pictures</h2>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <p>Current pictures</p>
          <p>Pictures for this theme</p>
          {offer.samples.flatMap(({ before, after, asDrawn }) => [
            <img key={before} src={before} alt="Current drawing" className="w-full rounded" />,
            <figure key={after}>
              <img
                src={after}
                alt={asDrawn ? "Original drawing" : "Drawing to match the theme"}
                className="w-full rounded"
              />
              {asDrawn && <figcaption className="text-xs text-muted">As drawn</figcaption>}
            </figure>,
          ])}
        </div>
        {error && (
          <p role="alert" className="mb-2 text-sm">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button disabled={applying} onClick={() => dialog.current?.close()}>
            Close
          </Button>
          <Button disabled={applying} onClick={keep}>
            Keep mine
          </Button>
          <Button variant="primary" disabled={applying} onClick={() => void apply()}>
            {applying ? "Applying…" : "Use these"}
          </Button>
        </div>
      </dialog>
    </>
  );
}
