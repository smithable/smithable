// A page as the starting point (docs/design/first-build.md §2.8): `smithable new <dir> --from
// <url>` reads one page politely (a named user agent, robots.txt, three redirects on the same
// site, 2 MB and 15 seconds) and keeps what describes the app behind it: its readable text, its
// navigation, its forms and its pictures' places and alt texts. That becomes the description the
// questions and the draft work from; nothing of it is copied into the app.
import { readFileSync } from "node:fs";
import { parse } from "node-html-parser";
import type { Io } from "./io.js";
import { VERSION } from "./version.js";

export const USER_AGENT = `Smithable/${VERSION} (+https://smithable.ai)`;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_PICTURE = 1024 * 1024;
const TIMEOUT = 15_000;

/** What a page says about the app behind it. */
export interface PageReading {
  url: string;
  title: string;
  headings: string[];
  text: string[];
  navigation: string[];
  forms: { fields: string[] }[];
  pictures: { src: string; alt: string }[];
}

/** Why a page cannot be used, in words. */
export class PageError extends Error {}

/** Whether robots.txt lets Smithable read `path` (the rules for its agent, else for everyone). */
export function allowedByRobots(robots: string, path: string): boolean {
  const groups: { agents: string[]; disallow: string[]; allow: string[] }[] = [];
  let group: (typeof groups)[number] | undefined;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const [key = "", ...rest] = line.split(":");
    const value = rest.join(":").trim();
    const name = key.trim().toLowerCase();
    if (name === "user-agent") {
      if (!lastWasAgent || !group) {
        group = { agents: [], disallow: [], allow: [] };
        groups.push(group);
      }
      group.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (group && (name === "disallow" || name === "allow")) {
      if (value) group[name].push(value);
      lastWasAgent = false;
    }
  }
  const mine =
    groups.find((g) => g.agents.some((a) => a !== "*" && "smithable".includes(a))) ??
    groups.find((g) => g.agents.includes("*"));
  if (!mine) return true;
  // The longest matching rule wins; an allow wins a tie.
  const match = (rules: string[]) =>
    Math.max(-1, ...rules.filter((r) => path.startsWith(r)).map((r) => r.length));
  return match(mine.allow) >= match(mine.disallow);
}

/** A response's body, at most `max` bytes, or an error naming the limit. */
async function body(response: Response, max: number, what: string): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new PageError(`${what} is larger than ${Math.round(max / 1024 / 1024)} MB.`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** GET with the user agent and the time limit, following at most three same-site redirects. */
async function get(url: URL, signal: AbortSignal): Promise<{ response: Response; url: URL }> {
  let at = url;
  for (let hop = 0; hop <= 3; hop++) {
    const response = await fetch(at, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,image/*;q=0.9,*/*;q=0.5" },
      redirect: "manual",
      signal,
    });
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) return { response, url: at };
    const next = new URL(location, at);
    if (next.hostname.replace(/^www\./, "") !== url.hostname.replace(/^www\./, ""))
      throw new PageError(`${at.href} redirects to another site (${next.hostname}).`);
    at = next;
  }
  throw new PageError(`${url.href} redirects more than three times.`);
}

