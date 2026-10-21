import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const SPEC = `smithable: 0.1
app: { name: Barbers, timezone: Europe/Mariehamn }
models:
  Service:
    fields: { name: string!, minutes: int!, price: money }
  Barber:
    fields: { name: string!, phone: phone }
    schedule:
      hours: { mon-fri: "09:00-17:00", sat: "10:00-14:00" }
      breaks: "12:00-12:30"
      gap: 10
      away: TimeOff
  TimeOff:
    fields: { barber: Barber!, from: datetime!, until: datetime!, note: string }
  Appointment:
    fields:
      service: Service!
      barber: Barber!
      startsAt: datetime!
      name: string!
      status: { type: requested | confirmed | cancelled, by: app }
    occupies:
      resource: barber
      starts: startsAt
      duration: service.minutes
      while: { status: [requested, confirmed] }
      cancelUntil: 12h
pages:
  appointments: { crud: Appointment }
  day: { calendar: { model: Appointment, starts: startsAt, duration: service.minutes } }
  barbers: { crud: Barber }
`;
const generate = (text: string) => {
  const ir = validateSpec({ path: "smithable.yml", text }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles: { member: { pages: [appointments], create: [Appointment] } }\npublic: { read: [Service, Barber] }\n",
    },
    ir,
  ).auth as AuthIR;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  return (path: string) => files.find((f) => f.path === path)?.content;
};
const file = generate(SPEC);

test("the time a record takes is checked in its write's transaction, and a move is checked again", () => {
  const data = file("src/generated/appointment.server.ts") ?? "";
  expect(data).toContain("const SCHEDULE: Schedule = {");
  expect(data).toContain(
    'const holdsTime = (row: Record<string, unknown>) => ["requested","confirmed"].includes(String(row.status));',
  );
  // The barber's appointments that hold time, with each service's minutes, and time away.
  expect(data).toContain(
    ".innerJoin(schema.services, eq(schema.services.id, schema.appointments.serviceId))",
  );
  expect(data).toContain("eq(schema.timeOffs.barberId, barberId)");
  expect(data).toMatch(
    /row = db\.transaction\(\(tx\) => \{\n\s+checkTime\(tx, \{ status: "requested", \.\.\.values \}\);/,
  );
  expect(data).toContain('["barberId", "startsAt", "serviceId", "status"].some((k) => k in moving');
  expect(data).toContain("checkTime(tx, { ...before, ...updated }, id);");
  expect(data).toContain("throw new Conflict(`not-free:");
});

test("the picker's free times, and the owner's Cancel inside its window", () => {
  const client = file("src/generated/appointment.ts") ?? "";
  expect(client).toContain("export const appointmentTimes = createServerFn()");
  expect(client).toContain(
    'bindSlots(appointmentTimes, { resource: "barberId", length: "serviceId" })',
  );
  expect(client).toContain(
    'export const cancelOwnAppointment = createServerFn({ method: "POST" })',
  );
  const data = file("src/generated/appointment.server.ts") ?? "";
  expect(data).toContain("const closes = row.startsAt.getTime() - 720 * 60_000;");
  expect(data).toContain('{ status: "cancelled" } as unknown as AppointmentValues, "cancelled"');
  // "Anyone": every barber the viewer may read, in their order.
  expect(data).toContain(
    "db.select({ id: schema.barbers.id }).from(schema.barbers).where(barberData.readable(viewer)).orderBy(asc(schema.barbers.id))",
  );
  expect(file("src/routes/appointments/$id.tsx")).toContain(
    "<CancelOwn id={row.id} load={appointmentCancelState} cancel={cancelOwnAppointment} />",
  );
  expect(file("src/kit/Slots.tsx")).toBeDefined();
  expect(file("src/kit/slots.ts")).toBeDefined();
});

test("the calendar has a day view with a column for each barber", () => {
  const route = file("src/routes/day/index.tsx") ?? "";
  expect(route).toContain("lane: row.barberId,");
  expect(route).toContain(
    'lanes: (await barberData.list(viewer)).map((r) => ({ id: r.id, title: String(r.name ?? "") })).sort((a, b) => a.id - b.id),',
  );
  expect(route).toContain("day: shaped(s.day,");
  expect(route).toContain("lanes={lanes}");
});

test("the access test books a time the schedule has, and the same time twice is refused", () => {
  const access = file("src/generated/access.test.ts") ?? "";
  // Monday 12 January 2026 opens at 09:00; a service of thirty minutes fits it.
  expect(access).toContain('startsAt: instantOf("2026-01-12T09:00", app.timeZone)');
  expect(access).toMatch(/function serviceValues[\s\S]*?minutes: 30,/);
  expect(access).toContain('describe("Appointment takes its barber\'s time", () => {');
  expect(access).toContain(".rejects.toThrow(/^not-free:/);");
});

test("without occupies, nothing of it", () => {
  const plain = generate(
    SPEC.replace(/ {4}occupies:[\s\S]*?cancelUntil: 12h\n/, "").replace(
      / {4}schedule:[\s\S]*?away: TimeOff\n/,
      "",
    ),
  );
  expect(plain("src/kit/Slots.tsx")).toBeUndefined();
  expect(plain("src/generated/appointment.server.ts")).not.toContain("checkTime");
  expect(plain("src/routes/day/index.tsx")).not.toContain("lanes");
});
