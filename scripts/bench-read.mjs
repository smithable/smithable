#!/usr/bin/env node
// The experiment of reading first descriptions without a model (packages/ai/src/read-description.ts)
// against the bench's descriptions, each with what a person would say is right: the kind of app,
// who signs in and what anyone may see. For each: what the reader settled, what it asked, and
// what it got wrong. A question where the description leaves it open is right; a wrong answer is
// the thing to drive to zero. Free: no model. Usage: node scripts/bench-read.mjs [--trace]
import { existsSync, readFileSync } from "node:fs";
import { readDescription, stem } from "../packages/ai/src/read-description.ts";

// [description, kinds that are right, audiences that are right, what visitors see that is right].
// "?" among them: the description leaves it open, so asking is right too.
const SET = [
  // The bench's first set: what the reader was written against.
  [
    "dev",
    "A booking site for a yoga studio, with classes, teachers and online booking.",
    ["booking"],
    ["members", "?"],
    ["read"],
  ],
  [
    "dev",
    "A CRM for a small sales team: companies, contacts, deals and follow-ups.",
    ["crm"],
    ["team"],
    ["nothing"],
  ],
  [
    "dev",
    "Invoicing for freelancers, with clients, invoices and payments.",
    ["invoicing"],
    ["me", "members", "?"],
    ["nothing"],
  ],
  [
    "dev",
    "A tool library where neighbors lend each other tools.",
    ["marketplace"],
    ["members"],
    ["read", "nothing", "?"],
  ],
  [
    "dev",
    "An inventory app for a small bakery: ingredients, suppliers and stock levels.",
    ["records"],
    ["team", "me", "?"],
    ["nothing"],
  ],
  [
    "dev",
    "A job board for a local union, with job posts and applications.",
    ["marketplace"],
    ["members"],
    ["read", "?"],
  ],
  [
    "dev",
    "A football club's site: teams, players, matches and results.",
    ["records"],
    ["team"],
    ["read"],
  ],
  [
    "dev",
    "Event registration for a conference: talks, speakers and attendees.",
    ["booking", "records"],
    ["members", "team", "?"],
    ["read", "?"],
  ],
  [
    "dev",
    "A help desk for an IT team: tickets, priorities and who handles them.",
    // The support starter fits it best since 2026-10-14; the two before it still do.
    ["support", "crm", "records"],
    ["team"],
    ["nothing"],
  ],
  [
    "dev",
    "A recipe collection for a family, with ingredients and shopping lists.",
    ["records"],
    ["team"],
    ["nothing"],
  ],
  [
    "dev",
    "A status page for our API, with incidents and planned maintenance.",
    ["status"],
    ["team"],
    ["read"],
  ],
  [
    "dev",
    "A public uptime page for a web shop: which services work, outages and their updates.",
    ["status"],
    ["team", "?"],
    ["read"],
  ],
  // The wide set: not written against.
  [
    "wide",
    "My clients as a freelance translator: who they are, what I quoted and what they paid.",
    ["crm", "invoicing"],
    ["me"],
    ["nothing"],
  ],
  [
    "wide",
    "A sales pipeline for our six-person web agency: leads, deals and who follows up when.",
    ["crm"],
    ["team"],
    ["nothing"],
  ],
  [
    "wide",
    "Online booking for a hair salon: customers pick a stylist and a free time themselves.",
    ["booking"],
    ["members"],
    ["read"],
  ],
  [
    "wide",
    "A piano teacher's lessons: my pupils, their weekly times and what each one practises.",
    ["booking", "records", "crm"],
    ["me"],
    ["nothing"],
  ],
  [
    "wide",
    "Invoices for my photography work: clients, shoots and what is still unpaid.",
    ["invoicing"],
    ["me"],
    ["nothing"],
  ],
  [
    "wide",
    "Our cleaning company of three sends invoices to households every month; we need one place for them.",
    ["invoicing"],
    ["team"],
    ["nothing"],
  ],
  [
    "wide",
    "A town flea market site where anyone can post things to sell, with photos and a price.",
    ["marketplace"],
    ["members"],
    ["read"],
  ],
  [
    "wide",
    "A swap shelf for our office: colleagues offer things they no longer need and others claim them.",
    ["marketplace"],
    ["team", "members"],
    ["nothing"],
  ],
  [
    "wide",
    "My vinyl record collection: albums, artists, condition and what I paid.",
    ["records"],
    ["me"],
    ["nothing"],
  ],
  [
    "wide",
    "Our local museum's collection online, so visitors can browse the objects and their stories.",
    ["records"],
    ["team"],
    ["read"],
  ],
  [
    "wide",
    "An internal status board for our IT systems, so staff see what is down and when it is back.",
    ["status"],
    ["team"],
    ["nothing"],
  ],
  [
    "wide",
    "Service status for our municipality's online services, for residents to check outages.",
    ["status"],
    ["team", "?"],
    ["read"],
  ],
  ["wide", "A log of my car's fuel, service visits and costs.", ["records"], ["me"], ["nothing"]],
  [
    "wide",
    "The guest list and seating plan for our wedding, with who has answered and their meal choices.",
    ["records"],
    ["team", "me"],
    ["nothing"],
  ],
  [
    "wide",
    "Bird sightings for our birdwatching club: species, place, date and who saw it.",
    ["records"],
    ["team", "members"],
    ["nothing", "read", "?"],
  ],
  [
    "wide",
    "Our allotment society: who has which plot, the waiting list and the yearly fee.",
    ["records", "crm"],
    ["team"],
    ["nothing"],
  ],
  [
    "wide",
    "A backend for my habit app: habits, daily check-ins and streaks.",
    ["api"],
    ["me"],
    ["nothing"],
  ],
  [
    "wide",
    "Somewhere my AI assistant keeps my tasks and notes, by project.",
    ["api"],
    ["me"],
    ["nothing"],
  ],
  // Other languages: not read at all, by design, so far.
  ["other", "Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet."],
  ["other", "Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor."],
  [
    "other",
    "En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.",
  ],
  ["other", "Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa."],
  ["other", "Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa."],
  ["other", "Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten."],
];

