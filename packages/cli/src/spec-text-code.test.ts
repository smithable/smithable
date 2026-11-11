// Text in the spec stays text in the generated app: every string value of every example's spec
// files is given a text built to end a comment, a string or a template literal and start code,
// as far as validation accepts it; then the app is generated, each TypeScript file is read
// into tokens, and the marker word must never be code (an identifier) or a pragma in a comment,
// only part of a string, a template's text or a comment. Other files are checked by their kind.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@babel/parser";
import { generateApp } from "@smithable/adapter-tanstack";
import {
  type AuthIR,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
  validateUx,
  YamlEditor,
} from "@smithable/core";
import { describe, expect, test } from "vitest";

const EXAMPLES = join(import.meta.dirname, "../../../examples");
const FILES = ["smithable.yml", "smithable.auth.yml", "smithable.content.yml", "smithable.ux.yml"];
const MARK = "zq9x";
// One text that may stand on one line, one with line breaks (for the texts that allow them).
// Three: one that may stand on one line, one with line breaks (for the texts that allow them),
// and a short one for the texts with a length limit, which the long ones would not reach.
const PAYLOADS = [
  `A */ ${MARK}; /* \` \${${MARK}} \` " ' {${MARK}} <${MARK}> </${MARK}> \\ @${MARK} ${MARK}`,
  `A\n${MARK};\n// \` \${${MARK}} */ ${MARK}`,
  `*/"${MARK}`,
];

type Doc = Record<string, unknown>;
type Docs = Record<string, Doc>;
type Path = (string | number)[];
type Leaf = { file: string; path: Path };

const SCHEMAS: Record<string, string> = {
  "smithable.yml": "smithable.schema.json",
  "smithable.auth.yml": "smithable.auth.schema.json",
  "smithable.content.yml": "smithable.content.schema.json",
  "smithable.ux.yml": "smithable.ux.schema.json",
};

