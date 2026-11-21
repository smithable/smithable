import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { kitSummary } from "@smithable/adapter-tanstack";
import {
  type Completion,
  cached,
  openAICompatible,
  type Paused,
  type Proposal,
  type Provider,
  parsePolicy,
  proposeChange,
  type ResponseStore,
  route,
  type Usage,
} from "@smithable/ai";
import { PEOPLE_PATH, validateSpec } from "@smithable/core";
import { appParts, buildContext, specLines, summarize } from "@smithable/index";
import { anthropic } from "./anthropic.js";
import { bedrock } from "./bedrock.js";
import { claudeCode } from "./claude-code.js";
import { coderFromEnv, writeCode } from "./code.js";
import { logTokens } from "./context.js";
import type { Io } from "./io.js";
import { requiredButEmpty, runOperation } from "./op.js";
import { loadPlugins } from "./plugins.js";
import { projectIndex } from "./rules.js";
import { modelKey, treeText } from "./secrets.js";
import { loadSpec, projectThemes } from "./validate.js";

/**
 * The models Smithable may use, from the environment (ARCHITECTURE §9.5), so keys never end
 * up in the project. A local model (Ollama by default) and the Smithable model, an open model
 * on an EU-hosted OpenAI-compatible endpoint.
 */
/** The models the AI policy (SMITHABLE_AI_POLICY) allows, cheapest first: every caller's. */
export function providersFor(env: NodeJS.ProcessEnv = process.env): Provider[] {
  return route(aiProviders(env), parsePolicy(env.SMITHABLE_AI_POLICY));
}

