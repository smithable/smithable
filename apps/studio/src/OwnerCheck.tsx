// The guide's one question about who the app is for (reports.md §3): the owner's address goes into
// `admins`, beside or instead of the builder's. Asked once per project in this browser.
import { useId, useState } from "react";
import { ownerAskedKey } from "./guide";

/** The administrators an auth file names, without a starter's sample addresses. */
export function adminsOf(auth: string | undefined): string[] {
  const lines = (auth ?? "").split(/\r?\n/);
  const start = lines.findIndex((l) => /^admins:/.test(l));
  if (start < 0) return [];
  const clean = (text: string) => text.replace(/#.*$/, "").replace(/["'\s]/g, "");
  const inline = /^admins:\s*\[(.*)\]/.exec(lines[start] ?? "")?.[1];
  const named =
    inline !== undefined
      ? inline.split(",").map(clean)
      : lines
          .slice(start + 1)
          .filter((_, i, rest) => rest.slice(0, i + 1).every((l) => /^\s*-\s/.test(l)))
          .map((l) => clean(l.replace(/^\s*-\s/, "")));
  return named.filter((a) => a && !a.endsWith(".example"));
}

const asked = (app: string) => {
  try {
    return localStorage.getItem(ownerAskedKey(app)) === "1";
  } catch {
    return true;
  }
};

export function OwnerCheck({
  app,
  auth,
  onSet,
}: {
  app: string;
  auth: string | undefined;
  /** Writes the administrators to the app; whether they were written. */
  onSet: (admins: string[]) => Promise<boolean>;
}) {
  const id = useId();
  const [done, setDone] = useState(() => asked(app));
  const [forOther, setForOther] = useState(false);
  const [owner, setOwner] = useState("");
  const [alongside, setAlongside] = useState(true);
  if (done) return null;
  const answered = () => {
    try {
      localStorage.setItem(ownerAskedKey(app), "1");
    } catch {
      // Private browsing: it may ask again another day.
    }
    setDone(true);
  };
  const mine = adminsOf(auth);
  const button = "rounded border border-line px-2 py-0.5 text-xs font-medium hover:bg-hover";
  return (
    <div
      data-part="owner-check"
      role="status"
      className="fixed bottom-4 left-1/2 z-[60] flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-xs shadow-2xl"
    >
      {forOther ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const address = owner.trim();
            const admins = [address, ...(alongside ? mine.filter((a) => a !== address) : [])];
            void onSet(admins).then((written) => written && answered());
          }}
        >
          <label htmlFor={`${id}-owner`}>The owner's email address</label>
          <input
            id={`${id}-owner`}
            type="email"
            required
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            className="rounded border border-line bg-transparent px-2 py-0.5 text-sm"
          />
          {mine.length > 0 && (
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={alongside}
                onChange={(event) => setAlongside(event.target.checked)}
              />
              I help run it too
            </label>
          )}
          <button type="submit" className={button}>
            Make them the administrator
          </button>
          <button type="button" className={button} onClick={() => setForOther(false)}>
            Back
          </button>
        </form>
      ) : (
        <>
          <span>Who will run this app day to day?</span>
          <button type="button" className={button} onClick={answered}>
            I will
          </button>
          <button type="button" className={button} onClick={() => setForOther(true)}>
            Someone else
          </button>
        </>
      )}
    </div>
  );
}
