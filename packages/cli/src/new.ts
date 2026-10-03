import { spawnSync } from "node:child_process";
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
import {
  fitSamples,
  validateAuth,
  validateContent,
  validateSpec,
  YamlEditor,
} from "@smithable/core";
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
import { addLibraryPictures, dropMissingPictures, writePictures } from "./pictures.js";
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
    /** The app's name as someone typed it (the hosted form): it wins over a draft's own. */
    name?: string;
    /** The administrator's address; without it, the Git user's (email-sign-in.md §3). */
    admin?: string;
  } = {},
): Promise<number> {
  // A page as the starting point: what it says is the description (first-build.md §2.8).
  let pictures: { file: string; alt: string; bytes: Uint8Array }[] = [];
  let fromPage = false;
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
        fromPage = pictures.length > 0;
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
  // (docs/design/first-build.md). --yes asks nothing; --answers answers in order, unasked. Either
  // way the model still picks the starter when none was named: skipping the questions is not
  // skipping the choice (the word match knows only English).
  const asking = !options.yes && !options.answers;
  if (description && (asking || starter === undefined)) {
    const asked = await clarifyProject({ description, starters: starterSummaries(), providers });
    if (asked.starter && starter === undefined) name = asked.starter;
    if (asking && asked.questions.length) {
      const answers = await askQuestions(io, asked.questions);
      if (answers === undefined) return 1;
      description = describedWith(description, answers);
    }
  }
  if (description && options.answers) {
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
        : await draftProjectByOperations({ description, providers, starter: { name, files } });
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
    // Pictures from the Smithable image library, unless the page's own came with --with-pictures.
    if (ir && !fromPage && process.env.SMITHABLE_NO_PICTURES !== "1")
      pictures = await addLibraryPictures({ description, ir, files, io });
  }
  if (options.name?.trim()) files = named(files, options.name.trim());
  // The app's first administrator is whoever makes it: a starter's sample address never
  // survives into a new project, where it would be someone else's way in.
  const admin = options.admin?.trim() || gitEmail();
  if (admin) {
    files = administered(files, admin);
    // A starter's allowedDomains are its own: the admin gets in anyway, nobody else from theirs.
    const domains = /allowedDomains:\s*\[([^\]]*)\]/.exec(files["smithable.auth.yml"] ?? "")?.[1];
    const domain = admin.split("@")[1]?.toLowerCase();
    if (
      domains &&
      domain &&
      !domains
        .split(",")
        .map((d) => d.trim())
        .includes(domain)
    )
      io.out(
        `Sign-in is limited to ${domains.trim()} (allowedDomains in smithable.auth.yml): ${admin} may sign in as the administrator, but nobody else from ${domain}. Change it there if your people use other addresses.\n`,
      );
  } else if (/^admins:/m.test(files["smithable.auth.yml"] ?? ""))
    io.out(
      "No administrator was set (no --admin and no Git user.email): the starter's sample address is still in smithable.auth.yml. Set yours with: smithable op setAdmins you@your-domain\n",
    );
  mkdirSync(dir, { recursive: true });
  for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
  // The plain starter comes with its own custom code (e.g. the CRM's customer merge); an app
  // drafted from a description may have changed what that code relies on, so it gets stubs.
  if (!options.describe)
    for (const [file, text] of Object.entries(STARTER_CODE[name] ?? {})) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), text);
    }
  // Its sample records; none at all with --no-sample-data, which also leaves the database empty.
  const sampleData = options.sampleData !== false;
  // A drafted app keeps the starter's records for the models and fields it kept (fitSamples);
  // the rest get generated rows.
  const starterSamples = Object.entries(STARTER_SAMPLES[name] ?? {}).map(([path, text]) => ({
    path,
    text,
  }));
  const drafted = options.describe
    ? validateSpec({ path: "smithable.yml", text: files["smithable.yml"] ?? "" }).ir
    : undefined;
  const samples = !options.describe
    ? starterSamples
    : drafted
      ? fitSamples(starterSamples, drafted)
      : [];
  if (sampleData)
    for (const { path, text } of samples) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
  // The page's pictures as sample pictures (never linked to the site); the library's where its
  // list says (samples/<n>.webp, and hero.webp, which the texts name as images/hero.webp).
  writePictures(
    dir,
    pictures.map((p) => (fromPage ? { ...p, file: `samples/${p.file}` } : p)),
  );
  // Its pictures, which a drafted app's texts may still use.
  for (const [file, data] of Object.entries(STARTER_ASSETS[name] ?? {})) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), Buffer.from(data, "base64"));
  }
  if (options.describe) dropMissingPictures(dir, io);
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

/** The project's files with the app named `name` (a name someone typed wins over a draft's). */
/** The project's files with `address` as the only administrator, when the app has sign-in. */
export function administered(
  files: Record<string, string>,
  address: string,
): Record<string, string> {
  const auth = new YamlEditor(files["smithable.auth.yml"] ?? "");
  if (!auth.has(["signIn"]) || auth.get(["signIn"]) === "none") return files;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return files;
  if (auth.has(["admins"])) auth.set(["admins"], [address.toLowerCase()]);
  else auth.add([], "admins", [address.toLowerCase()]);
  return { ...files, "smithable.auth.yml": auth.text };
}

/** The Git user's email address, when Git is there and knows one. */
function gitEmail(): string | undefined {
  const result = spawnSync("git", ["config", "user.email"], { encoding: "utf8" });
  const address = result.status === 0 ? result.stdout.trim() : "";
  return address || undefined;
}

export function named(files: Record<string, string>, name: string): Record<string, string> {
  const spec = new YamlEditor(files["smithable.yml"] ?? "");
  if (!spec.has(["app", "name"])) return files;
  spec.set(["app", "name"], name);
  return { ...files, "smithable.yml": spec.text };
}
