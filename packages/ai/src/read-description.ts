// An experiment (Johan, 2026-10-05): reading a first description without a model. Every decision
// a first build needs starts unknown; each word of the description either settles something or
// is left over. What is still unknown and matters becomes a question, never a guess: rather a
// question than a mistake. This file imports nothing, so scripts/bench-read.mjs runs it as it is.

export type Kind =
  | "booking"
  | "crm"
  | "invoicing"
  | "marketplace"
  | "status"
  | "records"
  | "api"
  | "support"
  | "kiosk"
  | "barbers";

export interface Question {
  about: "kind" | "audience" | "visitors" | "languages";
  question: string;
  options: string[];
}

export interface Reading {
  /** Whether it was read at all: only English is, so far. */
  read: boolean;
  /** The app's shape: the starter that is its example. */
  kind?: Kind;
  /** Who signs in: only me, people I invite, or anyone who signs up. */
  audience?: "me" | "team" | "members";
  /** What anyone on the internet may do without signing in. */
  visitors?: "nothing" | "read";
  /** For programs or an AI assistant rather than people at a screen. */
  api?: boolean;
  /** The kinds of record the description names, as it names them. */
  things: string[];
  /**
   * Items of its list that no word list knows ("shopping lists", but also "SMS reminders"):
   * perhaps a thing to keep, perhaps a wish. Their words stay left over: asked, never built.
   */
  maybe: string[];
  /** What a record holds, where the description says so (price, photos, who handles it). */
  fields: string[];
  /** Words nothing accounted for. */
  leftover: string[];
  /** What must be asked before building. */
  questions: Question[];
  /** How each word was read, for the report. */
  trace: { word: string; as: string }[];
}

// A language's name as a description may write it (in English, in itself, in Finnish), and two
// named together, as packages/ai/src/language.ts reads them for the draft.
const LANGUAGES = "english|engelska|englanti|swedish|svenska|svensk|ruotsi|ruotsiksi";
const LANGUAGE_WORD = new RegExp(`\\b(${LANGUAGES})\\b`, "i");
const TWO_LANGUAGES = new RegExp(
  `\\b(${LANGUAGES})\\s*(?:,|and|och|ja|&|\\+)\\s*(?:also\\s+|även\\s+|också\\s+)?(${LANGUAGES})\\b`,
  "i",
);

const set = (words: string) => new Set(words.split(/\s+/).filter(Boolean));

// Short words of English that say nothing about the app.
const STOP = set(`a an the and or but of to for in on at by with from as is are be been was were
  can could may should will would that this these those so it its they them their there here
  where which who what when how each every one all any some no not still also other others
  than then into about up out off over under more most less very just only own new do does did
  has have had get gets got you your he she his her if while per via etc`);

// Words every app description has: they settle nothing and are not left over.
const GENERIC = set(`app application tool system software program solution platform
  need want like keep track tracking manage managing hold store know send small
  little local simple basic good nice thing stuff way one single whole together page board
  desk work month year week day longer front-page shared kept written second-hand invite
  invited behind`);

// The app's shape, by the words that are evidence for it.
const KIND: Record<string, [Kind, number][]> = {};
const cue = (kind: Kind, weight: number, words: string) => {
  for (const w of words.split(/\s+/).filter(Boolean))
    KIND[w] = [...(KIND[w] ?? []), [kind, weight]];
};
cue("booking", 3, "booking book reservation reserve appointment registration");
cue("booking", 2, "lesson class schedule timetable slot session stylist salon studio teacher");
cue("crm", 3, "crm lead deal pipeline prospect");
cue("crm", 2, "sales contact follow-up followup customer");
cue("crm", 1, "client company");
cue("invoicing", 3, "invoice invoicing billing bill quote quoted");
cue("invoicing", 2, "payment paid unpaid pay");
cue("invoicing", 1, "client fee");
cue("marketplace", 3, "marketplace sell selling sale swap lend lending borrow claim");
cue("marketplace", 2, "post offer listing ad advert market buy job");
cue("status", 3, "status status-page uptime outage incident downtime maintenance");
cue("status", 1, "down service");
cue("records", 3, "collection catalogue catalog log register archive inventory");
cue("records", 2, "sighting museum recipe list record");
cue("api", 3, "backend assistant chatbot bot");
cue("support", 3, "support helpdesk help-desk case");
cue("support", 2, "inbox agent reply");
cue("support", 1, "request");
cue("kiosk", 3, "takeaway take-away food-truck truck pre-order preorder hatch");
cue("kiosk", 2, "dish dishes pick-up pickup");
cue("kiosk", 1, "menu");
cue(
  "barbers",
  3,
  "barber barbers barbershop hairdresser hairdressers salon appointment appointments",
);
cue("barbers", 2, "haircut haircuts physiotherapist therapist clinic massage");
cue("barbers", 1, "slot slots");

