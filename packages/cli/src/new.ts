import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import {
  clarifyProject,
  closestStarter,
  describedWith,
  draftProject,
  draftProjectByOperations,
  type Question,
} from "@smithable/ai";
import { validateAuth, validateContent, validateSpec } from "@smithable/core";
import { summarize } from "@smithable/index";
import { confirm, providersFor, usageLine } from "./ask.js";
import {
  describePage,
  downloadPictures,
  fetchPage,
  PageError,
  readPage,
  tooLittle,
} from "./from-page.js";
import { generate } from "./generate.js";
import { exec, type Io, tool } from "./io.js";
import { STARTER_ASSETS, STARTER_CODE, STARTER_SAMPLES, STARTERS } from "./starters.gen.js";

/**
 * `smithable new <dir>`: a new project from a starter spec, with sample data. With
 * `--describe "<sentence>"`, a model first adapts the closest starter to the description
 * (ARCHITECTURE §9.8), and the result is shown in plain language before it is used.
 */
export async function create(
  dir: string,
  io: Io,
  starter: string | undefined,
  options: {
    describe?: string;
    answers?: string;
    yes?: boolean;
    sampleData?: boolean;
    from?: string;
    withPictures?: boolean;
  } = {},
): Promise<number> {
  // A page as the starting point: what it says is the description (first-build.md §2.8).
  let pictures: { file: string; alt: string; bytes: Uint8Array }[] = [];
  if (options.from) {
    if (options.withPictures) {
      const consent = await confirm(
        io,
        "These pictures belong to whoever made that site. Use them only for a site you own or have the right to make from it. Continue?",
        options.yes === true,
      );
      if (consent !== true) return consent;
    }
    try {
      const page = await fetchPage(options.from);
      const reading = readPage(page.html, page.url);
      if (tooLittle(reading))
        throw new PageError(
          `${page.url} shows almost nothing without JavaScript, so there is too little to go on. Describe the app instead: smithable new ${dir} --describe "…"`,
        );
      if (options.withPictures) {
        const bytes = new Map<string, Uint8Array>();
        const saved = await downloadPictures(reading, (file, data) => bytes.set(file, data));
        pictures = saved.map((p) => ({ ...p, bytes: bytes.get(p.file) as Uint8Array }));
      }
      io.out(
        `Read ${page.url}: ${reading.headings.length} headings, ${reading.navigation.length} menu links, ${reading.forms.length} forms${options.withPictures ? `, ${pictures.length} pictures` : ""}.\n`,
      );
      options = { ...options, describe: describePage(reading, pictures) };
    } catch (error) {
      if (!(error instanceof PageError)) throw error;
      io.err(`${error.message}\n`);
      return 1;
    }
  }
  let name = starter ?? (options.describe ? closestStarter(options.describe, STARTERS) : "crm");
  if (starter !== undefined && STARTERS[starter] === undefined) {
    io.err(`Unknown starter "${starter}". Available: ${Object.keys(STARTERS).join(", ")}.\n`);
    return 2;
  }
  let description = options.describe;
  const providers = description ? providersFor() : [];
  // Before the draft: the model may ask up to three questions and picks the starter to adapt
  // (docs/design/first-build.md). --yes asks nothing; --answers answers in order, unasked.
  if (description && !options.yes && !options.answers) {
    const asked = await clarifyProject({ description, starters: starterSummaries(), providers });
    if (asked.starter && starter === undefined) name = asked.starter;
    if (asked.questions.length) {
      const answers = await askQuestions(io, asked.questions);
      if (answers === undefined) return 1;
      description = describedWith(description, answers);
    }
  } else if (description && options.answers) {
    const given = options.answers.split(";").map((a) => a.trim());
    description = describedWith(
      description,
      given.map((answer, i) => ({ question: `(${i + 1})`, answer })),
    );
  }
  let files = STARTERS[name] as Record<string, string>;
  // Prepared dependencies (node_modules, possibly a link, and the lockfile they were installed
  // from, as hosted workspaces provide) do not count: the install then has little to do.
  const PREPARED = ["node_modules", "pnpm-lock.yaml"];
  if (existsSync(dir) && readdirSync(dir).some((f) => !PREPARED.includes(f))) {
    io.err(`${dir} already exists and is not empty.\n`);
    return 1;
  }
  if (description) {
    io.out(`Starting from the ${name} starter.\n`);
    // Drafting as operations (an empty app, one checked operation at a time; the default, see
    // docs/benchmarks/draft-modes-*.md) or as whole files adapted from the starter.
    const draft =
      process.env.SMITHABLE_DRAFT === "files"
        ? await draftProject({ description, starter: files, providers })
        : await draftProjectByOperations({ description, providers });
    io.out(`${usageLine(draft.usage)}\n`);
    if (draft.kind === "failed") {
      io.err(
        `${draft.message}\nWithout a model, start from a starter: smithable new ${dir} --starter ${name}\n`,
      );
      return 1;
    }
    files = draft.files;
    const auth = validateAuth({
      path: "smithable.auth.yml",
      text: files["smithable.auth.yml"] ?? "",
    }).auth;
    const ir = validateSpec({ path: "smithable.yml", text: files["smithable.yml"] ?? "" }).ir;
    const content = files["smithable.content.yml"];
    if (ir) {
      const texts = content
        ? validateContent({ path: "smithable.content.yml", text: content }, ir).content
        : undefined;
      for (const section of summarize(ir, auth, texts))
        io.out(`\n${section.title}\n${section.sentences.map((s) => `  ${s}\n`).join("")}`);
    }
    const confirmed = await confirm(io, "\nCreate this app?", options.yes === true);
    if (confirmed !== true) return confirmed;
  }
  mkdirSync(dir, { recursive: true });
  for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
  // The plain starter comes with its own custom code (e.g. the CRM's customer merge); an app
  // drafted from a description may have changed what that code relies on, so it gets stubs.
  if (!options.describe)
    for (const [file, text] of Object.entries(STARTER_CODE[name] ?? {})) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), text);
    }
  // Its sample records, for the plain starter (a drafted app's models may differ); none at all
  // with --no-sample-data, which also leaves the database empty.
  const sampleData = options.sampleData !== false;
  if (!options.describe && sampleData)
    for (const [file, text] of Object.entries(STARTER_SAMPLES[name] ?? {})) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), text);
    }
  // The page's pictures, as the project's sample pictures (never linked to the site).
  for (const picture of pictures) {
    const path = join(dir, "public", "images", "samples", picture.file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, picture.bytes);
  }
  // Its pictures, which a drafted app's texts may still use.
  for (const [file, data] of Object.entries(STARTER_ASSETS[name] ?? {})) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), Buffer.from(data, "base64"));
  }
  const code = await generate(dir, io, { tools: true, force: false });
  if (code !== 0) return code;
  if (sampleData && exec(...tool(dir, "tsx", ["src/db/seed.ts"]), dir) !== 0)
    io.err("Could not add sample data; the app works without it.\n");
  io.out(`\nCreated ${dir}. Start it with:\n\n  cd ${dir}\n  smithable run\n`);
  return 0;
}

