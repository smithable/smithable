import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
  validateUx,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// The kit's zoned.ts and params.ts, as the generated apps get them (paths the build does not follow).
const zonedPath: string = "../templates/src/kit/zoned.ts";
const paramsPath: string = "../templates/src/kit/params.ts";
const zoned = (await import(zonedPath)) as {
  relativeDays(value: string, now: Date, timeZone?: string): { from?: string; to?: string };
};
const params = (await import(paramsPath)) as {
  withDefaults(
    given: Record<string, string | undefined>,
    defaults: Record<string, string>,
  ): Record<string, string | undefined>;
};

test("a relative date spans the right days in the app's time zone; a week starts on Monday", () => {
  const { relativeDays } = zoned;
  // 23:30 UTC on a Wednesday is already Thursday the 15th in Mariehamn (UTC+3 in October).
  const now = new Date("2026-10-14T23:30:00Z");
  const tz = "Europe/Mariehamn";
  expect(relativeDays("today", now, tz)).toEqual({ from: "2026-10-15", to: "2026-10-16" });
  expect(relativeDays("today", now, "UTC")).toEqual({ from: "2026-10-14", to: "2026-10-15" });
  expect(relativeDays("thisWeek", now, tz)).toEqual({ from: "2026-10-12", to: "2026-10-19" });
  expect(relativeDays("thisMonth", now, tz)).toEqual({ from: "2026-10-01", to: "2026-11-01" });
  expect(relativeDays("upcoming", now, tz)).toEqual({ from: "2026-10-15" });
  expect(relativeDays("past", now, tz)).toEqual({ to: "2026-10-15" });
  // December's month ends in the next year; a Sunday's week began the Monday before.
  expect(relativeDays("thisMonth", new Date("2026-12-20T12:00:00Z"), "UTC")).toEqual({
    from: "2026-12-01",
    to: "2027-01-01",
  });
  expect(relativeDays("thisWeek", new Date("2026-10-18T12:00:00Z"), "UTC")).toEqual({
    from: "2026-10-12",
    to: "2026-10-19",
  });
});

test("a page's defaults fill what the address leaves out, and 'all' clears one", () => {
  const { withDefaults } = params;
  const defaults = { startsAt: "upcoming", status: "open,full" };
  expect(withDefaults({}, defaults)).toEqual(defaults);
  expect(withDefaults({ startsAt: "past" }, defaults)).toEqual({
    startsAt: "past",
    status: "open,full",
  });
  expect(withDefaults({ startsAt: "all", q: "yoga" }, defaults)).toEqual({
    q: "yoga",
    status: "open,full",
  });
});

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Studio, timezone: Europe/Mariehamn }
models:
  Session:
    fields:
      title: string!
      startsAt: datetime!
      status: open | full | canceled
      places: int
pages:
  sessions:
    crud: Session
    filters: [startsAt, status, places, createdAt]
    defaultFilter: { startsAt: upcoming, status: [open, full] }
`,
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\n",
  },
  ir,
).auth as AuthIR;

test("the list route applies the page's defaults and the time zone, and marks folded filters", () => {
  const ux = validateUx(
    {
      path: "smithable.ux.yml",
      text: "smithableUx: 0.1\npages:\n  sessions:\n    filters: { shown: [startsAt, status] }\n",
    },
    ir,
  ).ux;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent(), ux });
  const route = files.find((f) => f.path === "src/routes/sessions/index.tsx")?.content ?? "";
  // The server function reads the address with the defaults; a date range in the app's time zone.
  expect(route).toContain(
    'withDefaults(given.f ?? {}, { startsAt: "upcoming", status: "open,full" })',
  );
  expect(route).toContain(
    'inRange(schema.sessions.startsAt, data.f?.startsAt, "instant", 1, app.timeZone)',
  );
  expect(route).toContain(
    'inRange(schema.sessions.createdAt, data.f?.createdAt, "instant", 1, app.timeZone)',
  );
  expect(route).toContain('inRange(schema.sessions.places, data.f?.places, "number")');
  expect(route).toContain('import { app } from "#/generated/app";');
  expect(route).toMatch(/import \{ [^}]*withDefaults[^}]* \} from "#\/kit\/params";/);
  // The kit gets the address as it is and the defaults, and which filters fold.
  expect(route).toContain("values={values}");
  expect(route).toContain('defaults={{ startsAt: "upcoming", status: "open,full" }}');
  expect(route).toMatch(/name: "places"[^}]*folded: true/);
  expect(route).toMatch(/name: "createdAt"[^}]*folded: true/);
  expect(route).not.toMatch(/name: "startsAt"[^}]*folded/);
  // Without the ux file's shown, nothing folds; without defaults, the address is read as it is.
  const plain = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const plainRoute = plain.find((f) => f.path === "src/routes/sessions/index.tsx")?.content ?? "";
  expect(plainRoute).not.toContain("folded");
});

test("a filter on a reference is a search from 200 readable records, or as the ux file says (A 208)", () => {
  const spec = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Rooms }
models:
  Room:
    fields:
      name: string!
  Booking:
    fields:
      room: Room!
pages:
  bookings:
    crud: Booking
    filters: [room]
`,
  }).ir as SpecIR;
  const route = (pick?: string) => {
    const ux = pick
      ? validateUx(
          {
            path: "smithable.ux.yml",
            text: `smithableUx: 0.1\npages:\n  bookings:\n    filters: { pick: { room: ${pick} } }\n`,
          },
          spec,
        ).ux
      : undefined;
    const files = generateApp(spec, {
      smithableVersion: "0.0.0",
      auth,
      content: emptyContent(),
      ux,
    });
    const at = (path: string) => files.find((f) => f.path === path)?.content ?? "";
    return { list: at("src/routes/bookings/index.tsx"), data: at("src/generated/room.server.ts") };
  };
  // Unsaid: the related records the viewer may read are counted, never listed to decide.
  const counted = route();
  expect(counted.data).toContain("pickCount(viewer: Viewer | null): number {");
  expect(counted.list).toContain("const pickRoomMany = roomData.pickCount(viewer) >= 200;");
  expect(counted.list).toContain(
    "options: { room: pickRoomMany ? pickRoomChosen : (await roomData.list(viewer))",
  );
  expect(counted.list).toContain(
    "search: options.roomSearch ? (text: string) => pickRoom({ data: { text } }) : undefined",
  );
  // Said: always a search, or always the list as before.
  expect(route("search").list).toContain("const pickRoomMany = true;");
  const listed = route("list").list;
  expect(listed).not.toContain("pickRoom");
  expect(listed).toContain("options: { room: (await roomData.list(viewer))");
});
