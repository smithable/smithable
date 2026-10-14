import {
  type AuthIR,
  emptyContent,
  emptyUx,
  isUpload,
  kebab,
  type SpecIR,
  storesFiles,
} from "@smithable/core";
import { accessTestSource } from "./access-test.js";
import {
  actionInputModule,
  actionModule,
  actionRoute,
  actionStub,
  queryContract,
  queryStub,
  standardActionModule,
  standardActionServer,
} from "./actions.js";
import { apiModule, apiRoutes, askModule, mcpModule, mcpRoute } from "./api.js";
import {
  authModule,
  hasInvitations,
  hasSignIn,
  SIGN_IN_KIT,
  signInReadme,
  signInRoute,
  usersModule,
  viewerModule,
} from "./auth.js";
import { calculatorFiles } from "./calculators.js";
import { dataModule, isMarkdown, modelModule, modelSchemaModule, trashModule } from "./data.js";
import { formulasModuleSource, formulasTestSource, hasFormulas } from "./formulas.js";
import { hooksModule, hooksStub } from "./hooks.js";
import { incomingRoute, incomingStub } from "./incoming.js";
import { hasKeys, keysModule, keysTestSource } from "./keys.js";
import { outgoingModule, outgoingOf } from "./outgoing.js";
import { publicArticles } from "./pages/articles.js";
import { CUSTOM_PROPS, customPageStub, customSectionStub } from "./pages/custom.js";
import { hasInspector } from "./pages/data.js";
import { PAGE_GENERATORS, pageRoutes } from "./pages/index.js";
import { siteModule } from "./pages/landing.js";
import { indexRoute, pagesModule, robotsRoute, rootRoute, sitemapRoute } from "./pages/root.js";
import { reviewed, reviewRolesModule, reviewServerModule } from "./review.js";
import { schemaModule, seedModule } from "./schema.js";
import {
  dataKey,
  type GenContext,
  type GeneratedFile,
  type GenerateOptions,
  HEADER,
  literal,
  names,
  type SectionGenerator,
  standardActions,
  type Texts,
  texts,
  userFields,
} from "./shared.js";
import { smokeTests } from "./smoke.js";
import { STACK_PROFILE } from "./stack.js";
import { TEMPLATES } from "./templates.gen.js";
import { themeCss } from "./themes.js";
import { usersReadme, usersServerModule, usersTestSource } from "./users.js";

const SCAFFOLD = new Set([
  "pnpm-workspace.yaml",
  ".gitignore",
  ".dockerignore",
  "CLAUDE.md",
  ".mcp.json",
]);

/** The kit's words, one file per language (docs/design/language.md). */
const WORDS_DIR = "src/kit/words/";
const WORDS_FILE = "src/kit/words.ts";

const WORDS_IMPORT = 'import { w } from "#/kit/words";\n';
/**
 * A generated file imports the words where it says one; a module whose fields have no message
 * to give (no required text, no email) would import them unused, which the app's type check
 * refuses.
 */
function wordsIfUsed(content: string): string {
  if (!content.includes(WORDS_IMPORT)) return content;
  return /\bw\./.test(content.replace(WORDS_IMPORT, ""))
    ? content
    : content.replace(WORDS_IMPORT, "");
}

