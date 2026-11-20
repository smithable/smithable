import { expect, test } from "vitest";

// The kit's refusal.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../templates/src/kit/refusal.ts";
const kit = (await import(path)) as {
  refusalText(
    error: unknown,
    fallback: string,
    on?: { label?: string; fields?: { name: string; label: string }[]; timeZone?: string },
  ): string;
};
const said = (message: string, on = {}) => kit.refusalText(new Error(message), "Try again.", on);

test("every surface says a refusal in words, never its code (T1010)", () => {
  const customer = { label: "Customer", fields: [{ name: "vatNumber", label: "VAT number" }] };
  expect(said("taken:vat_number", customer)).toBe("Another customer already has this vat number.");
  expect(said("taken:email")).toBe("Another record already has this email.");
  expect(said("in-use", customer)).toBe(
    "This customer is still used by other records. Change or delete those first.",
  );
  expect(said("no-right:Orders")).toMatch(/orders records are not yours/);
  expect(said("full")).toBe("No places left.");
  expect(said("no-value:Total")).toMatch(/Total/);
  expect(said("closed")).toBe("Booking for this has closed.");
  expect(said("cancel-closed")).toMatch(/too late to cancel/);
  expect(said("booked:3")).toMatch(/^3 are already taken/);
  expect(said("not-free:2026-11-20T09:00:00Z", { timeZone: "UTC" })).toMatch(/09:00|9:00/);
  for (const code of ["taken:email", "in-use", "no-value:Total", "booked:3", "cancel-closed"])
    expect(said(code)).not.toContain(code);
  // Anything else is said as it came, and nothing at all as the surface's own fallback.
  expect(said("The order is already sent.")).toBe("The order is already sent.");
  expect(kit.refusalText("The order is already sent.", "Try again.")).toBe(
    "The order is already sent.",
  );
  expect(kit.refusalText("no-right:Orders", "Try again.")).toMatch(/orders records are not yours/);
  expect(kit.refusalText(undefined, "Try again.")).toBe("Try again.");
});