// Who it is for. "My" and "our" say whose it is, which is the app's audience only for an app
// that looks inward (my clients, our pipeline): "my shop" and "our workshops" are a business
// with customers. A word for a group that works together says more.
const ME = set("i my me mine myself");
const OURS = set("our we us");
const TEAM = set(`team staff colleague office club society family internal crew department
  employee coworker band`);
// People outside. With a word for doing something themselves they sign up and add their own;
// with a word for looking they are visitors, which makes what they look at open.
const PEOPLE = set(`member neighbor neighbour customer anyone people everybody everyone resident
  visitor folk guest user patient tenant parent volunteer supporter fan donor subscriber
  applicant buyer seller participant client`);
// (Words that are as often a thing as a doing, "order", "report", "review", are not here.)
const CONTRIBUTE = set(`post sell lend borrow offer claim book pick register apply upload
  submit swap themselves suggest vote rent buy pay reserve sign-up`);
const LOOK = set("check browse see look view read follow find");
// What anyone may see.
const OPEN = set("public site website online");
const CLOSED = set("internal private");
const NOT = set("nothing not no never without");
// Words for the people of a team are who uses it, never a thing it keeps.
const NOT_THINGS = set("team colleague staff member");
// Shapes that face outward: who signs in and what is seen are never taken from "my" or "our".
const OUTWARD = new Set<string>(["booking", "marketplace", "status"]);

// Things people keep records of, by the word they use (singular).
const THING = set(`customer client contact company lead deal follow-up invoice payment quote
  booking appointment class teacher instructor lesson pupil student stylist service tool item
  product ingredient supplier job application team player match talk speaker attendee ticket
  recipe incident outage maintenance update component album artist object fuel visit guest
  sighting species plot shoot project task note order member event habit check-in streak
  case request message reply
  household colleague neighbor translator freelancer schedule blog catalog catalogue line
  picture contact-form`);
// What a record holds.
const FIELD = set(`price cost fee amount photo picture image date time place location
  condition priority result score story description level quantity stock answer answered choice
  meal status seating plan waiting weekly monthly yearly daily planned free`);
// Clauses that say what a record holds: "who handles them", "what I paid".
const CLAUSE: [RegExp, string][] = [
  [/\bwho (handles?|follows? up|has|saw|is responsible)\b/, "who (a person)"],
  [/\bwhat (i|we|they|it) (paid|cost|costs|quoted|owe)\b/, "an amount"],
  [/\bwhat is (still )?(unpaid|paid|open|done|down)\b/, "a state"],
  [/\bwho has answered\b/, "a state"],
  [/\bwhen it is back\b/, "a time"],
  [/\bwhat each one practi[sc]es\b/, "a text"],
  [/\bwho they are\b/, "a name"],
  [/\bwhich \w+ work\b/, "a state"],
];
const NUMBER = set("one two three four five six seven eight nine ten dozen");