/** Reads a page: robots.txt first, then the page within the limits. */
export async function fetchPage(address: string): Promise<{ html: string; url: string }> {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    throw new PageError(`"${address}" is not a web address; it starts with https://.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new PageError(`"${address}" is not a web address; it starts with https://.`);
  const signal = AbortSignal.timeout(TIMEOUT);
  try {
    const robots = await fetch(new URL("/robots.txt", url), {
      headers: { "user-agent": USER_AGENT },
      signal,
    });
    if (robots.ok && !allowedByRobots(await robots.text(), url.pathname))
      throw new PageError(`${url.hostname}'s robots.txt asks not to read ${url.pathname}.`);
    const { response, url: final } = await get(url, signal);
    if (!response.ok) throw new PageError(`${final.href} answered ${response.status}.`);
    if (!(response.headers.get("content-type") ?? "").includes("html"))
      throw new PageError(`${final.href} is not a web page.`);
    const bytes = await body(response, MAX_BYTES, "The page");
    return { html: new TextDecoder().decode(bytes), url: final.href };
  } catch (error) {
    if (error instanceof PageError) throw error;
    if (signal.aborted) throw new PageError(`${url.href} took longer than 15 seconds.`);
    throw new PageError(`${url.href} could not be read (${(error as Error).message}).`);
  }
}

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

/** What describes the app behind a page: text, navigation, forms and pictures, in page order. */
export function readPage(html: string, url: string): PageReading {
  const root = parse(html, { comment: false });
  for (const tag of root.querySelectorAll("script, style, noscript, template, svg")) tag.remove();
  const unique = (items: string[]) => [...new Set(items.filter(Boolean))];
  const navigation = unique(
    root
      .querySelectorAll("nav a, header a")
      .map((a) => clean(a.text))
      .filter((t) => t.length <= 40),
  );
  const forms = root.querySelectorAll("form").map((form) => ({
    fields: unique(
      form.querySelectorAll("input, select, textarea").flatMap((input) => {
        const type = input.getAttribute("type") ?? input.tagName.toLowerCase();
        if (["hidden", "submit", "button", "reset"].includes(type)) return [];
        const id = input.getAttribute("id");
        const label =
          (id && clean(form.querySelector(`label[for="${id}"]`)?.text ?? "")) ||
          input.getAttribute("aria-label") ||
          input.getAttribute("placeholder") ||
          input.getAttribute("name") ||
          "";
        return label ? [`${clean(label)} (${type})`] : [];
      }),
    ),
  }));
  const pictures = root
    .querySelectorAll("img")
    .flatMap((img) => {
      const src = img.getAttribute("src") ?? img.getAttribute("data-src");
      if (!src || src.startsWith("data:")) return [];
      try {
        return [{ src: new URL(src, url).href, alt: clean(img.getAttribute("alt") ?? "") }];
      } catch {
        return [];
      }
    })
    .slice(0, 40);
  return {
    url,
    title: clean(root.querySelector("title")?.text ?? ""),
    headings: unique(root.querySelectorAll("h1, h2, h3").map((h) => clean(h.text))),
    text: unique(
      root
        .querySelectorAll("p, li")
        .map((p) => clean(p.text))
        .filter((t) => t.length > 20),
    ),
    navigation,
    forms: forms.filter((f) => f.fields.length),
    pictures,
  };
}

/** A page that renders only with JavaScript leaves almost nothing to read. */
export function tooLittle(reading: PageReading): boolean {
  const words = [...reading.headings, ...reading.text].join(" ").split(/\s+/).filter(Boolean);
  return words.length < 25;
}

/** The reading as a description for the questions and the draft, within a model's budget. */
export function describePage(
  reading: PageReading,
  pictures: { file: string; alt: string }[] = [],
): string {
  const section = (title: string, lines: string[]) =>
    lines.length ? `\n${title}:\n${lines.map((l) => `- ${l}`).join("\n")}` : "";
  let text = reading.text.join("\n");
  if (text.length > 4000) text = `${text.slice(0, 4000)}…`;
  return `The app behind a site like this one (${reading.url}). Derive its records, pages, roles and sections; write new texts for it, never copy the site's.
Title: ${reading.title}${section("Navigation", reading.navigation)}${section("Headings", reading.headings.slice(0, 30))}${section(
    "Forms",
    reading.forms.map((f) => f.fields.join(", ")),
  )}${section(
    "Pictures on the page",
    reading.pictures
      .filter((p) => p.alt)
      .slice(0, 20)
      .map((p) => p.alt),
  )}${section(
    "Pictures the app may use (public/images/samples/)",
    pictures.map((p) => `${p.file}: ${p.alt}`),
  )}
Text:
${text}`;
}

/**
 * The page's pictures as the project's sample pictures: at most 20, each at most 1 MB, kept as
 * the site serves them (JPEG, PNG or WebP), never linked; the ones that fail are left out.
 */
export async function downloadPictures(
  reading: PageReading,
  save: (file: string, bytes: Uint8Array) => void,
): Promise<{ file: string; alt: string }[]> {
  const kinds: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const saved: { file: string; alt: string }[] = [];
  const signal = AbortSignal.timeout(TIMEOUT * 4);
  for (const picture of reading.pictures) {
    if (saved.length === 20) break;
    try {
      const { response } = await get(new URL(picture.src), signal);
      const kind = kinds[(response.headers.get("content-type") ?? "").split(";")[0] ?? ""];
      if (!response.ok || !kind) continue;
      const bytes = await body(response, MAX_PICTURE, "A picture");
      const file = `page-${saved.length + 1}.${kind}`;
      save(file, bytes);
      saved.push({ file, alt: picture.alt || `A picture from ${new URL(reading.url).hostname}` });
    } catch {
      // Too large, gone or slow: the draft does without it.
    }
  }
  return saved;
}

/**
 * `smithable read-page <file.html> --url <address>`: the description `new --from` would draft
 * from, for a page fetched elsewhere (the hosted service fetches it with its own guards and
 * runs this in a sandbox, then the usual clarify and new --describe).
 */
export function readPageCommand(file: string | undefined, url: string | undefined, io: Io): number {
  if (!file || !url) {
    io.err(
      "read-page needs a saved page and its address: smithable read-page page.html --url https://…\n",
    );
    return 2;
  }
  let html: string;
  try {
    html = readFileSync(file, "utf8");
  } catch {
    io.err(`Cannot read ${file}.\n`);
    return 1;
  }
  const reading = readPage(html, url);
  if (tooLittle(reading)) {
    io.err(
      `${url} shows almost nothing without JavaScript, so there is too little to go on. Describe the app instead.\n`,
    );
    return 1;
  }
  io.out(`${describePage(reading)}\n`);
  return 0;
}
