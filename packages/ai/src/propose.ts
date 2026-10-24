// From a request in plain words to operations (ARCHITECTURE §9.1–9.4). The model only chooses
// operations and their arguments; every proposal is dry-run against the project before anyone
// sees it, and nothing is applied until the user confirms.
import {
  type AnyOperation,
  applyOperation,
  type Effect,
  type OperationArgs,
  operationsFor,
  type ProjectFiles,
  type SpecIR,
  type SpecPlugin,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import {
  answerQuestion,
  type ContextSlice,
  looksLikeQuestion,
  matchRequest,
  refusalOf,
} from "@smithable/index";
import { completeJson, type Provider, REPAIRS, type Usage } from "./provider.js";
import { smallTalk } from "./small-talk.js";

export interface ProposedOperation {
  op: string;
  args: OperationArgs;
  /** Plain language, e.g. "Add field phone (phone) to Customer". */
  description: string;
  destructive: boolean;
}

export type Proposal =
  | {
      kind: "change";
      operations: ProposedOperation[];
      files: ProjectFiles;
      usage: Usage[];
      /** Set when no model was needed: the wording rule that read the request (tier 0). */
      generator?: string;
    }
  | { kind: "question"; question: string; options: string[]; usage: Usage[] }
  /** A question about the app, answered rather than applied (docs/design/studio-v2.md §4). */
  | { kind: "answer"; text: string; concepts: string[]; usage: Usage[]; generator?: string }
  | { kind: "none"; reason: string; usage: Usage[] }
  | { kind: "failed"; message: string; usage: Usage[] };

const SYSTEM = `You change a Smithable app. Smithable apps are described by a spec, and change only through operations.
Answer with JSON only:
- {"kind":"operations","operations":[{"op":"<operation>","args":{…}}]} when the request clearly means one change (one or more operations).
- {"kind":"question","question":"…","options":["…","…"]} when the request could mean different changes, or it is unclear what it is about. Never guess.
- {"kind":"answer","text":"…"} when the request is a question about the app (who can do what, what something is, whether it is public, what happens when), answered in one to three plain sentences from the app as described; never a change.
- {"kind":"answer","text":"…"} also for a greeting, thanks or other small talk: one or two friendly sentences, like a chat, that suggest something to change or ask about this app. Never answer "none" to small talk.
- {"kind":"none","reason":"…"} when the request is a change no operation can do. Anything that sends email or messages, happens by itself (on a schedule or when something changes), calculates beyond a spreadsheet formula, or talks to other systems needs custom code: answer "none" and say so.
Do only what is asked: add no fields, required flags (!), searches, pages or menus the request does not mention. A new field is optional (no "!") unless the request says it must always be filled in; "should have" is not "must".
If the app already does what is asked, answer {"kind":"none","reason":"Already done: …"}. Never change or remove an existing field, page, menu entry or rule unless the request asks for exactly that; a changed menu lists every page that stays in it.
A record belongs to whoever created it. When the request says it belongs to, is handled by or is the responsibility of a person named in the record, that is setOwner with the record's User field (add the field first when there is none); access for "owner" then means that person.
Use the exact names of models, fields and pages from the app. New names are camelCase (fields) or PascalCase (models).
Field types (shorthand): string, text, email, phone, url, int, decimal, money, bool, date, datetime; choices as "a | b | c"; a reference to another model as "Customer"; a list of related records as "Order[]". Append ! for required, add "unique", and "= value" for a default: "email! unique", "int = 60".`;

/** The operations a model may propose: the project's, its plugins' included, but the whole-file edit. */
const proposable = (plugins?: readonly SpecPlugin[]) =>
  operationsFor(plugins).filter((o) => o.name !== "editSpec");

/** The operation's arguments, compactly: names, types, allowed values and hints. */
export function signature(op: AnyOperation): string {
  const schema = op.schema as {
    properties?: Record<
      string,
      { type?: string; enum?: unknown[]; description?: string; items?: { type?: string } }
    >;
    required?: string[];
  };
  const args = Object.entries(schema.properties ?? {}).map(([name, p]) => {
    const type = p.enum
      ? p.enum.map((v) => JSON.stringify(v)).join(" | ")
      : p.type === "array"
        ? `${p.items?.type ?? "string"}[]`
        : (p.type ?? "any");
    const optional = schema.required?.includes(name) ? "" : "?";
    return `${name}${optional}: ${type}${p.description ? ` (${p.description})` : ""}`;
  });
  return `- ${op.name} { ${args.join(", ")} }: ${op.summary}`;
}

/**
 * The operations that can be about the request's concepts (ARCHITECTURE §9.3): one that
 * changes an existing model, field or page is offered only when the context has one. Operations
 * that create something, or work on the app as a whole, are always offered. Fewer choices make
 * a small model choose better and cost fewer tokens.
 */
export function relevantOperations(
  concepts: string[],
  plugins?: readonly SpecPlugin[],
): AnyOperation[] {
  const has = (kind: string) => concepts.some((c) => c.startsWith(`${kind}:`));
  const models = has("model") || has("field");
  const pages = has("page");
  return proposable(plugins).filter((op) => {
    const properties = Object.keys((op.schema as { properties?: object }).properties ?? {});
    // What the operation works on: an existing model (or a field of one), an existing page or
    // menu. The ones that make a model or a page from nothing need neither.
    const needsModel =
      op.name !== "addModel" && (properties.includes("model") || properties.includes("field"));
    const needsPage =
      !["addLandingPage", "addTile"].includes(op.name) &&
      ["page", "pages", "menu"].some((p) => properties.includes(p));
    if (!needsModel && !needsPage) return true;
    return (needsModel && models) || (needsPage && pages);
  });
}

/**
 * The answer's shape for constrained decoding. Strict: each operation's own argument schema,
 * so a constrained model cannot name an argument wrong or leave a required one out, which
 * saves the repair round. Loose: only the operation names, for servers whose JSON Schema
 * support stops at that (the provider falls back to it).
 */
export function answerSchema(operations: AnyOperation[], strict = true): object {
  const item = strict
    ? {
        anyOf: operations.map((op) => ({
          type: "object",
          required: ["op", "args"],
          additionalProperties: false,
          properties: { op: { const: op.name }, args: plainSchema(op.schema) },
        })),
      }
    : {
        type: "object",
        required: ["op", "args"],
        properties: { op: { enum: operations.map((o) => o.name) }, args: { type: "object" } },
      };
  return {
    type: "object",
    required: ["kind"],
    properties: {
      kind: { enum: ["operations", "question", "answer", "none"] },
      operations: { type: "array", items: item },
      question: { type: "string" },
      options: { type: "array", items: { type: "string" } },
      text: { type: "string" },
      reason: { type: "string" },
    },
  };
}

/**
 * What a provider is asked. A local model pays no tokens but prefills slowly, so it gets the
 * same system text and the whole operation list every time: a stable prefix its server keeps
 * in its cache, with only the request's context after it. A hosted model pays per token, so
 * it gets only the operations that fit the request, after the context.
 */
export function promptFor(
  provider: Pick<Provider, "location">,
  context: ContextSlice,
  plugins?: readonly SpecPlugin[],
): { system: string; user: string; operations: AnyOperation[] } {
  const operations = relevantOperations(context.concepts, plugins);
  if (provider.location === "local") {
    return {
      system: `${SYSTEM}\n\nOperation arguments:\n${proposable(plugins).map(signature).join("\n")}`,
      user: `${context.text}\n\nOperations that fit this request: ${operations.map((o) => o.name).join(", ")}.`,
      operations,
    };
  }
  return {
    system: SYSTEM,
    user: `${context.text}\n\nOperation arguments:\n${operations.map(signature).join("\n")}`,
    operations,
  };
}

/** A schema without Smithable's own annotations (x-smithable), which a strict server may refuse. */
export function plainSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(plainSchema);
  if (schema && typeof schema === "object")
    return Object.fromEntries(
      Object.entries(schema as Record<string, unknown>)
        .filter(([key]) => !key.startsWith("x-"))
        .map(([key, value]) => [key, plainSchema(value)]),
    );
  return schema;
}

