// The description that makes each starter, in words the reader knows (read-description.ts), and
// what a small edit of it means (Johan, 2026-10-05). The start page shows a starter's
// description in its box; built unchanged it is the starter, at no cost. A small change (a thing
// added or taken out, closed to visitors, by invitation only) is read as the difference between
// the two readings and made by operations, with no model. Anything else is a new description
// and goes the usual way: about something else, a word the reader cannot place, a choice about
// what to open.
import { applyOperation, type ProjectFiles } from "@smithable/core";
import { readDescription, stem } from "./read-description.js";

interface Step {
  op: string;
  args: Record<string, unknown>;
}

export interface StarterText {
  text: string;
  /** The page of each thing the description names that has a page of its own. */
  pages: Record<string, string>;
}

export const STARTER_TEXTS: Record<string, StarterText> = {
  booking: {
    text: "A booking site for a yoga studio: a public schedule of classes with their teachers, where members sign up and book their own places, with a blog and a contact form.",
    pages: { class: "class-types", teacher: "instructors", blog: "blog", schedule: "schedule" },
  },
  crm: {
    text: "A CRM for a small sales team: customers and their orders, shared by colleagues we invite, with nothing public.",
    pages: { customer: "customers", order: "orders" },
  },
  invoicing: {
    text: "Invoicing for freelancers: anyone signs up and keeps their own clients and invoices with their lines, behind a public front page.",
    pages: { client: "clients", invoice: "invoices" },
  },
  marketplace: {
    text: "A marketplace for a neighborhood: a public catalog of second-hand things with photos and a price, where anyone signs up to sell their own.",
    pages: {},
  },
  records: {
    text: "My collection of things with pictures and a description, on a public site for visitors to browse.",
    pages: {},
  },
  status: {
    text: "A public status page for our services: components, incidents with their updates and planned maintenance, written by a team we invite.",
    pages: {},
  },
  api: {
    text: "A backend where my AI assistant keeps tasks and notes by project for a small team, with nothing public.",
    pages: {},
  },
  support: {
    text: "A support desk for a small team: customer requests to our inbox, each a case with its messages and replies, answered by agents we invite, with nothing public.",
    pages: { case: "cases" },
  },
};

export type Edit =
  /** The starter as it is. */
  | { kind: "same" }
  /** The starter with these operations applied; `notes` say what the person should know. */
  | { kind: "edit"; steps: Step[]; notes: string[]; files: ProjectFiles }
  /** A new description: `why` says what made it one. */
  | { kind: "rewrite"; why: string };

const plain = (text: string) =>
  (text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}’'-]*/gu) ?? []).map(stem).join(" ");
const pascal = (thing: string) =>
  thing
    .split(/[\s-]+/)
    .map((w) => (w[0]?.toUpperCase() ?? "") + w.slice(1))
    .join("");
const pageOf = (thing: string) => {
  const kebab = thing.trim().replace(/\s+/g, "-");
  return kebab.endsWith("y")
    ? `${kebab.slice(0, -1)}ies`
    : /(s|x|ch|sh)$/.test(kebab)
      ? `${kebab}es`
      : `${kebab}s`;
};
const minus = (a: string[], b: string[]) => a.filter((x) => !b.includes(x));

/** What an edited description of a starter means, given the starter's files. */
export function readEdit(starter: string, edited: string, files: ProjectFiles): Edit {
  const known = STARTER_TEXTS[starter];
  if (!known) return { kind: "rewrite", why: "There is no such starter." };
  if (plain(edited) === plain(known.text)) return { kind: "same" };
  const before = readDescription(known.text);
  const after = readDescription(edited);
  if (!after.read) return { kind: "rewrite", why: "It is not written in English." };
  if (after.kind !== before.kind) return { kind: "rewrite", why: "It is another kind of app." };
  if (after.questions.length)
    return {
      kind: "rewrite",
      why: `It leaves open: ${after.questions.map((q) => q.question).join(" ")}`,
    };
  // The words the starter's description is about (a yoga studio) are its subject: with another
  // subject the starter's texts, samples and pictures no longer fit.
  const subject = before.leftover.map(stem);
  const strange = after.leftover.filter((w) => !subject.includes(stem(w)));
  if (strange.length)
    return {
      kind: "rewrite",
      why: `It says something the reader cannot place: ${strange.join(", ")}.`,
    };
  if (minus(before.leftover.map(stem), after.leftover.map(stem)).length)
    return { kind: "rewrite", why: "It is about something else." };
  if (minus(after.fields, before.fields).length || minus(before.fields, after.fields).length)
    return { kind: "rewrite", why: "It changes what a record holds." };

  const steps: Step[] = [];
  const notes: string[] = [];
  for (const thing of minus(after.things, before.things)) {
    steps.push(
      {
        op: "addModel",
        args: { model: pascal(thing), fields: { name: "string!", notes: "text" } },
      },
      { op: "addPage", args: { page: pageOf(thing), model: pascal(thing) } },
    );
    notes.push(`Added ${pageOf(thing)} with a name and notes: say what else they hold.`);
  }
  for (const thing of minus(before.things, after.things)) {
    const page = known.pages[thing];
    if (page) steps.push({ op: "removePage", args: { page } });
    else return { kind: "rewrite", why: `Taking out ${thing} changes more than a page.` };
  }
  if (before.visitors !== after.visitors) {
    // Closing is safe; what to open is a choice.
    if (after.visitors !== "nothing")
      return { kind: "rewrite", why: "It opens something to visitors." };
    steps.push({ op: "setPublic", args: { pages: [], read: [], create: [] } });
  }
  if (before.audience !== after.audience) {
    if (before.audience === "members" && after.audience === "team")
      steps.push({ op: "setSignUp", args: { who: "invited" } });
    else return { kind: "rewrite", why: "It changes who signs in." };
  }
  if (!steps.length) return { kind: "rewrite", why: "The reader sees no difference it can make." };

  let next = files;
  for (const step of steps) {
    const result = applyOperation(next, step.op, step.args);
    if (!result.ok) return { kind: "rewrite", why: `${step.op}: ${result.message}` };
    next = result.files;
  }
  return { kind: "edit", steps, notes, files: next };
}
