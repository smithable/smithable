import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  // The pages and the kit are compiled as the dev server starts, so the libraries they use are
  // found then. Otherwise the first visit to a page can find a new one: Vite optimizes it and
  // reloads, and a page loading at that moment fails ("Failed to fetch dynamically imported
  // module"), which a busy machine makes likely.
  server: { warmup: { clientFiles: ["./src/routes/**/*.tsx", "./src/kit/**/*.tsx"] } },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-router",
      "lucide-react",
      "clsx",
      "tailwind-merge",
      "class-variance-authority",
      "zod",
    ],
  },
});
