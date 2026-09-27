// From a request in plain words to operations (ARCHITECTURE §9.1–9.4). The model only chooses
// operations and their arguments; every proposal is dry-run against the project before anyone
// sees it, and nothing is applied until the user confirms.
import {
  type AnyOperation,
  applyOperation,
  type Effect,
  OPERATIONS,
  type OperationArgs,
  type ProjectFiles,
} from "@smithable/core";
import type { ContextSlice } from "@smithable/index";
import { completeJson, type Provider, type Usage } from "./provider.js";

export interface ProposedOperation {
  op: string;
  args: OperationArgs;
  /** Plain language, e.g. "Add field phone (phone) to Customer". */
  description: string;
  destructive: boolean;
}

export type Proposal =
  | { kind: "change"; operations: ProposedOperation[]; files: ProjectFiles; usage: Usage[] }
  | { kind: "question"; question: string; options: string[]; usage: Usage[] }
  | { kind: "none"; reason: string; usage: Usage[] }
  | { kind: "failed"; message: string; usage: Usage[] };

const SYSTEM = `You change a Smithable app. Smithable apps are described by a spec, and change only through operations.
Answer with JSON only:
- {"kind":"operations","operations":[{"op":"<operation>","args":{…}}]} when the request clearly means one change (one or more operations).
- {"kind":"question","question":"…","options":["…","…"]} when the request could mean different changes, or it is unclear what it is about. Never guess.
- {"kind":"none","reason":"…"} when no operation can do it. Anything that sends email or messages, happens by itself (on a schedule or when something changes), calculates beyond a spreadsheet formula, or talks to other systems needs custom code: answer "none" and say so.
Do only what is asked: add no fields, required flags (!), searches, pages or menus the request does not mention. A new field is optional (no "!") unless the request says it must always be filled in; "should have" is not "must".
If the app already does what is asked, answer {"kind":"none","reason":"Already done: …"}. Never change or remove an existing field, page, menu entry or rule unless the request asks for exactly that; a changed menu lists every page that stays in it.
Use the exact names of models, fields and pages from the app. New names are camelCase (fields) or PascalCase (models).
Field types (shorthand): string, text, email, phone, url, int, decimal, money, bool, date, datetime; choices as "a | b | c"; a reference to another model as "Customer"; a list of related records as "Order[]". Append ! for required, add "unique", and "= value" for a default: "email! unique", "int = 60".`;

/** The operation's arguments, compactly: names, types, allowed values and hints. */
function signature(op: AnyOperation): string {
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

/** The answer's shape, for constrained decoding. */
function answerSchema(): object {
  return {
    type: "object",
    required: ["kind"],
    properties: {
      kind: { enum: ["operations", "question", "none"] },
      operations: {
        type: "array",
        items: {
          type: "object",
          required: ["op", "args"],
          properties: { op: { enum: OPERATIONS.map((o) => o.name) }, args: { type: "object" } },
        },
      },
      question: { type: "string" },
      options: { type: "array", items: { type: "string" } },
      reason: { type: "string" },
    },
  };
}

interface Answer {
  kind?: string;
  operations?: { op?: string; args?: OperationArgs }[];
  question?: string;
  options?: string[];
  reason?: string;
}

/**
 * Asks the allowed models, cheapest tier first, for the operations a request means. A model
 * gets two chances to repair an answer that does not apply; after that the request goes to
 * the next tier. The same semantic context goes to every tier.
 */
export async function proposeChange(options: {
  request: string;
  files: ProjectFiles;
  context: ContextSlice;
  /** Allowed by the AI policy, in the order to try them (see `route`). */
  providers: Provider[];
  /**
   * What only the host can check, e.g. that a new required field has no existing rows to
   * fill. A message sends the proposal back for repair like any other error.
   */
  check?: (before: ProjectFiles, after: ProjectFiles, effects: Effect[]) => string | undefined;
}): Promise<Proposal> {
  const { files, context, providers } = options;
  const usage: Usage[] = [];
  if (providers.length === 0)
    return {
      kind: "failed",
      message:
        "No model is available under the AI policy. Set up a local model or the Smithable model, or change the policy.",
      usage,
    };
  const user = `${context.text}\n\nOperation arguments:\n${OPERATIONS.filter(
    (o) => o.name !== "editSpec",
  )
    .map(signature)
    .join("\n")}`;
  let problem = "";
  for (const provider of providers) {
    let prompt = user;
    for (let attempt = 0; attempt < 3; attempt++) {
      let answer: Answer;
      try {
        answer = (await completeJson(
          provider,
          { system: SYSTEM, user: prompt, schema: answerSchema() },
          usage,
        )) as Answer;
      } catch (error) {
        // Unreachable or not JSON: the next tier gets the request.
        problem = error instanceof Error ? error.message : String(error);
        break;
      }
      if (answer.kind === "question" && answer.question)
        return {
          kind: "question",
          question: answer.question,
          options: answer.options ?? [],
          usage,
        };
      if (answer.kind === "none")
        return { kind: "none", reason: answer.reason ?? "No operation can do this.", usage };
      const checked = dryRun(files, answer.operations ?? []);
      const refused = checked.ok
        ? options.check?.(files, checked.files, checked.effects)
        : undefined;
      if (checked.ok && !refused)
        return { kind: "change", operations: checked.operations, files: checked.files, usage };
      problem = checked.ok ? (refused as string) : checked.message;
      prompt = `${user}\n\nYour previous answer was:\n${JSON.stringify(answer)}\nIt cannot be applied: ${problem}\nAnswer again.`;
    }
  }
  return { kind: "failed", message: `No model found a change that applies. ${problem}`, usage };
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
