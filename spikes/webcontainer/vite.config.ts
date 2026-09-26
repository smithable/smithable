import { defineConfig } from "vite";

// WebContainers need SharedArrayBuffer, which needs a cross-origin isolated page.
export default defineConfig({
  server: {
    port: 4800,
    strictPort: true,
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
});
