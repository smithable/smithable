import { kebab, plural, type SpecIR } from "@smithable/core";

/** The generated page routes, rather than a guess from a page's name. */
export function pageForPreviewPath(ir: SpecIR, path: string, languages: string[] = []) {
  if (!path.startsWith("/") || path.startsWith("//")) return;
  let pathname: string;
  try {
    pathname = decodeURIComponent(path.split(/[?#]/)[0] ?? "");
  } catch {
    return;
  }
  if (
    pathname.includes("//") ||
    /[\\?#]/.test(pathname) ||
    [...pathname].some((char) => char.charCodeAt(0) <= 32) ||
    pathname.split("/").some((part) => part === "." || part === "..")
  )
    return;
  pathname = pathname.replace(/\/$/, "") || "/";
  const [, first = "", ...rest] = pathname.split("/");
  if (languages.includes(first)) pathname = `/${rest.join("/")}` || "/";
  if (/^\/(?:sign-in|sign-out|api|files|dev|_serverFn)(?:\/|$)/.test(pathname)) return;
  const pages = [...ir.pages].sort((a, b) => b.route.length - a.route.length);
  for (const page of pages) {
    if (page.route === pathname) return page.id;
    const prefix = page.route === "/" ? "/" : `${page.route}/`;
    if (!pathname.startsWith(prefix)) continue;
    const parts = pathname.slice(prefix.length).split("/");
    const record = (part: string | undefined) =>
      Boolean(part && /^(?:new|trash|[1-9]\d*)$/.test(part));
    const pattern = page.pattern;
    if (pattern.kind === "crud" && parts.length === 1 && record(parts[0])) return page.id;
    if (pattern.kind === "articles" && parts.length === 1 && parts[0]) return page.id;
    if (
      pattern.kind === "review" &&
      parts.length === 2 &&
      parts[0] === "file" &&
      /^[1-9]\d*$/.test(parts[1] ?? "")
    )
      return page.id;
    if (
      pattern.kind === "users" &&
      parts.length === 1 &&
      ["activity", "trash"].includes(parts[0] ?? "")
    )
      return page.id;
    if (pattern.kind === "data") {
      if (parts.length === 1 && ["activity", "ask"].includes(parts[0] ?? "")) return page.id;
      if (
        pattern.models.some((model) => kebab(plural(model)) === parts[0]) &&
        (parts.length === 1 || (parts.length === 2 && record(parts[1])))
      )
        return page.id;
    }
  }
}

/** A document reports only genuine route changes; repeated ready/selection reports are quiet. */
export class PreviewNavigation {
  private document = "";
  private seen = new Map<string, number>();
  private path = "";
  private retired = new Set<string>();

  receive(value: unknown, context: number): string | undefined {
    if (!value || typeof value !== "object") return;
    const message = value as Record<string, unknown>;
    if (
      message.type !== "navigated" ||
      typeof message.path !== "string" ||
      typeof message.documentId !== "string" ||
      !message.documentId ||
      !Number.isSafeInteger(message.navigationId) ||
      (message.navigationId as number) < 0 ||
      this.retired.has(message.documentId)
    )
      return;
    const sequence = message.navigationId as number;
    const previous = this.seen.get(message.documentId) ?? -1;
    if (sequence <= previous) return;
    this.seen.set(message.documentId, sequence);
    // Even an old-context report identifies the document that has replaced its predecessor.
    if (message.documentId !== this.document) {
      if (this.document) this.retired.add(this.document);
      this.document = message.documentId;
    }
    const samePath = this.path === message.path;
    this.path = message.path;
    if (message.followContext !== context) return;
    if (samePath) return;
    return message.path;
  }
}
