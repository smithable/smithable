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
import { languageNote } from "./language.js";
import { completeJson, type Provider, REPAIRS, type Usage } from "./provider.js";

export type SpecFiles = Record<string, string>;

export type Draft =
  | {
      kind: "draft";
      files: SpecFiles;
      usage: Usage[];
      /** What was left out because it could not be made valid, in words. */
      dropped?: string[];
    }
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
  const best = names.reduce(
    (b, name) => (score(starters[name] ?? {}) > score(starters[b] ?? {}) ? name : b),
    names[0] ?? "",
  );
  // Nothing in common with any starter: the neutral one, when there is one.
  return score(starters[best] ?? {}) === 0 && "records" in starters ? "records" : best;
}

/**
 * Every page pattern and an auth file with several roles, in their exact syntax: the part of
 * the grammar the starters do not all show. A test keeps it valid.
 */
export const REFERENCE = {
  "smithable.yml": `smithable: 0.1
app:
  name: Example
  description: What the app is for, in one sentence.
models:
  Profile:
    description: The user's own details.
    fields:
      displayName: string!
      city: string
  Ticket:
    fields:
      title: string!
      status: open | waiting | closed
      priority: int! = 3
      openedOn: date! = TODAY()
pages:
  home:
    route: /
    landing:
      hero: { button: tickets }
      features:
      faq:
      callToAction: { button: tickets }
  overview:
    dashboard:
      open: { count: Ticket, where: { status: open } }
      byMonth: { count: Ticket, by: openedOn }
      latest: { list: Ticket, limit: 5 }
  tickets:
    crud: Ticket
    search: [title]
  settings:
    settings: Profile
  welcome:
    onboarding:
      model: Profile
      steps:
        you: [displayName]
        where: [city]
`,
  "smithable.auth.yml": `smithableAuth: 0.1
signIn:
  providers: [email]
defaultAccess: shared
roles:
  admin: all
  agent: { description: Handles tickets., pages: all, create: all, write: [Ticket] }
defaultRole: agent
public:
  pages: [home]
`,
};

const fenced = (yaml: string) => `\`\`\`yaml\n${yaml.trimEnd()}\n\`\`\``;

const SYSTEM = `You design the first version of a web app as Smithable spec files. Smithable generates the whole app from them.
Adapt the example project to the description: its models and fields, pages, roles and access, theme, and the visible texts (landing page copy, labels). Keep what fits, remove what does not, and add what the description needs. Keep the files' format and version lines exactly.
Keep it small: crud pages for the records people manage; a landing page only for an app with public visitors; a dashboard, settings or onboarding only when the description asks for one. Use exactly the syntax of the example project and of this reference.
The reference only shows syntax: its models (Profile, Ticket) belong to no app. Name only models and fields your own files declare.

Reference smithable.yml, with every page pattern:
${fenced(REFERENCE["smithable.yml"])}

Reference smithable.auth.yml (several roles need defaultRole):
${fenced(REFERENCE["smithable.auth.yml"])}

Answer with JSON only: {"smithable.yml": "<YAML>", "smithable.auth.yml": "<YAML>", "smithable.content.yml": "<YAML>", "smithable.ux.yml": "<YAML>"}.`;

function answerSchema(): object {
  return {
    type: "object",
    required: ["smithable.yml", "smithable.auth.yml"],
    properties: Object.fromEntries(FILES.map((f) => [f, { type: "string" }])),
  };
}

/**
 * Quotes plain one-line texts that YAML would misread: a value containing ": " ("summary:
 * Classes: all levels" is a nested mapping to YAML). A trailing comment stays a comment;
 * quoted, flow ({…}, […]), block (|, >) and alias values stay as they are.
 */
export function quoteTexts(yaml: string): string {
  return yaml
    .split("\n")
    .map((line) => {
      const m = /^(\s*(?:- )?[\w.@-]+:[ \t]+)(.*?)(\s+#.*)?$/.exec(line);
      const value = m?.[2] ?? "";
      if (!m || !value.includes(": ") || /^["'{[|>&*!#]/.test(value)) return line;
      return `${m[1]}${JSON.stringify(value)}${m[3] ?? ""}`;
    })
    .join("\n");
}

/**
 * Removes a "!" after a choice's last value ("unit: g | kg | pieces!"): a model's way of
 * saying required, which a choice always is.
 */
export function choiceWithoutBang(yaml: string): string {
  return yaml.replace(/^(\s*[\w-]+:[ \t]+[^#\n]*\|[^#\n]*?)!([ \t]*(#.*)?)$/gm, "$1$2");
}

/** Files a draft can do without: the app falls back to its default presentation and texts. */
const OPTIONAL = ["smithable.ux.yml", "smithable.content.yml"];

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
 * errors goes back with the exact diagnostics, up to four times; then the next model tries.
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
    .map((f) => `${f}:\n${fenced(options.starter[f] as string)}`)
    .join("\n\n");
  const user = `Description: ${options.description}${languageNote(options.description)}\n\nExample project:\n${example}\n\nJSON Schema of smithable.yml:\n${JSON.stringify(buildJsonSchema())}`;
  let problem = "";
  for (const provider of [...options.providers].reverse()) {
    let prompt = user;
    for (let attempt = 0; attempt < 1 + REPAIRS; attempt++) {
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
      // A model sometimes starts a file with a "---" line; it is not part of the file.
      const kept = Object.fromEntries(
        FILES.flatMap((f) =>
          typeof files[f] === "string" ? [[f, (files[f] as string).replace(/^---.*\n/, "")]] : [],
        ),
      );
      let errors = checkSpecFiles(kept);
      // Common slips are fixed without a model, each kept only if it leaves fewer errors.
      for (const repair of [quoteTexts, choiceWithoutBang]) {
        if (!errors.length) break;
        const repaired = Object.fromEntries(Object.entries(kept).map(([f, t]) => [f, repair(t)]));
        const remaining = checkSpecFiles(repaired);
        if (remaining.length < errors.length) {
          Object.assign(kept, repaired);
          errors = remaining;
        }
      }
      // Presentation and wording are optional: with mistakes only there, the app keeps its
      // defaults for them rather than being thrown away.
      if (errors.length && errors.every((e) => OPTIONAL.includes(e.file ?? ""))) {
        for (const file of new Set(errors.map((e) => e.file ?? ""))) delete kept[file];
        errors = checkSpecFiles(kept);
      }
      if (errors.length === 0) return { kind: "draft", files: kept, usage };
      problem = errors.map(formatDiagnostic).join("\n");
      // The model fixes its own draft rather than starting over.
      const previous = Object.entries(kept)
        .map(([f, text]) => `${f}:\n${fenced(text)}`)
        .join("\n\n");
      prompt = `${user}\n\nYour draft:\n${previous}\n\nIt has these errors:\n${problem}\nFix exactly these errors and change nothing else. Answer with all files.`;
    }
  }
  return { kind: "failed", message: `No model drafted a valid project.\n${problem}`, usage };
}
