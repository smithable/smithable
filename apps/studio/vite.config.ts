import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { vadAssets } from "../../scripts/vad-assets.mjs";

// The voice detector's files are fetched at run time, never bundled; Studio carries their hashes.
const vad = vadAssets();

// In development, `smithable studio` runs on 4321 and serves the API this app talks to. Studio
// takes changes only from its own page (the request's origin is the host it was sent to), so the
// proxy keeps this page's host instead of putting Studio's there, as the short form would.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // onnxruntime's build that leaves the WebAssembly file out (its default names it by URL, and
  // Vite would put 15 MB into Studio); src/speech/vad.ts hands it the checked file instead.
  resolve: {
    alias: [{ find: /^onnxruntime-web\/wasm$/, replacement: vad.ortWasmEntry }],
  },
  define: {
    __VAD__: JSON.stringify({
      version: vad.version,
      integrity: Object.fromEntries(
        Object.entries(vad.files).map(([name, file]) => [name, file.integrity]),
      ),
    }),
  },
  // Code mode and the tour load when first opened (App.tsx); React, YAML and Smithable's engine
  // are chunks of their own, each cached apart from Studio's own code (backlog A 64), so every
  // chunk stays under Vite's default warning.
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: "yaml", test: /node_modules[\\/]yaml[\\/]/ },
            { name: "engine", test: /packages[\\/](core|index)[\\/]/ },
          ],
        },
      },
    },
  },
  server: { proxy: { "/api": { target: "http://localhost:4321", changeOrigin: false } } },
});