export function aiProviders(env: NodeJS.ProcessEnv = process.env): Provider[] {
  const providers: Provider[] = [];
  if (env.SMITHABLE_LOCAL_MODEL)
    providers.push(
      openAICompatible({
        name: "local",
        baseUrl: env.SMITHABLE_LOCAL_URL ?? "http://localhost:11434/v1",
        model: env.SMITHABLE_LOCAL_MODEL,
        tier: "local",
        location: "local",
      }),
    );
  if (env.SMITHABLE_MODEL && env.SMITHABLE_MODEL_URL) {
    // "0.1/0.3": euros per million input and output tokens; without it, a known model's list
    // price (in dollars), or nothing.
    const [input = 0, output = 0] = (env.SMITHABLE_MODEL_PRICE ?? "").split("/").map(Number);
    providers.push(
      openAICompatible({
        name: "smithable",
        baseUrl: env.SMITHABLE_MODEL_URL,
        model: env.SMITHABLE_MODEL,
        ...((env.SMITHABLE_MODEL_KEY ?? modelKey())
          ? { apiKey: env.SMITHABLE_MODEL_KEY ?? modelKey() }
          : {}),
        tier: "smithable",
        location: env.SMITHABLE_MODEL_LOCATION === "elsewhere" ? "elsewhere" : "eu",
        ...(env.SMITHABLE_MODEL_PRICE ? { price: { input, output } } : {}),
      }),
    );
  }
  // A frontier model through the user's own Claude Code: SMITHABLE_FRONTIER=claude-code.
  if (env.SMITHABLE_FRONTIER === "claude-code")
    providers.push(claudeCode(env.SMITHABLE_FRONTIER_MODEL || undefined));
  // Claude through Amazon Bedrock and the signed-in `aws` command: SMITHABLE_FRONTIER=bedrock,
  // SMITHABLE_FRONTIER_MODEL=<inference profile id> (an eu. one stays in the EU).
  if (env.SMITHABLE_FRONTIER === "bedrock" && env.SMITHABLE_FRONTIER_MODEL)
    providers.push(
      bedrock(
        env.SMITHABLE_FRONTIER_MODEL,
        env.SMITHABLE_BEDROCK_REGION || env.AWS_REGION || "eu-north-1",
        env.SMITHABLE_USAGE_LOG,
      ),
    );
  // Claude through Anthropic's own API: SMITHABLE_FRONTIER=anthropic, SMITHABLE_FRONTIER_MODEL=one
  // or more models, cheapest first (claude-haiku-5-5,claude-sonnet-5-5), the key in ANTHROPIC_API_KEY.
  if (
    env.SMITHABLE_FRONTIER === "anthropic" &&
    env.SMITHABLE_FRONTIER_MODEL &&
    env.ANTHROPIC_API_KEY
  )
    for (const model of env.SMITHABLE_FRONTIER_MODEL.split(",")
      .map((m) => m.trim())
      .filter(Boolean))
      providers.push(anthropic(model, env.ANTHROPIC_API_KEY, env.SMITHABLE_USAGE_LOG));
  // The benchmark's and tests' response cache (SMITHABLE_LLM_CACHE=<folder>): a request seen
  // before is answered from the folder. Never on unless set. SMITHABLE_LLM_REPLAY=1 replays only:
  // a request not in the folder fails and no model is asked. SMITHABLE_LLM_REPLAY=loose replays
  // too, and answers a request whose system prompt or schemas changed since the recording by the
  // answer recorded for the same model and user text (the description); each such answer is a line
  // in SMITHABLE_LLM_LOOSE_LOG, so a run says how many it took. A loose replay tests what runs
  // after the model, never the model or its prompt. SMITHABLE_LLM_CACHE_FROM=<folder> answers from
  // a second folder too and copies each answer used into the first (a fixture made from a whole
  // recording keeps only what its runs read).
  const folder = env.SMITHABLE_LLM_CACHE;
  if (!folder) return providers;
  const store = folderStore(folder, env.SMITHABLE_LLM_CACHE_FROM);
  const replay = env.SMITHABLE_LLM_REPLAY;
  return providers.map((p) =>
    cached(
      replay === "1" || replay === "loose"
        ? offline(p, store, replay === "loose" ? (env.SMITHABLE_LLM_LOOSE_LOG ?? "") : undefined)
        : p,
      store,
    ),
  );
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/**
 * A provider that never asks its model: for replays, where a request not recorded is an error.
 * A recording made before the output allowance was part of the key (2026-11-14) still answers a
 * request with an allowance, when the recorded answer is shorter than it: the model, asked with the
 * allowance, would have given the same answer. With `looseLog` set (a loose replay), a request
 * still not found is answered by the recording's answer for the same model and user text.
 */
function offline(provider: Provider, store: FolderStore, looseLog?: string): Provider {
  const model = provider.model ?? null;
  return {
    ...provider,
    async complete(request) {
      const answer = (kept: string) => ({
        ...(JSON.parse(kept) as Completion),
        inputTokens: 0,
        outputTokens: 0,
      });
      if (request.maxOutputTokens !== undefined) {
        const before = sha256(
          JSON.stringify([
            provider.name,
            model,
            request.system,
            request.user,
            request.schema,
            request.fallbackSchema ?? null,
          ]),
        );
        const kept = await store.get(before);
        if (
          kept !== undefined &&
          (JSON.parse(kept) as Completion).outputTokens < request.maxOutputTokens
        )
          return answer(kept);
      }
      if (looseLog !== undefined) {
        const kept = await store.loose(provider.name, model, request.user);
        if (kept !== undefined) {
          if (looseLog)
            appendFileSync(
              looseLog,
              `${JSON.stringify({ model, user: sha256(request.user).slice(0, 12) })}\n`,
            );
          return answer(kept);
        }
      }
      throw new Error(
        `Not in the recording: ${provider.model ?? provider.name} was asked something it was not asked when recorded.`,
      );
    },
  };
}

/**
 * Where the models the AI policy allows run, in words, for Smith's AI notice (legal-1.0 U6): each
 * provider and its region; none when no model is configured, so Smith answers by rule and nothing
 * leaves Studio.
 */
export function aiDestinations(env: NodeJS.ProcessEnv = process.env): string[] {
  const bedrock = env.SMITHABLE_BEDROCK_REGION || env.AWS_REGION || "eu-north-1";
  const where: Record<string, string> = {
    local: "a model on this computer",
    // The hosted model's provider and place are the service's to say (ASSISTANT_PROVIDER and
    // _REGION, the same words the apps' assistant shows); without them no place is guessed (T864).
    smithable: ((provider, region) =>
      provider && region
        ? `${provider}, in ${region}`
        : provider
          ? provider
          : region
            ? `the Smithable model, in ${region}`
            : "the Smithable model, where the Smithable service runs it")(
      env.ASSISTANT_PROVIDER?.trim(),
      env.ASSISTANT_REGION?.trim(),
    ),
    anthropic: "Anthropic's Claude, in the USA",
    "claude-code": "Anthropic's Claude through your Claude Code, in the USA",
    // A cross-region inference profile's prefix says where it routes (eu., us., global.…); without
    // one, the region the calls go to.
    bedrock: `Anthropic's Claude on Amazon Bedrock, ${((prefix) =>
      prefix
        ? prefix === "eu"
          ? "in the EU"
          : "outside the EU"
        : bedrock.startsWith("eu-")
          ? "in the EU"
          : `in ${bedrock}`)(/^([a-z]+)\./.exec(env.SMITHABLE_FRONTIER_MODEL ?? "")?.[1])}`,
  };
  return [...new Set(providersFor(env).map((p) => where[p.name] ?? p.name))];
}

/**
 * Whether every model Smith may use runs in the EU, for his notice's "processed in the EU": only
 * when the service says so (ASSISTANT_EU=1, for its EU levels) and its model is the only one the
 * policy allows; the engine never decides it from a region's name.
 */
export function aiInEu(env: NodeJS.ProcessEnv = process.env): boolean {
  const providers = providersFor(env);
  return (
    env.ASSISTANT_EU?.trim() === "1" &&
    providers.length > 0 &&
    providers.every((p) => p.name === "smithable")
  );
}

/**
 * Where Smith may hear and speak (docs/design/smith-speech.md §3), from the same policy as his
 * requests: `browser` (the browser's own recognition and voices; under eu-only only what the
 * browser says runs on the device) and, on the hosted service, `service` (its gateway, in the EU).
 * Under local-only, or a policy that names its providers, Smith neither hears nor speaks.
 */
export function speechProviders(
  env: NodeJS.ProcessEnv = process.env,
): { name: "browser" | "service"; onDeviceOnly?: true }[] {
  const policy = parsePolicy(env.SMITHABLE_AI_POLICY);
  if (policy === "local-only" || typeof policy !== "string") return [];
  return [
    { name: "browser", ...(policy === "eu-only" ? { onDeviceOnly: true as const } : {}) },
    ...(env.SMITHABLE_SPEECH_SERVICE ? [{ name: "service" as const }] : []),
  ];
}

/** A response store in a folder, which can also answer loosely (by model and user text). */
interface FolderStore extends ResponseStore {
  loose(provider: string, model: string | null, user: string): Promise<string | undefined>;
}

/**
 * The folder's layout: `<2>/<key>.json` the answer; `requests/<key>.json` what was asked (the
 * system text and schemas by the hash of their file in `parts/`, written once however many
 * requests share them); `loose/<hash>.json` names the first answer to a model and user text.
 */
export function folderStore(folder: string, from?: string): FolderStore {
  const path = (dir: string, key: string) => join(dir, key.slice(0, 2), `${key}.json`);
  const write = (file: string, text: string) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  };
  // A file from the folder, or from the second folder, copied into the first when used.
  const read = (name: string) => {
    if (existsSync(join(folder, name))) return readFileSync(join(folder, name), "utf8");
    if (!from || !existsSync(join(from, name))) return undefined;
    const text = readFileSync(join(from, name), "utf8");
    write(join(folder, name), text);
    return text;
  };
  const part = (value: unknown) => {
    if (value === undefined || value === null) return null;
    const text = typeof value === "string" ? value : JSON.stringify(value);
    const hash = sha256(text);
    const file = join(folder, "parts", `${hash}.txt`);
    if (!existsSync(file)) write(file, text);
    return hash;
  };
  const looseName = (provider: string, model: string | null, user: string) =>
    join("loose", `${sha256(JSON.stringify([provider, model, user]))}.json`);
  return {
    async get(key) {
      return read(join(key.slice(0, 2), `${key}.json`));
    },
    async set(key, value, request) {
      write(path(folder, key), value);
      if (!request) return;
      const { system, schema, fallbackSchema, ...rest } = request;
      write(
        join(folder, "requests", `${key}.json`),
        `${JSON.stringify({ ...rest, system: part(system), schema: part(schema), fallbackSchema: part(fallbackSchema) }, null, 1)}\n`,
      );
      const loose = join(folder, looseName(request.provider, request.model, request.user));
      if (!existsSync(loose)) write(loose, `${JSON.stringify({ answer: key })}\n`);
    },
    async loose(provider, model, user) {
      const index = read(looseName(provider, model, user));
      if (index === undefined) return undefined;
      const { answer: key } = JSON.parse(index) as { answer: string };
      return read(join(key.slice(0, 2), `${key}.json`));
    },
  };
}

