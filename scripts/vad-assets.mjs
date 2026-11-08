// The voice detector's large files (docs/design/smith-speech.md §4.2): the WebAssembly runtime
// and Silero's model. They are not in Studio's bundle: the site publishes them under
// docs.smithable.ai/vad/<version>/ (scripts/build-docs.mjs), a hosted Studio serves the same files
// itself, and Studio fetches them only when automatic mode starts, checked against the hashes
// here, which Vite puts into Studio's build. Both read node_modules, so the hashes match the files.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const require = createRequire(resolve(import.meta.dirname, "../apps/studio/package.json"));
// Each package's folder, from a file it exports (neither exports its package.json).
const ORT = join(dirname(require.resolve("onnxruntime-web/ort-wasm-simd-threaded.wasm")), "..");
const VAD = join(dirname(require.resolve("@ricky0123/vad-web")), "..");
const version = (dir) => JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version;

/** The files by name, with where they are and their integrity (SRI), and the folder's version. */
export function vadAssets() {
  const files = {
    "ort-wasm-simd-threaded.wasm": join(ORT, "dist", "ort-wasm-simd-threaded.wasm"),
    "silero_vad_v5.onnx": join(VAD, "dist", "silero_vad_v5.onnx"),
  };
  return {
    /** onnxruntime's JavaScript without the WebAssembly file, for Studio's bundle. */
    ortWasmEntry: join(ORT, "dist", "ort.wasm.min.mjs"),
    version: `${version(ORT)}-${version(VAD)}`,
    files: Object.fromEntries(
      Object.entries(files).map(([name, path]) => [
        name,
        {
          path,
          integrity: `sha384-${createHash("sha384").update(readFileSync(path)).digest("base64")}`,
        },
      ]),
    ),
  };
}
