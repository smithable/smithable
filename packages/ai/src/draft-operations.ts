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
  pageAccess,
  pageModels,
  sensitiveKind,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import type { Draft, SpecFiles } from "./draft.js";
import { LANGUAGE_NAMES, languageNote, textLanguage } from "./language.js";
import { plainSchema } from "./propose.js";
import { completeJson, type Provider, type Usage } from "./provider.js";

/** An app with nothing in it yet: what the operations start from. */
export const BLANK: SpecFiles = {
  "smithable.yml": "smithable: 0.1\napp:\n  name: App\n",
  "smithable.auth.yml":
    "smithableAuth: 0.1\nsignIn:\n  providers: [email]\ndefaultAccess: private\nroles:\n  admin: all\n  member: { pages: all, create: all }\nassistant:\n  for: signed-in\n",
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
  "setRuleId",
  "setPackage",
  // A draft has no files of its own: its mark comes from the image library afterwards.
  "setLogo",
]);

export function draftOperations(): AnyOperation[] {
  return operationsFor([]).filter((op) => !NOT_FOR_DRAFTS.has(op.name));
}

const GUIDANCE = `You design the first version of a web app as a list of Smithable operations, applied in order to an empty app. Smithable generates the whole app from the result.
Order: setApp (name, one-sentence description, currency, timezone); addModel for each kind of record with its fields; addPage for the records people manage (one crud page per model, the first page is the app's start); addLandingPage only for an app with public visitors (it already has a hero and a footer; addSection adds other sections), and with it addPrivacyPage (a privacy page written from the app; the operator's details come later); addDataPage or addUsersPage only for administrators' tools; setDefaultAccess only to change the access the app starts with (shared: a team works on the same records; private: each person sees only their own); setRoles when the app has more than one kind of user, then grant for each role (pages, create, write, delete, actions: "all" or a list; the member role already opens every page and adds every kind of record, so grant it less when the description says so, e.g. { role: "member", what: "create", names: ["Booking"] }); setOwner when a record belongs to someone other than whoever created it ("each customer has an account manager", "the salesperson who handles the order": add a field that refers to User, then setOwner with it, and "owner" in the access means that person); setPublic for what visitors may open, read or create; setTheme for the look; setText for the landing page's texts; addAction with "on", "set" and usually "when" for a button that moves a record to its next state (resolve an incident, mark an invoice paid, cancel a booking), e.g. { action: "resolve", on: "Incident", when: { status: "investigating | identified" }, set: { status: "resolved", resolvedAt: "NOW()" }, add: { "IncidentUpdate.at": "NOW()", "IncidentUpdate.status": "resolved", "IncidentUpdate.message": "" } }: "add" also creates a related record (a model that refers to this one), and an empty value asks the person for it when they press the button; "copy" (with "with" for its lists) makes a new record from this one ("duplicate invoice"), and "ME()" sets a User field to whoever presses the button ("take ticket"). Never add a custom action (one without "on") unless the description asks for something only code can do: it does nothing until someone writes its code. Booking a place needs no action: the booking refers to what is booked ("session: Session!", with "unique" only when bookings are private, as in the booking starter, where it means one place per person; in a shared app "unique" would allow one booking per session in all) and setCapacity limits the bookings per session to its places ("session.capacity"); the Book button and the places left come with it. A "when" compares choice and yes/no fields only, never numbers. addOutgoing only when the description says someone is told of something ("send a confirmation when a booking is made", "mail the customer when the order ships"): { outgoing: "bookingMade", when: "Booking created", recipient: "owner" } (when: "<Model> created | changed | deleted" or an action's name; recipient: "owner", a role, an email field, or one reference away as "customer.email"; "where" for "becomes shipped").
When a starter is given, it is the example of shape and naming for this kind of app: reuse its models, fields, pages, standard actions (those with "on"; never its custom ones), roles and access that fit the description, under the same names, leave out what does not fit, and add what the description needs. The app already starts with the starter's default access. A role opens only the pages and adds only the records its grants name, and changes or deletes only its own records unless granted "write" or "delete" on a model: grant as the starter does, and as the description says. The starter's app name, its people, places and texts are sample content: never reuse them.
Fields, in addModel's "fields" object, are name: type, written exactly as: <type>, then "!" when required, then "unique" when unique, then "= value" for a default. Types: string, text (long), markdown (formatted long text), int, decimal, money, bool, date, datetime, email, phone, url, picture (one stored picture), pictures (up to ten), file (one stored document: a PDF, an Office file), files (up to ten; attachments); choices as "draft | sent | paid" (the FIRST value is the default; never write "=" with choices); a reference as another model's name, "Customer!" when required; "Order[]" lists the records of another model that refer to this one (that model needs exactly one reference back). Examples: "string!", "email! unique", "int! = 12", "money", "low | normal | high", "Customer!", "Order[]". A value worked out from the record's other fields, never entered, is a computed field, written as an object instead of a string: "amount": { "type": "money", "formula": "quantity * unitPrice" } ("= …" in the string is a default, set once). Model names are PascalCase, field and page names camelCase or kebab-case. Every model already has id, owner (the user who created the record), createdAt and updatedAt: never declare them; "User" is the people who sign in, never a model of your own (refer to it as a type, e.g. "assignee: User").
Language: everything a person reads is written in one language, the description's (or the one you are told): the app's name and description, the landing page's texts, and, when that language is not English, a label for every model (setText with path [models, <Model>, label] and [models, <Model>, pluralLabel]), field ([models, <Model>, fields, <field>, label]), choice value ([models, <Model>, fields, <field>, values, <value>]), action ([actions, <action>, label]) and page ([pages, <page>, title]); never one action or choice left in English beside the others. Model, field and choice names themselves stay English identifiers; a page's name becomes its address, so it may be a word of that language written with plain letters (boka-nu). When the description is in a language the app kit has words in (setLanguage), setLanguage with it comes first, so the app's own words (Save, Cancel, the sign-in page) are in that language too; it is already applied when "Applied so far" lists it.
Keep it small: what the description needs, nothing for later. Every model needs a page or a place it is shown. A public site needs a landing page, public pages and public read in setPublic. What people come to look at before they join is public even when the rest needs sign-in (the tools of a tool library, the plots of an allotment, a menu, the listings, the classes to book): a landing page, that model's page in setPublic's pages and the model in its read; signing in is then for what a person does (borrow, book, sell) and for the records about people (members, loans, bookings), which are never public. An app for a team's own work (a CRM, invoicing, a help desk, an inventory) has nothing public. A landing page's button leads to a page visitors may open, unless it is the way into the app ("Book now", "Sign in"). Never make a model with an email or phone field, or a field that refers to User, readable by visitors (setPublic's read): that publishes people's names and contact details; keep those in a model that is not public, or collect them with a contact form. An app with shared access is for people who are invited (Smithable adds the team page): call setSignUp anyone only when the description says anybody may join.`;

