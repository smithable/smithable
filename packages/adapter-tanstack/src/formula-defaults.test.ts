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

test("a formula default is filled on the server for a field the values leave out, a visitor's form too (T1366)", () => {
  const data =
    generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() }).find(
      (f) => f.path === "src/generated/enquiry.server.ts",
    )?.content ?? "";
  expect(data).toContain(
    'import { enquiryDefaults, withEnquiryFormulas } from "./enquiry.formulas";',
  );
  // What the app fills and what a form may leave out alike; a value given is kept.
  expect(data).toContain(
    "followUpOn: values.followUpOn === undefined ? enquiryDefaults.followUpOn(values) : values.followUpOn",
  );
  expect(data).toContain(
    "remindOn: values.remindOn === undefined ? enquiryDefaults.remindOn(values) : values.remindOn",
  );
});
