import { timed } from "./io.js";

/**
 * Loads the preview's start page and its module graph once, as a browser would, including the
 * routes it loads lazily. The dev server then discovers and optimizes every dependency before
 * the first real visit; when that happens during a visit instead, the page reloads, and a
 * module being loaded at that moment can fail (seen in the sandboxed hosted previews).
 * Returns how many modules were loaded.
 */
export async function warmPreview(
  port: number,
  log: (text: string) => void,
  attempts = 240,
  /** Studio's token, when the preview takes one (behind a proxy). */
  headers: Record<string, string> = {},
): Promise<number> {
  const started = Date.now();
  const seconds = () => Math.round((Date.now() - started) / 100) / 10;
  const base = `http://127.0.0.1:${port}`;
  const get = async (path: string) => {
    try {
      const answer = await fetch(`${base}${path}`, { headers, redirect: "manual" });
      return {
        status: answer.status,
        location: answer.headers.get("location"),
        body: await answer.text(),
      };
    } catch {
      return { status: 0, location: null, body: "" };
    }
  };
  let answers = false;
  for (let i = 0; i < attempts && !answers; i++) {
    answers = (await get("/health")).status === 200;
    if (!answers) await new Promise((r) => setTimeout(r, 500));
  }
  // How long a person waits for the preview is the first thing to know when it seems stuck;
  // and when it never answered, the log must not say it did.
  if (!answers) {
    log(`The preview has not answered ${seconds()} s after it was started.`);
    timed("preview without an answer", started);
    return 0;
  }
  log(`The preview answers (${seconds()} s after it was started).`);
  timed("preview answers", started);
  // The start page, following its redirects (e.g. to sign-in).
  let page = await get("/");
  for (let i = 0; i < 3 && page.location; i++)
    page = await get(new URL(page.location, base).pathname);
  const seen = new Set<string>();
  let queue = imports(page.body);
  while (queue.length && seen.size < 500) {
    const batch = queue.filter((p) => !seen.has(p)).slice(0, 8);
    if (!batch.length) break;
    for (const path of batch) seen.add(path);
    const bodies = await Promise.all(batch.map(async (path) => (await get(path)).body));
    queue = [...queue.filter((p) => !seen.has(p)), ...bodies.flatMap(imports)];
  }
  log(`The preview is warmed up (${seen.size} modules, ${seconds()} s after it was started).`);
  timed("preview warmed up", started);
  return seen.size;
}

/** The same-origin module paths a page or module imports, statically or lazily. */
function imports(code: string): string[] {
  const found = [
    ...code.matchAll(/<script[^>]*type="module"[^>]*src="(\/[^"]+)"/g),
    ...code.matchAll(/(?:\bimport|\bfrom)\s*\(?\s*["'](\/[^"'\s]+)["']/g),
  ].map((m) => m[1] as string);
  return [...new Set(found)].filter((p) => !p.startsWith("//"));
}
