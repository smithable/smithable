// Builds docs.smithable.ai into site/: the pages in docs/site and the spec reference as HTML,
// and the JSON Schema at the address its $id names. Fails on a link to a page, heading or
// repository file that does not exist, so the site never ships a dead link. A picture in a page
// (a file under docs/site) is copied into the site at the same path; a missing one fails too.
// Links between pages start at the root, so the 404 page works at any address.
// Usage: node scripts/build-docs.mjs [out dir]
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { Marked } from "marked";
import { operationsPage } from "./operations-page.mjs";

const root = resolve(import.meta.dirname, "..");
const out = resolve(process.argv[2] ?? join(root, "site"));
const SITE = "https://docs.smithable.ai/";
const REPO = "https://github.com/smithable/smithable/blob/main/";
const PAGES = [
  { src: "docs/site/index.md", out: "index.html", nav: "Home" },
  { src: "docs/site/start.md", out: "start.html", nav: "Getting started" },
  { src: "docs/site/starters.md", out: "starters.html", nav: "Starters" },
  { src: "docs/site/change.md", out: "change.html", nav: "Changing an app" },
  { src: "docs/site/actions.md", out: "actions.html", nav: "Buttons on a record" },
  { src: "docs/site/api.md", out: "api.html", nav: "The API" },
  { src: "docs/site/assistants.md", out: "assistants.html", nav: "Programs and assistants" },
  { src: "docs/site/outgoing.md", out: "outgoing.html", nav: "Mail and calls out" },
  { src: "docs/site/incoming.md", out: "incoming.html", nav: "Mail and calls in" },
  { src: "docs/site/language.md", out: "language.html", nav: "Another language" },
  { src: "docs/site/self-host.md", out: "self-host.html", nav: "Self-hosting" },
  { src: "docs/site/google-sign-in.md", out: "google-sign-in.html", nav: "Sign in with Google" },
  // Generated from the operations at build time, not a file in the repository.
  {
    src: "docs/site/operations.md",
    out: "operations.html",
    nav: "Operations",
    generate: operationsPage,
  },
  { src: "docs/site/why.md", out: "why.html", nav: "Why Smithable" },
  { src: "docs/site/faq.md", out: "faq.html", nav: "Questions" },
  { src: "docs/spec/v0.1.md", out: "spec.html", nav: "Spec reference", toc: true },
  { src: "docs/ai.md", out: "ai.html", nav: "AI setup" },
];
const schemaDir = join(root, "packages/core/schema");
const schemas = readdirSync(schemaDir)
  .filter((f) => f.endsWith(".schema.json"))
  .map((f) => JSON.parse(readFileSync(join(schemaDir, f), "utf8")));
const schemaPaths = schemas.map((schema) => {
  if (!schema.$id.startsWith(SITE))
    throw new Error(`The schema's $id (${schema.$id}) is not on ${SITE}.`);
  return schema.$id.slice(SITE.length);
});
const schema = schemas.find((s) => s.title === "smithable.yml");
const schemaPath = schemaPaths[schemas.indexOf(schema)];

/** GitHub's heading anchors, so links written for the repository work here too. */
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s/g, "-");
const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// First the headings of every page, so a link can be checked against the page it points to.
const lexer = new Marked();
for (const page of PAGES) {
  page.markdown = page.generate ? page.generate(root) : readFileSync(join(root, page.src), "utf8");
  page.headings = [];
  const seen = new Map();
  // Every heading, also one inside a list or a quote, in the order the renderer meets them.
  lexer.walkTokens(lexer.lexer(page.markdown), (token) => {
    if (token.type !== "heading") return;
    const base = slug(token.text);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    page.headings.push({ depth: token.depth, text: token.text, id: n ? `${base}-${n}` : base });
  });
}

const problems = [];
// Every page in docs/site is on the site. One left out of PAGES would only be linked as a file of
// the repository, which a reader of the site cannot open (the assistants how-to, for a day).
for (const file of readdirSync(join(root, "docs/site")))
  if (file.endsWith(".md") && !PAGES.some((page) => page.src === `docs/site/${file}`))
    problems.push(`docs/site/${file} is not in PAGES, so the site would not have it`);
/** Where a link in `page` goes on the site: another page, a heading, the schema or the repository. */
function target(page, href) {
  const [path, hash] = href.split("#");
  const check = (to, where) => {
    if (hash && !to.headings.some((h) => h.id === hash))
      problems.push(`${page.src}: no heading #${hash} in ${where}`);
  };
  if (!path) {
    check(page, page.src);
    return href;
  }
  if (href.startsWith(SITE)) {
    if (
      !schemaPaths.includes(path.slice(SITE.length)) &&
      !PAGES.some((p) => p.out === path.slice(SITE.length))
    )
      problems.push(`${page.src}: ${href} is not on the site`);
    return href;
  }
  if (/^[a-z]+:/.test(href)) return href;
  const file = relative(root, resolve(root, dirname(page.src), path));
  const to = PAGES.find((p) => p.src === file);
  if (to) {
    check(to, to.src);
    return `/${to.out === "index.html" ? "" : to.out}${hash ? `#${hash}` : ""}`;
  }
  if (!existsSync(join(root, file))) problems.push(`${page.src}: ${href} does not exist`);
  return REPO + file + (hash ? `#${hash}` : "");
}

