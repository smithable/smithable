import { type AuthIR, emptyContent, emptyUx, kebab, type SpecIR, type UxIR } from "@smithable/core";
import { accessTestSource } from "./access-test.js";
import { actionModule, actionRoute, actionStub, queryContract, queryStub } from "./actions.js";
import {
  authModule,
  hasSignIn,
  SIGN_IN_KIT,
  signInReadme,
  signInRoute,
  usersModule,
  viewerModule,
} from "./auth.js";
import { dataModule, modelModule } from "./data.js";
import { formulasModuleSource, formulasTestSource, hasFormulas } from "./formulas.js";
import { PAGE_GENERATORS, pageRoutes } from "./pages/index.js";
import { indexRoute, pagesModule, rootRoute } from "./pages/root.js";
import { schemaModule, seedModule } from "./schema.js";
import {
  type GenContext,
  type GeneratedFile,
  type GenerateOptions,
  HEADER,
  literal,
  type SectionGenerator,
  texts,
  userFields,
} from "./shared.js";
import { smokeTests } from "./smoke.js";
import { STACK_PROFILE } from "./stack.js";
import { TEMPLATES } from "./templates.gen.js";
import { FONT_PACKAGES, themeCss, themeFont } from "./themes.js";

const SCAFFOLD = new Set([
  "pnpm-workspace.yaml",
  ".gitignore",
  ".dockerignore",
  "CLAUDE.md",
  ".mcp.json",
]);

