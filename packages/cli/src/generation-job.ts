// A host's receipt for the existing first build. It lives beside the project, never among
// generated files. A host must exclude this control file from the build's writable mounts.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Assumption, Usage } from "@smithable/ai";
import { ensureRepository, git, uncommitted } from "./git.js";
import type { Io } from "./io.js";
import { type Replacement, replaceProject } from "./replace.js";

export type GenerationStage = "preparing" | "drafting" | "building" | "arriving" | "committing";
export interface GenerationReceipt {
  id: string;
  status: "running" | "ready" | "failed";
  stage: GenerationStage;
  checkpoint?: string;
  assumptions: string[];
  diagnostics: string[];
  usage: { tokens: number; entries: Usage[] };
  error?: string;
  code?: string;
  retryable?: boolean;
}
interface Stored extends GenerationReceipt {
  fingerprint: string;
  base: string;
  intendedTree?: string;
}
export const generationRunning = (dir: string): boolean => active.has(resolve(dir));
export const generationId = (id: unknown): id is string =>
  typeof id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(id);
const file = (dir: string) => `${resolve(dir)}.generation.json`;
export const hasGenerationReceipt = (dir: string): boolean => existsSync(file(dir));
const active = new Set<string>();
const head = (dir: string) => git(dir, ["rev-parse", "HEAD"]).out;
const save = (dir: string, receipt: Stored) => {
  writeFileSync(`${file(dir)}.incoming`, JSON.stringify(receipt), { mode: 0o600 });
  renameSync(`${file(dir)}.incoming`, file(dir));
};
const load = (dir: string): Stored | undefined => {
  if (!existsSync(file(dir))) return undefined;
  return JSON.parse(readFileSync(file(dir), "utf8")) as Stored;
};
const checkpoint = (dir: string, receipt: Stored): string | undefined => {
  if (
    receipt.stage !== "committing" ||
    !receipt.intendedTree ||
    !/^[a-f0-9]{40}$/.test(receipt.base) ||
    !/^[a-f0-9]{40}$/.test(receipt.intendedTree)
  )
    return undefined;
  const found = git(dir, [
    "log",
    "--ancestry-path",
    "--max-count=10000",
    "--format=%H%x09%P%x09%T",
    `${receipt.base}..HEAD`,
  ]);
  if (!found.ok) return undefined;
  for (const line of found.out.split("\n")) {
    const [commit, parent, tree] = line.split("\t");
    if (!commit || parent !== receipt.base || tree !== receipt.intendedTree) continue;
    const body = git(dir, ["show", "-s", "--format=%B", commit]);
    const values = (key: string) =>
      body.out
        .split("\n")
        .filter((value) => value.startsWith(`${key}:`))
        .map((value) => value.slice(key.length + 1).trim());
    const ids = values("Smithable-Generation");
    const fingerprints = values("Smithable-Generation-Input");
    if (
      body.ok &&
      ids.length === 1 &&
      ids[0] === receipt.id &&
      fingerprints.length === 1 &&
      fingerprints[0] === receipt.fingerprint
    )
      return commit;
  }
  return undefined;
};
const publicReceipt = ({
  fingerprint: _fingerprint,
  base: _base,
  intendedTree: _tree,
  ...receipt
}: Stored) => receipt;
const unchanged = (dir: string, receipt: Stored) =>
  head(dir) === receipt.base && uncommitted(dir).length === 0;

/** A completed commit is authoritative even when the process stopped before saving its receipt. */
export function generationReceipt(dir: string, id: string): GenerationReceipt | undefined {
  const receipt = load(dir);
  if (!receipt || receipt.id !== id) return undefined;
  if (receipt.status === "running" && !active.has(resolve(dir))) {
    const committed = checkpoint(dir, receipt);
    if (committed) Object.assign(receipt, { status: "ready", checkpoint: committed });
    else {
      const safe = !["arriving", "committing"].includes(receipt.stage) && unchanged(dir, receipt);
      Object.assign(receipt, {
        status: "failed",
        retryable: safe,
        code: safe ? "interrupted" : "project-changed",
        error: safe
          ? "Making stopped before the app arrived. It can be tried again."
          : "Making stopped while the project was changing. Your files were kept; automatic replacement was stopped.",
      });
    }
    save(dir, receipt);
  }
  return publicReceipt(receipt);
}

