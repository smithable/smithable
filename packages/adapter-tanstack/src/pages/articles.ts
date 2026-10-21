// An articles page (`articles: Post`, docs/design/articles.md): the records newest first, 12 at
// a time, and a page per article at its address. Everything is read through the model's data
// function, so visitors see only what its public read (and its `where`) lets them: a draft is
// not found. A public articles page has the site's frame (the landing pages'), with head tags
// for links shared elsewhere; a signed-in one the app's shell.
import { kebab, type PageIR, type PatternOf, pageModel } from "@smithable/core";
import { hasSignIn } from "../auth.js";
import {
  attr,
  type GenContext,
  guard,
  HEADER,
  importList,
  indexPath,
  join,
  modelNamed,
  names,
} from "../shared.js";

type ArticlesPage = PageIR & { pattern: PatternOf<"articles"> };

/** Articles in a list: this many to a page. */
const PER_PAGE = 12;

/** Whether visitors open the page (then it has the site's frame, not the app's). */
export const publicArticles = (page: PageIR, { auth }: Pick<GenContext, "auth">) =>
  page.pattern.kind === "articles" && auth.public.pages.includes(page.id);

export function articlesRoutes(page: ArticlesPage, ctx: GenContext): Record<string, string> {
  return {
    "index.tsx": listRoute(page, ctx),
    "$address.tsx": articleRoute(page, ctx),
  };
}

/** The server side both routes share: the readable articles, newest first, as cards. */
function shared(page: ArticlesPage, ctx: GenContext) {
  const { ir, t } = ctx;
  const p = page.pattern;
  const model = modelNamed(ir, p.model);
  const n = names(model, t);
  const author = p.author ? model.fields.find((f) => f.name === p.author) : undefined;
  const dateField = p.date ? model.fields.find((f) => f.name === p.date) : undefined;
  const dated = dateField?.type.kind === "scalar" && dateField.type.name === "date";
  const imports = importList()
    .add("@tanstack/react-start", "createServerFn")
    .add("zod", "z")
    .add(`${n.module}.server`, n.access, n.data)
    .add(n.module, `type ${model.name}Row`)
    .add("#/kit/access", "allows")
    .add("#/lib/viewer.server", "currentViewer");
  const crud = ir.pages.find((x) => pageModel(x) === model.name);
  if (crud) imports.add("#/generated/pages", "pageAccess");
  const picture = p.picture
    ? `row.${p.picture} ? { src: \`/files/${kebab(model.name)}/\${row.id}/${p.picture}\`, alt: row.${p.picture}.alt, width: row.${p.picture}.width, height: row.${p.picture}.height, generated: row.${p.picture}.generated } : undefined`
    : "undefined";
  const code = `
// The row type from the model's module: a type of the data function would keep its server
// import in the page's code.
type Row = ${model.name}Row;

/** When an article appeared, for ordering: its ${p.date ?? "record"}${p.date ? "" : "'s creation"}. */
const when = (row: Row) => ${
    p.date
      ? `(row.${p.date} ? new Date(${dated ? `\`\${row.${p.date}}T00:00:00Z\`` : `row.${p.date}`}).getTime() : 0)`
      : "row.id"
  };
const dateText = (row: Row) =>
  ${
    p.date
      ? `row.${p.date} ? new Intl.DateTimeFormat("en", { dateStyle: "long"${dated ? `, timeZone: "UTC"` : ""} }).format(new Date(${dated ? `\`\${row.${p.date}}T00:00:00Z\`` : `row.${p.date}`})) : undefined`
      : "undefined"
  };
/** An article's address under the page: its ${p.address ?? "id"}. */
const addressOf = (row: Row) => ${p.address ? `row.${p.address} || String(row.id)` : "String(row.id)"};
const hrefOf = (row: Row) => \`${page.route === "/" ? "" : page.route}/\${encodeURIComponent(addressOf(row))}\`;
/** The summary, else the body's first paragraph without its marks. */
const summaryOf = (row: Row) => {
  const first = (row.${p.body} ?? "").split(/\\n\\s*\\n/).find((b) => b.trim() && !b.trim().startsWith("#")) ?? "";
  const text = ${p.summary ? `row.${p.summary} || first` : "first"};
  const plain = text.replace(/[#*_\`>[\\]]|\\(https?:[^)]*\\)/g, "").trim();
  return plain.length > 200 ? \`\${plain.slice(0, 199)}…\` : plain || undefined;
};
const cardOf = (row: Row) => ({
  href: hrefOf(row),
  title: String(row.${p.title} ?? ""),
  summary: summaryOf(row),
  date: dateText(row),
  picture: ${picture},
});

/** Newest first: by when they appeared, then by creation. */
const newestFirst = (rows: Row[]) => [...rows].sort((a, b) => when(b) - when(a) || b.id - a.id);
`;
  return { imports, code, n, model, author, crud };
}

