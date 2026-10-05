import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import {
  clarifyProject,
  closeShared,
  closestStarter,
  describedWith,
  draftProject,
  draftProjectByOperations,
  type Edit,
  type Question,
  readEdit,
  STARTER_TEXTS,
} from "@smithable/ai";
import {
  fitSamples,
  reservedDomain,
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
import { addLibraryPictures, dropMissingPictures, placePictures } from "./pictures.js";
import { STARTER_ASSETS, STARTER_CODE, STARTER_SAMPLES, STARTERS } from "./starters.gen.js";

/**
 * The starter a description is, or is a small edit of, where that can be read without a model
 * (the start page shows a starter's own description; packages/ai starter-descriptions.ts).
 */
function knownStart(
  description: string,
): { name: string; edit: Exclude<Edit, { kind: "rewrite" }> } | undefined {
  for (const name of Object.keys(STARTER_TEXTS)) {
    const files = STARTERS[name];
    if (!files) continue;
    const edit = readEdit(name, description, {
      spec: files["smithable.yml"] ?? "",
      auth: files["smithable.auth.yml"],
      content: files["smithable.content.yml"],
      ux: files["smithable.ux.yml"],
    });
    if (edit.kind !== "rewrite") return { name, edit };
  }
  return undefined;
}

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
  // A starter's own description, or a small edit of it, needs no model: it is the starter, with
  // the edit's operations applied. From here on it is treated as that starter.
  let prepared: Record<string, string> | undefined;
  const known =
    options.describe && starter === undefined && !options.from
      ? knownStart(options.describe)
      : undefined;
  if (known) {
    starter = known.name;
    options = { ...options, describe: undefined };
    if (known.edit.kind === "same")
      io.out(`This is the ${known.name} starter's own description: no model is needed.\n`);
    else {
      const base = STARTERS[known.name] as Record<string, string>;
      prepared = {
        ...base,
        "smithable.yml": known.edit.files.spec,
        "smithable.auth.yml": known.edit.files.auth ?? "",
        "smithable.content.yml": known.edit.files.content ?? "",
        "smithable.ux.yml": known.edit.files.ux ?? "",
      };
      io.out(
        `The ${known.name} starter with what your description changes, read without a model:\n${known.edit.steps
          .map(
            (s) =>
              `  ${s.op} ${Object.values(s.args)
                .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
                .join(" ")}\n`,
          )
          .join("")}${known.edit.notes.map((n) => `${n}\n`).join("")}`,
      );
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
  let files = prepared ?? (STARTERS[name] as Record<string, string>);
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
    // An action the model could not get right is left out and said, rather than failing the draft.
    if (draft.dropped?.length)
      io.out(
        `Left out, since it could not be made valid:\n${draft.dropped.map((d) => `  ${d}\n`).join("")}`,
      );
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
    files = withoutSampleDomains(files, io);
    // What follows for the administrator and their colleagues, in the validator's words.
    const ir = validateSpec({ path: "smithable.yml", text: files["smithable.yml"] ?? "" }).ir;
    for (const d of validateAuth(
      { path: "smithable.auth.yml", text: files["smithable.auth.yml"] ?? "" },
      ir,
    ).diagnostics)
      if (d.code === "admin-outside-domains" || d.code === "example-domain")
        io.out(`${d.message}\n`);
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
  // The starter's own pictures (a drafted app's texts may still use them), then the page's as
  // sample pictures (never linked to the site) or the library's where its list says
  // (samples/<n>.webp, and hero.webp): the hero picked for this app replaces the starter's.
  placePictures(
    dir,
    STARTER_ASSETS[name] ?? {},
    pictures.map((p) => (fromPage ? { ...p, file: `samples/${p.file}` } : p)),
  );
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
  // A starter's own description, or a small edit of it: nothing to ask, and no model to ask it.
  const known = knownStart(description);
  const asked = known
    ? { starter: known.name, questions: [], usage: [] }
    : await clarifyProject({
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

/**
 * A starter's allowedDomains are sample content, like its admin: on a domain nobody has
 * (acme.example) they are taken out. A shared app that anyone could then sign up to and read is
 * made invite-only, as a draft is (closeShared): a team page and setSignUp invited.
 */
export function withoutSampleDomains(
  files: Record<string, string>,
  io: Io,
): Record<string, string> {
  const text = files["smithable.auth.yml"];
  if (!text) return files;
  const auth = new YamlEditor(text);
  const path = ["signIn", "allowedDomains"];
  const domains = auth.has(path) ? (auth.get(path) as unknown) : undefined;
  if (
    !Array.isArray(domains) ||
    !domains.length ||
    !domains.every((d) => reservedDomain(String(d)))
  )
    return files;
  auth.removeAndPrune(path, 1);
  const project = {
    spec: files["smithable.yml"] ?? "",
    auth: auth.text,
    content: files["smithable.content.yml"],
    ux: files["smithable.ux.yml"],
  };
  const closed = closeShared(project, []);
  io.out(
    `Sign-in was limited to ${domains.join(" and ")}, the starter's sample domain${domains.length > 1 ? "s" : ""}: taken out.${
      closed !== project
        ? " So that not anyone may sign up and read everything, only invited people and the administrator may sign in (the team page invites them; smithable op setSignUp anyone opens it)."
        : ""
    }\n`,
  );
  return {
    ...files,
    "smithable.yml": closed.spec,
    "smithable.auth.yml": closed.auth ?? auth.text,
    ...(closed.content !== undefined ? { "smithable.content.yml": closed.content } : {}),
    ...(closed.ux !== undefined ? { "smithable.ux.yml": closed.ux } : {}),
  };
}