/** A word as the lists hold it: lower case, singular, without a possessive. */
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/[’']s$/, "");
  if (/^(species|series|news|status|business|address|class|access)$/.test(w)) return w;
  if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (/(ss|x|ch|sh)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  return w;
}

// Short words of English that any sentence about an app has a few of (language.ts's test).
const ENGLISH = set(`a an the and or but of to for in on at by with from as is are be can may
  should will who what when where which that this these those our we us you your my i it its
  their they them so one each every all any some no not`);

// Two words that are one thing, joined before the words are read.
const PHRASES: [RegExp, string][] = [
  [/\bcontact forms?\b/gi, "contact-form"],
  [/\bsigns? up\b/gi, "sign-up"],
  [/\bfront page\b/gi, "front-page"],
  [/\bsecond hand\b/gi, "second-hand"],
  [/\bhelp ?desk\b/gi, "help-desk"],
  [/\bstatus pages?\b/gi, "status-page"],
];

export function readDescription(given: string): Reading {
  const description = PHRASES.reduce((text, [phrase, as]) => text.replace(phrase, as), given);
  const words = description.match(/[\p{L}\p{N}][\p{L}\p{N}’'-]*/gu) ?? [];
  const reading: Reading = {
    read: false,
    things: [],
    maybe: [],
    fields: [],
    leftover: [],
    questions: [],
    trace: [],
  };
  const english =
    words.length >= 4 &&
    words.filter((w) => ENGLISH.has(w.toLowerCase())).length / words.length >= 0.15;
  if (!english) return reading;
  reading.read = true;

  const text = description.toLowerCase();
  const votes = new Map<Kind, number>();
  const who = { me: 0, ours: 0, team: 0, people: 0, contribute: 0, look: 0 };
  let open = 0;
  let closed = 0;
  // Clauses first: their words are accounted for together.
  const inClause = new Set<number>();
  for (const [pattern, holds] of CLAUSE) {
    const found = pattern.exec(text);
    if (!found) continue;
    reading.fields.push(holds);
    let at = 0;
    words.forEach((w, i) => {
      const start = text.indexOf(w.toLowerCase(), at);
      at = start + w.length;
      if (start >= found.index && start < found.index + found[0].length) inClause.add(i);
    });
  }
  words.forEach((word, i) => {
    const w = stem(word);
    const as: string[] = [];
    if (inClause.has(i)) as.push("clause");
    // "Books" are things one reads; "book" and "booking" are what one does.
    const cues = /^books$/i.test(word) ? [] : (KIND[w] ?? []);
    for (const [kind, weight] of cues) {
      votes.set(kind, (votes.get(kind) ?? 0) + weight);
      as.push(`${kind} +${weight}`);
    }
    if (ME.has(w)) {
      who.me++;
      as.push("me");
    }
    if (OURS.has(w)) {
      who.ours++;
      as.push("ours");
    }
    if (TEAM.has(w) || /-person$/.test(w)) {
      who.team++;
      as.push("team");
    }
    if (LOOK.has(w)) {
      who.look++;
      as.push("looks");
    }
    if (PEOPLE.has(w)) {
      who.people++;
      as.push("people");
    }
    if (CONTRIBUTE.has(w)) {
      who.contribute++;
      as.push("adds");
    }
    if (OPEN.has(w)) {
      // "Nothing public", "not online": said to be closed.
      const before = words.slice(Math.max(0, i - 2), i).map((x) => x.toLowerCase());
      if (before.some((x) => NOT.has(x))) {
        closed++;
        as.push("closed");
      } else {
        open++;
        as.push("open");
      }
    }
    if (CLOSED.has(w)) {
      closed++;
      as.push("closed");
    }
    if (THING.has(w) && !NOT_THINGS.has(w)) {
      if (!reading.things.includes(w)) reading.things.push(w);
      as.push("thing");
    }
    if (FIELD.has(w)) {
      if (!reading.fields.includes(w)) reading.fields.push(w);
      as.push("field");
    }
    if (!as.length && (STOP.has(w) || STOP.has(word.toLowerCase()) || NOT.has(w) || w === "ai"))
      as.push("stop");
    if (!as.length && (GENERIC.has(w) || NUMBER.has(w) || /^\d+$/.test(w))) as.push("generic");
    if (!as.length) reading.leftover.push(word.toLowerCase());
    reading.trace.push({ word, as: as.join(", ") || "?" });
  });

  // An item of the list after ":" or "with" that no word list knows may be a thing to keep or
  // a wish ("shopping lists", "SMS reminders"): noted as it was written, and still left over.
  const colon = text.indexOf(":");
  const withAt = text.indexOf(" with ");
  const starts = [colon, withAt === -1 ? -1 : withAt + " with ".length - 1].filter((i) => i !== -1);
  const listed = starts.length ? text.slice(Math.min(...starts) + 1) : "";
  for (const item of listed.split(/,|;|\.|\band\b|\bor\b/)) {
    const parts = (item.match(/[\p{L}\p{N}][\p{L}\p{N}’'-]*/gu) ?? []).filter(
      (w) => !STOP.has(w) && !STOP.has(stem(w)),
    );
    if (parts.length === 0 || parts.length > 3) continue;
    if (parts.some((w) => reading.leftover.includes(w)))
      reading.maybe.push(parts.map(stem).join(" "));
  }

  // The shape: the kind with the most evidence, when it is clearly ahead.
  const ranked = [...votes].sort((a, b) => b[1] - a[1]);
  const [first, second] = ranked;
  if (first && first[1] >= 2 && (!second || first[1] >= second[1] + 2)) reading.kind = first[0];
  // "A status page for our API": the API is what it reports on, not what it is.
  if (votes.get("api")) {
    const rest = ranked.filter(([k]) => k !== "api");
    if ((votes.get("api") ?? 0) >= 3) {
      reading.api = true;
      reading.kind = "api";
    } else if (rest[0]) reading.kind = rest[0][0];
  }
  // Things to keep and no real evidence for any other shape (a single weak word is none): the
  // plain one, a list of records.
  if (!reading.kind && (first?.[1] ?? 0) < 2 && reading.things.length > 0) reading.kind = "records";
  if (!reading.kind)
    reading.questions.push({
      about: "kind",
      question: "What is the app mostly for?",
      options: [
        "Taking bookings",
        "Customers and sales",
        "Sending invoices",
        "People posting things for others",
        "Showing whether something works",
        "Keeping a collection or a log",
        "Records for a program or an AI assistant",
      ],
    });

  // People posting for each other is what a marketplace is. The same words about a team
  // (a crew that lends out its equipment) may be a plain log: asked, not guessed.
  const outsiders = who.people > 0 && who.contribute > 0;
  if (
    reading.kind === "marketplace" &&
    who.people === 0 &&
    who.team + who.ours + who.me > 0 &&
    !text.includes("marketplace")
  ) {
    reading.kind = undefined;
    reading.questions.push({
      about: "kind",
      question: "Do people offer things to each other in it, or is it a list you keep?",
      options: ["People offer things to each other", "A list we keep"],
    });
  }

  // What anyone may see. A word for closed wins; a word for open, or people from outside who
  // look at it, make it open.
  if (closed) reading.visitors = "nothing";
  else if (open || (who.people > 0 && who.look > 0)) reading.visitors = "read";

  // Who signs in. People from outside who do something themselves sign up; a group that works
  // together is invited; a status page is written by its team. "My" and "our" count only for a
  // shape that looks inward.
  const outward = reading.kind === undefined || OUTWARD.has(reading.kind);
  if (outsiders) reading.audience = "members";
  else if (who.team) reading.audience = "team";
  else if (reading.kind === "status") reading.audience = "team";
  else if (!outward && who.ours) reading.audience = "team";
  else if (!outward && who.me) reading.audience = "me";
  else if (reading.kind === "booking" && reading.visitors === "read") reading.audience = "members";
  if (reading.api && !reading.audience) reading.audience = "me";

  // Nothing said about being seen: closed, when it looks inward or a group that works together
  // uses it. A status page may be either, and a place to book or to post is for others: asked.
  if (reading.visitors === undefined && reading.kind !== undefined && reading.kind !== "status") {
    const inward = !OUTWARD.has(reading.kind);
    if (reading.api || (inward && reading.audience) || (who.team > 0 && !outsiders))
      reading.visitors = "nothing";
  }

  if (!reading.audience && reading.kind !== undefined)
    reading.questions.push({
      about: "audience",
      question: "Who will sign in to it?",
      options: ["Only me", "People I invite", "Anyone who signs up"],
    });
  if (reading.visitors === undefined && reading.kind !== undefined)
    reading.questions.push({
      about: "visitors",
      question: "Should people see anything without signing in?",
      options: ["No, nothing", "Yes, they can look", "Yes, and they can send a form"],
    });
  // A language named, but not two together ("for our Swedish customers", "in Swedish"): which
  // the app is in is asked (languages.md §6 step 6). Two named together the draft settles, and
  // an answer naming two ("Swedish and English") is read the same way.
  if (LANGUAGE_WORD.test(given) && !TWO_LANGUAGES.test(given))
    reading.questions.push({
      about: "languages",
      question: "Which languages should the app be in?",
      options: ["English", "Swedish", "Swedish and English", "English and Swedish"],
    });
  return reading;
}
