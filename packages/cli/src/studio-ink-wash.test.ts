import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { sha256 } from "./picture-style.js";
import { projectRevision } from "./project-revision.js";
import { StudioInkWash } from "./studio-ink-wash.js";
import { tempDir } from "./test-dir.js";

test("Studio prepares its offer outside the project and invalidates it after a picture edit", async () => {
  const drawing = Buffer.from(
    "UklGRlAAAABXRUJQVlA4TEQAAAAvCcABEB8gECByREsSY0dAQrwx2U85ICQgTpnsnAmagKDg/+jiA2SfgoI2kpS7Z351a3JNPoqI6H8CHvBrzbWmfGQhCw==",
    "base64",
  );
  const digest = sha256(drawing);
  const dir = tempDir("ink-wash-offer-");
  const images = join(dir, "public", "images");
  mkdirSync(images, { recursive: true });
  const hero = join(images, "hero.webp");
  writeFileSync(hero, drawing);
  writeFileSync(
    join(dir, "smithable.yml"),
    "smithable: 0.1\napp: { name: Notes }\nmodels: { Note: { fields: { text: string } } }\n",
  );
  writeFileSync(join(dir, "smithable.auth.yml"), "smithableAuth: 0.1\nsignIn: none\n");
  writeFileSync(
    join(dir, "smithable.ux.yml"),
    "smithableUx: 0.1\npictures: { style: ink-wash }\ntheme: { preset: sage-garden }\n",
  );
  const server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/images/latest.json")
      return res.end(JSON.stringify({ version: "v1", index: "versions/v1.json" }));
    if (req.url === "/images/versions/v1.json")
      return res.end(
        JSON.stringify({
          version: "v1",
          styles: [{ id: "ink-wash", generated: true, words: {}, washHue: 300 }],
          entries: [
            {
              id: "ink-hero",
              subject: "hero",
              kind: "hero",
              generated: true,
              style: "ink-wash",
              alt: "Drawing",
              sha256: digest,
              url: `https://docs.smithable.ai/images/files/${digest}.webp`,
            },
          ],
        }),
      );
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const port = (server.address() as AddressInfo).port;
  vi.stubEnv("SMITHABLE_IMAGE_LIBRARY", `http://127.0.0.1:${port}/images`);
  const offers = new StudioInkWash();
  try {
    const revision = projectRevision(dir);
    expect(offers.get(dir, "project", revision)).toEqual({ pending: true });
    const offer = await vi.waitFor(
      () => {
        const answer = offers.get(dir, "project", revision).offer;
        if (!answer) throw new Error("The worker has not prepared the drawing yet");
        return answer;
      },
      { timeout: 8000 },
    );
    const staged = offers.read(dir, "project", offer.id);
    expect(staged?.placement.files).toHaveLength(1);
    expect(staged?.placement.files[0]?.path).toBe("public/images/hero.webp");
    expect(sha256(readFileSync(hero))).toBe(digest);
    expect(offers.read(dir, "other-project", offer.id)).toBeUndefined();
    writeFileSync(hero, "The owner's new drawing");
    expect(offers.read(dir, "project", offer.id)).toBeUndefined();
  } finally {
    offers.clear();
    vi.unstubAllEnvs();
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }
});
