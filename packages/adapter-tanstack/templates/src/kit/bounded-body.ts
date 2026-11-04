// Smithable app kit: bound request bytes while reading, including chunked bodies. Callers
// choose their own limit and response words. Never trust Content-Length as the actual size.
export class BodyLimit extends Error {}

/** Unknown length reserves the maximum. Malformed declarations never reserve zero. */
export function bodySize(request: Request, maximum: number): number {
  if (!Number.isSafeInteger(maximum) || maximum < 0) throw new BodyLimit();
  const header = request.headers.get("content-length");
  if (header === null) return maximum;
  if (!/^\d+$/.test(header)) throw new BodyLimit();
  const size = Number(header);
  if (!Number.isSafeInteger(size) || size > maximum) throw new BodyLimit();
  return size;
}

/** At most the declared size or maximum, with a total read deadline and cancellation. */
export async function boundedBody(
  request: Request,
  maximum: number,
  milliseconds = 30_000,
): Promise<Uint8Array> {
  const limit = bodySize(request, maximum);
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort = () => {};
  const failed = new Promise<never>((_, reject) => {
    abort = () => reject(new BodyLimit());
    timer = setTimeout(abort, milliseconds);
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) abort();
  });
  let complete = false;
  try {
    let bytes = new Uint8Array(0);
    let length = 0;
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), failed]);
      if (done) break;
      if (value.byteLength > limit - length) throw new BodyLimit();
      if (length + value.byteLength > bytes.length) {
        const grown = new Uint8Array(
          Math.min(limit, Math.max(length + value.byteLength, 65536, bytes.length * 2)),
        );
        grown.set(bytes);
        bytes = grown;
      }
      bytes.set(value, length);
      length += value.byteLength;
    }
    complete = true;
    return length === bytes.length ? bytes : bytes.slice(0, length);
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
    if (!complete) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
