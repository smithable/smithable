import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  // The libraries every app uses, bundled for the browser as the dev server starts. Otherwise the
  // first visit to a page can find one: Vite optimizes it and reloads, and a page loading at that
  // moment fails ("Failed to fetch dynamically imported module"), which a busy machine makes likely.
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
