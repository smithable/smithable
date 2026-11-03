// Read-only host context for the shared editor; route claims confer no data access.
import { previewPages } from "@smithable/core";
import { projectLook } from "./project-look.js";
import { loadSpec } from "./validate.js";

export function lookContext(dir: string, preview: string, projectId: string, opened = "/") {
  if (!opened.startsWith("/") || opened.startsWith("//") || opened.length > 2048)
    throw new Error("Choose an app-relative preview address.");
  const pathname = new URL(opened, "http://preview.local").pathname;
  const loaded = loadSpec(dir, { out() {}, err() {} });
  if (!loaded.ir) throw new Error("The project has validation errors. Fix them in Code.");
  const frames = previewPages(
    loaded.ir.pages,
    Object.fromEntries(
      Object.entries(loaded.content?.pages ?? {}).flatMap(([id, p]) =>
        p.title ? [[id, p.title]] : [],
      ),
    ),
    loaded.auth,
  );
  const page = loaded.ir.pages
    .filter(
      (p) =>
        p.route === pathname ||
        (p.route !== "/" && pathname.startsWith(`${p.route}/`)) ||
        (p.route === "/" && ["crud", "articles"].includes(p.pattern.kind)),
    )
    .sort((a, b) => b.route.length - a.route.length)[0];
  let selected = frames.find((f) => f.path === pathname);
  if (!selected && page) {
    const record = frames.find((f) => f.page === page.id && f.kind === "record");
    const prefix = record?.discoverFrom === "/" ? "/" : `${record?.discoverFrom}/`;
    const tail = pathname.slice(prefix.length);
    if (record && pathname.startsWith(prefix) && tail && !tail.includes("/") && tail !== "new") {
      record.path = opened;
      selected = record;
    }
  }
  const look = projectLook(dir, page?.id ?? loaded.ir.pages[0]?.id);
  if (!look) throw new Error("The saved look could not be validated.");
  return {
    preview,
    projectId,
    frames,
    open: selected?.id,
    starters: [],
    themes: look.themeFiles,
    project: true,
    canApply: true,
    target: "This project",
    look,
    ...(!page && !selected
      ? { notice: "That page is no longer available. Choose a current page." }
      : {}),
  };
}