/** The paths a schema takes free text at ("*" a name, "[]" an item): no enum or pattern. */
function textPaths(file: string): string[][] {
  const schema = JSON.parse(
    readFileSync(join(import.meta.dirname, "../../core/schema", SCHEMAS[file] as string), "utf8"),
  );
  const resolve = (node: Doc | undefined): Doc | undefined => {
    let n = node;
    for (let i = 0; n?.$ref && i < 20; i++)
      n = String(n.$ref)
        .replace(/^#\//, "")
        .split("/")
        .reduce<Doc | undefined>((a, k) => a?.[k] as Doc | undefined, schema);
    return n;
  };
  const out = new Set<string>();
  const walk = (raw: Doc | undefined, path: string[]) => {
    const n = resolve(raw);
    if (!n || path.length > 10) return;
    const types = ([] as unknown[]).concat(n.type ?? []);
    if (types.includes("string") && !n.enum && !n.pattern && n.const === undefined)
      out.add(JSON.stringify(path));
    for (const [k, v] of Object.entries((n.properties as Doc) ?? {})) walk(v as Doc, [...path, k]);
    if (n.additionalProperties && typeof n.additionalProperties === "object")
      walk(n.additionalProperties as Doc, [...path, "*"]);
    for (const v of Object.values((n.patternProperties as Doc) ?? {}))
      walk(v as Doc, [...path, "*"]);
    if (n.items && !Array.isArray(n.items)) walk(n.items as Doc, [...path, "[]"]);
    for (const k of ["oneOf", "anyOf", "allOf"])
      for (const v of (n[k] as Doc[]) ?? []) walk(v, path);
  };
  walk(schema, []);
  return [...out].map((p) => JSON.parse(p));
}

const at = (doc: unknown, path: Path): unknown =>
  path.reduce<unknown>((a, k) => (a && typeof a === "object" ? (a as Doc)[k] : undefined), doc);

/**
 * Every place a file may hold free text: the strings it has, and the schema's text keys it lacks
 * where their names exist (a name at "*" from the file itself or the same place in
 * smithable.yml). Only the content file gains new entries above them; elsewhere a key is added
 * only where its parent is, so nothing is switched on.
 */
function leaves(file: string, docs: Docs): Leaf[] {
  const doc = docs[file] as Doc;
  const out = new Map<string, Leaf>();
  const add = (path: Path) => out.set(JSON.stringify([file, path]), { file, path });
  const walk = (value: unknown, path: Path) => {
    if (typeof value === "string") add(path);
    else if (Array.isArray(value)) for (const [i, v] of value.entries()) walk(v, [...path, i]);
    else if (value && typeof value === "object")
      for (const [k, v] of Object.entries(value)) walk(v, [...path, k]);
  };
  walk(doc, []);
  const main = docs["smithable.yml"];
  const expand = (pattern: string[], path: Path): Path[] => {
    if (!pattern.length) return [path];
    const [head, ...rest] = pattern as [string, ...string[]];
    if (head === "[]") return [];
    if (head !== "*") return expand(rest, [...path, head]);
    const names = new Set<string>();
    for (const source of [at(doc, path), at(main, path)])
      if (source && typeof source === "object" && !Array.isArray(source))
        for (const k of Object.keys(source)) names.add(k);
    return [...names].flatMap((k) => expand(rest, [...path, k]));
  };
  for (const pattern of textPaths(file))
    for (const path of expand(pattern, [])) {
      if (at(doc, path) !== undefined) continue;
      if (file !== "smithable.content.yml" && typeof at(doc, path.slice(0, -1)) !== "object")
        continue;
      add(path);
    }
  return [...out.values()].filter(
    (l) => !(l.path.length === 1 && String(l.path[0]).startsWith("smithable")),
  );
}

/** The files with the payload at each of `set`, written as JSON (which is YAML), a value a line. */
function withPayload(docs: Docs, set: Leaf[], payload: string): Record<string, string> {
  const copy: Docs = structuredClone(docs);
  for (const { file, path } of set) {
    let node = copy[file] as Doc;
    path.slice(0, -1).forEach((k, i) => {
      if (!node[k] || typeof node[k] !== "object")
        node[k] = typeof path[i + 1] === "number" ? [] : {};
      node = node[k] as Doc;
    });
    node[path[path.length - 1] as string] = payload;
  }
  return Object.fromEntries(Object.entries(copy).map(([f, d]) => [f, JSON.stringify(d, null, 1)]));
}

interface Read {
  ir: SpecIR;
  auth: AuthIR;
  content?: ReturnType<typeof validateContent>["content"];
  ux?: ReturnType<typeof validateUx>["ux"];
  errors: { file: string; line: number }[];
}

/** The four files read as the CLI reads them, with the lines of their errors. */
function read(texts: Record<string, string>): Read {
  const errorsOf = (file: string, ds: { severity: string; line: number }[]) =>
    ds.filter((d) => d.severity === "error").map((d) => ({ file, line: d.line }));
  const spec = validateSpec({ path: "smithable.yml", text: texts["smithable.yml"] ?? "" });
  const errors = errorsOf("smithable.yml", spec.diagnostics);
  const ir = spec.ir as SpecIR;
  if (!spec.ir) return { ir, auth: undefined as unknown as AuthIR, errors };
  const a = validateAuth(
    { path: "smithable.auth.yml", text: texts["smithable.auth.yml"] ?? "" },
    ir,
  );
  errors.push(...errorsOf("smithable.auth.yml", a.diagnostics));
  const c = texts["smithable.content.yml"];
  const content = c
    ? validateContent({ path: "smithable.content.yml", text: c }, ir, undefined, a.auth)
    : undefined;
  if (content) errors.push(...errorsOf("smithable.content.yml", content.diagnostics));
  const u = texts["smithable.ux.yml"];
  const ux = u ? validateUx({ path: "smithable.ux.yml", text: u }, ir, [], a.auth) : undefined;
  if (ux) errors.push(...errorsOf("smithable.ux.yml", ux.diagnostics));
  return { ir, auth: a.auth as AuthIR, content: content?.content, ux: ux?.ux, errors };
}

/** The line of each value in withPayload's text (JSON with one value a line). */
function lineOf(text: string, path: Path): number {
  const doc = JSON.parse(text);
  let line = 1;
  let found = 0;
  const walk = (value: unknown, p: Path) => {
    if (found) return;
    if (JSON.stringify(p) === JSON.stringify(path)) found = line;
    if (value && typeof value === "object") {
      const entries = Object.entries(value);
      if (!entries.length) return;
      for (const [k, v] of entries) {
        line++;
        walk(v, [...p, Array.isArray(value) ? Number(k) : k]);
        if (found) return;
      }
      line++;
    }
  };
  walk(doc, []);
  return found;
}

/**
 * The values that take the payload with every file valid: all at first; then those on a line
 * with an error are left out, until none is; the rest by halving.
 */
function accepted(docs: Docs, all: Leaf[], payload: string): Leaf[] {
  let set = all;
  for (let round = 0; round < 8; round++) {
    const texts = withPayload(docs, set, payload);
    const { errors } = read(texts);
    if (!errors.length) return set;
    const bad = new Set(errors.map((e) => `${e.file}:${e.line}`));
    const next = set.filter(
      (l) => !bad.has(`${l.file}:${lineOf(texts[l.file] as string, l.path)}`),
    );
    if (next.length === set.length) break;
    set = next;
  }
  const kept: Leaf[] = [];
  const tryAdd = (part: Leaf[]) => {
    if (!part.length) return;
    if (!read(withPayload(docs, [...kept, ...part], payload)).errors.length) {
      kept.push(...part);
      return;
    }
    if (part.length === 1) return;
    const half = Math.ceil(part.length / 2);
    tryAdd(part.slice(0, half));
    tryAdd(part.slice(half));
  };
  tryAdd(set);
  return kept;
}

/** The places in a file where the marker is code: identifiers and JSX names that hold it. */
function markerAsCode(path: string, source: string): string[] {
  let tokens: {
    type: { label: string } | string;
    value?: unknown;
    loc: { start: { line: number } };
  }[];
  let comments: { value: string; loc: { start: { line: number } } }[];
  try {
    const file = parse(source, {
      sourceType: "module",
      plugins: path.endsWith(".tsx") ? ["typescript", "jsx"] : ["typescript"],
      tokens: true,
    });
    tokens = file.tokens as typeof tokens;
    comments = (file.comments ?? []) as typeof comments;
  } catch (error) {
    return [`does not parse: ${(error as Error).message}`];
  }
  // A pragma (@jsxImportSource, @ts-nocheck) is an instruction to the build, even in a comment.
  const pragmas = comments
    .filter((c) => c.value.toLowerCase().includes(`@${MARK}`))
    .map((c) => `line ${c.loc.start.line}: a pragma in a comment`);
  return [
    ...pragmas,
    ...tokens
      .filter((t) => {
        const label = typeof t.type === "string" ? t.type : t.type.label;
        return (
          (label === "name" || label === "jsxName") &&
          typeof t.value === "string" &&
          t.value.toLowerCase().includes(MARK)
        );
      })
      .map(
        (t) =>
          `line ${t.loc.start.line}: ${source.split("\n")[t.loc.start.line - 1]?.trim().slice(0, 160)}`,
      ),
  ];
}

/**
 * Where the marker is out of place in a generated file of any kind: code in a script; a broken
 * JSON file; a line of its own in a line-by-line file (a Dockerfile, an ignore list); in a
 * Markdown code block, which people copy into a shell, any word with more than a name's characters; CSS outside a string or a comment; inside
 * an SVG tag outside a quoted value.
 */
function markerOutOfPlace(path: string, source: string): string[] {
  const lower = source.toLowerCase();
  if (/\.(ts|tsx|mts|mjs|js)$/.test(path)) return markerAsCode(path, source);
  if (!lower.includes(MARK)) return [];
  if (/\.(json|webmanifest)$/.test(path)) {
    try {
      JSON.parse(source);
      return [];
    } catch (error) {
      return [`does not parse: ${(error as Error).message}`];
    }
  }
  if (path.endsWith(".md"))
    return source
      .split(/^```/m)
      .filter((_, i) => i % 2 === 1)
      .flatMap((block) => block.toLowerCase().split(/\s+/))
      .filter((word) => word.includes(MARK) && !/^[a-z0-9:/._=-]+$/.test(word))
      .map((word) => `in a code block: ${word.slice(0, 120)}`);
  if (path.endsWith(".css")) {
    const bare = lower
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, "");
    return bare.includes(MARK) ? ["outside a string or a comment"] : [];
  }
  if (path.endsWith(".svg") || path.endsWith(".html"))
    return (lower.match(/<[^>]*>/g) ?? [])
      .map((tag) => tag.replace(/"[^"]*"|'[^']*'/g, ""))
      .filter((tag) => tag.includes(MARK))
      .map((tag) => `in a tag: ${tag.slice(0, 120)}`);
  return lower
    .split(/\r?\n|\r/)
    .filter((line) => line.trimStart().startsWith(MARK))
    .map((line) => `a line of its own: ${line.slice(0, 120)}`);
}

const examples = readdirSync(EXAMPLES, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => FILES.slice(0, 2).every((f) => exists(join(EXAMPLES, name, f))));

function exists(path: string): boolean {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

describe.each(examples)("%s", (example) => {
  const docs: Docs = Object.fromEntries(
    FILES.filter((f) => exists(join(EXAMPLES, example, f))).map((f) => [
      f,
      new YamlEditor(readFileSync(join(EXAMPLES, example, f), "utf8")).get([]) as Doc,
    ]),
  );
  const all = Object.keys(docs).flatMap((file) => leaves(file, docs));

  test.each(PAYLOADS.map((p, i) => [["on one line", "with line breaks", "short"][i], p]))(
    "a text %s stays text in the generated code",
    (_, payload) => {
      const set = accepted(docs, all, payload);
      const spec = read(withPayload(docs, set, payload));
      expect(spec.errors).toEqual([]);
      const files = generateApp(spec.ir, {
        smithableVersion: "0.0.0",
        auth: spec.auth,
        content: spec.content,
        ux: spec.ux,
      });
      const problems = files.flatMap((f) =>
        markerOutOfPlace(f.path, f.content).map((p) => `${f.path} ${p}`),
      );
      expect(problems).toEqual([]);
      // The payload reached the app at all: else the test proves nothing.
      expect(set.length).toBeGreaterThan(0);
    },
    300_000,
  );
});
