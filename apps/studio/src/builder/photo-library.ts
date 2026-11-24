// The Photos and videos panel's calls (docs/design/media-storage.md §6; T1458). Hosted, the
// owner's library is the service's, at Studio's own address (/_smithable/media: the owner's session
// and the same-origin rule cover it), and a chosen file goes in as an asset whose sizes the host
// reads from the record. Locally the panel lists the project's own pictures under public/images/.
// Every answer is checked here: a name or id that is not one is never shown or sent.
import { ASSET_ID } from "@smithable/core";

export const LIBRARY_PATH = "/_smithable/media";

export type StoredFile = {
  id: string;
  name: string;
  kind: "image" | "video";
  state: "processing" | "ready" | "failed";
  error?: string;
  /** Granted to this project already: only a granted file may be placed or published. */
  here: boolean;
};
export type Library =
  | { hosted: true; files: StoredFile[]; more: boolean }
  | { hosted: false; files: string[] };

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const COULD_NOT = "The photo library could not be reached. Try again in a moment.";
const LOCAL_PICTURE = /^images\/[\w-][\w.-]*\.(webp|avif|jpe?g|png)$/i;

async function json(response: Response): Promise<Record<string, unknown> | undefined> {
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) return;
  const body: unknown = await response.json().catch(() => undefined);
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : undefined;
}

/** One stored file from the service's answer, or undefined when it is not one. */
export function storedFile(value: unknown): StoredFile | undefined {
  if (!value || typeof value !== "object") return;
  const o = value as Record<string, unknown>;
  if (typeof o.id !== "string" || !ASSET_ID.test(o.id)) return;
  if (o.kind !== "image" && o.kind !== "video") return;
  if (o.state !== "processing" && o.state !== "ready" && o.state !== "failed") return;
  const name = typeof o.name === "string" && o.name.trim() ? o.name.trim().slice(0, 120) : o.id;
  const error = typeof o.error === "string" && o.error ? o.error : undefined;
  return {
    id: o.id,
    name,
    kind: o.kind,
    state: o.state,
    ...(error ? { error } : {}),
    here: o.here === true,
  };
}

/**
 * The service's library when it answers here, else the project's own pictures (local Studio, where
 * /_smithable/media is no route of Studio's and answers no JSON).
 */
export async function readLibrary(fetcher: Fetch = fetch): Promise<Library | { why: string }> {
  try {
    const hosted = await json(
      await fetcher(LIBRARY_PATH, { headers: { accept: "application/json" } }),
    );
    if (hosted && Array.isArray(hosted.assets))
      return {
        hosted: true,
        files: hosted.assets.map(storedFile).filter((f): f is StoredFile => !!f),
        more: hosted.more === true,
      };
    const local = await json(await fetcher("/api/photos"));
    if (!local || !Array.isArray(local.photos)) return { why: COULD_NOT };
    return {
      hosted: false,
      files: local.photos.filter(
        (p): p is string => typeof p === "string" && LOCAL_PICTURE.test(p),
      ),
    };
  } catch {
    return { why: COULD_NOT };
  }
}

/** Sends the owner's file to the library: its id while it is made ready, or the service's reason. */
export async function uploadFile(
  file: { name: string; type: string; size: number },
  body: BodyInit,
  fetcher: Fetch = fetch,
): Promise<{ id: string } | { why: string }> {
  try {
    const response = await fetcher(LIBRARY_PATH, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": file.type || "application/octet-stream",
        "x-file-name": encodeURIComponent(file.name),
      },
      body,
    });
    const answer = await json(response);
    if (response.status === 202 && typeof answer?.id === "string" && ASSET_ID.test(answer.id))
      return { id: answer.id };
    return { why: typeof answer?.error === "string" && answer.error ? answer.error : COULD_NOT };
  } catch {
    return { why: COULD_NOT };
  }
}

/** One stored file's state now, or undefined when the service does not answer for it. */
export async function readFile(id: string, fetcher: Fetch = fetch) {
  if (!ASSET_ID.test(id)) return;
  try {
    return storedFile(
      await json(
        await fetcher(`${LIBRARY_PATH}/${id}`, { headers: { accept: "application/json" } }),
      ),
    );
  } catch {
    return;
  }
}

/**
 * Asks until the file is ready or failed, every `every` ms for at most `within` ms: the ready
 * file, or why not.
 */
export async function untilReady(
  id: string,
  { every = 2000, within = 120_000, fetcher = fetch as Fetch, wait = sleep } = {},
): Promise<StoredFile | { why: string }> {
  for (let waited = 0; waited <= within; waited += every) {
    const file = await readFile(id, fetcher);
    if (file?.state === "ready") return file;
    if (file?.state === "failed")
      return { why: file.error ?? "This file could not be made ready. Try another." };
    await wait(every);
  }
  return { why: "The file is still being made ready. It will be in Photos and videos when it is." };
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Grants one of the owner's files to this project, so that it may be placed here (the service's
 * /use; 204). False when it is not the owner's, not there, or not ready: the service says no more.
 */
export async function grantFile(id: string, fetcher: Fetch = fetch): Promise<boolean> {
  if (!ASSET_ID.test(id)) return false;
  try {
    return (await fetcher(`${LIBRARY_PATH}/${id}/use`, { method: "POST" })).status === 204;
  } catch {
    return false;
  }
}

/** Deletes a stored file from the library (no undo in phase A); true when it is gone. */
export async function deleteFile(id: string, fetcher: Fetch = fetch): Promise<boolean> {
  if (!ASSET_ID.test(id)) return false;
  try {
    return (await fetcher(`${LIBRARY_PATH}/${id}`, { method: "DELETE" })).status === 204;
  } catch {
    return false;
  }
}

/** The small picture of a stored file, from the service; of a project picture, from Studio. */
export const thumbnail = (file: StoredFile | string) =>
  typeof file === "string" ? `/api/${file}` : `${LIBRARY_PATH}/${file.id}/w480.webp`;
