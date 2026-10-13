import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development, `smithable theme lab` runs on 4330 and serves the API this app talks to; the
// proxy keeps this page's host, since the lab saves only from its own page. React, YAML and the
// engine are chunks of their own, as in Studio, so each stays under Vite's warning.
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: "yaml", test: /node_modules[\\/]yaml[\\/]/ },
            { name: "engine", test: /packages[\\/](core|adapter-tanstack)[\\/]/ },
          ],
        },
      },
    },
  },
  server: { proxy: { "/api": { target: "http://localhost:4330", changeOrigin: false } } },
});