/**
 * Slips models make in the field shorthand, mended without a model: "unique!" for "! unique",
 * "required" for "!", a choice default written with "=" (the first value is the default),
 * prefixes like "choices:", other libraries' type names, and "file[]" or "picture[]" for the
 * list types files and pictures.
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
    .replace(/\blongtext\b/g, "text")
    .replace(/\b(picture|file)\s*\[\]/g, "$1s");
  // Other names for the stored kinds, when the whole type is one (a choice may hold the word).
  if (!t.includes("|"))
    t = t
      .replace(/^(?:image|photo)\b/, "picture")
      .replace(/^(?:attachment|document)\b/, "file")
      .replace(/^(?:images|photos)\b/, "pictures")
      .replace(/^(?:attachments|documents)\b/, "files");
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
/**
 * A value worked out from the model's other fields, written as a default ("money = quantity *
 * unitPrice"): the long form of a computed field. A default that names none of them (TODAY())
 * stays a default.
 */
export function computedField(
  text: string,
  others: string[],
): { type: string; formula: string } | undefined {
  const m = /^([^=]+?)\s*=\s*(.+)$/.exec(text.trim());
  if (!m?.[1] || !m[2] || m[1].includes("|")) return undefined;
  const formula = m[2].trim();
  if (!others.some((name) => new RegExp(`\\b${name}\\b`).test(formula))) return undefined;
  // A computed field is never entered: not required, not unique.
  const type = m[1].replace(/!|\bunique\b/g, "").trim();
  return /^\w+$/.test(type) ? { type, formula } : undefined;
}

