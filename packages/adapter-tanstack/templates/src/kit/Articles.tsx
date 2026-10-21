// Smithable app kit: articles (a blog, news). A list newest first, and an article with its
// picture, date, author and formatted body, and links to the ones before and after it.
// To change them, copy this file into src/custom/components/ and edit the copy.
import { Card } from "#/components/ui/card";
import { AiMarked } from "./AiMark";
import { AppLink } from "./AppLink";
import { MarkdownText } from "./Markdown";
import { w } from "./words";

export interface ArticleCard {
  href: string;
  title: string;
  summary?: string;
  date?: string;
  picture?: { src: string; alt: string; width: number; height: number; generated?: boolean };
}

export function ArticleList({
  items,
  older,
  newer,
}: {
  items: ArticleCard[];
  /** Addresses of the next and previous pages of the list, when there are more. */
  older?: string;
  newer?: string;
}) {
  if (!items.length) return <p className="text-muted-foreground">{w.nothingHereYet}</p>;
  return (
    <div data-kit="articles" className="space-y-8">
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.href} data-part="row">
            <Card className="relative h-full overflow-hidden hover:bg-hover">
              {item.picture && (
                <AiMarked generated={item.picture.generated}>
                  <img
                    src={item.picture.src}
                    alt={item.picture.alt}
                    width={item.picture.width}
                    height={item.picture.height}
                    loading="lazy"
                    className="aspect-[3/2] w-full object-cover"
                  />
                </AiMarked>
              )}
              <div className="space-y-2 p-card">
                {item.date && <p className="text-sm text-muted-foreground">{item.date}</p>}
                <h2 className="text-lg font-semibold">
                  {/* The whole card opens the article; the link is the title. */}
                  <AppLink
                    href={item.href}
                    className="outline-none after:absolute after:inset-0 focus-visible:underline"
                  >
                    {item.title}
                  </AppLink>
                </h2>
                {item.summary && <p className="text-muted-foreground">{item.summary}</p>}
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {(older || newer) && (
        <nav aria-label={w.moreArticles} className="flex justify-between gap-4">
          {newer ? (
            <AppLink href={newer} className="font-medium text-primary">
              {w.newerArticles}
            </AppLink>
          ) : (
            <span />
          )}
          {older && (
            <AppLink href={older} className="font-medium text-primary">
              {w.olderArticles}
            </AppLink>
          )}
        </nav>
      )}
    </div>
  );
}

export function ArticleView({
  title,
  date,
  author,
  picture,
  body,
  previous,
  next,
  edit,
}: {
  title: string;
  date?: string;
  author?: string;
  picture?: ArticleCard["picture"];
  body: string;
  previous?: { href: string; title: string };
  next?: { href: string; title: string };
  /** Where those who may change it edit the article. */
  edit?: string;
}) {
  return (
    <article data-kit="article" className="mx-auto max-w-3xl space-y-6">
      {picture && (
        <AiMarked generated={picture.generated} full>
          <img
            src={picture.src}
            alt={picture.alt}
            width={picture.width}
            height={picture.height}
            fetchPriority="high"
            className="aspect-[3/2] w-full rounded-xl object-cover"
          />
        </AiMarked>
      )}
      <header className="space-y-2">
        <h1 data-part="title" className="text-3xl leading-tight font-semibold sm:text-4xl">
          {title}
        </h1>
        {(date || author) && (
          <p className="text-muted-foreground">{[date, author].filter(Boolean).join(" · ")}</p>
        )}
        {edit && (
          <AppLink href={edit} className="text-sm font-medium text-primary">
            {w.edit}
          </AppLink>
        )}
      </header>
      <div className="text-lg">
        <MarkdownText text={body} />
      </div>
      {(previous || next) && (
        <nav aria-label={w.otherArticles} className="flex justify-between gap-4 border-t pt-6">
          {previous ? (
            <AppLink href={previous.href} className="text-primary">
              ← {previous.title}
            </AppLink>
          ) : (
            <span />
          )}
          {next && (
            <AppLink href={next.href} className="text-right text-primary">
              {next.title} →
            </AppLink>
          )}
        </nav>
      )}
    </article>
  );
}
