import { type HTMLElement, parse } from "node-html-parser";
import { type SiteReadPage, sameSiteAddress } from "./site-bundle.js";
import { inlineHidden } from "./site-validation.js";

const headings = "h1, h2, h3";
const clean = (text: string, limit: number) => text.replace(/\s+/gu, " ").trim().slice(0, limit);
const style = (element: HTMLElement) => element.getAttribute("style") ?? "";
const classes = (element: HTMLElement) => element.getAttribute("class") ?? "";

function fontIn(declarations: string): string | undefined {
  const family = /(?:^|;)\s*font-family\s*:\s*([^,;]+)/iu.exec(declarations)?.[1]?.trim();
  return family && /^[\p{L}\p{N} "'-]{1,80}$/u.test(family)
    ? family.replace(/["']/g, "")
    : undefined;
}

function ruleFont(css: string, tags: string[]): string | undefined {
  let found: string | undefined;
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (rule[1]?.split(",").some((selector) => tags.includes(selector.trim().toLowerCase())))
      found = fontIn(rule[2] ?? "") ?? found;
  }
  return found;
}

function darkWash(declarations: string): boolean {
  const gradient = /linear-gradient\s*\([^;]+/iu.exec(declarations)?.[0] ?? "";
  const opacity = /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*(\d*\.?\d+)\s*\)/iu.exec(gradient)?.[1];
  const alpha = /#000000([0-9a-f]{2})\b/iu.exec(gradient)?.[1];
  return Number(opacity ?? 0) > 0 || (alpha !== undefined && Number.parseInt(alpha, 16) > 0);
}

function buttonHref(href: string | undefined, page: string): string | undefined {
  if (!href || href.length > 300) return undefined;
  if (/^#[\w-]+$/u.test(href)) return href;
  try {
    const destination = new URL(href, page);
    if (destination.username || destination.password || !sameSiteAddress(destination.href, page))
      return undefined;
    if (destination.pathname.startsWith("//")) return undefined;
    return destination.pathname + destination.hash;
  } catch {
    return undefined;
  }
}

function blockFor(heading: HTMLElement): HTMLElement {
  let block = heading.parentNode ?? heading;
  for (let step = 0; step < 4; step++) {
    const parent = block.parentNode;
    if (!parent?.tagName || /^(BODY|MAIN|HTML)$/u.test(parent.tagName)) break;
    if (parent.querySelectorAll(headings).length !== 1) break;
    if (block.querySelector("img") && block.querySelector("p")) break;
    block = parent;
  }
  return block;
}

function imageSide(block: HTMLElement, heading: HTMLElement): "left" | "right" | undefined {
  if (/\b(?:has-media-on-the-right|image-right)\b/u.test(classes(block))) return "right";
  if (/\b(?:has-media-on-the-left|image-left)\b/u.test(classes(block))) return "left";
  if (
    !/\bdisplay\s*:\s*flex\b/iu.test(style(block)) ||
    /\bflex-direction\s*:\s*column/iu.test(style(block))
  )
    return undefined;
  const picture = block.children.findIndex(
    (child) => child.tagName === "IMG" || child.querySelector("img"),
  );
  const copy = block.children.findIndex(
    (child) => child === heading || child.querySelector(headings) === heading,
  );
  if (picture < 0 || copy < 0 || picture === copy) return undefined;
  const reversed = /\bflex-direction\s*:\s*row-reverse\b/iu.test(style(block));
  return picture < copy !== reversed ? "left" : "right";
}

/** Bounded hints from HTML already retrieved for the local full-content import. */
export function sourceLayout(pages: SiteReadPage[]) {
  return pages
    .slice(0, 5)
    .map(({ html, url }, index) => {
      const root = parse(html, { comment: false });
      const css = root
        .querySelectorAll("style")
        .map((element) => element.text)
        .join("\n")
        .slice(0, 64_000);
      const documentBody = root.querySelector("body");
      const bodyFont =
        (documentBody && fontIn(style(documentBody))) ?? ruleFont(css, ["html", "body"]);
      for (const element of root.querySelectorAll(
        'script, style, template, [hidden], [aria-hidden="true"]',
      ))
        element.remove();
      for (const element of root.querySelectorAll("[style]"))
        if (inlineHidden(style(element))) element.remove();
      const body = root.querySelector("main") ?? documentBody ?? root;
      const firstHeading = body.querySelector(headings);
      const headingFont =
        (firstHeading && fontIn(style(firstHeading))) ?? ruleFont(css, ["h1", "h2", "h3"]);
      const blocks = body
        .querySelectorAll(headings)
        .slice(0, 16)
        .flatMap((heading) => {
          if (heading.closest("nav, footer")) return [];
          const title = clean(heading.text, 200);
          if (!title) return [];
          const block = blockFor(heading);
          const picture = block.querySelector("img");
          const copy = block
            .querySelectorAll("p")
            .slice(0, 2)
            .map((p) => clean(p.text, 360))
            .filter(Boolean);
          const buttons = block
            .querySelectorAll("a[href], button")
            .slice(0, 3)
            .flatMap((link) => {
              const label = clean(link.text, 150);
              const href = buttonHref(link.getAttribute("href"), url);
              return label && href ? [{ label, href }] : [];
            });
          return [
            {
              title,
              copy,
              buttons,
              ...(heading.tagName === "H1" && darkWash(style(block)) ? { darkOverlay: true } : {}),
              ...(picture
                ? {
                    picture: {
                      alt: clean(picture.getAttribute("alt") ?? "", 200),
                      side: imageSide(block, heading),
                    },
                  }
                : {}),
            },
          ];
        });
      return { page: index + 1, bodyFont, headingFont, blocks };
    })
    .filter(({ blocks }) => blocks.length > 0);
}
