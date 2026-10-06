import type { FieldIR, FieldValue, ModelIR } from "@smithable/core";
import { kebab, words } from "@smithable/core";

/** Sample value as stored: money in cents, datetimes as ISO strings. */
export type SampleValue = FieldValue | null;

export const SAMPLE_COUNT = 8;

const COMPANIES = [
  "Nordic Timber Oy",
  "Baltic Freight AB",
  "Skerry Software",
  "Helios Energy",
  "Fjord Analytics",
  "Kallio Design",
  "Solstice Bakery",
  "Arctic Outdoor Co",
];
const PEOPLE = [
  "Emma Lindqvist",
  "Oskar Nieminen",
  "Sofia Andersson",
  "Leo Virtanen",
  "Aino Karlsson",
  "Elias Johansson",
  "Maja Korhonen",
  "William Berg",
];
const SENTENCES = [
  "Prefers email over phone calls.",
  "Follow up after the summer break.",
  "Long-standing relationship, very reliable.",
  "Interested in the premium offering.",
  "Asked for a quote in the spring.",
  "Recommended to us by a partner.",
  "Needs invoices in English.",
  "Visited our office in August.",
];
const AMOUNTS = [120, 480, 1250, 2300, 75, 960, 3400, 640];

const PERSON_MODELS =
  /instructor|teacher|person|user|member|employee|contact|staff|student|author|coach/i;
const COMPANY_MODELS = /customer|client|company|supplier|vendor|partner|organi[sz]ation|account/i;

/** Deterministic, plausible sample rows for a model: identical on every run. */
export function sampleRows(model: ModelIR): Record<string, SampleValue>[] {
  return Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const row: Record<string, SampleValue> = {};
    for (const field of model.fields) row[field.name] = sampleValue(model, field, i, row);
    return row;
  });
}

function sampleValue(
  model: ModelIR,
  field: FieldIR,
  i: number,
  row: Record<string, SampleValue>,
): SampleValue {
  const name = field.name.toLowerCase();
  if (field.type.kind === "choice") return field.type.values[i % field.type.values.length] ?? null;
  // A reference points at one of the related model's sample records; ids start at 1.
  if (field.type.kind === "relation") {
    // Users sign in; sample data cannot invent them.
    return field.type.many || field.type.model === "User" ? null : (i % SAMPLE_COUNT) + 1;
  }
  switch (field.type.name) {
    case "string":
      if (/number|code|reference|sku/.test(name)) return `${prefix(model, field)}-${1001 + i}`;
      if (/name|title/.test(name)) return titleFor(model, i);
      return `${words(field.name).join(" ")} ${i + 1}`;
    case "text": {
      // The notes suit people and companies; elsewhere a plain placeholder.
      if (PERSON_MODELS.test(model.name) || COMPANY_MODELS.test(model.name))
        return SENTENCES[i % SENTENCES.length] ?? null;
      const title = Object.values(row).find((v) => typeof v === "string");
      return `A short description of ${title ?? `${words(model.name).join(" ")} ${i + 1}`}.`;
    }
    case "markdown": {
      const title = Object.values(row).find((v) => typeof v === "string");
      return `A short description of **${title ?? `${words(model.name).join(" ")} ${i + 1}`}**.\n\n- What it is\n- Who it is for`;
    }
    case "email": {
      const title = Object.values(row).find((v) => typeof v === "string" && v.includes(" "));
      const local = typeof title === "string" ? slug(title) : `${kebab(model.name)}${i + 1}`;
      return `${local}@example.com`;
    }
    case "phone":
      return `+358 40 ${String(120 + i * 7)} ${String(1000 + i * 37)}`;
    case "url":
      return `https://example.com/${kebab(model.name)}/${i + 1}`;
    case "int":
      return clamp(
        field,
        /minute/.test(name)
          ? 45 + (i % 4) * 15
          : /capacity|seats|size/.test(name)
            ? 8 + (i % 3) * 4
            : ((i * 7) % 20) + 1,
      );
    case "decimal":
      return clamp(field, 1 + ((i * 37) % 40) / 10);
    case "money":
      return clamp(field, AMOUNTS[i % AMOUNTS.length] ?? 100) * 100;
    case "bool":
      return i % 3 !== 0;
    case "date": {
      // Later date fields of a record get later dates (issued on, then due on).
      const nth = model.fields
        .filter((f) => f.type.kind === "scalar" && f.type.name === "date")
        .indexOf(field);
      // Spread over six months, so charts by month have something to show.
      return addDays("2026-04-15T00:00:00Z", i * 23 + nth * 30).slice(0, 10);
    }
    case "datetime":
      return new Date(
        Date.parse(addDays("2026-09-01T08:00:00Z", i)) + (i % 3) * 2 * 3_600_000,
      ).toISOString();
    case "picture":
    case "pictures":
      // The seed copies a sample picture in, when the app has any (see seedModule).
      return null;
    case "file":
    case "files":
      // Sample data has no documents: someone sends them.
      return null;
  }
}

function titleFor(model: ModelIR, i: number): string {
  if (PERSON_MODELS.test(model.name)) return PEOPLE[i % PEOPLE.length] ?? "";
  if (COMPANY_MODELS.test(model.name)) return COMPANIES[i % COMPANIES.length] ?? "";
  // Examples in the description, as in "A kind of class, such as Vinyasa or Yin."
  const examples = /such as ([^.;]+)/i
    .exec(model.description ?? "")?.[1]
    ?.split(/,\s*|\s+(?:and|or)\s+/)
    .map((e) => e.trim())
    .filter(Boolean);
  if (examples?.length) {
    const example = examples[i % examples.length] ?? "";
    const round = Math.floor(i / examples.length);
    return round === 0 ? example : `${example} ${round + 1}`;
  }
  const label = words(model.name).join(" ");
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} ${i + 1}`;
}

function prefix(model: ModelIR, field: FieldIR): string {
  const own = words(field.name).filter((w) => !/number|code|reference/.test(w));
  return (own[0] ?? model.name).slice(0, 3).toUpperCase();
}

function clamp(field: FieldIR, n: number): number {
  const min = field.min ?? Number.NEGATIVE_INFINITY;
  const max = field.max ?? Number.POSITIVE_INFINITY;
  return Math.min(Math.max(n, min), max);
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString();
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
}