/** The model's proposal for a request, dry-run against the project; nothing is applied. */
export async function proposeFor(
  dir: string,
  io: Io,
  request: string,
  id: string = randomUUID(),
  around: Pick<Parameters<typeof proposeChange>[0], "conversation" | "docs"> = {},
): Promise<Proposal | undefined> {
  const { ir, auth, content, ux } = loadSpec(dir, io);
  if (!ir || !auth) return undefined;
  const read = (name: string) =>
    existsSync(join(dir, name)) ? treeText(join(dir, name)) : undefined;
  const files = {
    spec: read("smithable.yml") as string,
    ...(read("smithable.content.yml") ? { content: read("smithable.content.yml") } : {}),
    ...(read("smithable.auth.yml") ? { auth: read("smithable.auth.yml") } : {}),
    ...(read("smithable.ux.yml") ? { ux: read("smithable.ux.yml") } : {}),
    // The sample users, so "add three customers" names new people and counts to five.
    ...(read(PEOPLE_PATH) !== undefined ? { people: read(PEOPLE_PATH) } : {}),
    plugins: loadPlugins(dir),
    themes: projectThemes(dir),
  };
  const context = buildContext(projectIndex(dir, ir, auth), request);
  // The app's own summary, the parts the request names (T755): what a question is answered from.
  const lines = specLines(files.spec, request);
  const app = `${appParts(summarize(ir, auth, content, files.plugins, ux), request)}${lines ? `\n\nIts lines in smithable.yml:\n${lines}` : ""}`;
  const providers = providersFor();
  const irOf = (text: string) =>
    validateSpec({ path: "smithable.yml", text }, { plugins: files.plugins }).ir;
  const proposal = await proposeChange({
    request,
    files,
    context,
    providers,
    anyConfigured: aiProviders().length > 0,
    kit: kitSummary(),
    app,
    ...around,
    // What only the project's data can tell: a new required field on a table with rows.
    check: (before, after, effects) => {
      const [was, will] = [irOf(before.spec), irOf(after.spec)];
      return was && will ? requiredButEmpty(dir, was, will, effects) : undefined;
    },
  });
  // With the outcome logged under the same id (proposalOutcome), a request, its context, the
  // answer and whether it was applied: the start of a training set (ARCHITECTURE §9.2).
  logTokens(dir, {
    source: "ask",
    id,
    request,
    concepts: context.concepts,
    usage: proposal.usage,
    answered:
      (proposal.kind === "change" || proposal.kind === "answer") && proposal.generator
        ? "generator"
        : proposal.usage.at(-1)?.tier,
    kind: proposal.kind,
    ...(proposal.kind === "change"
      ? { operations: proposal.operations.map(({ op, args }) => ({ op, args })) }
      : {}),
  });
  return proposal;
}

