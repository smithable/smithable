// Smithable app kit: Markdown turned into React elements (react-markdown), with no HTML string
// anywhere to inject into. Headings start at h2, under the page's own h1; links to other sites
// get rel="noopener nofollow"; pictures belong in picture fields, not in the text.
import Markdown, { type Components } from "react-markdown";
import { AppLink } from "./AppLink";

const components: Components = {
  h1: ({ node: _, ...props }) => <h2 className="mt-6 mb-3 text-2xl font-semibold" {...props} />,
  h2: ({ node: _, ...props }) => <h3 className="mt-6 mb-3 text-xl font-semibold" {...props} />,
  h3: ({ node: _, ...props }) => <h4 className="mt-5 mb-2 text-lg font-semibold" {...props} />,
  h4: ({ node: _, ...props }) => <h5 className="mt-4 mb-2 font-semibold" {...props} />,
  p: ({ node: _, ...props }) => <p className="my-3 leading-relaxed" {...props} />,
  ul: ({ node: _, ...props }) => <ul className="my-3 list-disc space-y-1 pl-6" {...props} />,
  ol: ({ node: _, ...props }) => <ol className="my-3 list-decimal space-y-1 pl-6" {...props} />,
  blockquote: ({ node: _, ...props }) => (
    <blockquote className="my-4 border-l-4 pl-4 text-muted-foreground" {...props} />
  ),
  code: ({ node: _, ...props }) => (
    <code className="rounded bg-muted px-1 font-mono text-sm" {...props} />
  ),
  // A link to a page of the app opens through the router (AppLink); others are ordinary links.
  a: ({ node: _, href, ...props }) => (
    <AppLink
      href={href}
      className="text-primary underline underline-offset-4"
      {...(href && /^https?:\/\//.test(href) ? { rel: "noopener nofollow" } : {})}
      {...props}
    />
  ),
};

export default function MarkdownFormatted({ text }: { text: string }) {
  return (
    <div className="[&>*:first-child]:mt-0">
      <Markdown components={components} disallowedElements={["img"]} unwrapDisallowed>
        {text}
      </Markdown>
    </div>
  );
}
