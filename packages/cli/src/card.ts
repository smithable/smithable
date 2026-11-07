// `smithable card` (docs/design/app-card.md): the app card, from the spec files by core's appCard,
// with what only the project's folder knows (the commit, the custom files by path and size, files
// edited by hand, the migrations) gathered here and kept apart. Custom code is never read.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  appCard,
  type CardProject,
  emptyContent,
  type Language,
  renderCard,
  translationPath,
} from "@smithable/core";
import { hashFile, readRecord } from "./generate.js";
import { git, ownRepository } from "./git.js";
import type { Io } from "./io.js";
import { loadSpec } from "./validate.js";
import { VERSION } from "./version.js";

const FORMATS = ["md", "html", "json"] as const;

export function card(
  dir: string,
  io: Io,
  options: { format?: string; language?: string; out?: string } = {},
): number {
  const format = (options.format ?? "md") as (typeof FORMATS)[number];
  if (!FORMATS.includes(format)) {
    io.err(`card writes md, html or json, not "${options.format}".\n`);
    return 2;
  }
  const { ir, auth, content = emptyContent(), path } = loadSpec(dir, io);
  if (!ir || !auth) return 1;
  const root = dirname(path);
  const languages = [content.language, ...(content.languages ?? [])];
  const language = (options.language ?? content.language) as Language;
  if (!languages.includes(language)) {
    io.err(`The app is in ${languages.join(", ")}, not "${options.language}".\n`);
    return 2;
  }
  // The files the card is written from, in the order its version hash reads them.
  const names = [
    "smithable.yml",
    "smithable.auth.yml",
    "smithable.ux.yml",
    "smithable.content.yml",
    "smithable.context.yml",
    ...(content.languages ?? []).map(translationPath),
  ];
  const files = names.flatMap((name) =>
    existsSync(join(root, name)) ? [{ name, text: readFileSync(join(root, name), "utf8") }] : [],
  );
  const context = files.find((f) => f.name === "smithable.context.yml")?.text;
  const facts = appCard({
    ir,
    auth,
    content,
    files,
    language,
    smithable: VERSION,
    ...(context === undefined ? {} : { context }),
  });
  const text =
    format === "json"
      ? `${JSON.stringify(facts, null, 2)}\n`
      : renderCard(facts, format, projectFacts(root, names));
  if (options.out) writeFileSync(options.out, text);
  else io.out(text);
  return 0;
}

/** What the project's folder knows: Git, src/custom/ by path and size, drift, migrations. */
export function projectFacts(root: string, specFiles: string[]): CardProject {
  const custom: CardProject["customFiles"] = [];
  const walk = (folder: string) => {
    for (const name of readdirSync(join(root, folder)).sort()) {
      const path = `${folder}/${name}`;
      const stat = statSync(join(root, path));
      if (stat.isDirectory()) walk(path);
      else custom.push({ path, bytes: stat.size });
    }
  };
  if (existsSync(join(root, "src", "custom"))) walk("src/custom");
  const edited = Object.entries(readRecord(root).files)
    .filter(([path, hash]) => existsSync(join(root, path)) && hashFile(join(root, path)) !== hash)
    .map(([path]) => path)
    .sort();
  const drizzle = join(root, "drizzle");
  const migrations = existsSync(drizzle)
    ? readdirSync(drizzle).filter((f) => f.endsWith(".sql")).length
    : 0;
  const facts: CardProject = { customFiles: custom, edited, migrations };
  if (!ownRepository(root)) return facts;
  const head = git(root, ["log", "-1", "--format=%H %cs"]);
  if (!head.ok || !head.out) return facts;
  const [id = "", date = ""] = head.out.split(" ");
  const dirty = git(root, ["status", "--porcelain", "--", ...specFiles]).out !== "";
  const ai = git(root, ["log", "--format=%H", "--grep=^Smithable-AI: "]);
  return {
    ...facts,
    commit: { id, date, uncommitted: dirty },
    ...(ai.ok ? { confirmed: ai.out.split("\n").filter(Boolean).length } : {}),
  };
}
