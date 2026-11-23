import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// A time through the API and the assistants' tools, in the app's own zone (T1307).
const conversions = (app: string) => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1\napp: { name: Classes${app} }\nmodels:\n  Lesson:\n    fields: { title: string!, startsAt: datetime }\npages:\n  lessons: { crud: Lesson }\n  team: { users: manage }\n`,
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\nroles: { admin: {} }\napi: { models: all }\n",
    },
    ir,
  ).auth as AuthIR;
  return (
    generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() }).find(
      (f) => f.path === "src/generated/api.server.ts",
    )?.content ?? ""
  );
};

class BadInput extends Error {}
/** The generated `moment` and the date-time's reading, run with the kit's zoned.ts. */
const run = async (code: string) => {
  const zoned: string = "../templates/src/kit/zoned.ts";
  const { instantOf, isoIn } = (await import(zoned)) as {
    instantOf(wall: string, timeZone?: string): Date;
    isoIn(at: Date, timeZone?: string): string;
  };
  const helper = code.match(/const moment = \(v: unknown, field: string\) => \{[\s\S]*?\n\};/)?.[0];
  const reading = code.match(/^ {4}startsAt: (.*),$/m)?.[1];
  expect(helper).toBeDefined();
  expect(reading).toBeDefined();
  const js = (helper as string).replace("(v: unknown, field: string)", "(v, field)");
  const moment = new Function("instantOf", "BadInput", `${js}\nreturn moment;`)(
    instantOf,
    BadInput,
  ) as (v: unknown, field: string) => Date;
  const read = new Function("isoIn", "row", `return ${reading};`) as (
    isoIn: unknown,
    row: unknown,
  ) => unknown;
  return { moment, read: (at: Date) => read(isoIn, { startsAt: at }) };
};

test("a time without an offset is the app's wall time, and is given back with the zone's offset", async () => {
  const code = conversions(", timezone: Europe/Mariehamn");
  expect(code).toContain('import { instantOf, isoIn } from "#/kit/zoned";');
  const { moment, read } = await run(code);
  // A bare local time, seconds kept.
  expect(moment("2026-11-28T10:00", "startsAt").toISOString()).toBe("2026-11-28T08:00:00.000Z");
  expect(moment("2026-11-28T10:00:30.5", "startsAt").toISOString()).toBe(
    "2026-11-28T08:00:30.500Z",
  );
  // A time with an offset or Z is that moment, wherever the app is.
  expect(moment("2026-11-28T10:00:00+01:00", "startsAt").toISOString()).toBe(
    "2026-11-28T09:00:00.000Z",
  );
  expect(moment("2026-11-28T10:00:00Z", "startsAt").toISOString()).toBe("2026-11-28T10:00:00.000Z");
  // Across the change from summer time (25 October 2026): the same wall time, an hour apart in UTC.
  expect(moment("2026-10-24T10:00", "startsAt").toISOString()).toBe("2026-10-24T07:00:00.000Z");
  expect(moment("2026-10-26T10:00", "startsAt").toISOString()).toBe("2026-10-26T08:00:00.000Z");
  // What was stored, as the result gives it, the record's own times too.
  expect(code).toContain(
    'createdAt: row.createdAt instanceof Date ? isoIn(row.createdAt, "Europe/Mariehamn")',
  );
  expect(read(new Date("2026-11-28T08:00:30Z"))).toBe("2026-11-28T10:00:30+02:00");
  expect(read(new Date("2026-10-24T07:00:00Z"))).toBe("2026-10-24T10:00:00+03:00");
  // At the changes themselves: 03:30 is skipped in spring (read with the offset before it) and
  // happens twice in autumn (its first occurrence).
  expect(moment("2026-03-29T03:30", "startsAt").toISOString()).toBe("2026-03-29T01:30:00.000Z");
  expect(moment("2026-10-25T03:30", "startsAt").toISOString()).toBe("2026-10-25T00:30:00.000Z");
  // Only ISO, on a day the calendar has: no rolling 30 February over, no server-zone guesses.
  for (const wrong of [
    "tomorrow",
    "2026-13-40T99:99",
    1764316800000,
    "2026-02-30T10:00",
    "2026-02-31T10:00:00+01:00",
    "2026-11-28 10:00",
    "2026-11-28",
    "2026-11-28T25:00",
    "2026-11-28T24:00",
    "2026-11-28T24:00Z",
    "2026-11-28T10:60",
  ])
    expect(() => moment(wrong, "startsAt")).toThrow(
      '"startsAt" must be a date and time, like "2026-10-04T09:30" (in Europe/Mariehamn) or "2026-10-04T09:30:00Z".',
    );
  // The API's description says the same.
  expect(code).toContain(
    '"description": "In Europe/Mariehamn when given without an offset, like 2026-10-04T09:30; given back with that zone\'s offset."',
  );
});

test("an app without a time zone keeps UTC and reads a time as before", async () => {
  const code = conversions("");
  expect(code).not.toContain("#/kit/zoned");
  expect(code).toContain('"format": "date-time"');
  expect(code).toContain(
    "createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,",
  );
  const { moment, read } = await run(code);
  expect(moment("2026-11-28T10:00:00Z", "startsAt").toISOString()).toBe("2026-11-28T10:00:00.000Z");
  expect(read(new Date("2026-11-28T08:00:30Z"))).toBe("2026-11-28T08:00:30.000Z");
});

test("the pages never read a time through these conversions: their round trip stays as it was", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Classes, timezone: Europe/Mariehamn }\nmodels:\n  Lesson:\n    fields: { title: string!, startsAt: datetime }\npages:\n  lessons: { crud: Lesson }\n  team: { users: manage }\n",
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\nroles: { admin: {} }\napi: { models: all, assistants: true }\nassistant: { for: signed-in, may: change }\n",
    },
    ir,
  ).auth as AuthIR;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  // Ask's tools carry their own copy of the conversions.
  const users = files
    .filter(
      (f) =>
        f.content.includes('from "#/generated/api.server"') || f.content.includes("const moment ="),
    )
    .map((f) => f.path);
  expect(users.length).toBeGreaterThan(0);
  // Only the REST API's routes and the assistants' tools (Ask's and MCP's) use them.
  expect(users).toContain("src/generated/ask.server.ts");
  const tools = [
    "src/generated/api.server.ts",
    "src/generated/mcp.server.ts",
    "src/generated/ask.server.ts",
  ];
  expect(users.filter((p) => !p.startsWith("src/routes/api/") && !tools.includes(p))).toEqual([]);
});