// C's blind set (docs/benchmarks/read-blind.json, or a path after --blind): written and judged
// without sight of the reader, with what a builder must notice and not drop (`notice`).
const blindAt = process.argv.includes("--blind")
  ? process.argv[process.argv.indexOf("--blind") + 1]
  : new URL("../docs/benchmarks/read-blind.json", import.meta.url).pathname;
const notices = new Map();
if (existsSync(blindAt))
  for (const d of JSON.parse(readFileSync(blindAt, "utf8"))) {
    SET.push(["blind", d.text, d.kind, d.audience, d.visitors]);
    notices.set(d.text, d.notice ?? []);
  }

const trace = process.argv.includes("--trace");
const mark = (value, right) =>
  value === undefined
    ? right.includes("?")
      ? "asked (open)"
      : "asked"
    : right.includes(value)
      ? "right"
      : "WRONG";
const totals = {};
const count = (set, what) => {
  totals[set] ??= {
    n: 0,
    right: 0,
    asked: 0,
    wrong: 0,
    leftover: 0,
    words: 0,
    clean: 0,
    questions: 0,
  };
  totals[set][what]++;
};
for (const [set, text, kinds, audiences, visitors] of SET) {
  const r = readDescription(text);
  if (set === "other") {
    console.log(`${r.read ? "READ (should not be)" : "not read"}  ${text}`);
    continue;
  }
  const marks = {
    kind: mark(r.kind, kinds),
    audience: mark(r.audience, audiences),
    visitors: mark(r.visitors, visitors),
  };
  count(set, "n");
  for (const m of Object.values(marks))
    count(set, m.startsWith("asked") ? "asked" : m === "right" ? "right" : "wrong");
  totals[set].leftover += r.leftover.length;
  totals[set].words += r.trace.length;
  totals[set].questions += r.questions.length;
  const wrong = Object.values(marks).some((m) => m === "WRONG");
  if (!wrong && r.questions.length === 0) count(set, "clean");
  console.log(`\n${text}`);
  console.log(
    `  kind ${r.kind ?? "?"} (${marks.kind}); who ${r.audience ?? "?"} (${marks.audience}); visitors ${r.visitors ?? "?"} (${marks.visitors})`,
  );
  console.log(
    `  things: ${r.things.join(", ") || "none"}${r.maybe.length ? `; perhaps: ${r.maybe.join(", ")}` : ""}; holds: ${r.fields.join(", ") || "nothing said"}`,
  );
  if (r.leftover.length) console.log(`  left over: ${r.leftover.join(", ")}`);
  if (r.questions.length) console.log(`  asks: ${r.questions.map((q) => q.question).join(" | ")}`);
  // What must not be dropped: each such word is left over or kept as a thing, never swallowed.
  // Only the words the description itself has: a judge's own word for it ("assignee") is not one
  // a reader could have left over.
  const said = new Set((text.toLowerCase().match(/[\p{L}\p{N}-]+/gu) ?? []).map(stem));
  const notice = (notices.get(text) ?? [])
    .flatMap((n) => n.toLowerCase().match(/[\p{L}\p{N}-]+/gu) ?? [])
    .filter((w) => said.has(stem(w)));
  if (notice.length) {
    const seen = new Set(
      [...r.leftover, ...[...r.things, ...r.maybe].flatMap((t) => t.split(" "))].map(stem),
    );
    const missed = notice.filter((w) => !seen.has(stem(w)));
    totals[set].notice = (totals[set].notice ?? 0) + notice.length;
    totals[set].missed = (totals[set].missed ?? 0) + missed.length;
    console.log(
      `  to notice: ${notice.join(", ")}${missed.length ? `; SWALLOWED: ${missed.join(", ")}` : "; all left over or kept"}`,
    );
  }
  if (trace) console.log(`  ${r.trace.map((t) => `${t.word}[${t.as}]`).join(" ")}`);
}
console.log(
  "\nset   descriptions  settled right  asked  wrong  no question and nothing wrong  questions  words left over",
);
for (const [set, t] of Object.entries(totals))
  console.log(
    `${set.padEnd(5)} ${String(t.n).padStart(12)} ${String(t.right).padStart(14)} ${String(t.asked).padStart(6)} ${String(t.wrong).padStart(6)} ${String(t.clean).padStart(30)} ${String(t.questions).padStart(10)} ${`${t.leftover} of ${t.words}`.padStart(15)}`,
  );
for (const [set, t] of Object.entries(totals))
  if (t.notice)
    console.log(
      `${set}: of ${t.notice} words a builder must notice, ${t.missed} were swallowed by a word list`,
    );
