// The first draft as a batch of operations (docs/design/first-build.md, 2.7; ARCHITECTURE §9):
// the model starts from an empty app and answers with operations, constrained to each
// operation's own argument schema, so the spec's grammar cannot go wrong. The operations are
// applied one by one; the one that fails goes back to the model with its reason, and the model
// answers with that one corrected and the rest.
import {
  type AnyOperation,
  applyOperation,
  type OperationArgs,
  operationsFor,
  type ProjectFiles,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import type { Draft, SpecFiles } from "./draft.js";
import { languageNote } from "./language.js";
import { plainSchema } from "./propose.js";
import { completeJson, type Provider, type Usage } from "./provider.js";

/** An app with nothing in it yet: what the operations start from. */
export const BLANK: SpecFiles = {
  "smithable.yml": "smithable: 0.1\napp:\n  name: App\n",
  "smithable.auth.yml":
    "smithableAuth: 0.1\nsignIn:\n  providers: [email]\ndefaultAccess: private\n",
  "smithable.content.yml": "smithableContent: 0.1\n",
  "smithable.ux.yml": "smithableUx: 0.1\n",
};

/**
 * The empty app a draft starts from, with the starter's default access (a team's starter is
 * shared, a members' one private) so a draft that says nothing about access gets the right one.
 */
export function blankFor(starter?: SpecFiles): SpecFiles {
  const access = /^defaultAccess:\s*(shared|private)\b/m.exec(
    starter?.["smithable.auth.yml"] ?? "",
  );
  return access
    ? {
        ...BLANK,
        "smithable.auth.yml": (BLANK["smithable.auth.yml"] as string).replace(
          "defaultAccess: private",
          `defaultAccess: ${access[1]}`,
        ),
      }
    : BLANK;
}

/** Operations a first draft never needs: they change or undo what a draft has not made yet. */
const NOT_FOR_DRAFTS = new Set([
  "editSpec",
  "removeField",
  "renameField",
  "changeField",
  "removePage",
  "removeSection",
  "setRuleId",
  "setPackage",
]);

export function draftOperations(): AnyOperation[] {
  return operationsFor([]).filter((op) => !NOT_FOR_DRAFTS.has(op.name));
}

const GUIDANCE = `You design the first version of a web app as a list of Smithable operations, applied in order to an empty app. Smithable generates the whole app from the result.
Order: setApp (name, one-sentence description, currency, timezone); addModel for each kind of record with its fields; addPage for the records people manage (one crud page per model, the first page is the app's start); addLandingPage only for an app with public visitors (it already has a hero and a footer; addSection adds other sections); addDataPage or addUsersPage only for administrators' tools; setDefaultAccess only to change the access the app starts with (shared: a team works on the same records; private: each person sees only their own); setRoles when the app has more than one kind of user; setAccess for what only some roles may do; setPublic for what visitors may open, read or create; setTheme for the look; setText for the landing page's texts; addAction with "on", "set" and usually "when" for a button that moves a record to its next state (resolve an incident, mark an invoice paid, cancel a booking), e.g. { action: "resolve", on: "Incident", when: { status: "investigating | identified" }, set: { status: "resolved", resolvedAt: "NOW()" }, add: { "IncidentUpdate.at": "NOW()", "IncidentUpdate.status": "resolved", "IncidentUpdate.message": "" } }: "add" also creates a related record (a model that refers to this one), and an empty value asks the person for it when they press the button; "copy" (with "with" for its lists) makes a new record from this one ("duplicate invoice"), and "ME()" sets a User field to whoever presses the button ("take ticket"). Never add a custom action (one without "on") unless the description asks for something only code can do: it does nothing until someone writes its code.
When a starter is given, it is the example of shape and naming for this kind of app: reuse its models, fields, pages, standard actions (those with "on"; never its custom ones), roles and access that fit the description, under the same names, leave out what does not fit, and add what the description needs. The app already starts with the starter's default access. Restrict a page or a model to some roles only where the starter does or the description says so: a page without it is open to everyone who signs in. The starter's app name, its people, places and texts are sample content: never reuse them.
Fields, in addModel's "fields" object, are name: type, written exactly as: <type>, then "!" when required, then "unique" when unique, then "= value" for a default. Types: string, text (long), int, decimal, money, bool, date, datetime, email, phone, url; choices as "draft | sent | paid" (the FIRST value is the default; never write "=" with choices); a reference as another model's name, "Customer!" when required; "Order[]" lists the records of another model that refer to this one (that model needs exactly one reference back). Examples: "string!", "email! unique", "int! = 12", "money", "low | normal | high", "Customer!", "Order[]". Model names are PascalCase, field and page names camelCase or kebab-case. Every model already has id, owner (the user who created the record), createdAt and updatedAt: never declare them; "User" is the people who sign in, never a model of your own (refer to it as a type, e.g. "assignee: User").
Language: everything a person reads is written in the description's language: the app's name and description, the landing page's texts, and, when that language is not English, a label for every model (setText with path [models, <Model>, label] and [models, <Model>, pluralLabel]), field ([models, <Model>, fields, <field>, label]), choice value ([models, <Model>, fields, <field>, values, <value>]) and page ([pages, <page>, title]). Model, field and choice names themselves stay English identifiers; a page's name becomes its address, so it may be a word of that language written with plain letters (boka-nu).
Keep it small: what the description needs, nothing for later. Every model needs a page or a place it is shown. A public site needs a landing page, public pages and public read in setPublic. Never make a model with an email or phone field readable by visitors (setPublic's read): that publishes people's contact details; keep those in a model that is not public, or collect them with a contact form. An app with shared access is for people who are invited (Smithable adds the team page): call setSignUp anyone only when the description says anybody may join.`;

/**
 * Slips models make in the field shorthand, mended without a model: "unique!" for "! unique",
 * "required" for "!", a choice default written with "=" (the first value is the default),
 * prefixes like "choices:", and other libraries' type names.
 */
export function repairFieldShorthand(text: string): string {
  let t = text.trim().replace(/^(?:choices?|enum|options?|type)\s*:\s*/i, "");
  t = t
    .replace(/\b(boolean)\b/g, "bool")
    .replace(/\b(integer)\b/g, "int")
    .replace(/\b(number|float|double)\b/g, "decimal");
  t = t
    .replace(/\b(timestamp|date-time|dateTime)\b/g, "datetime")
    .replace(/\b(str|varchar)\b/g, "string")
    .replace(/\blongtext\b/g, "text");
  t = t
    .replace(/\s+required\b/g, "!")
    .replace(/\s*unique!/g, "! unique")
    .replace(/!\s*!/g, "!");
  if (t.includes("|")) {
    const m = /^(.*?)\s*=\s*["']?([A-Za-z0-9]+)["']?\s*$/.exec(t);
    const chosen = m?.[2];
    let values = (m?.[1] ?? t)
      .replace(/!|\bunique\b|["']/g, "")
      .split("|")
      .map((v) => v.trim())
      .filter(Boolean);
    if (chosen && values.includes(chosen)) values = [chosen, ...values.filter((v) => v !== chosen)];
    t = values.join(" | ");
  }
  return t.replace(/\s+/g, " ").trim();
}

/** The step with its field shorthand mended, or undefined when nothing changed. */
function repaired(step: Step): Step | undefined {
  if (step.op === "addModel" && step.args.fields && typeof step.args.fields === "object") {
    const fields = Object.fromEntries(
      Object.entries(step.args.fields as Record<string, unknown>).map(([k, v]) => [
        k,
        repairFieldShorthand(String(v)),
      ]),
    );
    return JSON.stringify(fields) === JSON.stringify(step.args.fields)
      ? undefined
      : { ...step, args: { ...step.args, fields } };
  }
  if (step.op === "addField" && typeof step.args.type === "string") {
    const type = repairFieldShorthand(step.args.type);
    return type === step.args.type ? undefined : { ...step, args: { ...step.args, type } };
  }
  return undefined;
}

function describeOperations(operations: AnyOperation[]): string {
  return operations
    .map(
      (op) => `- ${op.name}: ${op.summary}\n  arguments: ${JSON.stringify(plainSchema(op.schema))}`,
    )
    .join("\n");
}

function answerSchema(operations: AnyOperation[]): object {
  return {
    type: "object",
    required: ["operations"],
    additionalProperties: false,
    properties: {
      operations: {
        type: "array",
        items: {
          anyOf: operations.map((op) => ({
            type: "object",
            required: ["op", "args"],
            additionalProperties: false,
            properties: { op: { const: op.name }, args: plainSchema(op.schema) },
          })),
        },
      },
    },
  };
}

type Step = { op: string; args: OperationArgs };

/** Operations a draft cannot do without; the others are extras a draft may drop. */
const ESSENTIAL = new Set([
  "setApp",
  // A starter's actions are its flow (the status page's resolve): refused, they are corrected;
  // still refused after the last round, they are dropped and named (see lastRoundDrops).
  "addAction",
  "addModel",
  "addField",
  "addPage",
  "addLandingPage",
  "setRoles",
  "setPublic",
  "setSignUp",
]);

/**
 * Essential while there are rounds left; after the last one, dropped rather than failing the
 * draft: an action, and a field worked out by a formula (a total over a list never added).
 */
const lastRoundDrops = (step: Step) =>
  step.op === "addAction" ||
  (step.op === "addField" && /=\s*[A-Z]+\(/.test(String(step.args.type ?? "")));

/**
 * Applies steps in order: a slip in the field shorthand is mended, a step already applied or
 * already there is skipped, a model referred to before it is added is added first, and a step
 * that still cannot be applied is kept with its reason for the model.
 */
function applyAll(
  start: ProjectFiles,
  done: Step[],
  steps: Step[],
): { files: ProjectFiles; refused: { step: Step; message: string }[] } {
  let files = start;
  const refused: { step: Step; message: string }[] = [];
  const queue: Step[] = steps.map((raw) => ({ op: raw.op, args: raw.args ?? {} }));
  /** Steps put back once for a model added later; a second time they are refused, not looped. */
  const deferred = new Set<string>();
  while (queue.length) {
    const step = queue.shift() as Step;
    if (done.some((d) => JSON.stringify(d) === JSON.stringify(step))) continue;
    // User is built in: a model of that name is dropped, references to it then mean users.
    if (step.op === "addModel" && step.args.model === "User") continue;
    let result = applyOperation(files, step.op, step.args);
    let applied = step;
    if (!result.ok) {
      const mended = repaired(step);
      if (mended) {
        const again = applyOperation(files, mended.op, mended.args);
        if (again.ok) {
          result = again;
          applied = mended;
        }
      }
    }
    if (!result.ok) {
      const detail = result.diagnostics.map((d) => d.message).join(" ");
      const message = `${result.message}${detail ? ` ${detail}` : ""}`;
      if (/already (?:has|exists)/i.test(message)) continue;
      // A list of related records the other model does not refer back to: a convenience the
      // app is complete without, so it is left out rather than refused.
      if (
        step.op === "addField" &&
        /\[\]\s*$/.test(String(step.args.type ?? "")) &&
        /reference/i.test(message)
      )
        continue;
      const unmatched = /has no reference to \w+, so "\w+\.(\w+)"/.exec(message)?.[1];
      if (
        unmatched &&
        step.op === "addModel" &&
        typeof step.args.fields === "object" &&
        step.args.fields
      ) {
        const { [unmatched]: _dropped, ...rest } = step.args.fields as Record<string, string>;
        queue.unshift({ op: "addModel", args: { ...step.args, fields: rest } });
        continue;
      }
      const missing = /no model named "(\w+)"/.exec(message)?.[1];
      if (
        missing &&
        step.op === "addModel" &&
        typeof step.args.fields === "object" &&
        step.args.fields
      ) {
        // A field that needs a model not added yet (two models referring to each other, or
        // one added later): the model is added without it, and the field follows at the end.
        const fields = step.args.fields as Record<string, string>;
        const needs = Object.entries(fields).filter(([, type]) =>
          new RegExp(`\\b${missing}\\b`).test(String(type)),
        );
        if (needs.length && needs.length < Object.keys(fields).length) {
          const rest = Object.fromEntries(
            Object.entries(fields).filter(([name]) => !needs.some(([n]) => n === name)),
          );
          queue.unshift({ op: "addModel", args: { ...step.args, fields: rest } });
          for (const [field, type] of needs)
            queue.push({ op: "addField", args: { model: step.args.model, field, type } });
          continue;
        }
      }
      // A formula over a list the model does not have yet (a total of its lines): the model is
      // added without it, and the formula follows at the end, once the list may be there.
      const noList = /has no list named "(\w+)"/.exec(message)?.[1];
      if (
        noList &&
        step.op === "addModel" &&
        typeof step.args.fields === "object" &&
        step.args.fields
      ) {
        const fields = step.args.fields as Record<string, string>;
        const needs = Object.entries(fields).filter(([, type]) =>
          new RegExp(`\\b${noList}\\.`).test(String(type)),
        );
        if (needs.length && needs.length < Object.keys(fields).length) {
          const rest = Object.fromEntries(
            Object.entries(fields).filter(([name]) => !needs.some(([n]) => n === name)),
          );
          queue.unshift({ op: "addModel", args: { ...step.args, fields: rest } });
          for (const [field, type] of needs)
            queue.push({ op: "addField", args: { model: step.args.model, field, type } });
          continue;
        }
      }
      // Invite-only before the team page that invites: the page first, as closeShared does.
      if (
        step.op === "setSignUp" &&
        /no page invites/.test(message) &&
        !deferred.has(JSON.stringify(step))
      ) {
        deferred.add(JSON.stringify(step));
        queue.unshift({ op: "addUsersPage", args: {} }, step);
        continue;
      }
      const later = missing
        ? queue.findIndex((q) => q.op === "addModel" && q.args.model === missing)
        : -1;
      if (later !== -1 && !deferred.has(JSON.stringify(step))) {
        deferred.add(JSON.stringify(step));
        queue.unshift(queue.splice(later, 1)[0] as Step, step);
        continue;
      }
      refused.push({ step, message });
      continue;
    }
    files = result.files;
    done.push(applied);
  }
  return { files, refused };
}

/**
 * A shared app that anyone may sign up to lets every newcomer read everything (the validator's
 * open-shared-access warning). A draft that ends there is made invite-only, with a team page to
 * invite from: deterministic, said in the summary the person confirms, and undone with
 * setSignUp anyone.
 */
export function closeShared(files: ProjectFiles, done: Step[]): ProjectFiles {
  const ir = validateSpec({ path: "smithable.yml", text: files.spec }).ir;
  const open = validateAuth({ path: "smithable.auth.yml", text: files.auth ?? "" }, ir).diagnostics;
  if (!ir || !open.some((d) => d.code === "open-shared-access")) return files;
  let next = files;
  const steps: Step[] = [
    ...(ir.pages.some((p) => p.pattern.kind === "users") ? [] : [{ op: "addUsersPage", args: {} }]),
    { op: "setSignUp", args: { who: "invited" } },
  ];
  for (const step of steps) {
    const result = applyOperation(next, step.op, step.args);
    if (!result.ok) return files;
    next = result.files;
    done.push(step);
  }
  return next;
}

const toProject = (files: SpecFiles): ProjectFiles => ({
  spec: files["smithable.yml"] ?? "",
  auth: files["smithable.auth.yml"],
  content: files["smithable.content.yml"],
  ux: files["smithable.ux.yml"],
});
const toFiles = (files: ProjectFiles): SpecFiles => ({
  "smithable.yml": files.spec,
  "smithable.auth.yml": files.auth ?? "",
  "smithable.content.yml": files.content ?? "",
  "smithable.ux.yml": files.ux ?? "",
});

/** At most this many operations in one draft, and rounds of corrections. */
const MAX_OPERATIONS = 160;
const MAX_ROUNDS = 4;

/**
 * Drafts a project as operations from the description, with the strongest allowed model
 * first. An operation that cannot be applied goes back to the model with its reason and what
 * was applied before it; the model answers with that one corrected and the rest.
 */
export async function draftProjectByOperations(options: {
  description: string;
  providers: Provider[];
  /** The closest starter (clarify's choice): the example of shape, and the access default. */
  starter?: { name: string; files: SpecFiles };
  operations?: AnyOperation[];
}): Promise<Draft & { operations?: Step[] }> {
  const usage: Usage[] = [];
  if (options.providers.length === 0)
    return { kind: "failed", message: "No model is available under the AI policy.", usage };
  const operations = options.operations ?? draftOperations();
  const system = `${GUIDANCE}\n\nOperations:\n${describeOperations(operations)}\n\nAnswer with JSON only: {"operations": [{"op": "<name>", "args": {...}}, ...]}.`;
  const schema = answerSchema(operations);
  let problem = "";
  // The starter's spec and its auth file (roles, default access, what is public), as the example.
  const fence = (name: string) => {
    const text = options.starter?.files[name]?.trim();
    return text ? `\n${name}:\n\`\`\`yaml\n${text}\n\`\`\`` : "";
  };
  const example = fence("smithable.yml");
  const shape = example
    ? `\n\nThe ${options.starter?.name} starter, the example for this kind of app:${example}${fence("smithable.auth.yml")}`
    : "";
  for (const provider of [...options.providers].reverse()) {
    let files = toProject(blankFor(options.starter?.files));
    const done: Step[] = [];
    let prompt = `Description: ${options.description}${languageNote(options.description)}${shape}`;
    let round = 0;
    let refused: { step: Step; message: string }[] = [];
    while (round < MAX_ROUNDS) {
      round += 1;
      let answer: { operations?: Step[] };
      try {
        answer = (await completeJson(provider, { system, user: prompt, schema }, usage)) as {
          operations?: Step[];
        };
      } catch (error) {
        problem = error instanceof Error ? error.message : String(error);
        // A broken answer (cut off, not JSON) is asked for once more.
        if (/JSON|Unexpected|position/.test(problem) && round < MAX_ROUNDS) continue;
        break;
      }
      const steps = (answer.operations ?? []).slice(0, MAX_OPERATIONS - done.length);
      if (steps.length === 0) {
        // In a correction round an empty answer drops what was refused; a first answer with
        // nothing in it is no draft.
        if (done.length > 0)
          return {
            kind: "draft",
            files: toFiles(closeShared(files, done)),
            usage,
            operations: done,
          };
        problem = refused.length
          ? refused.map((r) => `${r.step.op}: ${r.message}`).join("\n")
          : "The answer has no operations.";
        break;
      }
      // Everything that can be applied is; what cannot goes back together, with its reasons.
      // The model's correction is the authority: what it leaves out is dropped.
      const outcome = applyAll(files, done, steps);
      files = outcome.files;
      refused = outcome.refused;
      const last = round === MAX_ROUNDS;
      const essential = refused.filter(
        (r) => ESSENTIAL.has(r.step.op) && !(last && lastRoundDrops(r.step)),
      );
      if (essential.length === 0) {
        // Refused extras (a text, a color) are left out rather than failing the draft, and an
        // action or formula field still refused after the last round is named.
        const dropped = refused
          .filter((r) => lastRoundDrops(r.step))
          .map((r) => {
            const { action, model, field } = r.step.args;
            return `${r.step.op} ${String(action ?? (model ? `${model}.${field}` : ""))}: ${r.message}`;
          });
        if (done.length > 0)
          return {
            kind: "draft",
            files: toFiles(closeShared(files, done)),
            usage,
            operations: done,
            ...(dropped.length ? { dropped } : {}),
          };
        problem =
          refused.map((r) => `${r.step.op}: ${r.message}`).join("\n") ||
          "Nothing could be applied.";
        break;
      }
      if (last) {
        problem = essential.map((r) => `${r.step.op}: ${r.message}`).join("\n");
        break;
      }
      prompt = `Description: ${options.description}${languageNote(options.description)}\n\nApplied so far (do not repeat them):\n${JSON.stringify(done)}\n\nThese operations were refused:\n${refused.map((r) => `${JSON.stringify(r.step)}\n  Reason: ${r.message}`).join("\n")}\n\nAnswer with corrected versions of the refused operations only (leave out any that are not needed), in order.`;
    }
  }
  return { kind: "failed", message: `No model drafted a valid project.\n${problem}`, usage };
}
