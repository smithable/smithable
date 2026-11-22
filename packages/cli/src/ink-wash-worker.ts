import { writeFile } from "node:fs/promises";
import { serialize } from "node:v8";
import { parentPort, workerData } from "node:worker_threads";
import type { InkWashColours } from "./ink-wash-raster.js";
import { type LibraryVersion, placeStyle } from "./picture-style.js";

export interface InkWashWork {
  dir: string;
  destination: string;
  version: LibraryVersion;
  colours: InkWashColours;
}

const work = workerData as InkWashWork;
const placed = await placeStyle(work.dir, "ink-wash", fetch, work.version, work.colours);
if (typeof placed === "string" || !placed.files.length) {
  parentPort?.postMessage(false);
} else {
  const data = serialize(placed);
  if (data.byteLength > 32 * 1024 * 1024) parentPort?.postMessage(false);
  else {
    await writeFile(work.destination, data, { flag: "wx", mode: 0o600 });
    parentPort?.postMessage(true);
  }
}
