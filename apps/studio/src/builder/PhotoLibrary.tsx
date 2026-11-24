// The Photos and videos panel as a chooser (docs/design/media-storage.md §6; T1458): the owner's
// library on the hosted service, with upload and delete; locally the project's own pictures.
// Choosing one hands it back to the section's form, which runs setSectionPicture.
import { useCallback, useEffect, useState } from "react";
import {
  deleteFile,
  failedBecause,
  grantFile,
  type Library,
  readLibrary,
  type StoredFile,
  thumbnail,
  untilReady,
  uploadFile,
} from "./photo-library";

export function PhotoLibrary({
  current,
  choose,
  close,
  busy,
}: {
  /** The section's file now (its asset or src), marked in the list. */
  current: string | undefined;
  choose: (picked: { asset: string } | { src: string }) => void;
  close: () => void;
  busy: boolean;
}) {
  const [library, setLibrary] = useState<Library>();
  const [said, setSaid] = useState<string>();
  const [working, setWorking] = useState<string>();
  const [deleting, setDeleting] = useState<StoredFile>();
  const load = useCallback(async () => {
    const read = await readLibrary();
    if ("why" in read) setSaid(read.why);
    else setLibrary(read);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const held = busy || !!working;

  const upload = async (file: File | undefined) => {
    setSaid(undefined);
    if (!file) return;
    setWorking(`Sending ${file.name}…`);
    const sent = await uploadFile(file, file);
    if ("why" in sent) {
      setWorking(undefined);
      return setSaid(sent.why);
    }
    setWorking(`Making ${file.name} ready…`);
    void load();
    const ready = await untilReady(sent.id);
    setWorking(undefined);
    void load();
    if ("why" in ready) return setSaid(ready.why);
    await place(ready);
  };

  // A file of the owner's library is granted to this project before it is placed here.
  const place = async (file: StoredFile) => {
    setSaid(undefined);
    if (!file.here) {
      setWorking(`Bringing ${file.name} into this app…`);
      const granted = await grantFile(file.id);
      setWorking(undefined);
      if (!granted) return setSaid(`${file.name} could not be used here. Try again in a moment.`);
    }
    choose({ asset: file.id });
  };

  const remove = async (file: StoredFile) => {
    setDeleting(undefined);
    setWorking(`Deleting ${file.name}…`);
    const gone = await deleteFile(file.id);
    setWorking(undefined);
    if (!gone) setSaid(`${file.name} could not be deleted. Try again in a moment.`);
    void load();
  };

  return (
    <section
      className="space-y-2 rounded border border-line bg-panel p-2"
      aria-label="Photos and videos"
      data-photo-library
    >
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">Photos and videos</h3>
        {library?.hosted && (
          <label className="ml-auto cursor-pointer rounded border border-line px-2 py-1 text-sm hover:bg-subtle focus-within:ring-2 focus-within:ring-accent has-[:disabled]:opacity-60">
            Upload
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={held}
              onChange={(event) => {
                void upload(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        )}
        <button
          type="button"
          className={`${library?.hosted ? "" : "ml-auto "}rounded border border-line px-2 py-1 text-sm hover:bg-subtle`}
          onClick={close}
        >
          Close
        </button>
      </div>
      {!library && !said && <p className="text-sm text-quiet">Reading the library…</p>}
      {library && library.files.length === 0 && (
        <p className="text-sm text-quiet">
          {library.hosted
            ? "No photos yet. Upload one to use it here."
            : "No pictures in public/images/ yet. Use Replace to add one."}
        </p>
      )}
      {library && library.files.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {library.files.map((file) => {
            const key = typeof file === "string" ? file : file.id;
            const name = typeof file === "string" ? file.slice("images/".length) : file.name;
            const ready =
              typeof file === "string" || (file.state === "ready" && file.kind === "image");
            return (
              <li key={key} className="space-y-1">
                <button
                  type="button"
                  disabled={held || !ready || key === current}
                  aria-label={`Use ${name}`}
                  className="block w-full rounded border border-line hover:ring-2 hover:ring-accent disabled:opacity-60"
                  onClick={() =>
                    typeof file === "string" ? choose({ src: file }) : void place(file)
                  }
                >
                  {ready ? (
                    <img
                      src={thumbnail(file)}
                      alt=""
                      className="h-16 w-full rounded object-cover"
                    />
                  ) : (
                    <span
                      className="flex h-16 items-center justify-center text-xs text-quiet"
                      title={
                        typeof file !== "string" && file.state === "failed"
                          ? failedBecause(file.error)
                          : undefined
                      }
                    >
                      {typeof file !== "string" && file.state === "failed"
                        ? "Could not be used"
                        : typeof file !== "string" && file.kind === "video"
                          ? "Video"
                          : "Being made ready"}
                    </span>
                  )}
                </button>
                <p className="truncate text-xs" title={name}>
                  {key === current ? `${name} (here now)` : name}
                </p>
                {typeof file !== "string" && (
                  <button
                    type="button"
                    disabled={held}
                    className="text-xs text-red-700 underline disabled:opacity-60"
                    onClick={() => setDeleting(file)}
                  >
                    Delete
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {library?.hosted && library.more && (
        <p className="text-xs text-quiet">Only your newest 500 files are shown.</p>
      )}
      {deleting && (
        <div role="alertdialog" aria-label="Delete this file" className="space-y-1 text-sm">
          <p>
            Delete {deleting.name} from your library? This cannot be undone: every app and published
            site that shows it shows an empty frame in its place.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-red-700 px-2 py-1 text-red-700"
              onClick={() => void remove(deleting)}
            >
              Delete
            </button>
            <button
              type="button"
              className="rounded border border-line px-2 py-1"
              onClick={() => setDeleting(undefined)}
            >
              Keep it
            </button>
          </div>
        </div>
      )}
      {working && <p className="text-sm text-quiet">{working}</p>}
      {said && (
        <p role="alert" className="text-sm text-red-700">
          {said}
        </p>
      )}
    </section>
  );
}
