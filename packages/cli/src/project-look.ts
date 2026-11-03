// The host supplies source text and validated IR; the editor resolves it without filesystem I/O.
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { type ProjectLook, parseTheme } from "@smithable/core";
import { projectRevision } from "./project-revision.js";
import { loadSpec, projectThemeFiles } from "./validate.js";

export function projectLook(app: string, page?: string): ProjectLook | undefined {
  const project = loadSpec(app, { out() {}, err() {} });
  if (!project.ir) return undefined;
  const path = join(app, "smithable.ux.yml");
  return {
    ir: project.ir,
    revision: projectRevision(app),
    specText: readFileSync(join(app, "smithable.yml"), "utf8"),
    auth: project.auth,
    themes: project.themes ?? [],
    uxText: existsSync(path) ? readFileSync(path, "utf8") : "smithableUx: 0.1\n",
    themeFiles: projectThemeFiles(app).map((path) => ({
      name:
        parseTheme({ path, text: readFileSync(path, "utf8") }).theme?.name ??
        basename(path).replace(/\.ya?ml$/, ""),
      text: readFileSync(path, "utf8"),
    })),
    page,
  };
}
