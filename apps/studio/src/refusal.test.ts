import { expect, test } from "vitest";
import { plainRefusal } from "./refusal";

test("a refusal loses the files' language in Builder", () => {
  expect(
    plainRefusal(
      [
        "removeField would make smithable.yml invalid.",
        'smithable.yml:39:18  error  The formula of shippingCost names "weight", which Order does not have.',
        "    hint: Change the formula first.",
      ].join("\n"),
    ),
  ).toBe(
    'The formula of shippingCost names "weight", which Order does not have.\nChange the formula first.',
  );
  expect(plainRefusal('addField: "type" is missing.')).toBe("Fill in “Type”.");
  expect(
    plainRefusal(
      'Model name "order line" must start with a capital letter and use only letters and digits.',
    ),
  ).toBe(
    "“order line” cannot be the name of a kind of record: use letters, digits and spaces, starting with a letter.",
  );
  // Already plain: as it is.
  expect(plainRefusal('Customer already has a field named "email".')).toBe(
    'Customer already has a field named "email".',
  );
});

test("files changed outside Studio are named in plain words, never 'commit or discard' (T1697)", () => {
  const said = plainRefusal(
    "Commit or discard these changes first:\n  ?? public/media/\n   M src/custom/a.ts\n",
  );
  expect(said).toBe(
    "Undo waits: public/media/, src/custom/a.ts changed outside Studio, and an undo now would take those edits along. It works again once they are saved as a change or put back.",
  );
  expect(said).not.toMatch(/commit|discard/i);
});
