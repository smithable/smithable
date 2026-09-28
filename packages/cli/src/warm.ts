/**
 * Loads the preview's start page and its module graph once, as a browser would, including the
 * routes it loads lazily. The dev server then discovers and optimizes every dependency before
 * the first real visit; when that happens during a visit instead, the page reloads, and a
 * module being loaded at that moment can fail (seen in the sandboxed hosted previews).
 * Returns how many modules were loaded.
 */
export async function warmPreview(port: number, log: (text: string) => void): Promise<number> {
  const base = `http://127.0.0.1:${port}`;
  const get = async (path: string) => {
    try {
      const answer = await fetch(`${base}${path}`, { redirect: "manual" });
      return {
        status: answer.status,
        location: answer.headers.get("location"),
        body: await answer.text(),
      };
    } catch {
      return { status: 0, location: null, body: "" };
    }
  };
  for (let i = 0; i < 240 && (await get("/health")).status !== 200; i++)
    await new Promise((r) => setTimeout(r, 500));
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
  log(`The preview is warmed up (${seen.size} modules).`);
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
