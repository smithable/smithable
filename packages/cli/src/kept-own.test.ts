// Each person's records their own where the description has people from outside (T857): a draft
// that made everyone's records shared, when its starter was private, goes back to private for
// members, stays for a team, and is said where the reader cannot tell.

import { applyOperations, validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { keptOwn } from "./new.js";
import { STARTERS } from "./starters.gen.js";

const marketplace = STARTERS.marketplace as Record<string, string>;
const support = STARTERS.support as Record<string, string>;
/** A draft of the starter that made every record shared, as fb-04's did. */
const shared = (starter: Record<string, string>) => {
  const result = applyOperations(
    { spec: starter["smithable.yml"] ?? "", auth: starter["smithable.auth.yml"] ?? "" },
    [{ op: "setDefaultAccess", args: { access: "shared" } }],
  );
  if (!result.ok) throw new Error(result.message);
  return { ...starter, "smithable.auth.yml": result.files.auth ?? "" };
};
const access = (files: Record<string, string>) => {
  const ir = validateSpec({ path: "smithable.yml", text: files["smithable.yml"] ?? "" }).ir;
  return ir
    ? validateAuth({ path: "smithable.auth.yml", text: files["smithable.auth.yml"] ?? "" }, ir).auth
        ?.defaultAccess
    : undefined;
};

test("neighbours who sign up see their own records, not each other's (fb-04)", () => {
  const kept = keptOwn(
    shared(marketplace),
    "A tool library where neighbors lend each other tools.",
    marketplace,
  );
  expect(access(kept.files)).toBe("private");
  expect(kept.assumption?.chosen).toBe(
    "Each person sees their own records, and what a role's grants open to it.",
  );
});

test("a team sees each other's work: shared is kept", () => {
  const kept = keptOwn(
    shared(marketplace),
    "A CRM for a small sales team: companies, contacts, deals and follow-ups.",
    marketplace,
  );
  expect(access(kept.files)).toBe("shared");
  expect(kept.assumption).toBeUndefined();
});

test("where the reader cannot tell, shared is kept and said", () => {
  const kept = keptOwn(
    shared(marketplace),
    "An inventory app for a small bakery: ingredients, suppliers and stock levels",
    marketplace,
  );
  expect(access(kept.files)).toBe("shared");
  expect(kept.assumption?.chosen).toBe("Everyone who signs in sees every record.");
});

test("a starter that is shared itself is inherited, not decided: kept", () => {
  const kept = keptOwn(
    support,
    "Customers send us support requests and our agents answer them.",
    support,
  );
  expect(access(kept.files)).toBe("shared");
  expect(kept.assumption).toBeUndefined();
});