interface Answer {
  kind?: string;
  operations?: { op?: string; args?: OperationArgs }[];
  question?: string;
  options?: string[];
  text?: string;
  reason?: string;
}

/**
 * Asks the allowed models, cheapest tier first, for the operations a request means. A model
 * gets two chances to repair an answer that does not apply; after that, or when it says no
 * operation can do it while a stronger model is allowed, the request goes to the next tier.
 * Every tier gets the same semantic context.
 */
export async function proposeChange(options: {
  request: string;
  files: ProjectFiles;
  context: ContextSlice;
  /** Allowed by the AI policy, in the order to try them (see `route`). */
  providers: Provider[];
  /** Whether any model is set up at all, so an empty list is the policy's doing, not a missing setup. */
  anyConfigured?: boolean;
  /**
   * What only the host can check, e.g. that a new required field has no existing rows to
   * fill. A message sends the proposal back for repair like any other error.
   */
  check?: (before: ProjectFiles, after: ProjectFiles, effects: Effect[]) => string | undefined;
}): Promise<Proposal> {
  const { files, context, providers } = options;
  const usage: Usage[] = [];
  // Tier 0: a request worded like one of the everyday changes needs no model at all. Its
  // operations get the same dry run and host check; when they do not apply, a model reads it.
  // The spec read once for every rule tier below.
  const ir = validateSpec(
    { path: "smithable.yml", text: files.spec },
    files.plugins ? { plugins: files.plugins } : {},
  ).ir;
  // Tier 0 for small talk: a greeting or thanks is answered like a chat, by rule (A 151).
  const talk = smallTalk(options.request, ir);
  if (talk) return { kind: "answer", text: talk, concepts: [], usage, generator: "small talk" };
  // Tier 0 for questions: what the spec answers on its own (who can, what is, is it public…).
  const answered = ir && questionTier(files, ir, options.request);
  if (answered)
    return {
      kind: "answer",
      text: answered.text,
      concepts: answered.concepts,
      usage,
      generator: answered.rule,
    };
  const phrased = ir && phraseTier(files, ir, options.request);
  // The rules read it and it cannot be done as asked (the field is there already, no field has
  // that name): the reason, not a model that would meet the same.
  const why = phrased || !ir ? undefined : refusalTier(files, ir, options.request);
  if (why) return { kind: "none", reason: why.refusal, usage };
  if (phrased) {
    const checked = dryRun(files, phrased.operations);
    if (checked.ok && unchanged(files, checked.files))
      return { kind: "none", reason: NOTHING, usage };
    const refused = checked.ok ? options.check?.(files, checked.files, checked.effects) : undefined;
    if (checked.ok && !refused)
      return {
        kind: "change",
        operations: checked.operations,
        files: checked.files,
        usage,
        generator: phrased.rule,
      };
  }
  // Said for the maker: what is missing and where to read how (the stranger walk, 2026-10-07).
  if (providers.length === 0)
    return {
      kind: "failed",
      message: options.anyConfigured
        ? "No model is available under the AI policy: the models set up run where the policy does not allow. Change the policy (SMITHABLE_AI_POLICY) or set up one that fits; see AI setup (docs.smithable.ai/ai.html)."
        : "This needs an AI model, and none is set up yet: see AI setup (docs.smithable.ai/ai.html). A local model, the Smithable model or Claude Code can do it.",
      usage,
    };
  let problem = "";
  let none: string | undefined;
  for (const [index, provider] of providers.entries()) {
    const { system, user, operations } = promptFor(provider, context, files.plugins);
    const schema = answerSchema(operations);
    const fallbackSchema = answerSchema(operations, false);
    let prompt = user;
    for (let attempt = 0; attempt < 1 + REPAIRS; attempt++) {
      let answer: Answer;
      try {
        answer = (await completeJson(
          provider,
          { system, user: prompt, schema, fallbackSchema },
          usage,
        )) as Answer;
      } catch (error) {
        // Unreachable or not JSON: the next tier gets the request.
        problem = error instanceof Error ? error.message : String(error);
        break;
      }
      if (answer.kind === "answer" && answer.text)
        return { kind: "answer", text: answer.text, concepts: [], usage };
      if (answer.kind === "question" && answer.question)
        return {
          kind: "question",
          question: answer.question,
          options: answer.options ?? [],
          usage,
        };
      if (answer.kind === "none") {
        // A small model's "cannot" is not the last word while a stronger one is allowed.
        none = answer.reason ?? "No operation can do this.";
        if (index === providers.length - 1) return { kind: "none", reason: none, usage };
        break;
      }
      const checked = dryRun(files, answer.operations ?? []);
      // Operations that leave every file as it was are no change: nothing to apply or trace.
      if (checked.ok && unchanged(files, checked.files))
        return { kind: "none", reason: NOTHING, usage };
      const refused = checked.ok
        ? options.check?.(files, checked.files, checked.effects)
        : undefined;
      if (checked.ok && !refused)
        return { kind: "change", operations: checked.operations, files: checked.files, usage };
      problem = checked.ok ? (refused as string) : checked.message;
      prompt = `${user}\n\nYour previous answer was:\n${JSON.stringify(answer)}\nIt cannot be applied: ${problem}\nAnswer again.`;
    }
  }
  if (none !== undefined && !problem) return { kind: "none", reason: none, usage };
  return { kind: "failed", message: `No model found a change that applies. ${problem}`, usage };
}