/** A field's text whichever way it is written, to look for the names it uses. */
const fieldText = (value: unknown) =>
  typeof value === "object" && value
    ? `${(value as { type: string }).type} = ${(value as { formula: string }).formula}`
    : String(value);

/** An addModel field added on its own: shorthand as the type, a computed field with its formula. */
const fieldStep = (model: unknown, field: string, value: unknown): Step => ({
  op: "addField",
  args:
    typeof value === "object" && value
      ? { model, field, ...(value as { type: string; formula: string }) }
      : { model, field, type: value },
});

const AUTOMATIC_FIELDS = ["id", "owner", "createdAt", "updatedAt"];

export function repaired(step: Step): Step | undefined {
  if (step.op === "addModel" && step.args.fields && typeof step.args.fields === "object") {
    // Every model already has these: declaring them is a slip, left out. An owner that refers
    // to another model (a car's owner, a customer) is meant differently: its refusal goes back.
    const declared = step.args.fields as Record<string, unknown>;
    const given = Object.fromEntries(
      Object.entries(declared).flatMap(([k, v]): [string, unknown][] => {
        if (!AUTOMATIC_FIELDS.includes(k)) return [[k, v]];
        // An owner that refers to another model (a car's owner, a customer) is that model's
        // reference by its name: "owner" is the user who created the record.
        const other = k === "owner" && /^([A-Z]\w*)!?$/.exec(String(v).trim())?.[1];
        if (!other || other === "User") return [];
        const name = other[0]?.toLowerCase() + other.slice(1);
        return [[name in declared ? `owner${other}` : name, v]];
      }),
    );
    const fields = Object.fromEntries(
      Object.entries(given).map(([k, v]) => {
        if (typeof v !== "string") return [k, v];
        const text = repairFieldShorthand(v);
        return [
          k,
          computedField(
            text,
            Object.keys(given).filter((n) => n !== k),
          ) ?? text,
        ];
      }),
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

export type Step = { op: string; args: OperationArgs };

/** Operations a draft cannot do without; the others are extras a draft may drop. */
const ESSENTIAL = new Set([
  "setApp",
  // A starter's actions are its flow (the status page's resolve): refused, they are corrected;
  // still refused after the last round, they are dropped and named (see lastRoundDrops).
  "addAction",
  // A booking's places: refused (one that could never fill), corrected rather than lost.
  "setCapacity",
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
 * draft: an action, and a field with a formula or default (a total over a list never added).
 */
const lastRoundDrops = (step: Step) =>
  step.op === "addAction" ||
  step.op === "setCapacity" ||
  (step.op === "addField" &&
    (Boolean(step.args.formula) || String(step.args.type ?? "").includes("=")));

/** The capacity-unique-shared warning on these files, as a refusal's words. */
function neverFills(files: ProjectFiles): string | undefined {
  const ir = validateSpec({ path: "smithable.yml", text: files.spec }).ir;
  if (!ir || files.auth === undefined) return undefined;
  const found = validateAuth({ path: "smithable.auth.yml", text: files.auth }, ir).diagnostics.find(
    (d) => d.code === "capacity-unique-shared",
  );
  return found && `${found.message} ${found.hint ?? ""}`.trim();
}

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
      // The errors only: a warning on the side (an example administrator) is not the reason.
      const detail = result.diagnostics
        .filter((d) => d.severity === "error")
        .map((d) => `${d.message}${d.hint ? ` ${d.hint}` : ""}`)
        .join(" ");
      const message = `${result.message}${detail ? ` ${detail}` : ""}`;
      // Already there (a model or page added before): skipped. A validation error that only
      // says the words ("every record already has an owner") is a refusal like any other.
      if (/already (?:has|exists)/i.test(message) && !/would make/.test(message)) continue;
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
          new RegExp(`\\b${missing}\\b`).test(fieldText(type)),
        );
        if (needs.length && needs.length < Object.keys(fields).length) {
          const rest = Object.fromEntries(
            Object.entries(fields).filter(([name]) => !needs.some(([n]) => n === name)),
          );
          queue.unshift({ op: "addModel", args: { ...step.args, fields: rest } });
          for (const [field, type] of needs) queue.push(fieldStep(step.args.model, field, type));
          continue;
        }
      }
      // A formula over a list the model does not have yet (a total of its lines), or a value
      // worked out from other fields written as a default (no operation adds those yet): the
      // model is added without it, and the field follows at the end, where it may still be
      // refused and then left out and named, rather than costing the model and all after it.
      const noList = /has no list named "(\w+)"/.exec(message)?.[1];
      const expression = /Default "([^"]+)" must be/.exec(message)?.[1];
      if (
        (noList || expression) &&
        step.op === "addModel" &&
        typeof step.args.fields === "object" &&
        step.args.fields
      ) {
        const fields = step.args.fields as Record<string, string>;
        const needs = Object.entries(fields).filter(([, type]) =>
          noList
            ? new RegExp(`\\b${noList}\\b`).test(fieldText(type).split("=").slice(1).join("="))
            : fieldText(type).includes(`= ${expression}`) ||
              fieldText(type).includes(`=${expression}`),
        );
        if (needs.length && needs.length < Object.keys(fields).length) {
          const rest = Object.fromEntries(
            Object.entries(fields).filter(([name]) => !needs.some(([n]) => n === name)),
          );
          queue.unshift({ op: "addModel", args: { ...step.args, fields: rest } });
          // Mended on the way (a value worked out from other fields becomes a computed field).
          const others = (field: string) => Object.keys(fields).filter((n) => n !== field);
          for (const [field, type] of needs)
            queue.push(
              fieldStep(
                step.args.model,
                field,
                typeof type === "string"
                  ? (computedField(repairFieldShorthand(type), others(field)) ?? type)
                  : type,
              ),
            );
          continue;
        }
      }
      // Public pages or models the draft never added (the starter's): left out of the list.
      if (
        step.op === "setPublic" &&
        /There is no (?:page|model) named/.test(message) &&
        !deferred.has(JSON.stringify(step))
      ) {
        deferred.add(JSON.stringify(step));
        const ir = validateSpec({ path: "smithable.yml", text: files.spec }).ir;
        const pages = new Set(ir?.pages.map((p) => p.id));
        const models = new Set(ir?.models.map((m) => m.name));
        const named = (entry: unknown, known: Set<string>) =>
          typeof entry === "string"
            ? known.has(entry)
            : Object.keys(entry as object).every((k) => known.has(k));
        const keep = (key: string, known: Set<string>) =>
          Array.isArray(step.args[key])
            ? { [key]: (step.args[key] as unknown[]).filter((e) => named(e, known)) }
            : {};
        queue.unshift({
          op: "setPublic",
          args: {
            ...step.args,
            ...keep("pages", pages),
            ...keep("read", models),
            ...keep("create", models),
          },
        });
        continue;
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
    // A capacity that can never fill (a unique reference on records not private to their
    // owners) is only a warning for a person; a draft gives it back to the model instead.
    const next = { ...files, ...result.files };
    const never = neverFills(next);
    if (never) {
      refused.push({ step, message: never });
      continue;
    }
    files = next;
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

/**
 * A public landing page whose button or shortcut leads to a page visitors cannot open sends
 * them to sign-in (Johan's status page, blind round 2). When that page is a list of records
 * visitors may read anyway, it is opened to them: nothing more becomes readable than
 * `public.read` already says. A page for some roles, or of the viewer's own records, stays closed.
 */
export function openLinked(files: ProjectFiles, done: Step[]): ProjectFiles {
  const ir = validateSpec({ path: "smithable.yml", text: files.spec }).ir;
  const auth = ir && validateAuth({ path: "smithable.auth.yml", text: files.auth ?? "" }, ir).auth;
  if (!ir || !auth) return files;
  const open = new Set(auth.public.pages);
  const linked = ir.pages.flatMap((p) =>
    p.pattern.kind === "landing" && open.has(p.id)
      ? p.pattern.sections.flatMap((s) => [...(s.button ? [s.button] : []), ...(s.shortcuts ?? [])])
      : [],
  );
  const more = [...new Set(linked)].filter((id) => {
    const page = ir.pages.find((p) => p.id === id);
    if (!page || open.has(id) || page.mine) return false;
    if (pageAccess(page, auth).roles.length < auth.roles.length) return false;
    if (!["crud", "articles", "calendar"].includes(page.pattern.kind)) return false;
    const models = pageModels(page);
    return models.length > 0 && models.every((m) => auth.public.read.includes(m));
  });
  if (more.length === 0) return files;
  const step: Step = { op: "setPublic", args: { pages: [...auth.public.pages, ...more] } };
  const result = applyOperation(files, step.op, step.args);
  if (!result.ok) return files;
  done.push(step);
  return result.files;
}

/**
 * A hero's shortcut to a page visitors cannot open, which openLinked could not open for them
 * (its records are not public, or it is for some roles), is taken off: a visitor who taps it only
 * meets sign-in, and opening the page would be a choice about what is public. The hero's button
 * may still lead into the app: "Get started" is meant to. Deterministic, so no round with the
 * model is spent on it (two salon drafts kept such a shortcut after being told, bench of
 * 2026-10-05).
 */
export function dropClosedShortcuts(files: ProjectFiles, done: Step[]): ProjectFiles {
  const ir = validateSpec({ path: "smithable.yml", text: files.spec }).ir;
  const auth = ir && validateAuth({ path: "smithable.auth.yml", text: files.auth ?? "" }, ir).auth;
  if (!ir || !auth) return files;
  let next = files;
  for (const page of ir.pages) {
    if (page.pattern.kind !== "landing" || !auth.public.pages.includes(page.id)) continue;
    const all = page.pattern.sections.flatMap((s) => s.shortcuts ?? []);
    const open = all.filter((p) => auth.public.pages.includes(p));
    if (open.length === all.length) continue;
    const step: Step = { op: "setShortcuts", args: { page: page.id, pages: open } };
    const result = applyOperation(next, step.op, step.args);
    if (!result.ok) continue;
    next = result.files;
    done.push(step);
  }
  return next;
}

/** Fields an app must not hold whatever the description says: card data, passwords and keys. */
const MUST_NOT_HOLD = new Set(["card-data", "secret-field"]);

/**
 * A draft's field that looks like a payment card's number or a password is taken out again: no
 * description makes it right to store one, so this is not left to the model. A field something
 * else in the draft still needs stays, and its warning with it.
 */
export function dropForbidden(files: ProjectFiles, done: Step[]): ProjectFiles {
  let next = files;
  const read = validateSpec({ path: "smithable.yml", text: files.spec });
  for (const model of read.ir?.models ?? [])
    for (const field of model.fields) {
      const kind = sensitiveKind(field);
      if (!kind || !MUST_NOT_HOLD.has(kind)) continue;
      const step: Step = { op: "removeField", args: { model: model.name, field: field.name } };
      const result = applyOperation(next, step.op, step.args);
      if (!result.ok) continue;
      next = result.files;
      done.push(step);
    }
  return next;
}

/** The mends every draft gets, in order, each adding the operations it applied to `done`. */
const mended = (files: ProjectFiles, done: Step[]) =>
  dropForbidden(dropClosedShortcuts(openLinked(closeShared(files, done), done), done), done);

/** The validator's warnings that mean a visitor finds the app broken or too open. */
const VISITOR_FLAWS = new Set([
  "public-page-closed-records",
  "shortcut-closed",
  "contact-form-closed",
  "public-personal-data",
  "mine-public",
  "visitors-read-drafts",
]);

/**
 * What a valid draft still gets wrong for visitors, in the validator's words: a public page
 * whose records they may not read, a contact form they cannot send, a person's contact details
 * open to anyone. The draft goes back to the model with these once (deterministic to find; the
 * remedy depends on what the description meant, so it is the model's to choose).
 */
export function visitorFlaws(files: ProjectFiles): string[] {
  return flawsOf(files).map((d) => d.message);
}

function flawsOf(files: ProjectFiles): { code: string; message: string }[] {
  const ir = validateSpec({ path: "smithable.yml", text: files.spec }).ir;
  if (!ir) return [];
  const english = untranslated(files);
  return [
    ...validateAuth({ path: "smithable.auth.yml", text: files.auth ?? "" }, ir).diagnostics.filter(
      (d) => d.severity === "warning" && VISITOR_FLAWS.has(d.code),
    ),
    ...(english
      ? [
          {
            code: "text-in-english",
            message: `The app is in ${english.language}, but these would show English names: give each a text in ${english.language} with setText (one language for every label, choice, action and page): ${english.paths.slice(0, 40).join(", ")}.`,
          },
        ]
      : []),
  ];
}

/**
 * In an app whose texts are not English, the texts that would still show an English name (a
 * model, field, choice value, action or page with no text of its own), as setText paths: one
 * language throughout, not Swedish labels beside "Resolve" and "new or handled".
 */
export function untranslated(
  files: ProjectFiles,
): { language: string; paths: string[] } | undefined {
  const ir = validateSpec({ path: "smithable.yml", text: files.spec }).ir;
  if (!ir) return undefined;
  const content = validateContent(
    { path: "smithable.content.yml", text: files.content ?? "" },
    ir,
  ).content;
  if (!content || content.language === "en") return undefined;
  const paths: string[] = [];
  for (const model of ir.models) {
    const own = content.models[model.name];
    if (!own?.label) paths.push(`models.${model.name}.label`);
    if (!own?.pluralLabel) paths.push(`models.${model.name}.pluralLabel`);
    for (const field of model.fields) {
      const texts = own?.fields[field.name];
      if (!texts?.label) paths.push(`models.${model.name}.fields.${field.name}.label`);
      if (field.type.kind === "choice")
        for (const value of field.type.values)
          if (!texts?.values?.[value])
            paths.push(`models.${model.name}.fields.${field.name}.values.${value}`);
    }
  }
  for (const action of ir.actions)
    if (!content.actions[action.name]?.label) paths.push(`actions.${action.name}.label`);
  for (const page of ir.pages)
    if (!content.pages[page.id]?.title) paths.push(`pages.${page.id}.title`);
  return paths.length ? { language: LANGUAGE_NAMES[content.language], paths } : undefined;
}

/** Flaws that expose someone weigh far more than flaws that only look broken. */
const EXPOSES = new Set(["public-personal-data", "visitors-read-drafts"]);
const weigh = (flaws: { code: string }[]) =>
  flaws.reduce((n, f) => n + (EXPOSES.has(f.code) ? 100 : 1), 0);

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
    // A description in a language the kit has words in sets the app's language before the model
    // says anything (the model is told, and a repeat is skipped as any step already done).
    const language = textLanguage(options.description);
    if (language && language !== "en")
      files = applyAll(files, done, [{ op: "setLanguage", args: { language } }]).files;
    let prompt = `Description: ${options.description}${languageNote(options.description)}${done.length ? `\n\nApplied so far (do not repeat them):\n${JSON.stringify(done)}` : ""}${shape}`;
    let round = 0;
    let refused: { step: Step; message: string }[] = [];
    // A valid draft's flaws for visitors go back once each (a remedy may bring a new one: a
    // model closed to visitors leaves its landing section empty); what those rounds drop is
    // still named.
    const told = new Set<string>();
    let droppedBefore: string[] = [];
    // The best the draft has been, by its flaws: a remedy that makes it worse (personal details
    // closed in one round and opened again in the next) is not what the person gets.
    let best: { files: ProjectFiles; count: number; score: number } | undefined;
    const draftOf = (dropped: string[]): Draft & { operations?: Step[] } => ({
      kind: "draft",
      files: toFiles(best?.files ?? files),
      usage,
      operations: best ? done.slice(0, best.count) : done,
      ...(dropped.length ? { dropped } : {}),
    });
    while (round < MAX_ROUNDS) {
      round += 1;
      let answer: { operations?: Step[] };
      try {
        answer = (await completeJson(provider, { system, user: prompt, schema }, usage)) as {
          operations?: Step[];
        };
      } catch (error) {
        problem = error instanceof Error ? error.message : String(error);
        // The round about a valid draft's flaws failing leaves the draft as it was.
        if (told.size > 0 && done.length > 0) return draftOf(droppedBefore);
        // A broken answer (cut off, not JSON) is asked for once more.
        if (/JSON|Unexpected|position/.test(problem) && round < MAX_ROUNDS) continue;
        break;
      }
      const steps = (answer.operations ?? []).slice(0, MAX_OPERATIONS - done.length);
      if (steps.length === 0) {
        // In a correction round an empty answer drops what was refused; a first answer with
        // nothing in it is no draft.
        if (done.length > 0) {
          if (!best) files = mended(files, done);
          return draftOf(droppedBefore);
        }
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
      // After the flaws went back, the draft was already valid: a refused remedy is left out.
      const essential = told.size
        ? []
        : refused.filter((r) => ESSENTIAL.has(r.step.op) && !(last && lastRoundDrops(r.step)));
      if (essential.length === 0) {
        // Refused extras (a text, a color) are left out rather than failing the draft, and an
        // action or formula field still refused after the last round is named.
        const dropped = [
          ...droppedBefore,
          ...refused
            .filter((r) => lastRoundDrops(r.step))
            .map((r) => {
              const { action, model, field } = r.step.args;
              const what = action ?? (model ? (field ? `${model}.${field}` : model) : "");
              return `${r.step.op} ${String(what)}: ${r.message}`;
            }),
        ];
        if (done.length > 0) {
          files = mended(files, done);
          const found = flawsOf(files);
          if (!best || weigh(found) < best.score)
            best = { files, count: done.length, score: weigh(found) };
          const flaws = last ? [] : found.map((f) => f.message);
          if (!flaws.some((f) => !told.has(f))) return draftOf(dropped);
          for (const f of flaws) told.add(f);
          droppedBefore = dropped;
          refused = [];
          prompt = `Description: ${options.description}${languageNote(options.description)}\n\nApplied so far (do not repeat them):\n${JSON.stringify(done)}\n\nThe app is valid, but a visitor would find it broken or too open:\n${flaws.map((f) => `- ${f}`).join("\n")}\n\nAnswer with only the operations that put this right for what the description wants (usually setPublic with the whole list; removeSection for a landing section that shows what visitors may not read), or with no operations if it is as intended.`;
          continue;
        }
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
