import type { SummarySection } from "@smithable/index";
import { expect, test } from "vitest";
import { entryOf, fieldOf, openSections, readTarget, summaryLink, toggled } from "./summary-tab";

const sections: SummarySection[] = [
  { concept: "app", title: "Acme CRM", sentences: ["A CRM."] },
  {
    concept: "model:Customer",
    title: "Customers",
    sentences: ["Each customer has:", "- a name", "- an email"],
    fields: [
      { field: "name", label: "Name", text: "a name" },
      { field: "email", label: "Email", text: "an email" },
    ],
  },
  { concept: "auth", title: "Sign-in", sentences: ["People sign in with a code."] },
  { concept: "payment:deposit", title: "Deposit", sentences: ["A deposit is paid."] },
  { concept: "plugin:greeting", title: "Greeting", sentences: ["A greeting."] },
];

test("the first section is open at first; what was opened or closed is kept, without parts that are gone", () => {
  expect(openSections(sections)).toEqual(["app"]);
  expect(openSections([])).toEqual([]);
  const next = toggled(toggled(["app"], "app"), "model:Customer");
  expect(next).toEqual(["model:Customer"]);
  expect(openSections(sections, next)).toEqual(["model:Customer"]);
  expect(openSections(sections, [])).toEqual([]);
  expect(openSections(sections, ["model:Gone", "auth"])).toEqual(["auth"]);
});

test("in No code a title opens its entry, a field's line its field, and sign-in Who can", () => {
  expect(summaryLink("nocode", "model:Customer")).toEqual({ in: "nocode", part: "model:Customer" });
  const field = fieldOf(sections[1] as SummarySection, "- an email");
  expect(field).toBe("email");
  expect(summaryLink("nocode", "model:Customer", field)).toEqual({
    in: "nocode",
    part: { file: "smithable.yml", path: ["models", "Customer", "fields", "email"] },
  });
  expect(entryOf("auth")).toEqual({ sub: "who", path: [] });
  expect(summaryLink("nocode", "auth")).toEqual({ in: "nocode", part: "auth" });
  // No place in No code: plain text.
  expect(summaryLink("nocode", "payment:deposit")).toBeUndefined();
  expect(summaryLink("nocode", "plugin:greeting")).toBeUndefined();
});

test("in Code the same links open the file at the part's dotted path", () => {
  expect(summaryLink("code", "model:Customer")).toEqual({
    in: "code",
    file: "smithable.yml",
    path: "models.Customer",
  });
  expect(summaryLink("code", "model:Customer", "email")).toEqual({
    in: "code",
    file: "smithable.yml",
    path: "models.Customer.fields.email",
  });
  expect(summaryLink("code", "app")).toEqual({ in: "code", file: "smithable.yml", path: "app" });
  expect(summaryLink("code", "auth")).toEqual({ in: "code", file: "smithable.auth.yml", path: "" });
  expect(summaryLink("code", "payment:deposit")).toEqual({
    in: "code",
    file: "smithable.yml",
    path: "payments.deposit",
  });
  // No place in Code either: plain text.
  expect(summaryLink("code", "plugin:greeting")).toBeUndefined();
});

test("the setting reads as No code unless Code was chosen", () => {
  expect(readTarget(null)).toBe("nocode");
  expect(readTarget("something")).toBe("nocode");
  expect(readTarget("code")).toBe("code");
});
