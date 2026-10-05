import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development, `smithable studio` runs on 4321 and serves the API this app talks to. Studio
// takes changes only from its own page (the request's origin is the host it was sent to), so the
// proxy keeps this page's host instead of putting Studio's there, as the short form would.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { "/api": { target: "http://localhost:4321", changeOrigin: false } } },
});