/** Generates a complete TanStack Start app from the IR. Pure and deterministic. */
export function generateApp(ir: SpecIR, options: GenerateOptions): GeneratedFile[] {
  const ctx: GenContext = {
    ir,
    t: texts(options.content ?? emptyContent(), ir.app.name),
    auth: options.auth,
    ux: options.ux ?? emptyUx(),
    options,
  };
  const kits = SECTION_GENERATORS.flatMap((g) => g.kit ?? []);
  // The kit: every file, but a part's own only when the app uses that part, and of the words
  // (src/kit/words/<language>.ts) only the app's language, as src/kit/words.ts.
  const files: GeneratedFile[] = Object.entries(TEMPLATES)
    .filter(([path]) => !path.startsWith(WORDS_DIR) && path !== WORDS_FILE)
    .filter(([path]) => kits.every((k) => !k.files.includes(path) || k.used(ctx)))
    .map(([path, content]) => ({
      path,
      content,
      zone: SCAFFOLD.has(path) ? "scaffold" : "kit",
    }));
  const language = ctx.options.content?.language ?? "en";
  const words = TEMPLATES[`${WORDS_DIR}${language}.ts`];
  if (!words) throw new Error(`The kit has no words for the language "${language}".`);
  // Another language's file is checked against English in the kit (`satisfies Words`); the app
  // has no English beside it, so it stands on its own there.
  const own = words
    .replace(/^import type \{ Words \} from "\.\/en";\n\n?/m, "")
    .replace(/\} satisfies Words;\n$/, "};\n\nexport type Words = typeof w;\n");
  files.push({ path: WORDS_FILE, content: own, zone: "kit" });
  for (const generator of SECTION_GENERATORS)
    files.push(...generator.files(ctx).map((f) => ({ ...f, content: wordsIfUsed(f.content) })));
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** Whether a model has a Markdown field (an action's input is a plain text box). */
const hasMarkdown = (ir: SpecIR) => ir.models.some((m) => m.fields.some(isMarkdown));
const hasUploads = (ir: SpecIR) => ir.models.some((m) => m.fields.some(isUpload));

/**
 * src/generated/uploads.ts: each picture and document field by the model's and the field's
 * names in an address, with its kind and the data function and access the file routes check
 * through.
 */
function uploadsModule(ir: SpecIR, t: Texts): string {
  const models = ir.models.filter((m) => m.fields.some(isUpload));
  const entries = models.map((model) => {
    const n = names(model, t);
    const fields = model.fields
      .filter(isUpload)
      .map(
        (f) =>
          `    ${JSON.stringify(f.name)}: { kind: "${storesFiles(f) ? "file" : "picture"}", data: ${n.data}, access: ${n.access}, key: ${JSON.stringify(dataKey(f))} },`,
      );
    return `  ${JSON.stringify(kebab(model.name))}: {\n${fields.join("\n")}\n  },`;
  });
  return `${HEADER}// The records' pictures and documents: which data function and access each one goes through (src/routes/files/).
import type { ModelAccess, Viewer } from "#/kit/access";
${models.map((m) => `import { ${names(m, t).access}, ${names(m, t).data} } from "./${kebab(m.name)}.server";`).join("\n")}

export interface UploadField {
  kind: "picture" | "file";
  data: { get(viewer: Viewer | null, id: number): Promise<unknown>; uses(file: string): boolean };
  access: ModelAccess;
  /** The field's key in a record. */
  key: string;
}

export const UPLOADS: Record<string, Record<string, UploadField>> = {
${entries.join("\n")}
};
`;
}

function packageJson(ir: SpecIR, packages: Record<string, string> = {}): string {
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
    // The same for every app of a stack profile, whatever the app uses (sign-in, a Markdown
    // field, its theme's font): a change to the app then never changes what must be installed,
    // so nothing has to be fetched for it (a hosted workspace has no way to). What an app does
    // not import is not in its build. Only the owner's own packages (setPackage) differ.
    dependencies: Object.fromEntries(
      Object.entries({
        ...STACK_PROFILE.dependencies,
        ...STACK_PROFILE.fonts,
        ...STACK_PROFILE.markdown,
        ...packages,
      }).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ),
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

/** A simple icon with the app's initial, in the theme's primary color. */
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
| \`src/custom/\` | Custom actions, queries and pages, and \`hooks.ts\`: what happens after records change, and once a day |
| \`drizzle/\` | Database migrations, applied when the app starts |
`
    : `| Path | Owner | What it is |
|---|---|---|
| \`smithable.yml\` | You | What the app does. Smithable regenerates the code from it |
| \`src/generated/\`, \`src/db/schema.ts\`, \`src/db/seed.ts\`, generated routes | Smithable | Regenerated on every change. Files start with a "Generated by Smithable" comment |
| \`src/kit/\`, \`src/components/ui/\` | Smithable | Generic, readable building blocks, updated with Smithable. Copy one into \`src/custom/\` to change it |
| \`src/custom/\` | You | Your own code: actions, queries, custom pages, and \`hooks.ts\` (what happens after records change, and once a day). Smithable never overwrites it |
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

${auth ? signInReadme(ir, auth) : ""}${auth && hasInvitations(ir, auth) ? usersReadme(ir, auth, detached) : ""}${mailReadme()}${limitsReadme(ir, auth)}${stylesReadme()}${licensesReadme()}
## Project structure

${structure}`;
}

/** What the app owner may do with the app, and the notices it carries, for the README. */
function licensesReadme(): string {
  return `## Licenses

The app's code is yours: the app kit (\`src/kit/\`) comes under the Zero-Clause BSD license, which asks nothing of you, and the generated code carries no license of its own. The components in \`src/components/ui/\` are shadcn/ui's (MIT); their notice is in \`LICENSES/shadcn-ui.txt\` and travels with the container image. Libraries from npm keep their own licenses in \`node_modules/\`.

`;
}

/** How often one may write, for the README. */
function limitsReadme(ir: SpecIR, auth?: AuthIR): string {
  if (!ir.models.length) return "";
  const signIn = auth && hasSignIn(auth);
  return `## Limits

${signIn ? "A signed-in person may make 60 changes a minute, a visitor 10 a minute per address" : "A visitor may make 10 changes a minute per address"}${signIn && hasInvitations(ir, auth) ? ", and an administrator may send 20 invitations an hour" : ""}; beyond that a change is refused with "Too many changes in a short time" until the minute is over. The numbers are in \`src/kit/limit.ts\` (\`LIMITS\`), counted in memory by the running process${signIn ? "; sign-in attempts are limited by Better Auth itself (3 per 10 seconds)" : ""}. Behind a proxy that sets \`X-Forwarded-For\`, the address is the one the proxy saw. A request may carry at most 1 MB (a picture's limit too), said by its \`Content-Length\`: more is refused with 413, and a body without a length with 411 (\`MAX_BODY\` in \`server.mjs\`).

`;
}

/** The hooks custom styles may rely on, for the README (docs/design/look.md §2). */
function stylesReadme(): string {
  return `## Custom styles

Your own CSS goes in \`src/custom/styles.css\`, which is never overwritten and wins over the kit's styles. Rely on these attributes, not on class names or the order of elements; they name what a part is, and a value is removed only in a major version:

| Attribute | On | Values |
|---|---|---|
| \`data-page\` | \`<body>\` | the page's name in the spec, e.g. \`customers\`, \`home\` |
| \`data-kit\` | a kit component's root | \`app-shell\`, \`nav\`, \`model-table\`, \`model-form\`, \`field\`, \`search-box\`, \`dashboard\`, \`tile\`, \`calendar\`, \`reserve\`, \`landing\`, \`section\`, \`users\`, \`sign-in\`, \`onboarding\` |
| \`data-part\` | inside a component | \`header\`, \`title\`, \`actions\`, \`row\`, \`cell\`, \`label\`, \`input\`, \`help\`, \`error\`, \`empty\`, \`footer\` |
| \`data-field\` | a field's wrapper, input and table cells | the field's name |
| \`data-section\` | a landing section | its name, e.g. \`hero\` |
| \`data-tone\` | a badge | \`neutral\`, \`success\`, \`warning\`, \`danger\` |

For example \`[data-kit="model-form"] [data-part="actions"] { justify-content: flex-start; }\`. The theme's colors are CSS variables (\`var(--primary)\`, see \`src/theme.css\`), and Tailwind's \`@apply\` works in the file too.

`;
}

/** How the app sends mail, for the README. */
function mailReadme(): string {
  return `## Mail

Hooks (\`src/custom/hooks.ts\`) and custom code send mail with \`sendMail\` from \`src/kit/mail.ts\`. It reads SMTP settings from the environment: \`SMTP_URL\` (\`smtp://user:password@host:587\`, or \`smtps://\` for TLS from the start) or \`SMTP_HOST\`, \`SMTP_PORT\`, \`SMTP_USER\` and \`SMTP_PASSWORD\`, plus \`MAIL_FROM\` (the sender). Any provider works; give its SPF, DKIM and DMARC records to the sender's domain so the mail arrives. Without settings nothing is sent: mails are written to \`data/mail/outbox\` as \`.eml\` files, which is what development and tests look at.

`;
}

export { actionNames } from "./actions.js";
export { customPageFromEdit, customPageSource } from "./pages/custom.js";

export type { GeneratedFile, GenerateOptions, Zone } from "./shared.js";
export {
  dataKey,
  indexPath,
  join,
  names,
  storedFields,
  tableNames,
  texts,
} from "./shared.js";

const generated = (path: string, content: string): GeneratedFile => ({
  path,
  content,
  zone: "generated",
});
/** Created once; its code belongs to the project from then on. */
/** src/custom/styles.css as it starts: a comment and nothing that changes the app. */
const CUSTOM_STYLES = `/* Your own styles for this app. This file is never overwritten.
   Style the kit's parts through their data-* hooks (listed in the README) and the theme's
   variables, for example:

   [data-kit="model-form"] [data-part="actions"] { justify-content: flex-start; }
   [data-page="home"] [data-section="hero"] { min-height: 70vh; }
*/
`;

const custom = (path: string, content: string): GeneratedFile => ({
  path,
  content,
  zone: "custom",
});

/** Each part of the spec's files, in the order of the spec's sections. */
const SECTION_GENERATORS: SectionGenerator[] = [
  {
    // The app as a whole: its package, theme, lock, README, root route, pages and smoke tests.
    key: "app",
    files: ({ ir, t, auth, ux, options }) => [
      generated("package.json", packageJson(ir, options.packages)),
      generated("src/theme.css", themeCss(ux, options.themes)),
      // The app's own styles, on the kit's data-* hooks (see the README); created once.
      custom("src/custom/styles.css", CUSTOM_STYLES),
      generated("smithable.lock", smithableLock(ir, options)),
      generated("README.md", readme(ir, false, auth)),
      generated("public/favicon.svg", favicon(ir)),
      generated("src/generated/app.ts", appModule(ir)),
      // Always: a page or section of your own keeps its file after it leaves the spec.
      generated("src/generated/custom.ts", CUSTOM_PROPS),
      generated("src/generated/pages.ts", pagesModule(ir, auth)),
      // The public site's menu and contact details, for its landing pages and public blogs.
      ...(hasSite(ir, auth) ? [generated("src/generated/site.ts", siteModule(ir, t, auth))] : []),
      generated("src/lib/viewer.server.ts", viewerModule(auth)),
      ...(outgoingOf(ir).length
        ? [
            generated(
              "src/generated/outgoing.server.ts",
              outgoingModule(ir, t, ux, options.content),
            ),
          ]
        : []),
      generated(
        "src/routes/__root.tsx",
        rootRoute(
          ir,
          t,
          auth,
          ux,
          options.analytics,
          options.content?.consent,
          options.content?.assistant,
        ),
      ),
      generated("src/routes/robots[.]txt.ts", robotsRoute(ir, auth)),
      ...(auth.public.pages.length
        ? [generated("src/routes/sitemap[.]xml.ts", sitemapRoute(ir, auth, t))]
        : []),
      generated("tests/smoke.spec.ts", smokeTests(ir, t, auth)),
      ...(ir.pages.some((p) => p.route === "/")
        ? []
        : [generated("src/routes/index.tsx", indexRoute(ir))]),
    ],
  },
  {
    // Sign-in (smithable.auth.yml): its kit and files only when the app has sign-in.
    key: "auth",
    kit: [{ files: SIGN_IN_KIT, used: ({ auth }) => hasSignIn(auth) }],
    files: ({ ir, auth, t, ux, options }) => {
      if (!hasSignIn(auth)) return [];
      const onboarding = ir.pages.find((p) => p.pattern.kind === "onboarding");
      const users =
        ir.models.some((m) => userFields(m).length) ||
        ir.actions.some((a) => userFields(a.input).length);
      return [
        generated("src/lib/auth.ts", authModule(auth, ir)),
        generated(
          "src/routes/sign-in.tsx",
          signInRoute(auth, onboarding?.route, hasInvitations(ir, auth)),
        ),
        ...(users ? [generated("src/generated/users.ts", usersModule())] : []),
        // Invitations and user management, for the users page (see users.ts).
        ...(hasInvitations(ir, auth)
          ? [
              generated("src/generated/users.server.ts", usersServerModule(ir, auth, t)),
              generated("src/generated/users.test.ts", usersTestSource(ir, auth)),
            ]
          : []),
        // Keys for the API, made on the users page (docs/design/integrations.md §2).
        ...(hasKeys(ir, auth)
          ? [
              generated("src/generated/keys.server.ts", keysModule(auth)),
              generated("src/generated/keys.test.ts", keysTestSource(auth)),
              // The API itself: conversions, the OpenAPI description and the routes.
              generated("src/generated/api.server.ts", apiModule(ir, auth, t)),
              ...Object.entries(apiRoutes(ir, auth, t)).map(([path, source]) =>
                generated(path, source),
              ),
              // The same as tools for AI assistants, when the auth file says so (§5b).
              ...(auth.api?.assistants
                ? [
                    generated(
                      "src/generated/mcp.server.ts",
                      mcpModule(ir, auth, t, options.content),
                    ),
                    generated("src/routes/mcp.ts", mcpRoute(ir)),
                  ]
                : []),
            ]
          : []),
        // "Ask": the tools over everything the person may read, and ask().
        ...(auth.assistant
          ? [
              generated(
                "src/generated/ask.server.ts",
                askModule(ir, auth, t, options.content, ux.assistant.voice),
              ),
            ]
          : []),
      ];
    },
  },
  {
    key: "models",
    // The reservation block, for a model with a capacity (docs/design/booking.md), and Markdown
    // fields' editor and formatter: each only in apps that use it.
    kit: [
      {
        // A list's filters and sort control (marketplace.md §2.2), where a page has them,
        files: ["src/kit/Filters.tsx", "src/kit/filter.ts"],
        // and the Saved view's tabs (§2.3).
        used: ({ ir, auth }) =>
          ir.pages.some(
            (p) => p.filters?.length || p.sortable?.length || (hasSignIn(auth) && p.favorites),
          ),
      },
      {
        // Outgoing mail (integrations.md §4.1b): the outbox and its sender.
        files: ["src/kit/outgoing.ts", "src/kit/outgoing.server.ts", "src/kit/call.server.ts"],
        used: ({ ir }) => outgoingOf(ir).length > 0,
      },
      {
        // "Contact the owner" on a record's page (marketplace.md §2.4).
        files: ["src/kit/ContactOwner.tsx"],
        used: ({ ir, auth }) => hasSignIn(auth) && ir.pages.some((p) => p.contact),
      },
      {
        // A list on a record page shown as a conversation (docs/design/conversation.md).
        files: ["src/kit/Thread.tsx"],
        used: ({ ux }) =>
          Object.values(ux.pages).some((p) => Object.values(p.lists ?? {}).includes("thread")),
      },
      {
        files: ["src/kit/Reserve.tsx"],
        used: ({ ir, auth }) => hasSignIn(auth) && ir.models.some((m) => m.capacity),
      },
      {
        files: ["src/kit/ActionButton.tsx"],
        used: ({ ir, auth }) =>
          ir.pages.some((p) => standardActions(p, ir).length) ||
          selects(ir, auth) ||
          ir.models.some((m) => m.trash),
      },
      {
        // Chosen rows on a crud list (actions.md §9).
        files: ["src/kit/SelectionBar.tsx"],
        used: ({ ir, auth }) => selects(ir, auth) || ir.models.some((m) => m.trash),
      },
      {
        // The trash (docs/design/trash.md): its page, the notice's Undo, a trashed record's banner.
        files: ["src/kit/Trash.tsx"],
        used: ({ ir }) => ir.models.some((m) => m.trash),
      },
      {
        // Keys for the API, on the users page (docs/design/integrations.md §2).
        files: ["src/kit/Keys.tsx", "src/kit/api.server.ts"],
        used: ({ ir, auth }) => hasKeys(ir, auth),
      },
      {
        // Finding, counting and adding up in the data modules: for the API and for "Ask".
        files: ["src/kit/where.ts", "src/kit/refusal.ts"],
        used: ({ ir, auth }) => hasKeys(ir, auth) || Boolean(auth.assistant),
      },
      {
        // The administrator's inspector on the data page (docs/design/assistant.md §4): the
        // wording rules (§5), the answering loop and the panel.
        files: ["src/kit/ask.ts", "src/kit/assistant.server.ts", "src/kit/Inspector.tsx"],
        used: ({ ir, auth }) =>
          Boolean(auth.assistant) ||
          (hasInspector({ ir, auth }) && ir.pages.some((p) => p.pattern.kind === "data")),
      },
      {
        // The API as tools for AI assistants (docs/design/integrations.md §5b).
        files: ["src/kit/mcp.server.ts"],
        used: ({ ir, auth }) => hasKeys(ir, auth) && Boolean(auth.api?.assistants),
      },
      {
        // "Ask" for the people who use the app (docs/design/assistant.md §6).
        files: ["src/kit/Ask.tsx"],
        used: ({ auth }) => Boolean(auth.assistant),
      },
      {
        // The tools as /mcp and the app's own panels offer and check them.
        files: ["src/kit/tools.ts"],
        used: ({ ir, auth }) =>
          (hasKeys(ir, auth) && Boolean(auth.api?.assistants)) || Boolean(auth.assistant),
      },
      {
        files: ["src/kit/Markdown.tsx", "src/kit/MarkdownFormatted.tsx"],
        used: ({ ir }) => hasMarkdown(ir),
      },
      {
        files: [
          "src/kit/uploads.ts",
          "src/kit/receipts.server.ts",
          "src/kit/PictureInput.tsx",
          "src/kit/FileInput.tsx",
          "src/routes/files/$model.$field.ts",
          "src/routes/files/$model.$id.$field.ts",
          "src/routes/files/$model.$id.$field.$n.ts",
        ],
        used: ({ ir }) => hasUploads(ir),
      },
    ],
    files: ({ ir, t, auth, ux, options }) => [
      generated("src/db/schema.ts", schemaModule(ir, auth, ux)),
      generated("src/db/seed.ts", seedModule(ir, options)),
      ...(hasUploads(ir) ? [generated("src/generated/uploads.ts", uploadsModule(ir, t))] : []),
      // Files reviewed before others see them (docs/design/file-review.md).
      ...(reviewed(ir).length && options.auth
        ? [
            generated("src/generated/review.server.ts", reviewServerModule(ir, t, options.auth)),
            generated("src/generated/review.ts", reviewRolesModule(ir, options.auth)),
          ]
        : []),
      // The daily emptying of the trash, in the order the models point to each other.
      ...(ir.models.some((m) => m.trash)
        ? [generated("src/generated/trash.server.ts", trashModule(ir, t))]
        : []),
      ...(ir.models.length
        ? [
            generated("src/generated/access.test.ts", accessTestSource(ir, auth)),
            // The hook points: after a record changes, and daily (see hooks.ts).
            generated("src/generated/hooks.ts", hooksModule(ir, t, options.plugins)),
            custom("src/custom/hooks.ts", hooksStub()),
          ]
        : []),
      ...ir.models.flatMap((model) => {
        const base = `src/generated/${kebab(model.name)}`;
        const test = hasFormulas(model) ? formulasTestSource(model) : undefined;
        return [
          generated(`${base}.ts`, modelModule(model, t, ir, auth, ux)),
          generated(`${base}.schema.ts`, modelSchemaModule(model, t, auth)),
          generated(`${base}.server.ts`, dataModule(model, t, ir, auth, ux)),
          ...(hasFormulas(model)
            ? [generated(`${base}.formulas.ts`, formulasModuleSource(model, ir))]
            : []),
          ...(test ? [generated(`${base}.formulas.test.ts`, test)] : []),
        ];
      }),
    ],
  },
  {
    key: "actions",
    files: ({ ir, t, auth }) =>
      // A standard action is generated whole; a custom one gets a stub to implement, once.
      ir.actions.flatMap((action) =>
        action.custom
          ? [
              generated(
                `src/generated/actions/${kebab(action.name)}.ts`,
                actionModule(action, ir, auth, t),
              ),
              generated(
                `src/generated/actions/${kebab(action.name)}.input.ts`,
                actionInputModule(action),
              ),
              custom(`src/custom/actions/${kebab(action.name)}.ts`, actionStub(action)),
            ]
          : [
              generated(
                `src/generated/actions/${kebab(action.name)}.ts`,
                standardActionModule(action, ir, auth, t),
              ),
              generated(
                `src/generated/actions/${kebab(action.name)}.server.ts`,
                standardActionServer(action, ir, t),
              ),
            ],
      ),
  },
  {
    key: "incoming",
    // An address other services call; a custom one gets a stub to implement, once.
    files: ({ ir, t }) =>
      ir.incoming.flatMap((incoming) => [
        generated(`src/routes/incoming/${incoming.name}.ts`, incomingRoute(incoming, ir, t)),
        ...(incoming.custom
          ? [custom(`src/custom/incoming/${kebab(incoming.name)}.ts`, incomingStub(incoming))]
          : []),
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
    // A page pattern's kit files, only when a page uses the pattern.
    kit: Object.entries(PAGE_GENERATORS).flatMap(([kind, g]) =>
      g.kit
        ? [
            {
              files: g.kit,
              used: ({ ir, auth }) =>
                // The site's frame (LandingLayout) is the landing kit's: a public blog or
                // catalog uses it without a landing page.
                (kind === "landing" && hasSite(ir, auth)) ||
                // The owner's notice on a record (ReviewNotice) is the review kit's too.
                (kind === "review" && hasSignIn(auth) && ir.models.some((m) => m.review)) ||
                ir.pages.some(
                  (p) =>
                    p.pattern.kind === kind ||
                    // A landing section may be a calculator too.
                    (kind === "calculator" &&
                      p.pattern.kind === "landing" &&
                      p.pattern.sections.some((s) => s.calculator)),
                ),
            },
          ]
        : [],
    ),
    files: (ctx) =>
      ctx.ir.pages.flatMap((page) => {
        const dir = page.route === "/" ? "src/routes" : `src/routes${page.route}`;
        // A page's actions each get a route; the rest depends on its pattern.
        const actions = (page.actions ?? []).flatMap((name) => {
          const action = ctx.ir.actions.find((a) => a.name === name && a.custom);
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
        // A calculator, a page or a landing section: its fields and formulas as modules.
        const calculators =
          page.pattern.kind === "calculator"
            ? [[page.id, page.pattern.calculator, undefined] as const]
            : page.pattern.kind === "landing"
              ? page.pattern.sections.flatMap((s) =>
                  s.calculator ? [[`${page.id}.${s.name}`, s.calculator, s.name] as const] : [],
                )
              : [];
        const modules = calculators.flatMap(([name, calculator, section]) =>
          Object.entries(
            calculatorFiles(name, calculator, page.id, ctx.ir, ctx.t, ctx.ux, section),
          ).map(([path, content]) => generated(path, content)),
        );
        // A page or section of your own: its component, created once (calculator.md §4).
        const own =
          page.pattern.kind === "custom"
            ? [
                custom(
                  `src/custom/pages/${page.pattern.component}.tsx`,
                  customPageStub(page.pattern.component),
                ),
              ]
            : page.pattern.kind === "landing"
              ? page.pattern.sections.flatMap((s) =>
                  s.component
                    ? [
                        custom(
                          `src/custom/sections/${s.component}.tsx`,
                          customSectionStub(s.component),
                        ),
                      ]
                    : [],
                )
              : [];
        return [...actions, ...routes, ...modules, ...own];
      }),
  },
  {
    // A plugin's own files, only in its folder: everything else is built from its expansion.
    key: "plugins",
    files: ({ ir, options }) =>
      (options.plugins ?? []).flatMap((plugin) => {
        const value = ir.extensions?.[plugin.key];
        if (value === undefined || !plugin.generate) return [];
        const folder = `src/generated/plugins/${plugin.key}/`;
        return plugin.generate(value, ir).map((file) => {
          if (!file.path.startsWith(folder) || file.path.includes(".."))
            throw new Error(
              `The ${plugin.key} plugin may only write files in ${folder}, not ${file.path}.`,
            );
          return generated(file.path, file.content);
        });
      }),
  },
];

/** Whether the app has a public site: a landing page, a public blog, or a public catalog at "/". */
function hasSite(ir: SpecIR, auth: AuthIR): boolean {
  return ir.pages.some(
    (p) =>
      p.pattern.kind === "landing" ||
      publicArticles(p, { auth }) ||
      (p.route === "/" && p.pattern.kind === "crud" && auth.public.pages.includes(p.id)),
  );
}

/** Whether a crud list offers chosen rows: an action that changes records, or delete with sign-in. */
function selects(ir: SpecIR, auth: AuthIR): boolean {
  return ir.pages.some(
    (p) =>
      p.pattern.kind === "crud" && (hasSignIn(auth) || standardActions(p, ir).some((a) => !a.copy)),
  );
}