/** Why the rules cannot make a request they read, when that is so (tier 0). */
function refusalTier(files: ProjectFiles, ir: SpecIR, request: string) {
  const auth =
    files.auth === undefined
      ? undefined
      : validateAuth({ path: "smithable.auth.yml", text: files.auth }).auth;
  return refusalOf(ir, request, auth?.roles.map((r) => r.name) ?? [], auth);
}

/** The operations a request's wording means without a model (ARCHITECTURE §9.2, tier 0). */
function phraseTier(files: ProjectFiles, ir: SpecIR, request: string) {
  const auth =
    files.auth === undefined
      ? undefined
      : validateAuth({ path: "smithable.auth.yml", text: files.auth }).auth;
  return matchRequest(ir, request, auth?.roles.map((r) => r.name) ?? [], auth);
}

/** A question about the app the index answers without a model (tier 0). */
function questionTier(files: ProjectFiles, ir: SpecIR, request: string) {
  if (!looksLikeQuestion(request)) return undefined;
  const auth =
    files.auth === undefined
      ? undefined
      : validateAuth({ path: "smithable.auth.yml", text: files.auth }, ir).auth;
  const content =
    files.content === undefined
      ? undefined
      : validateContent({ path: "smithable.content.yml", text: files.content }, ir).content;
  return answerQuestion(ir, request, auth, content);
}

