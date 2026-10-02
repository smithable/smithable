import { expect, test } from "vitest";
import { actionNote } from "./op.js";

test("a new custom action says where its code goes, with an example that sends mail", () => {
  const note = actionNote("contactSeller");
  expect(note).toContain("src/custom/actions/contact-seller.ts");
  expect(note).toContain('import { sendMail } from "#/kit/mail";');
});
