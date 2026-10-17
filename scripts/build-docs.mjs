// Builds docs.smithable.ai into site/: the pages in docs/site and the spec reference as HTML,
// and the JSON Schema at the address its $id names. Fails on a link to a page, heading or
// repository file that does not exist, so the site never ships a dead link. A picture in a page
// (a file under docs/site) is copied into the site at the same path; a missing one fails too.
// Links between pages start at the root, so the 404 page works at any address.
// Usage: node scripts/build-docs.mjs [out dir]
import { spawnSync } from "node:child_process";
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
  {
    src: "docs/site/index.md",
    out: "index.html",
    description:
      "Smithable turns a plain-language description into a compact spec and an ordinary full-stack web app you own. Guides, starters and the spec reference.",
    nav: "Home",
  },
  {
    src: "docs/site/start.md",
    out: "start.html",
    description:
      "Two ways to start with Smithable: in the browser on smithable.ai with nothing to install, or on your own machine with the free, open-source command line.",
    nav: "Getting started",
    group: "Start",
  },
  // A page with `sub` is shown in the menu under the page before it.
  {
    src: "docs/site/start-hosted.md",
    out: "start-hosted.html",
    description:
      "Start on smithable.ai: try an app in a free sandbox with no sign-up, change it in the browser, publish it on your own domain, and download it whenever you like.",
    nav: "On smithable.ai",
    group: "Start",
    sub: true,
  },
  {
    src: "docs/site/start-local.md",
    out: "start-local.html",
    description:
      "Install the Smithable CLI, make a first app from a starter, change it with one command and open it in Studio, all on your own machine with no account.",
    nav: "On your own machine",
    group: "Start",
    sub: true,
  },
  {
    src: "docs/site/starters.md",
    out: "starters.html",
    description:
      "Eight complete apps to begin from, with pictures: a CRM, booking, invoicing, a marketplace, records, a status page, an assistant's notes and a support desk.",
    nav: "Starters",
    group: "Start",
  },
  {
    src: "docs/site/change.md",
    out: "change.html",
    description:
      "Five changes to a status page, each one command: a field, which records the front page shows, what visitors may read, the look, and undo.",
    nav: "Changing an app",
    group: "Build",
  },
  {
    src: "docs/site/actions.md",
    out: "actions.html",
    description:
      "Standard actions: buttons on a record's page that move it on, from setting a field to asking for a value or copying a record with its lines, with no code.",
    nav: "Buttons on a record",
    group: "Build",
  },
  {
    src: "docs/site/api.md",
    out: "api.html",
    description:
      "Let other programs use your app: API keys, the calls the app's API answers, and the refusals they get, shown on the status starter.",
    nav: "The API",
    group: "Connect",
  },
  {
    src: "docs/site/assistants.md",
    out: "assistants.html",
    description:
      "An app made for programs and AI assistants: the api starter, a key for an assistant, and Claude Code connected to it to keep tasks and notes.",
    nav: "Programs and assistants",
    group: "Connect",
  },
  {
    src: "docs/site/outgoing.md",
    out: "outgoing.html",
    description:
      "Mail and calls out: when something happens in an app it can mail a person or call another system, through an outbox that retries until it is sent.",
    nav: "Mail and calls out",
    group: "Connect",
  },
  {
    src: "docs/site/incoming.md",
    out: "incoming.html",
    description:
      "Mail and calls in: a mail to a support address or a call from another service, such as a monitor, becomes a record in the app, as smithable.yml says.",
    nav: "Mail and calls in",
    group: "Connect",
  },
  {
    src: "docs/site/language.md",
    out: "language.html",
    description:
      "An app in another language: set the language, and the app's own words (buttons, sign-in, messages) follow it. Swedish for the booking starter, step by step.",
    nav: "Another language",
    group: "Build",
  },
  {
    src: "docs/site/theme.md",
    out: "theme.html",
    description:
      "Make a theme of your own: colors, fonts, headings, cards and buttons in a small file, checked for readable contrast, or made in the theme lab on real pages.",
    nav: "Make a theme",
    group: "Build",
  },
  {
    src: "docs/site/self-host.md",
    out: "self-host.html",
    description:
      "Run a Smithable app on your own machine or server with Docker: deploying, where the data lives, backing up, restoring and updating.",
    nav: "Self-hosting",
    group: "Run",
  },
  {
    src: "docs/site/google-sign-in.md",
    out: "google-sign-in.html",
    description:
      'Offer "Continue with Google" beside the code by email: register the app with Google, give it its keys, and choose who may sign in.',
    nav: "Sign in with Google",
    group: "Connect",
  },
  // Generated from the operations at build time, not a file in the repository.
  {
    src: "docs/site/operations.md",
    out: "operations.html",
    description:
      "Every operation that changes a Smithable app, from addField to setTheme: what it does, its arguments and options, and an example command.",
    nav: "Operations",
    group: "Reference",
    generate: operationsPage,
  },
  {
    src: "docs/site/why.md",
    out: "why.html",
    description:
      "Why Smithable: changes without an AI rewriting code, low cost, an app you own outright, security and where it runs, with the measurements behind each.",
    nav: "Why Smithable",
    group: "About",
  },
  {
    src: "docs/site/faq.md",
    out: "faq.html",
    description:
      "Questions and answers about Smithable: how it compares, whether an app depends on it, AI models, running costs, hosting, data and what it builds today.",
    nav: "Questions",
    group: "About",
  },
  {
    src: "docs/spec/v0.1.md",
    out: "spec.html",
    description:
      "The spec reference: everything smithable.yml and its companion files for sign-in, looks, texts and context can say, with an example for each.",
    nav: "Spec reference",
    group: "Reference",
    toc: true,
  },
  {
    src: "docs/ai.md",
    out: "ai.html",
    description:
      "AI setup for Smithable: the models behind smithable ask and drafting an app from a sentence, configured with environment variables, local first.",
    nav: "AI setup",
    group: "Run",
  },
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
      !PAGES.some((p) => p.out === path.slice(SITE.length)) &&
      path !== `${SITE}theme-lab/index.html`
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
header{border-bottom:1px solid var(--line);padding:.75rem 1rem;display:flex;gap:1rem;align-items:center;position:relative}
header .home{display:flex;align-items:center}header .home img{display:block;border:0;border-radius:0}
header a{text-decoration:none}
header .docs{color:var(--fg);font-weight:700;margin-right:auto}
header .gh{color:var(--muted);font-size:.9rem}
.drawer summary{list-style:none;cursor:pointer;border:1px solid var(--line);border-radius:999px;padding:.2rem .85rem;font-weight:600}
.drawer summary::-webkit-details-marker{display:none}
.drawer[open] summary{background:var(--code)}
.drawer .side{position:absolute;left:0;right:0;top:100%;z-index:5;background:var(--bg);border-bottom:1px solid var(--line);padding:.25rem 1rem 1rem;max-height:calc(100vh - 4rem);overflow:auto}
.side p{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:1.1rem 0 .3rem}
.side ul{list-style:none;margin:0;padding:0}
.side a{display:block;padding:.25rem .5rem;margin-left:-.5rem;border-radius:6px;text-decoration:none;color:var(--fg)}
.side a.sub{padding-left:1.4rem;color:var(--muted)}
.side a[aria-current]{background:var(--code);color:var(--fg);font-weight:600}
.layout{max-width:80rem;margin:0 auto;padding:1.5rem 1rem 4rem;display:grid;gap:2rem}
.layout>.side,nav.toc{display:none}
nav.toc.always{display:block}
@media (min-width:60rem){
.drawer,nav.toc.always{display:none}
.layout{grid-template-columns:13rem minmax(0,1fr)}
.layout>.side{display:block}
.layout>.side,nav.toc{position:sticky;top:1rem;align-self:start;max-height:calc(100vh - 2rem);overflow:auto;font-size:.92rem}
.layout>.side>p:first-child{margin-top:0}
}
@media (min-width:76rem){
.layout.toc{grid-template-columns:13rem minmax(0,1fr) 12rem}
nav.toc,nav.toc.always{display:block;grid-column:3;grid-row:1;font-size:.85rem}
main{grid-column:2;grid-row:1}
}
nav.toc p{font-weight:600;margin:0 0 .3rem}
nav.toc ul{list-style:none;margin:0;padding:0}
nav.toc li{margin:.25rem 0}
nav.toc a{color:var(--muted);text-decoration:none}
nav.toc a:hover{color:var(--accent)}
main{min-width:0;max-width:48rem}
h1{font-size:2rem;line-height:1.2;margin-top:0}
h2{margin-top:2.5rem;padding-top:.5rem;border-top:1px solid var(--line)}
code{background:var(--code);padding:.1em .3em;border-radius:4px;font-size:.9em;white-space:nowrap}
code.words{white-space:normal}code.words>span{white-space:nowrap}
code .long{display:inline-block;max-width:calc(100% - 1em);white-space:normal}
pre{background:var(--code);padding:1rem;border-radius:6px;overflow-x:auto;line-height:1.45}
pre code{background:none;padding:0}
table{border-collapse:collapse;display:block;overflow-x:auto;margin:1rem 0}
th,td{border:1px solid var(--line);padding:.4rem .6rem;text-align:left;vertical-align:top}
img{max-width:100%;height:auto;border:1px solid var(--line);border-radius:6px}
footer{color:var(--muted);font-size:.85rem;border-top:1px solid var(--line);padding:1rem;text-align:center}
.search input{width:12rem;max-width:100%;font:inherit;font-size:.9rem;color:var(--fg);background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:.2rem .85rem}
.search input:focus{outline:2px solid var(--accent);outline-offset:1px}
.search ol{position:absolute;right:1rem;top:100%;z-index:6;width:min(36rem,calc(100% - 2rem));max-height:calc(100vh - 5rem);overflow:auto;margin:0;padding:.35rem;list-style:none;background:var(--bg);border:1px solid var(--line);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12)}
.search ol:empty{display:none}
.search li a{display:block;padding:.4rem .6rem;border-radius:6px;color:var(--fg);font-size:.9rem;line-height:1.4}
.search li a b{display:block;font-weight:600}
.search li a span{color:var(--muted)}
.search li a[aria-selected="true"],.search li a:hover{background:var(--code)}
.search mark{background:none;color:var(--accent);font-weight:600}
.search li.none{padding:.4rem .6rem;color:var(--muted);font-size:.9rem}
@media (max-width:40rem){header{flex-wrap:wrap;row-gap:.6rem}header .gh{display:none}.search{order:9;width:100%}.search input{width:100%;padding:.35rem .85rem}.search ol{left:1rem;right:1rem;width:auto}}
`;

// The visit counter (scripts/docs-count.js, served as /count.js), and for a visitor without
// script a picture that counts the page without where they came from.
const counter = (path) =>
  `<noscript><img src="https://smithable.ai/v?site=docs&amp;p=${encodeURIComponent(path)}" alt="" width="1" height="1"></noscript>`;

// Before the public release the site is reachable but kept out of search engines.
const PRERELEASE =
  process.env.SITE_PRERELEASE === "1" ? '\n<meta name="robots" content="noindex">' : "";

// Every page says what it covers, for search results and link previews (about 150 characters).
for (const page of PAGES)
  if (!page.description) throw new Error(`${page.src} has no description in PAGES.`);

// The menu: the pages in six groups, each in the order of PAGES.
const GROUPS = ["Start", "Build", "Connect", "Run", "Reference", "About"];
for (const page of PAGES)
  if (page.out !== "index.html" && !GROUPS.includes(page.group))
    throw new Error(`${page.src} has no menu group in PAGES.`);
const menu = (page) =>
  GROUPS.map((group) => {
    const links = PAGES.filter((p) => p.group === group).map(
      (p) =>
        `<li><a href="/${p.out}"${p.sub ? ' class="sub"' : ""}${p === page ? ' aria-current="page"' : ""}>${p.nav}</a></li>`,
    );
    if (group === "Reference")
      links.push(`<li><a href="${SITE}${schemaPath}">JSON Schema</a></li>`);
    return `<p>${group}</p><ul>${links.join("")}</ul>`;
  }).join("");

const html = (page, body) => {
  const title = page.headings.find((h) => h.depth === 1)?.text.replace(/`/g, "") ?? "Smithable";
  // The page's own address (none for the 404 page, which answers at any address).
  const url = page.out && SITE + (page.out === "index.html" ? "" : page.out);
  const where = url
    ? `\n<meta property="og:url" content="${url}">\n<link rel="canonical" href="${url}">`
    : "";
  // "On this page" beside a page with three sections or more, on a wide screen; the spec
  // reference (`toc`) also on a phone, above the page.
  const sections = page.headings.filter((h) => h.depth === 2);
  const toc =
    page.toc || sections.length >= 3
      ? `<nav class="toc${page.toc ? " always" : ""}" aria-label="On this page"><p>On this page</p><ul>${sections
          .map((h) => `<li><a href="#${h.id}">${esc(h.text.replace(/`/g, ""))}</a></li>`)
          .join("")}</ul></nav>`
      : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">${PRERELEASE}
<title>${esc(title)} · Smithable docs</title>
<meta name="description" content="${esc(page.description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:site_name" content="Smithable docs">
<meta property="og:type" content="website">${where}
<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
<script src="/count.js" defer></script>
<script src="/search.js" defer></script>
<style>${CSS}</style>
</head>
<body>
<header><a class="home" href="https://smithable.ai"><picture><source srcset="/brand/wordmark-dark.svg" media="(prefers-color-scheme: dark)"><img src="/brand/wordmark.svg" alt="Smithable website" height="26" width="125"></picture></a><a class="docs" href="/"${page.out === "index.html" ? ' aria-current="page"' : ""}>docs</a><form class="search" role="search" hidden><input type="search" placeholder="Search" aria-label="Search the docs" autocomplete="off"><ol></ol></form><a class="gh" href="https://github.com/smithable/smithable">GitHub</a><details class="drawer"><summary>Menu</summary><nav class="side" aria-label="Pages">${menu(page)}</nav></details></header>
<div class="layout${toc ? " toc" : ""}"><nav class="side" aria-label="Pages">${menu(page)}</nav>${toc}<main>
${body}</main></div>
<footer>Smithable · Apache-2.0 · <a href="https://github.com/smithable/smithable">GitHub</a> · <a href="https://smithable.ai">smithable.ai</a></footer>
${counter(page.out ? `/${page.out === "index.html" ? "" : page.out}` : "/404.html")}
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
      // Code never breaks inside a key, a flag or a path (Johan, 2026-10-17); a command or a
      // phrase in code may break only between its words. A word longer than a whole line (a long
      // path, address or key on a phone) breaks after a "/" or a ".", and nowhere else.
      codespan({ text }) {
        const word = (w) =>
          w.length > 30
            ? `<span class="long">${esc(w).replace(/([/.])(?=.)/g, "$1<wbr>")}</span>`
            : esc(w);
        const words = text.split(/\s+/).filter(Boolean);
        return words.length > 1
          ? `<code class="words">${words.map((w) => `<span>${word(w)}</span>`).join(" ")}</code>`
          : `<code>${word(text)}</code>`;
      },
      link({ href, title, tokens }) {
        return `<a href="${esc(target(page, href))}"${title ? ` title="${esc(title)}"` : ""}>${this.parser.parseInline(tokens)}</a>`;
      },
    },
  });
  writeFileSync(join(out, page.out), html(page, marked.parse(page.markdown)));
}
// The search index (search.json): every page cut at its headings, each part's words as plain
// text, which the header's search box loads on first use and searches in the browser.
// It is also an interface: Studio's Smith reads docs.smithable.ai/search.json to answer from
// the docs with links (A 124 step 5). Its shape, kept stable (tell A before changing it):
//   { pages: [[url, name], …], parts: [[page, heading, id, text], …] }
// url is the page's path without the leading slash ("" for the home page), name its menu name,
// page an index into pages, id the heading's anchor ("" for the page's top), and heading and
// text plain words.
/** Markdown as the words a reader sees: no link targets, pictures, marks or table rules. */
const plain = (md) =>
  md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(?:[-*+]|\d+\.|>|\|?\s*:?-{3,}.*)\s?/gm, "")
    .replace(/`|\*\*?/g, "")
    .replace(/[|#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const index = { pages: [], parts: [] };
for (const page of PAGES) {
  const p = index.pages.push([page.out === "index.html" ? "" : page.out, page.nav]) - 1;
  let heading = { text: page.nav, id: "" };
  let text = [];
  let next = 0;
  const flush = () => {
    const words = plain(text.join(" "));
    if (words || heading.id) index.parts.push([p, plain(heading.text), heading.id, words]);
    text = [];
  };
  for (const token of lexer.lexer(page.markdown)) {
    if (token.type !== "heading") {
      text.push(token.raw);
      continue;
    }
    flush();
    // The heading's id as the page gave it (also counting headings inside lists).
    while (next < page.headings.length && page.headings[next].text !== token.text) next++;
    heading = page.headings[next++] ?? { text: token.text, id: slug(token.text) };
    if (heading.depth === 1) heading = { text: heading.text, id: "" };
  }
  flush();
}
writeFileSync(join(out, "search.json"), JSON.stringify(index));
// The page scripts are files, not inline, so the site's CSP can stay at script-src 'self'.
copyFileSync(join(root, "scripts/docs-count.js"), join(out, "count.js"));
copyFileSync(join(root, "scripts/docs-search.js"), join(out, "search.js"));
for (const [i, each] of schemas.entries())
  writeFileSync(join(out, schemaPaths[i]), `${JSON.stringify(each, null, 2)}\n`);
writeFileSync(
  join(out, "404.html"),
  html(
    {
      headings: [{ depth: 1, text: "Not found" }],
      description:
        "That page does not exist. The Smithable documentation starts at docs.smithable.ai.",
    },
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
// The theme lab's public mode (docs/design/theme-lab.md §3): the lab built to read the pages
// scripts/theme-lab-export.mjs exported, beside them, with paths relative to its folder.
const lab = spawnSync(
  "pnpm",
  [
    "exec",
    "vite",
    "build",
    "--base",
    "./",
    "--outDir",
    join(out, "theme-lab"),
    "--logLevel",
    "warn",
  ],
  {
    cwd: join(root, "apps/theme-lab"),
    env: { ...process.env, VITE_THEME_LAB: "public" },
    stdio: "inherit",
  },
);
if (lab.status !== 0) process.exit(lab.status ?? 1);
cpSync(join(root, "docs/site/theme-lab"), join(out, "theme-lab"), { recursive: true });
// The lab's own page counts its visits too (the app pages it frames do not).
const labPage = join(out, "theme-lab/index.html");
writeFileSync(
  labPage,
  readFileSync(labPage, "utf8")
    .replace("</head>", '<script src="/count.js" defer></script>\n</head>')
    .replace("</body>", `${counter("/theme-lab/")}\n</body>`),
);

writeFileSync(join(out, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);

if (problems.length) {
  console.error(`Dead links:\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`Built ${PAGES.length + 4} files into ${relative(root, out) || out}.`);