const CSS = `
:root{--bg:#fcfcfa;--fg:#1d1d1b;--muted:#5d5d58;--line:#e3e2dc;--code:#f2f1ec;--accent:#9a4a12;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#151513;--fg:#e9e8e3;--muted:#a3a29b;--line:#2f2e2a;--code:#21201d;--accent:#f0a466;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent)}
header{border-bottom:1px solid var(--line);padding:.75rem 1rem;display:flex;flex-wrap:wrap;gap:.5rem 1.25rem;align-items:baseline}
header strong{margin-right:auto}
header .home{display:flex;align-items:center}header .home img{display:block;border:0;border-radius:0}
header a{text-decoration:none}
header a[aria-current]{color:var(--fg);font-weight:600}
.layout{max-width:72rem;margin:0 auto;padding:1.5rem 1rem 4rem;display:grid;gap:2rem}
@media (min-width:60rem){.layout.toc{grid-template-columns:14rem minmax(0,1fr)}nav.toc{position:sticky;top:1rem;align-self:start;max-height:calc(100vh - 2rem);overflow:auto}}
nav.toc ul{list-style:none;margin:0;padding:0;font-size:.9rem}
nav.toc li{margin:.2rem 0}
main{min-width:0;max-width:48rem}
h1{font-size:2rem;line-height:1.2;margin-top:0}
h2{margin-top:2.5rem;padding-top:.5rem;border-top:1px solid var(--line)}
code{background:var(--code);padding:.1em .3em;border-radius:4px;font-size:.9em;overflow-wrap:anywhere}
pre{background:var(--code);padding:1rem;border-radius:6px;overflow-x:auto;line-height:1.45}
pre code{background:none;padding:0}
table{border-collapse:collapse;display:block;overflow-x:auto;margin:1rem 0}
th,td{border:1px solid var(--line);padding:.4rem .6rem;text-align:left;vertical-align:top}
img{max-width:100%;height:auto;border:1px solid var(--line);border-radius:6px}
footer{color:var(--muted);font-size:.85rem;border-top:1px solid var(--line);padding:1rem;text-align:center}
`;

// Before the public release the site is reachable but kept out of search engines.
const PRERELEASE =
  process.env.SITE_PRERELEASE === "1" ? '\n<meta name="robots" content="noindex">' : "";

const html = (page, body) => {
  const title = page.headings.find((h) => h.depth === 1)?.text.replace(/`/g, "") ?? "Smithable";
  const toc = page.toc
    ? `<nav class="toc" aria-label="On this page"><ul>${page.headings
        .filter((h) => h.depth === 2)
        .map((h) => `<li><a href="#${h.id}">${esc(h.text.replace(/`/g, ""))}</a></li>`)
        .join("")}</ul></nav>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">${PRERELEASE}
<title>${esc(title)} · Smithable docs</title>
<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
<style>${CSS}</style>
</head>
<body>
<header><a class="home" href="/"><picture><source srcset="/brand/wordmark-dark.svg" media="(prefers-color-scheme: dark)"><img src="/brand/wordmark.svg" alt="Smithable" height="26" width="125"></picture></a><strong>docs</strong>${PAGES.map((p) => `<a href="/${p.out === "index.html" ? "" : p.out}"${p === page ? ' aria-current="page"' : ""}>${p.nav}</a>`).join("")}<a href="${SITE}${schemaPath}">JSON Schema</a></header>
<div class="layout${page.toc ? " toc" : ""}">${toc}<main>
${body}</main></div>
<footer>Smithable · Apache-2.0 · <a href="https://github.com/smithable/smithable">GitHub</a> · <a href="https://smithable.ai">smithable.ai</a></footer>
</body>
</html>
`;
};

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, dirname(schemaPath)), { recursive: true });
// The brand's files (the logo, the icons, the smithy picture), served as they are: smithable.ai's
// start page and the docs' own header use them from here.
cpSync(join(root, "docs/site/brand"), join(out, "brand"), { recursive: true });
for (const page of PAGES) {
  // A heading's id by its text: the next unused one of that text, so repeated headings keep
  // GitHub's -1, -2 suffixes.
  const ids = new Map();
  for (const h of page.headings) ids.set(h.text, [...(ids.get(h.text) ?? []), h.id]);
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth, text }) {
        return `<h${depth} id="${ids.get(text)?.shift() ?? slug(text)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      // A picture next to the page, copied into the site; its path stays as written.
      image({ href, text }) {
        const file = resolve(root, dirname(page.src), href);
        if (/^[a-z]+:/.test(href) || !existsSync(file)) {
          problems.push(`${page.src}: picture ${href} does not exist`);
        } else {
          const to = join(out, relative(join(root, "docs/site"), file));
          mkdirSync(dirname(to), { recursive: true });
          copyFileSync(file, to);
        }
        return `<img src="${esc(href)}" alt="${esc(text)}" loading="lazy">`;
      },
      link({ href, title, tokens }) {
        return `<a href="${esc(target(page, href))}"${title ? ` title="${esc(title)}"` : ""}>${this.parser.parseInline(tokens)}</a>`;
      },
    },
  });
  writeFileSync(join(out, page.out), html(page, marked.parse(page.markdown)));
}
for (const [i, each] of schemas.entries())
  writeFileSync(join(out, schemaPaths[i]), `${JSON.stringify(each, null, 2)}\n`);
writeFileSync(
  join(out, "404.html"),
  html(
    { headings: [{ depth: 1, text: "Not found" }] },
    `<h1>Not found</h1>\n<p>That page does not exist. <a href="/">The documentation starts here.</a></p>\n`,
  ),
);
// For search engines: every page, and robots.txt naming the list. robots.txt never refuses the
// pages: a build that must not be indexed says so on each page (SITE_PRERELEASE=1, noindex),
// which a crawler can only read if it may fetch them.
writeFileSync(
  join(out, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map((p) => `  <url><loc>${SITE}${p.out === "index.html" ? "" : p.out}</loc></url>`).join("\n")}
</urlset>
`,
);
writeFileSync(join(out, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);

if (problems.length) {
  console.error(`Dead links:\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`Built ${PAGES.length + 4} files into ${relative(root, out) || out}.`);