const NOTHING = "This changes nothing.";

/** Whether every file is as it was (a setting put back to what it already is). */
function unchanged(before: ProjectFiles, after: ProjectFiles): boolean {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)] as (keyof ProjectFiles)[]);
  return [...keys].every((k) => JSON.stringify(before[k]) === JSON.stringify(after[k]));
}

/** Applies the operations one after the other to copies of the files. */
function dryRun(
  files: ProjectFiles,
  operations: { op?: string; args?: OperationArgs }[],
):
  | { ok: true; operations: ProposedOperation[]; files: ProjectFiles; effects: Effect[] }
  | { ok: false; message: string } {
  if (operations.length === 0) return { ok: false, message: "The answer has no operations." };
  let current = files;
  const proposed: ProposedOperation[] = [];
  const effects: Effect[] = [];
  for (const { op = "", args = {} } of operations) {
    const result = applyOperation(current, op, args);
    if (!result.ok) {
      const detail = result.diagnostics.map((d) => d.message).join(" ");
      return { ok: false, message: `${op}: ${result.message}${detail ? ` ${detail}` : ""}` };
    }
    proposed.push({ op, args, description: result.description, destructive: result.destructive });
    effects.push(...result.effects);
    current = result.files;
  }
  return { ok: true, operations: proposed, files: current, effects };
}
