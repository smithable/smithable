/**
 * A stack profile: the exact, tested versions of everything a generated app depends on.
 * Security patches within a profile need no regeneration; new profiles arrive with Smithable releases.
 */
export const STACK_PROFILE = {
  id: "2026-09",
  packageManager: "pnpm@12.6.0",
  dependencies: {
    "@tailwindcss/vite": "4.3.3",
    "@tanstack/react-router": "1.170.39",
    "@tanstack/react-start": "1.168.58",
    "better-auth": "1.7.6",
    // 12.x ships prebuilt binaries; 13.x always compiles from source (needs Python and a C++ compiler).
    "better-sqlite3": "12.11.1",
    "class-variance-authority": "0.7.1",
    clsx: "2.1.1",
    "drizzle-orm": "0.45.3",
    "drizzle-zod": "0.8.3",
    "lucide-react": "1.48.0",
    react: "19.3.0",
    "react-dom": "19.3.0",
    srvx: "1.0.5",
    "tailwind-merge": "3.7.0",
    tailwindcss: "4.3.3",
    zod: "4.6.5",
  },
  /** Self-hosted fonts (OFL); an app gets the one its theme uses. */
  fonts: {
    "@fontsource-variable/inter": "5.3.0",
    "@fontsource-variable/nunito-sans": "5.3.0",
    "@fontsource-variable/source-sans-3": "5.3.0",
  },
  /**
   * Security fixes for dependencies of dependencies, kept in the project's pnpm-workspace.yaml
   * (pnpm reads overrides only there). Each names why.
   */
  overrides: {
    // Every esbuild in one patched version: drizzle-kit's @esbuild-kit loader pins 0.18
    // (GHSA-67mh-4wv8-2f99), and 0.25's binary is built with a Go affected by 22 advisories.
    // drizzle-kit stays in production images as an optional peer of better-auth.
    esbuild: "0.28.2",
  },
  /** Overrides earlier profiles set, which Smithable removes again. */
  retiredOverrides: ["@esbuild-kit/core-utils>esbuild"],
  devDependencies: {
    "@playwright/test": "1.63.0",
    "@tanstack/router-cli": "1.167.38",
    "@types/better-sqlite3": "9.6.0",
    "@types/node": "24.19.0",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.1.1",
    "drizzle-kit": "0.31.11",
    tsx: "4.23.15",
    typescript: "6.0.3",
    vite: "8.3.1",
    vitest: "5.0.2",
  },
} as const;