function listRoute(page: ArticlesPage, ctx: GenContext): string {
  const { imports, code, n } = shared(page, ctx);
  const framed = publicArticles(page, ctx);
  imports
    .add("@tanstack/react-router", "createFileRoute")
    .add("#/kit/Articles", "ArticleList")
    .add("#/kit/params", "count", "optional", "type Search")
    .add("#/generated/pages", "pageAccess")
    .add("#/kit/access", "allows", "guardPage");
  if (framed)
    imports
      .add("#/kit/Landing", "LandingLayout")
      .add("#/generated/app", "app")
      .add("#/generated/site", "site");
  else imports.add("#/kit/AppShell", "PageHeader");
  const header = `<h1 className="mb-6 text-3xl font-bold">{${ctx.t.pageTitleOf(page.id)}}</h1>`;
  return `${HEADER}${imports.render()}${code}
const getArticles = createServerFn()
  .validator(z.number().int().min(1))
  .handler(async ({ data: page }) => {
    // In the handler: the data function is the server's alone.
    const viewer = await currentViewer();
    const rows = newestFirst(await ${n.data}.list(viewer));
    const start = (page - 1) * ${PER_PAGE};
    return {
      items: rows.slice(start, start + ${PER_PAGE}).map(cardOf),
      more: rows.length > start + ${PER_PAGE},
      canCreate: allows(${n.access}.create, viewer),
    };
  });

export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${ctx.t.head(page)}  validateSearch: (s: Search) => optional({ page: count(s.page) }),
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: ({ deps }) => getArticles({ data: deps.page }),
  component: ArticlesPage,
});

function ArticlesPage() {
  const { items, more } = Route.useLoaderData();
  const { page = 1 } = Route.useSearch();
  const list = (
    <ArticleList
      items={items}
      older={more ? \`?page=\${page + 1}\` : undefined}
      newer={page > 1 ? (page === 2 ? ${JSON.stringify(page.route)} : \`?page=\${page - 1}\`) : undefined}
    />
  );
  return ${
    framed
      ? `(
    <LandingLayout appName={app.name}${ctx.t.logo} site={site}>
      <div className="mx-auto max-w-6xl px-5 py-12">
        ${header}
        {list}
      </div>
    </LandingLayout>
  );`
      : `(
    <>
      <PageHeader page=${attr(page.id)} ${ctx.t.pageHeader(page.id)} />
      {list}
    </>
  );`
  }
}
`;
}

function articleRoute(page: ArticlesPage, ctx: GenContext): string {
  const { imports, code, n, author, crud } = shared(page, ctx);
  const p = page.pattern;
  const framed = publicArticles(page, ctx);
  imports
    .add("@tanstack/react-router", "createFileRoute", "notFound")
    .add("@tanstack/react-start/server", "getRequestHeaders")
    .add("#/kit/Articles", "ArticleView")
    .add("#/kit/access", "allows", "guardPage");
  imports.add("#/generated/pages", "pageAccess");
  if (framed)
    imports
      .add("#/kit/Landing", "LandingLayout")
      .add("#/generated/app", "app")
      .add("#/generated/site", "site");
  // Those who may change it (and open the page records are changed on) get an Edit link.
  const owner = hasSignIn(ctx.auth) ? ", row.ownerId" : "";
  const edit = crud
    ? `allows(${n.access}.write, viewer${owner}) && allows(pageAccess[${JSON.stringify(crud.id)}], viewer) ? \`${crud.route === "/" ? "" : crud.route}/\${row.id}\` : undefined`
    : "undefined";
  return `${HEADER}${imports.render()}${code}
const getArticle = createServerFn()
  .validator(z.string().max(200))
  .handler(async ({ data: address }) => {
    // In the handler: the data function is the server's alone.
    const viewer = await currentViewer();
    const rows = newestFirst(await ${n.data}.list(viewer));
    const i = rows.findIndex((row) => addressOf(row) === address);
    const row = rows[i];
    if (!row) return null;
    const newer = rows[i - 1];
    const older = rows[i + 1];
    // The site's address, for the picture in links shared elsewhere (og:image).
    const headers = getRequestHeaders();
    const origin = \`\${headers.get("x-forwarded-proto") ?? "http"}://\${headers.get("x-forwarded-host") ?? headers.get("host")}\`;
    return {
      origin,
      article: {
        ...cardOf(row),
        body: String(row.${p.body} ?? ""),
        author: ${author ? `row.${author.name}?.name ?? undefined` : "undefined"},
      },
      previous: older ? { href: hrefOf(older), title: String(older.${p.title} ?? "") } : undefined,
      next: newer ? { href: hrefOf(newer), title: String(newer.${p.title} ?? "") } : undefined,
      edit: ${edit},
    };
  });

export const Route = createFileRoute(${JSON.stringify(join(page.route, "$address"))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}  loader: async ({ params }) => {
    const found = await getArticle({ data: params.address });
    if (!found) throw notFound();
    return found;
  },
  // What a link to the article shows in chat apps and search: its title, summary and picture.
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: loaderData.article.title },
          ...(loaderData.article.summary ? [{ name: "description", content: loaderData.article.summary }] : []),
          { property: "og:title", content: loaderData.article.title },${
            p.picture
              ? `
          ...(loaderData.article.picture
            ? [{ property: "og:image", content: loaderData.origin + loaderData.article.picture.src }]
            : []),`
              : ""
          }
        ]
      : [],
  }),
  component: ArticlePage,
});

function ArticlePage() {
  const { article, previous, next, edit } = Route.useLoaderData();
  const view = (
    <ArticleView
      title={article.title}
      date={article.date}
      author={article.author}
      picture={article.picture}
      body={article.body}
      previous={previous}
      next={next}
      edit={edit}
    />
  );
  return ${
    framed
      ? `(
    <LandingLayout appName={app.name}${ctx.t.logo} site={site}>
      <div className="px-5 py-12">{view}</div>
    </LandingLayout>
  );`
      : "view;"
  }
}
`;
}
