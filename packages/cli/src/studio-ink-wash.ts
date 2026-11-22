import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deserialize } from "node:v8";
import { Worker } from "node:worker_threads";
import { resolveLook } from "@smithable/core";
import type { InkWashWork } from "./ink-wash-worker.js";
import { type LibraryVersion, libraryVersion, type PlacedStyle, sha256 } from "./picture-style.js";
import type { Fetch } from "./pictures.js";
import { projectRevision } from "./project-revision.js";
import { pictureHashes } from "./studio-picture-styles.js";
import { loadSpec } from "./validate.js";

export interface InkWashOffer {
  id: string;
  binding: string;
  project: string;
  revision: string;
  samples: { before: string; after: string }[];
}

interface Preparation {
  project: string;
  revision: string;
  hashes: string;
  worker?: Worker;
  folder?: string;
  destination?: string;
  version?: LibraryVersion;
  offer?: InkWashOffer;
  pending?: true;
}

/** One pending or ready offer per Studio host. All rendered files live outside the project. */
export class StudioInkWash {
  private current: Preparation | undefined;

  constructor(private readonly fetchFn: Fetch = fetch) {}

  get(dir: string, project: string, revision: string): { offer?: InkWashOffer; pending?: true } {
    const hashes = pictureHashes(dir);
    if (
      this.current?.project !== project ||
      this.current.revision !== revision ||
      this.current.hashes !== hashes
    ) {
      this.clear();
      const work: Preparation = { project, revision, hashes, pending: true };
      this.current = work;
      void this.prepare(dir, work);
    }
    const work = this.current;
    if (!work) return {};
    return work.offer ? { offer: work.offer } : work.pending ? { pending: true } : {};
  }

  read(dir: string, project: string, id: string) {
    const work = this.current;
    if (
      !work?.destination ||
      !work.version ||
      work.offer?.id !== id ||
      work.project !== project ||
      work.revision !== projectRevision(dir) ||
      work.hashes !== pictureHashes(dir)
    )
      return undefined;
    return {
      placement: deserialize(readFileSync(work.destination)) as PlacedStyle,
      revision: work.revision,
      version: work.version,
    };
  }

  clear() {
    const work = this.current;
    this.current = undefined;
    if (work?.worker) {
      void work.worker
        .terminate()
        .catch(() => undefined)
        .then(() => this.remove(work));
    } else if (work) this.remove(work);
  }

  private remove(work: Preparation) {
    if (work.folder) rmSync(work.folder, { recursive: true, force: true });
  }

  private async prepare(dir: string, work: Preparation) {
    try {
      const { ux, themes } = loadSpec(dir, { out: () => {}, err: () => {} });
      if (ux?.pictures?.style !== "ink-wash") return;
      const version = await libraryVersion(this.fetchFn);
      if (typeof version === "string" || this.current !== work) return;
      const style = version.styles.find((entry) => entry.id === "ink-wash");
      if (!style || style.washHue === undefined) return;
      const { primary, foreground, background } = resolveLook(ux, themes).tokens.light;
      const colours = { primary, foreground, background };
      work.folder = mkdtempSync(join(tmpdir(), "smithable-ink-wash-"));
      work.destination = join(work.folder, "offer.bin");
      work.version = version;
      const workerData: InkWashWork = { dir, destination: work.destination, colours, version };
      const mirror = process.env.SMITHABLE_IMAGE_LIBRARY;
      const worker = new Worker(new URL("../dist/ink-wash-worker.js", import.meta.url), {
        workerData,
        env: mirror === undefined ? {} : { SMITHABLE_IMAGE_LIBRARY: mirror },
        resourceLimits: { maxOldGenerationSizeMb: 256 },
      });
      work.worker = worker;
      const prepared = await new Promise<boolean>((done) => {
        const deadline = setTimeout(() => void worker.terminate().catch(() => done(false)), 60_000);
        deadline.unref();
        const finish = (value: boolean) => {
          clearTimeout(deadline);
          done(value);
        };
        worker.once("message", (value: unknown) => finish(value === true));
        worker.once("error", () => finish(false));
        worker.once("exit", () => finish(false));
      });
      if (
        !prepared ||
        this.current !== work ||
        work.revision !== projectRevision(dir) ||
        work.hashes !== pictureHashes(dir)
      )
        return;
      const placed = deserialize(readFileSync(work.destination)) as PlacedStyle;
      const binding = sha256(
        Buffer.from(JSON.stringify([dir, version.version, colours, placed.planned])),
      );
      const id = randomUUID();
      const samples = placed.files.slice(0, 4).map(({ path }, index) => ({
        before: `/api/images/${path.slice("public/images/".length)}`,
        after: `/api/ink-wash/preview?${new URLSearchParams({ id, index: String(index) })}`,
      }));
      work.offer = { id, binding, project: work.project, revision: work.revision, samples };
    } catch {
      // The original pictures remain in place whenever preparation is unavailable.
    } finally {
      delete work.pending;
      if (!work.offer) this.remove(work);
    }
  }
}
