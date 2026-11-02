import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { lookGeneration } from "./look-generation.js";
import { lookPreviewHandler } from "./look-preview.js";
import { mintLookTicket } from "./look-ticket.js";

test("real preview verification HTTP consumes a ticket once, requires its own origin, and refuses a restarted or changed generation", async () => {
  const dir = mkdtempSync(join(tmpdir(), "smithable-look-preview-"));
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "smithable.yml"), "smithable: 0.1\napp: {name: Example}\n");
  writeFileSync(join(dir, "src/styles.css"), ":root{--radius:4px}");
  const key = "separate-presentation-key",
    boot = "preview-boot-one";
  const config = {
    project: "project-one",
    parentOrigins: ["https://studio.example.test"],
    previewOrigin: "https://preview.example.test",
  };
  const handler = lookPreviewHandler(config, dir, boot, key);
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing listener");
  const url = `http://127.0.0.1:${address.port}`;
  const generation = lookGeneration(dir, boot);
  const facts = {
    project: config.project,
    parentOrigin: config.parentOrigins[0] as string,
    document: "document-one",
    generation,
  };
  const post = (ticket: string, origin = config.previewOrigin, claimed = generation) =>
    fetch(`${url}/verify`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ ticket, document: facts.document, generation: claimed }),
    });
  try {
    const ready = await fetch(`${url}/generation`).then((r) => r.json());
    expect(ready).toEqual({ project: config.project, generation });
    const minted = mintLookTicket(key, facts);
    expect((await post(minted.ticket, "https://sibling.example.test")).status).toBe(403);
    const accepted = await post(minted.ticket);
    expect(accepted.status).toBe(200);
    const binding = (await accepted.json()) as { session: string; ttl: number };
    expect(binding.session).toBe(minted.binding.session);
    expect(binding.ttl).toBeGreaterThan(0);
    expect(binding.ttl).toBeLessThanOrEqual(120000);
    expect((await post(minted.ticket)).status).toBe(403);
    for (const change of [
      { project: "project-other" },
      { parentOrigin: "https://sibling.example.test" },
      { document: "document-other" },
      { generation: lookGeneration(dir, "new-boot") },
    ]) {
      expect((await post(mintLookTicket(key, { ...facts, ...change }).ticket)).status).toBe(403);
    }
    writeFileSync(join(dir, "src/styles.css"), ":root{--radius:8px}");
    expect((await post(mintLookTicket(key, facts).ticket)).status).toBe(403);
    expect(lookGeneration(dir, boot)).not.toBe(generation);
    expect(
      (
        await fetch(`${url}/verify`, {
          method: "POST",
          headers: { origin: config.previewOrigin },
          body: "x".repeat(8193),
        })
      ).status,
    ).toBe(413);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    rmSync(dir, { recursive: true, force: true });
  }
});
