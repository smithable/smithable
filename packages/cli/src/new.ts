import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { closestStarter, draftProject, parsePolicy, route } from "@smithable/ai";
import { validateAuth, validateContent, validateSpec } from "@smithable/core";
import { summarize } from "@smithable/index";
import { aiProviders, confirm, usageLine } from "./ask.js";
import { generate } from "./generate.js";
import { exec, type Io, tool } from "./io.js";
import { STARTER_CODE, STARTERS } from "./starters.gen.js";

/**
 * `smithable new <dir>`: a new project from a starter spec, with sample data. With
 * `--describe "<sentence>"`, a model first adapts the closest starter to the description
 * (ARCHITECTURE §9.8), and the result is shown in plain language before it is used.
 */
export async function create(
  dir: string,
  io: Io,
  starter: string | undefined,
  options: { describe?: string; yes?: boolean } = {},
): Promise<number> {
  const name = starter ?? (options.describe ? closestStarter(options.describe, STARTERS) : "crm");
  let files = STARTERS[name];
  if (files === undefined) {
    io.err(`Unknown starter "${name}". Available: ${Object.keys(STARTERS).join(", ")}.\n`);
    return 2;
  }
  // Prepared dependencies (node_modules, possibly a link, and the lockfile they were installed
  // from, as hosted workspaces provide) do not count: the install then has little to do.
  const PREPARED = ["node_modules", "pnpm-lock.yaml"];
  if (existsSync(dir) && readdirSync(dir).some((f) => !PREPARED.includes(f))) {
    io.err(`${dir} already exists and is not empty.\n`);
    return 1;
  }
  if (options.describe) {
    io.out(`Starting from the ${name} starter.\n`);
    const providers = route(aiProviders(), parsePolicy(process.env.SMITHABLE_AI_POLICY));
    const draft = await draftProject({ description: options.describe, starter: files, providers });
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
  const code = generate(dir, io, { tools: true, force: false });
  if (code !== 0) return code;
  if (exec(...tool(dir, "tsx", ["src/db/seed.ts"]), dir) !== 0)
    io.err("Could not add sample data; the app works without it.\n");
  io.out(`\nCreated ${dir}. Start it with:\n\n  cd ${dir}\n  smithable run\n`);
  return 0;
}