/**
 * `smithable clarify "<description>"`: the questions before a draft and the starter chosen, for
 * a program (--json) or a person. A model that fails or is missing means no questions, so a
 * caller never has to tell a failure from a description that says enough.
 */
export async function clarify(io: Io, description: string, json: boolean): Promise<number> {
  const asked = await clarifyProject({
    description,
    starters: starterSummaries(),
    providers: providersFor(),
  }).catch(() => ({ questions: [], usage: [] }) as Awaited<ReturnType<typeof clarifyProject>>);
  const result = {
    ...(asked.starter ? { starter: asked.starter } : {}),
    questions: asked.questions,
  };
  if (json) io.out(`${JSON.stringify(result)}\n`);
  else {
    io.out(`Starter: ${asked.starter ?? "(the closest by words)"}\n`);
    io.out(
      asked.questions.length
        ? asked.questions
            .map(
              (q, i) =>
                `${i + 1}. ${q.question}${q.options.length ? ` (${q.options.join(" / ")})` : ""}\n`,
            )
            .join("")
        : "No questions: the description says enough.\n",
    );
  }
  return 0;
}

/** Each starter as the questions step sees it: what it is, and its records. */
function starterSummaries(): Record<string, { description: string; models: string[] }> {
  return Object.fromEntries(
    Object.entries(STARTERS).map(([name, files]) => {
      const ir = validateSpec({ path: "smithable.yml", text: files["smithable.yml"] ?? "" }).ir;
      return [
        name,
        { description: ir?.app.description ?? "", models: ir?.models.map((m) => m.name) ?? [] },
      ];
    }),
  );
}

/** Asks the questions on the terminal: a number picks a suggested answer, text is free, Enter skips. */
async function askQuestions(
  io: Io,
  questions: Question[],
): Promise<{ question: string; answer: string }[] | undefined> {
  if (!process.stdin.isTTY) {
    io.err(
      `A few questions first:\n${questions.map((q, i) => `  ${i + 1}. ${q.question}${q.options.length ? ` (${q.options.join(" / ")})` : ""}`).join("\n")}\nAnswer them with --answers "a; b; c" (in order), or run again with --yes to skip them.\n`,
    );
    return undefined;
  }
  io.out("A few questions first (a number picks an answer, text is fine too, Enter skips):\n");
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answers: { question: string; answer: string }[] = [];
  try {
    for (const q of questions) {
      io.out(
        `\n${q.question}\n${q.options.map((o, i) => `  ${i + 1}. ${o}`).join("\n")}${q.options.length ? "\n" : ""}`,
      );
      const text = (await prompt.question("> ")).trim();
      const picked = /^\d+$/.test(text) ? q.options[Number(text) - 1] : undefined;
      answers.push({ question: q.question, answer: picked ?? text });
    }
  } finally {
    prompt.close();
  }
  return answers;
}
