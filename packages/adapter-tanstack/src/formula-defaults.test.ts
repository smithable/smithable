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
});
