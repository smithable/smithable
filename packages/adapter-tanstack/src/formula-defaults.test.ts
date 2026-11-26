import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Kiosk }
models:
  Enquiry:
    fields:
      name: string!
      eventDate: date
      followUpOn: { type: date, default: TODAY(), by: app }
      remindOn: { type: date, default: TODAY() }
      dueOn:
        type: date
        default: DATEADD(issuedOn, 30, "day")
      issuedOn: { type: date, default: TODAY() }
      receivedAt: { type: datetime, default: NOW() }
pages:
  enquiries: { crud: Enquiry }
`,
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: `smithableAuth: 0.1
signIn: { providers: [google], allowedDomains: [example.com] }
defaultAccess: private
public: { pages: [enquiries], create: [Enquiry] }
`,
  },
  ir,
).auth as AuthIR;

test("defaults that read each other are filled one at a time, before a default that reads them (T1383)", () => {
  const cyclic = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Kiosk }
models:
  Booking:
    fields:
      name: string!
      remindOn:
        type: date
        default: DATEADD(endOn, -1, "day")
      startOn:
        type: date
        default: DATEADD(endOn, -1, "day")
      endOn:
        type: date
        default: DATEADD(startOn, 1, "day")
pages:
  bookings: { crud: Booking }
`,
  }).ir as SpecIR;
  expect(cyclic).toBeDefined();
  const data =
    generateApp(cyclic, {
      smithableVersion: "0.0.0",
      auth: validateAuth(
        {
          path: "smithable.auth.yml",
          text: "smithableAuth: 0.1\nsignIn: { providers: [google], allowedDomains: [example.com] }\ndefaultAccess: private\n",
        },
        cyclic,
      ).auth as AuthIR,
      content: emptyContent(),
    }).find((f) => f.path === "src/generated/booking.server.ts")?.content ?? "";
  const at = (name: string) => data.indexOf(`values.${name} = bookingDefaults.${name}(values)`);
  expect(at("startOn")).toBeGreaterThan(-1);
  // The cycle first, in the spec's order; the reminder that reads into it after both.
  expect(at("endOn")).toBeGreaterThan(at("startOn"));
  expect(at("remindOn")).toBeGreaterThan(at("endOn"));
});

test("a formula default is filled by checkCreate, so every way of making a record gets it, a visitor's form too (T1366)", () => {
  const data =
    generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() }).find(
      (f) => f.path === "src/generated/enquiry.server.ts",
    )?.content ?? "";
  expect(data).toContain(
    'import { enquiryDefaults, withEnquiryFormulas } from "./enquiry.formulas";',
  );
  // checkCreate is what create(), actions, splits, merges and order lines all call.
  expect(data).toMatch(/values = withFormulaDefaults\(/);
  // What the app fills and what a form may leave out alike; a value given, null too, is kept.
  expect(data).toContain(
    "if (values.followUpOn === undefined) values.followUpOn = enquiryDefaults.followUpOn(values);",
  );
  expect(data).toContain(
    "if (values.remindOn === undefined) values.remindOn = enquiryDefaults.remindOn(values);",
  );
  // A default that reads another defaulted field comes after it, whatever the spec's order.
  const issued = data.indexOf("values.issuedOn = enquiryDefaults.issuedOn(values)");
  const due = data.indexOf("values.dueOn = enquiryDefaults.dueOn(values)");
  expect(issued).toBeGreaterThan(-1);
  expect(due).toBeGreaterThan(issued);
  // A datetime column is written from a Date: NOW()'s ISO text would make the insert throw (crm import).
  expect(data).toContain(
    "if (values.receivedAt === undefined) values.receivedAt = new Date(enquiryDefaults.receivedAt(values));",
  );
});