/** Starts once; exact replays read the receipt and never replace a finished or edited app. */
export function startGeneration(
  dir: string,
  id: string,
  replacement: Replacement,
  replaceable: boolean,
  io: Io,
  retry = false,
  finished: () => void = () => {},
  make: typeof replaceProject = replaceProject,
): GenerationReceipt {
  if (!generationId(id)) throw new Error("The generation id is invalid.");
  if (
    typeof replacement.describe !== "string" ||
    !replacement.describe.trim() ||
    replacement.describe.length > 64_000 ||
    replacement.from
  )
    throw new Error("A generation needs a description of at most 64000 characters.");
  const key = resolve(dir);
  const fingerprint = createHash("sha256").update(JSON.stringify(replacement)).digest("hex");
  const previous = load(dir);
  if (previous) {
    if (previous.id !== id || previous.fingerprint !== fingerprint)
      throw new Error("This workspace already has another generation request.");
    const receipt = generationReceipt(dir, id) as GenerationReceipt;
    if (!retry || receipt.status !== "failed" || !receipt.retryable) return receipt;
    if (!unchanged(dir, previous))
      throw new Error("The project changed; it cannot be replaced automatically.");
  } else {
    if (!replaceable) throw new Error("This project is not one that can be replaced.");
    ensureRepository(dir);
    if (uncommitted(dir).length)
      throw new Error("The project has edits; it cannot be replaced automatically.");
  }
  if (active.has(key)) return generationReceipt(dir, id) as GenerationReceipt;
  const receipt: Stored = {
    id,
    fingerprint,
    base: previous?.base ?? head(dir),
    status: "running",
    stage: "preparing",
    assumptions: previous?.assumptions ?? [],
    diagnostics: [
      "The site's facts and wording have not been independently checked. Review the app before using it.",
    ],
    usage: previous?.usage ?? { tokens: 0, entries: [] },
  };
  save(dir, receipt);
  active.add(key);
  const stage = (value: GenerationStage) => {
    receipt.stage = value;
    save(dir, receipt);
  };
  const assumptions = (values: Assumption[]) => {
    for (const value of values) {
      const text = `${value.question} ${value.chosen}`.slice(0, 1000);
      if (!receipt.assumptions.includes(text) && receipt.assumptions.length < 50)
        receipt.assumptions.push(text);
    }
    save(dir, receipt);
  };
  let output = "";
  const kept = {
    out: io.out,
    err: (text: string) => {
      output = `${output}${text}`.slice(-8000);
      io.err(text);
    },
  };
  void (async () => {
    try {
      const code = await make(
        dir,
        kept,
        replacement,
        (value) => {
          if (value === "arriving") stage(value);
        },
        {
          stage,
          assumptions,
          diagnostic: (message) => {
            if (receipt.diagnostics.length < 50) receipt.diagnostics.push(message.slice(0, 1000));
            save(dir, receipt);
          },
          maxTokens: Math.max(1, 150_000 - receipt.usage.tokens),
          usage: (entry) => {
            receipt.usage.tokens += entry.inputTokens + entry.outputTokens;
            if (receipt.usage.entries.length < 100) receipt.usage.entries.push(entry);
            save(dir, receipt);
          },
          beforeArrival: () => {
            if (!unchanged(dir, receipt))
              throw new Error(
                "The project changed while the app was being made. Your edits were kept.",
              );
            stage("arriving");
          },
        },
      );
      if (code !== 0) throw new Error(output.trim() || "The app could not be made.");
      if (head(dir) !== receipt.base)
        throw new Error(
          "The project's history changed while the app arrived. Your files were kept.",
        );
      const added = git(dir, ["add", "-A"]);
      if (!added.ok) throw new Error(added.out);
      const tree = git(dir, ["write-tree"]);
      if (!tree.ok || !/^[a-f0-9]{40}$/.test(tree.out))
        throw new Error(tree.out || "The generated tree could not be recorded.");
      receipt.intendedTree = tree.out;
      stage("committing");
      const committed = git(dir, [
        "commit",
        "--allow-empty",
        "-q",
        "-m",
        `smithable: make the app\n\nSmithable-Setup: true\nSmithable-Generation: ${id}\nSmithable-Generation-Input: ${fingerprint}`,
      ]);
      if (!committed.ok) throw new Error(committed.out);
      const verified = checkpoint(dir, receipt);
      if (!verified)
        throw new Error("The generated commit could not be verified. Your files were kept.");
      receipt.checkpoint = verified;
      receipt.status = "ready";
    } catch (error) {
      receipt.status = "failed";
      receipt.error = (error instanceof Error ? error.message : String(error)).slice(-8000);
      const transient = transientGenerationFailure(receipt.error);
      receipt.retryable =
        !["arriving", "committing"].includes(receipt.stage) && unchanged(dir, receipt) && transient;
      receipt.code = "generation-failed";
    } finally {
      try {
        save(dir, receipt);
      } finally {
        active.delete(key);
        if (receipt.status === "ready") finished();
      }
    }
  })().catch((error) =>
    io.err(`Could not save the generation outcome: ${String(error).slice(-1000)}\n`),
  );
  return publicReceipt(receipt);
}

/** Retry only recognizable failures in the terminal diagnostic, not earlier build output. */
export function transientGenerationFailure(message: string): boolean {
  const terminal =
    message
      .trim()
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .at(-1)
      ?.trim() ?? "";
  return (
    /\b(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENETUNREACH)\b/.test(terminal) ||
    /(?:^|:\s*)(?:fetch failed|network request failed|socket hang up)$/i.test(terminal) ||
    /\b(?:HTTP(?:\/\d(?:\.\d)?)?|status(?: code)?|answered|response)[:= ]+(?:408|429|5\d\d)\b/i.test(
      terminal,
    ) ||
    /\b(?:overloaded_error|rate_limit_error)\b/.test(terminal) ||
    /^(?:Error:\s*)?(?:The )?model (?:is )?(?:busy|overloaded)[.!]?$/i.test(terminal)
  );
}