/** What became of a proposal: applied, declined, or its apply failed. */
export function proposalOutcome(
  dir: string,
  id: string,
  outcome: "applied" | "declined" | "failed",
) {
  logTokens(dir, { source: "ask-outcome", id, outcome });
}

const TIER_NAMES = {
  local: "Local model",
  smithable: "Smithable model",
  frontier: "Frontier model",
};

/**
 * "Smithable model (mistral-small) · 1,234 tokens · €0.0003", for what a request used, or
 * "Generator (rule) · 0 tokens" when a wording rule read it and no model was needed (tier 0).
 */
export function usageLine(usage: Usage[], generator?: string): string {
  const last = usage.at(-1);
  if (generator && !last) return `Generator (${generator}) · 0 tokens`;
  if (!last) return "No model was used";
  const input = usage.reduce((sum, u) => sum + u.inputTokens, 0);
  const output = usage.reduce((sum, u) => sum + u.outputTokens, 0);
  const fromCache = usage.filter((u) => u.cached).length;
  // A price given in euros, a list price or Claude Code in dollars: each is totalled on its own.
  const costs = (["EUR", "USD"] as const).flatMap((currency) => {
    const list = usage.filter((u) => u.currency === currency);
    const sum = list.reduce((n, u) => n + u.cost, 0);
    return list.length ? [`${currency === "EUR" ? "€" : "$"}${sum.toFixed(4)}`] : [];
  });
  return `${TIER_NAMES[last.tier]} (${last.model}) · ${(input + output).toLocaleString("en")} tokens (${input.toLocaleString("en")} in, ${output.toLocaleString("en")} out)${costs.length ? ` · ${costs.join(" + ")}` : ""}${fromCache ? ` · ${fromCache} of ${usage.length} calls from the cache` : ""}`;
}

