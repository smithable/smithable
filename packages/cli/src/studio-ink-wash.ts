import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deserialize } from "node:v8";
import { Worker } from "node:worker_threads";
import { resolveLook } from "@smithable/core";
import type { InkWashWork, InkWashWorkResult } from "./ink-wash-worker.js";
import {
  type LibraryVersion,
  libraryVersion,
  type PictureRecords,
  type PlacedStyle,
  sha256,
} from "./picture-style.js";
import { projectRevision } from "./project-revision.js";
import { pictureHashes } from "./studio-picture-styles.js";
import { loadSpec } from "./validate.js";

export interface InkWashOffer {
  id: string;
  binding: string;
  project: string;
  revision: string;
  samples: { before: string; after: string; asDrawn: boolean }[];
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
  checkAfter?: number;
}

const libraryRefreshMs = 60_000;

/** One pending or ready offer per Studio host. All rendered files live outside the project. */
export class StudioInkWash {
  private current: Preparation | undefined;

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
    } else if (!this.current.pending && Date.now() >= (this.current.checkAfter ?? Infinity)) {
      this.current.pending = true;
      void this.prepare(dir, this.current);
    }
    const work = this.current;
    if (!work) return {};
    return work.pending ? { pending: true } : work.offer ? { offer: work.offer } : {};
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

  clear(id?: string) {
    const work = this.current;
    if (id !== undefined && work?.offer?.id !== id) return;
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
    delete work.folder;
    delete work.destination;
  }

  private async prepare(dir: string, work: Preparation) {
    try {
      const { ux, themes } = loadSpec(dir, { out: () => {}, err: () => {} });
      if (ux?.pictures?.style !== "ink-wash") return;
      const version = await libraryVersion(fetch);
      work.checkAfter = Date.now() + libraryRefreshMs;
      if (typeof version === "string" || this.current !== work) return;
      if (work.version?.version === version.version) return;
      this.remove(work);
      delete work.offer;
      delete work.version;
      const style = version.styles.find((entry) => entry.id === "ink-wash");
      if (!style || style.washHue === undefined) {
        work.version = version;
        return;
      }
      const { primary, foreground, background } = resolveLook(ux, themes).tokens.light;
      const colours = { primary, foreground, background };
      work.folder = mkdtempSync(join(tmpdir(), "smithable-ink-wash-"));
      work.destination = join(work.folder, "offer.bin");
      const workerData: InkWashWork = { dir, destination: work.destination, colours, version };
      const mirror = process.env.SMITHABLE_IMAGE_LIBRARY;
      // Run the built CLI worker in both the installed CLI and source-level tests.
      const worker = new Worker(new URL("../dist/ink-wash-worker.js", import.meta.url), {
        workerData,
        env: mirror === undefined ? {} : { SMITHABLE_IMAGE_LIBRARY: mirror },
        resourceLimits: { maxOldGenerationSizeMb: 256 },
      });
      work.worker = worker;
      const prepared = await new Promise<InkWashWorkResult>((done) => {
        const deadline = setTimeout(
          () => void worker.terminate().catch(() => done("failed")),
          60_000,
        );
        deadline.unref();
        const finish = (value: InkWashWorkResult) => {
          clearTimeout(deadline);
          done(value);
        };
        worker.once("message", (value: InkWashWorkResult) => finish(value));
        worker.once("error", () => finish("failed"));
        worker.once("exit", () => finish("failed"));
      });
      if (
        this.current !== work ||
        work.revision !== projectRevision(dir) ||
        work.hashes !== pictureHashes(dir)
      )
        return;
      if (prepared === "unchanged") {
        work.version = version;
        return;
      }
      if (prepared !== "ready") return;
      const placed = deserialize(readFileSync(work.destination)) as PlacedStyle;
      const binding = sha256(
        Buffer.from(JSON.stringify([dir, version.version, colours, placed.planned])),
      );
      const id = randomUUID();
      const record = placed.texts.find(({ path }) => path === "public/images/pictures.json");
      const records = JSON.parse(record?.text ?? "{}") as PictureRecords;
      const changed = new Map(
        placed.files.map(({ path }, index) => [path.slice("public/images/".length), index]),
      );
      const candidates = Object.keys(placed.planned).filter((file) => {
        const record = records[file];
        return (
          changed.has(file) ||
          (record?.version === version.version &&
            record.style === "ink-wash" &&
            record.fallback !== undefined &&
            record.sha256 === placed.planned[file] &&
            record.colours?.primary === primary &&
            record.colours.foreground === foreground &&
            record.colours.background === background)
        );
      });
      const samples = [...new Set([...candidates.slice(0, 1), ...changed.keys(), ...candidates])]
        .slice(0, 4)
        .map((file) => {
          const index = changed.get(file);
          const before = `/api/images/${file}?sha=${placed.planned[file]}`;
          return {
            before,
            after:
              index === undefined
                ? before
                : `/api/ink-wash/preview?${new URLSearchParams({ id, index: String(index) })}`,
            asDrawn: records[file]?.rule !== "ink-wash-b90",
          };
        });
      work.offer = { id, binding, project: work.project, revision: work.revision, samples };
      work.version = version;
    } catch {
      // The original pictures remain in place whenever preparation is unavailable.
    } finally {
      delete work.pending;
      if (!work.offer) this.remove(work);
    }
  }
}
