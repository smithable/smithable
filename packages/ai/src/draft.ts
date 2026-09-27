// Starting from a sentence (ARCHITECTURE §9.8): the closest starter is chosen without a model,
// then the strongest allowed model adapts its spec files to the description, once per project.
// The draft is validated like a hand-written spec and shown in plain language before use.
import {
  buildJsonSchema,
  type Diagnostic,
  formatDiagnostic,
  validateAuth,
  validateContent,
  validateSpec,
  validateUx,
  words,
} from "@smithable/core";
import { completeJson, type Provider, type Usage } from "./provider.js";

export type SpecFiles = Record<string, string>;

export type Draft =
  | { kind: "draft"; files: SpecFiles; usage: Usage[] }
  | { kind: "failed"; message: string; usage: Usage[] };

const FILES = ["smithable.yml", "smithable.auth.yml", "smithable.content.yml", "smithable.ux.yml"];

/**
 * The starter whose spec shares the most words with the description, e.g. "a booking site for
 * a yoga studio" → booking. Deterministic: no model needed to pick where to start.
 */
export function closestStarter(description: string, starters: Record<string, SpecFiles>): string {
  const wanted = new Set(words(description).map((w) => w.toLowerCase()));
  const score = (files: SpecFiles) => {
    const known = new Set(words(Object.values(files).join(" ")).map((w) => w.toLowerCase()));
    return [...wanted].filter((w) => w.length > 3 && known.has(w)).length;
  };
  const names = Object.keys(starters);
  return names.reduce(
    (best, name) => (score(starters[name] ?? {}) > score(starters[best] ?? {}) ? name : best),
    names[0] ?? "",
  );
}

const SYSTEM = `You design the first version of a web app as Smithable spec files. Smithable generates the whole app from them.
Adapt the example project to the description: its models and fields, pages (crud, landing, dashboard, settings, onboarding), roles and access, theme, and the visible texts (landing page copy, labels). Keep what fits, remove what does not, and add what the description needs. Keep the files' format and version lines exactly.
Answer with JSON only: {"smithable.yml": "<YAML>", "smithable.auth.yml": "<YAML>", "smithable.content.yml": "<YAML>", "smithable.ux.yml": "<YAML>"}.`;

function answerSchema(): object {
  return {
    type: "object",
    required: ["smithable.yml", "smithable.auth.yml"],
    properties: Object.fromEntries(FILES.map((f) => [f, { type: "string" }])),
  };
}

/** Every problem in the drafted files, as "file:line:column  error  message" lines. */
export function checkSpecFiles(files: SpecFiles): Diagnostic[] {
  const auth = validateAuth({
    path: "smithable.auth.yml",
    text: files["smithable.auth.yml"] ?? "",
  });
  const roles = auth.auth?.roles.map((r) => r.name);
  const spec = validateSpec(
    { path: "smithable.yml", text: files["smithable.yml"] ?? "" },
    roles ? { roles } : {},
  );
  const problems = [...spec.diagnostics, ...auth.diagnostics];
  if (spec.ir) {
    const content = files["smithable.content.yml"];
    const ux = files["smithable.ux.yml"];
    if (content)
      problems.push(
        ...validateContent({ path: "smithable.content.yml", text: content }, spec.ir).diagnostics,
      );
    if (ux)
      problems.push(...validateUx({ path: "smithable.ux.yml", text: ux }, spec.ir).diagnostics);
  }
  return problems.filter((d) => d.severity === "error");
}

/**
 * Adapts a starter to a description with the strongest allowed model first. A draft with
 * errors goes back once with the exact diagnostics; then the next model tries.
 */
export async function draftProject(options: {
  description: string;
  starter: SpecFiles;
  /** Allowed by the AI policy, cheapest first (see `route`); the strongest is tried first. */
  providers: Provider[];
}): Promise<Draft> {
  const usage: Usage[] = [];
  if (options.providers.length === 0)
    return { kind: "failed", message: "No model is available under the AI policy.", usage };
  const example = FILES.filter((f) => options.starter[f])
    .map((f) => `--- ${f}\n${options.starter[f]}`)
    .join("\n");
  const user = `Description: ${options.description}\n\nExample project:\n${example}\n\nJSON Schema of smithable.yml:\n${JSON.stringify(buildJsonSchema())}`;
  let problem = "";
  for (const provider of [...options.providers].reverse()) {
    let prompt = user;
    for (let attempt = 0; attempt < 2; attempt++) {
      let files: SpecFiles;
      try {
        files = (await completeJson(
          provider,
          { system: SYSTEM, user: prompt, schema: answerSchema() },
          usage,
        )) as SpecFiles;
      } catch (error) {
        problem = error instanceof Error ? error.message : String(error);
        break;
      }
      const kept = Object.fromEntries(
        FILES.flatMap((f) => (typeof files[f] === "string" ? [[f, files[f] as string]] : [])),
      );
      const errors = checkSpecFiles(kept);
      if (errors.length === 0) return { kind: "draft", files: kept, usage };
      problem = errors.map(formatDiagnostic).join("\n");
      prompt = `${user}\n\nYour previous files have errors:\n${problem}\nAnswer again with all files corrected.`;
    }
  }
  return { kind: "failed", message: `No model drafted a valid project.\n${problem}`, usage };
}
