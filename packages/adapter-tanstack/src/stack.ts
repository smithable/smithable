/**
 * A stack profile: the exact, tested versions of everything a generated app depends on.
 * Security patches within a profile need no regeneration; new profiles arrive with Smithable releases.
 */
export const STACK_PROFILE = {
  id: "2026-09",
  packageManager: "pnpm@12.6.0",
  dependencies: {
    "@tailwindcss/vite": "4.3.3",
    "@tanstack/react-router": "1.170.46",
    "@tanstack/react-start": "1.169.4",
    "better-auth": "1.7.13",
    // 12.x ships prebuilt binaries; 13.x always compiles from source (needs Python and a C++ compiler).
    "better-sqlite3": "12.11.1",
    "class-variance-authority": "0.7.1",
    clsx: "2.1.1",
    "drizzle-orm": "0.45.4",
    "drizzle-zod": "0.8.3",
    "lucide-react": "1.48.0",
    nodemailer: "10.1.7",
    react: "19.3.1",
    "react-dom": "19.3.1",
    srvx: "1.0.7",
    "tailwind-merge": "3.7.0",
    tailwindcss: "4.3.3",
    zod: "4.6.7",
  },
  /** For Markdown fields (MIT). In every app, like the fonts: see packageJson in generate.ts. */
  markdown: { "react-markdown": "10.1.0" },
  /**
   * Self-hosted fonts, every one under the SIL Open Font License 1.1 (OFL-1.1): every app has
   * the twenty, and imports the ones its theme uses (body, headings and labels).
   */
  fonts: {
    "@fontsource-variable/inter": "5.3.0", // OFL-1.1, Rasmus Andersson
    "@fontsource-variable/nunito-sans": "5.3.0", // OFL-1.1, Vernon Adams, Jacques Le Bailly
    "@fontsource-variable/source-sans-3": "5.3.1", // OFL-1.1, Adobe
    "@fontsource-variable/source-serif-4": "5.3.1", // OFL-1.1, Adobe
    "@fontsource-variable/fraunces": "5.3.0", // OFL-1.1, Undercase Type
    "@fontsource-variable/archivo-narrow": "5.3.0", // OFL-1.1, Omnibus-Type
    "@fontsource-variable/dm-sans": "5.3.0", // OFL-1.1, Colophon Foundry
    "@fontsource-variable/outfit": "5.3.0", // OFL-1.1, Rodrigo Fuenzalida
    "@fontsource-variable/hanken-grotesk": "5.3.0", // OFL-1.1, Hanken Design Co.
    "@fontsource-variable/instrument-sans": "5.3.0", // OFL-1.1, Rodrigo Fuenzalida, Jordan Egstad
    "@fontsource-variable/mona-sans": "5.3.0", // OFL-1.1, GitHub, Degarism
    "@fontsource-variable/bricolage-grotesque": "5.3.0", // OFL-1.1, Mathieu Triay
    "@fontsource-variable/oswald": "5.3.0", // OFL-1.1, Vernon Adams, Kalapi Gajjar, Cyreal
    "@fontsource-variable/big-shoulders-display": "5.3.0", // OFL-1.1, Patric King
    "@fontsource/instrument-serif": "5.3.0", // OFL-1.1, Rodrigo Fuenzalida, Jordan Egstad
    "@fontsource/young-serif": "5.3.0", // OFL-1.1, Bastien Sozeau, uplaod.fr
    "@fontsource-variable/newsreader": "5.3.0", // OFL-1.1, Production Type
    "@fontsource-variable/bodoni-moda": "5.3.0", // OFL-1.1, indestructible type*
    "@fontsource/zilla-slab": "5.3.0", // OFL-1.1, Typotheque, Mozilla
    "@fontsource-variable/jetbrains-mono": "5.3.0", // OFL-1.1, JetBrains, Philipp Nurullin, Konstantin Bulenkov
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
  /**
   * Advisories that name a pinned version and do not reach a generated app, each with why.
   * `smithable security` and scripts/stack-advisories.mjs show them at every run and do not
   * fail for them. An advisory with a fixed version is never listed here: the pin moves.
   */
  advisories: {
    // In 1.6.14 and later by the library's own choice, so no version fixes it.
    "GHSA-fmh4-wcc4-5jm3":
      "it is in Better Auth's organization plugin, which a generated app does not use",
  } as Record<string, string>,
  /** Overrides earlier profiles set, which Smithable removes again. */
  retiredOverrides: ["@esbuild-kit/core-utils>esbuild"],
  devDependencies: {
    "@playwright/test": "1.63.0",
    "@tanstack/router-cli": "1.167.46",
    "@types/better-sqlite3": "9.6.0",
    "@types/nodemailer": "8.0.2",
    "@types/node": "24.19.2",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.1.2",
    "drizzle-kit": "0.31.11",
    tsx: "4.23.15",
    typescript: "6.0.3",
    vite: "8.3.5",
    vitest: "5.0.5",
  },
} as const;