/**
 * Applies a confirmed proposal through the normal operation pipeline: each operation is
 * checked, regenerated, migrated and committed on its own, so each can be undone. The first
 * commit carries what the model used.
 */
export async function applyProposal(
  dir: string,
  io: Io,
  request: string,
  proposal: Extract<Proposal, { kind: "change" }>,
  /** The revision the proposal was made against: the first operation refuses if it moved. */
  base?: string,
): Promise<number> {
  const tokens = proposal.usage.reduce((sum, u) => sum + u.inputTokens + u.outputTokens, 0);
  const cost = proposal.usage.reduce((sum, u) => sum + u.cost, 0);
  const last = proposal.usage.at(-1);
  for (const [i, { op, args }] of proposal.operations.entries()) {
    // A change a wording rule read (no model) is recorded as the generator's, with the rule.
    const trailer = `Smithable-AI: ${JSON.stringify({
      request,
      tier: last?.tier ?? (proposal.generator ? "generator" : undefined),
      model: last?.model ?? proposal.generator,
      tokens: i === 0 ? tokens : 0,
      cost: i === 0 ? Number(cost.toFixed(6)) : 0,
      currency: last?.currency,
    })}`;
    const code = await runOperation(dir, io, op, args, {
      yes: true,
      trailer,
      ...(i === 0 && base ? { expectedRevision: base } : {}),
    });
    if (code !== 0) {
      if (i > 0)
        io.err(`The first ${i} operation(s) were applied; undo them with smithable undo.\n`);
      return code;
    }
  }
  return 0;
}

/**
 * Asks in the terminal whether to go ahead: true to go ahead, otherwise the exit code. Without
 * a terminal, only --yes goes ahead.
 */