/** Generates a complete TanStack Start app from the IR. Pure and deterministic. */
export function generateApp(ir: SpecIR, options: GenerateOptions): GeneratedFile[] {
  const { auth } = options;
  const ux = options.ux ?? emptyUx();
  const t = texts(options.content ?? emptyContent());
  const files: GeneratedFile[] = Object.entries(TEMPLATES)
    .filter(([path]) => hasSignIn(auth) || !SIGN_IN_KIT.includes(path))
    .filter(([path]) => {
      // A pattern's kit files, only when a page uses the pattern.
      const owner = Object.entries(PAGE_GENERATORS).find(([, g]) => g.kit?.includes(path));
      return !owner || ir.pages.some((p) => p.pattern.kind === owner[0]);
    })
    .map(([path, content]) => ({
      path,
      content,
      zone: SCAFFOLD.has(path) ? "scaffold" : "kit",
    }));
  const add = (path: string, content: string) => files.push({ path, content, zone: "generated" });

  add("package.json", packageJson(ir, auth, ux, options.packages));
  add("src/theme.css", themeCss(ux));
  add("smithable.lock", smithableLock(ir, options));
  add("README.md", readme(ir, false, auth));
  add("public/favicon.svg", favicon(ir));
  add("src/generated/app.ts", appModule(ir));
  add("src/generated/pages.ts", pagesModule(ir, auth));
  add("src/lib/viewer.server.ts", viewerModule(auth));
  add("src/db/schema.ts", schemaModule(ir, auth));
  add("src/db/seed.ts", seedModule(ir));
  add("src/routes/__root.tsx", rootRoute(ir, t, auth, ux));
  add("tests/smoke.spec.ts", smokeTests(ir, t, auth));
  if (hasSignIn(auth)) {
    add("src/lib/auth.ts", authModule(auth));
    const onboarding = ir.pages.find((p) => p.pattern.kind === "onboarding");
    add("src/routes/sign-in.tsx", signInRoute(auth, onboarding?.route));
    if (
      ir.models.some((m) => userFields(m).length) ||
      ir.actions.some((a) => userFields(a.input).length)
    )
      add("src/generated/users.ts", usersModule());
  }
  if (!ir.pages.some((p) => p.route === "/")) add("src/routes/index.tsx", indexRoute(ir));
  if (ir.models.length) add("src/generated/access.test.ts", accessTestSource(ir, auth));
  const ctx: GenContext = { ir, t, auth, ux, options };
  for (const generator of SECTION_GENERATORS) files.push(...generator.files(ctx));
  // A plugin's own files, only in its folder: everything else is built from its expansion.
  for (const plugin of options.plugins ?? []) {
    const value = ir.extensions?.[plugin.key];
    if (value === undefined || !plugin.generate) continue;
    const folder = `src/generated/plugins/${plugin.key}/`;
    for (const file of plugin.generate(value, ir)) {
      if (!file.path.startsWith(folder) || file.path.includes(".."))
        throw new Error(
          `The ${plugin.key} plugin may only write files in ${folder}, not ${file.path}.`,
        );
      add(file.path, file.content);
    }
  }
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

function packageJson(
  ir: SpecIR,
  auth: AuthIR,
  ux: UxIR,
  packages: Record<string, string> = {},
): string {
  const fontPackage = FONT_PACKAGES[themeFont(ux)] as string;
  const { "better-auth": _, ...withoutAuth } = STACK_PROFILE.dependencies;
  const pkg = {
    name: kebab(ir.app.name.replace(/[^A-Za-z0-9 -]/g, "")) || "app",
    private: true,
    type: "module",
    packageManager: STACK_PROFILE.packageManager,
    imports: { "#/*": "./src/*" },
    scripts: {
      dev: "vite dev --port 3000",
      build: "vite build",
      start: "node server.mjs",
      typecheck: "tsc",
      test: "vitest run",
      "test:smoke": "playwright test",
      routes: "tsr generate",
      "db:generate": "drizzle-kit generate",
      "db:seed": "tsx src/db/seed.ts",
      "db:studio": "drizzle-kit studio",
    },
    dependencies: {
      ...(hasSignIn(auth) ? STACK_PROFILE.dependencies : withoutAuth),
      [fontPackage]: STACK_PROFILE.fonts[fontPackage as keyof typeof STACK_PROFILE.fonts],
      ...Object.fromEntries(
        Object.entries(packages).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      ),
    },
    devDependencies: STACK_PROFILE.devDependencies,
  };
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

function smithableLock(ir: SpecIR, options: GenerateOptions): string {
  const lock = {
    smithable: options.smithableVersion,
    spec: ir.specVersion,
    adapter: "tanstack",
    stackProfile: STACK_PROFILE.id,
  };
  return `${JSON.stringify(lock, null, 2)}\n`;
}

function appModule(ir: SpecIR): string {
  const app = {
    name: ir.app.name,
    currency: ir.app.currency ?? "EUR",
    ...(ir.app.timezone ? { timeZone: ir.app.timezone } : {}),
  };
  return `${HEADER}import type { AppUi } from "#/kit/model";

export const app: AppUi = ${literal(app)};
`;
}

/** A simple icon with the app's initial, in the theme's primary colour. */
function favicon(ir: SpecIR): string {
  const initial = (ir.app.name.match(/[A-Za-z0-9]/)?.[0] ?? "A").toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#3b5bdb"/>
  <text x="16" y="22" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="#fff">${initial}</text>
</svg>
`;
}

// ── README ───────────────────────────────────────────────────────────────────

/**
 * The app's README. After \`smithable detach\` the project is an ordinary one, and its README
 * says nothing about Smithable.
 */
export function readme(ir: SpecIR, detached = false, auth?: AuthIR): string {
  const name = kebab(ir.app.name) || "app";
  const origin = detached
    ? "A [TanStack Start](https://tanstack.com/start) app with [Drizzle](https://orm.drizzle.team) and SQLite."
    : "A [TanStack Start](https://tanstack.com/start) app with [Drizzle](https://orm.drizzle.team) and SQLite, generated by Smithable from `smithable.yml`.";
  const structure = detached
    ? `| Path | What it is |
|---|---|
| \`src/db/schema.ts\` | The database tables (Drizzle). After changing it, run \`pnpm db:generate\` for a migration |
| \`src/routes/\` | Pages and endpoints (TanStack Router file routes). \`pnpm routes\` updates the route tree |
| \`src/generated/\` | Per-model code: what forms and tables show, validation, server functions, formulas |
| \`src/kit/\`, \`src/components/ui/\` | Generic table, form, layout and UI components |
| \`src/custom/\` | Custom actions and other hand-written code |
| \`drizzle/\` | Database migrations, applied when the app starts |
`
    : `| Path | Owner | What it is |
|---|---|---|
| \`smithable.yml\` | You | What the app does. Smithable regenerates the code from it |
| \`src/generated/\`, \`src/db/schema.ts\`, \`src/db/seed.ts\`, generated routes | Smithable | Regenerated on every change. Files start with a "Generated by Smithable" comment |
| \`src/kit/\`, \`src/components/ui/\` | Smithable | Generic, readable building blocks, updated with Smithable. Copy one into \`src/custom/\` to change it |
| \`src/custom/\` | You | Your own code. Smithable never overwrites it |
| \`AGENTS.md\` | Smithable | How AI coding agents should work on the app: through Smithable's MCP tools |
| \`drizzle/\` | History | Database migrations. Never rewritten once created |

The app has no dependency on Smithable: it builds and runs with the ordinary tools above.
`;
  return `# ${ir.app.name}
${ir.app.description ? `\n${ir.app.description}\n` : ""}
${origin}

## Run it

\`\`\`sh
pnpm install
pnpm db:seed    # optional: sample data
pnpm dev        # http://localhost:3000
pnpm test       # tests
\`\`\`

Build and run a container (data is kept in the \`/data\` volume):

\`\`\`sh
docker build -t ${name} .
docker run -p 3000:3000 -v ${name}-data:/data ${name}
\`\`\`

${auth ? signInReadme(ir, auth) : ""}
## Project structure

${structure}`;
}

export { actionNames } from "./actions.js";
export { customPageFromEdit, customPageSource } from "./pages/custom.js";
export type { GeneratedFile, GenerateOptions, Zone } from "./shared.js";
export { dataKey, indexPath, join, names, storedFields, tableNames, texts } from "./shared.js";

const generated = (path: string, content: string): GeneratedFile => ({
  path,
  content,
  zone: "generated",
});
/** Created once; its code belongs to the project from then on. */
const custom = (path: string, content: string): GeneratedFile => ({
  path,
  content,
  zone: "custom",
});

/** Each part of the spec's files, in the order of the spec's sections. */
const SECTION_GENERATORS: SectionGenerator[] = [
  {
    key: "models",
    files: ({ ir, t, auth, ux }) =>
      ir.models.flatMap((model) => {
        const base = `src/generated/${kebab(model.name)}`;
        const test = hasFormulas(model) ? formulasTestSource(model) : undefined;
        return [
          generated(`${base}.ts`, modelModule(model, t, ir, auth, ux)),
          generated(`${base}.server.ts`, dataModule(model, t, ir, auth)),
          ...(hasFormulas(model)
            ? [generated(`${base}.formulas.ts`, formulasModuleSource(model, ir))]
            : []),
          ...(test ? [generated(`${base}.formulas.test.ts`, test)] : []),
        ];
      }),
  },
  {
    key: "actions",
    files: ({ ir, t, auth }) =>
      ir.actions.flatMap((action) => [
        generated(
          `src/generated/actions/${kebab(action.name)}.ts`,
          actionModule(action, ir, auth, t),
        ),
        custom(`src/custom/actions/${kebab(action.name)}.ts`, actionStub(action)),
      ]),
  },
  {
    key: "queries",
    files: ({ ir, t }) =>
      ir.queries.flatMap((query) => [
        generated(`src/generated/queries/${kebab(query.name)}.ts`, queryContract(query, ir, t)),
        custom(`src/custom/queries/${kebab(query.name)}.ts`, queryStub(query, ir, t)),
      ]),
  },
  {
    key: "pages",
    files: (ctx) =>
      ctx.ir.pages.flatMap((page) => {
        const dir = page.route === "/" ? "src/routes" : `src/routes${page.route}`;
        // A page's actions each get a route; the rest depends on its pattern.
        const actions = (page.actions ?? []).flatMap((name) => {
          const action = ctx.ir.actions.find((a) => a.name === name);
          return action
            ? [
                generated(
                  `${dir}/actions/${kebab(name)}.tsx`,
                  actionRoute(page, action, ctx.ir, ctx.t),
                ),
              ]
            : [];
        });
        const routes = Object.entries(pageRoutes(page, ctx)).map(([file, content]) =>
          generated(`${dir}/${file}`, content),
        );
        return [...actions, ...routes];
      }),
  },
];