export async function confirm(io: Io, question: string, yes: boolean): Promise<true | number> {
  if (yes) return true;
  if (!process.stdin.isTTY) {
    io.err("Run again with --yes to apply it.\n");
    return 1;
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(`${question} [y/N] `);
  prompt.close();
  if (/^y(es)?$/i.test(answer.trim())) return true;
  io.out("Nothing was changed.\n");
  return 0;
}

/** Free building paused, said plainly: why, until when, and that changes by rule still work. */
export function pausedText(paused: Paused): string {
  const until = new Date(paused.until).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const why =
    paused.reason === "shared"
      ? "Free building is paused for everyone for now"
      : `Your free building for this ${paused.reason} is used up`;
  return `${why}; it continues on ${until}. Changes made by rule, with no model, still work.${paused.invite ? ` Invite someone: ${paused.invite}` : ""}`;
}

/**
 * `smithable ask "<request>"`: a model proposes the operations a request means; they are
 * shown in plain language and applied only after confirmation (ARCHITECTURE §9.4).
 */
export async function ask(
  dir: string,
  io: Io,
  request: string | undefined,
  flags: { yes: boolean },
): Promise<number> {
  if (!request) {
    io.err('ask needs a request, like: smithable ask "Customers should have a website"\n');
    return 2;
  }
  const id = randomUUID();
  const proposal = await proposeFor(dir, io, request, id);
  if (!proposal) return 1;
  io.out(
    `${usageLine(proposal.usage, proposal.kind === "change" || proposal.kind === "answer" ? proposal.generator : undefined)}\n`,
  );
  switch (proposal.kind) {
    case "failed":
      io.err(`${proposal.message}\n`);
      return 1;
    case "none":
      // The reason is said as Smith says it (A 163), with the nearest thing that can be done.
      io.out(`${proposal.reason}\n`);
      // Behavior that follows a change is a hook, which a coder can write (ARCHITECTURE §6.4).
      if (
        /\b(e-?mail|message|notif|remind|schedule|daily|when |after |whenever|send)/i.test(
          `${request} ${proposal.reason}`,
        )
      )
        io.out(
          `If it should happen after a record changes, or daily, that is a hook: smithable code hooks ${JSON.stringify(request)}\n`,
        );
      return 0;
    case "question":
      io.out(
        `${proposal.question}\n${proposal.options.map((o) => `  - ${o}\n`).join("")}Ask again with the details.\n`,
      );
      return 0;
    case "answer":
      io.out(`${proposal.text}\n`);
      return 0;
    case "paused":
      io.err(`${pausedText(proposal.paused)}\n`);
      return 1;
  }
  io.out("Proposed change:\n");
  for (const [i, o] of proposal.operations.entries())
    io.out(`  ${i + 1}. ${o.description}${o.destructive ? " (loses data)" : ""}\n`);
  if (proposal.note) io.out(`${proposal.note}\n`);
  const confirmed = await confirm(io, "Apply it?", flags.yes);
  if (confirmed !== true) {
    proposalOutcome(dir, id, "declined");
    return confirmed;
  }
  const applied = await applyProposal(dir, io, request, proposal);
  proposalOutcome(dir, id, applied === 0 ? "applied" : "failed");
  if (applied !== 0) return applied;
  // A new query needs its code: a coder writes it when one is set up (ARCHITECTURE §9.2).
  for (const { op, args } of proposal.operations) {
    if (op !== "addQuery") continue;
    const concept = `query:${String(args.query)}`;
    const coder = coderFromEnv();
    if (!coder) {
      io.out(
        `${concept} works with a placeholder (every record, newest first). Write its code in src/custom/queries/, or set up a coder and run: smithable code ${concept} "${request}"\n`,
      );
      continue;
    }
    const code = await writeCode(
      dir,
      io,
      concept,
      `${request}${args.intent ? ` (${String(args.intent)})` : ""}`,
      coder,
    );
    if (code !== 0) return code;
  }
  return 0;
}
