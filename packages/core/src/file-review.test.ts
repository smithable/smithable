import { expect, test } from "vitest";
import { pageAccess, reviewRoles } from "./access.js";
import { applyOperation } from "./apply.js";
import { validateAuth } from "./auth.js";
import { validateSpec } from "./spec.js";

// Files reviewed before others see them (docs/design/file-review.md).
const spec = (review: string, page = "  moderation: { review: all }\n") => `smithable: 0.1
app: { name: Market }
models:
  Listing:
    fields:
      title: string!
      photo: picture!
      contract: file
      price: money
${review}
  Seller:
    fields: { name: string! }
pages:
  listings: { crud: Listing }
${page}`;
const read = (review: string, page?: string) =>
  validateSpec({ path: "smithable.yml", text: spec(review, page) });
const codes = (review: string, page?: string) => read(review, page).diagnostics.map((d) => d.code);
const AUTH = `smithableAuth: 0.1
signIn: { providers: [google] }
defaultAccess: shared
defaultRole: member
roles:
  admin: all
  moderator: { pages: all, review: [Listing] }
  member: { pages: all }
`;

test("review names a model's picture and file fields, or all of them", () => {
  expect(read("    review: [photo]").ir?.models[0]?.review).toEqual(["photo"]);
  expect(read("    review: all").ir?.models[0]?.review).toEqual(["photo", "contract"]);
});

test("a name that is no picture or file field is an error; all with none is a warning", () => {
  expect(codes("    review: [price]")).toContain("review-not-file");
  expect(codes("    review: [nope]")).toContain("review-not-file");
  const none = validateSpec({
    path: "smithable.yml",
    text: spec("    review: [photo]").replace(
      "  Seller:\n    fields: { name: string! }",
      "  Seller:\n    fields: { name: string! }\n    review: all",
    ),
  });
  expect(none.diagnostics.map((d) => d.code)).toContain("review-nothing");
  expect(none.ir).toBeDefined();
});

test("the review page lists every reviewed model, or those named; files with no page to wait on are a warning", () => {
  const page = read("    review: [photo]").ir?.pages[1];
  expect(page?.pattern).toEqual({ kind: "review", models: ["Listing"], all: true });
  expect(codes("    review: [photo]", "")).toContain("review-no-page");
  expect(codes("", "  moderation: { review: [Seller] }\n")).toContain("review-nothing");
  expect(read("    review: [photo]", "  moderation: { review: [Sellr] }\n").ir).toBeUndefined();
});

test("the review grant names models; the review page opens for admins and those roles, not for pages: all", () => {
  const ir = read("    review: [photo]").ir;
  if (!ir) throw new Error("invalid");
  const { auth, diagnostics } = validateAuth({ path: "smithable.auth.yml", text: AUTH }, ir);
  if (!auth) throw new Error(diagnostics.map((d) => d.message).join("\n"));
  expect(reviewRoles("Listing", auth)).toEqual(["admin", "moderator"]);
  expect(reviewRoles("Seller", auth)).toEqual(["admin"]);
  expect(pageAccess(ir.pages[1] as never, auth).roles).toEqual(["admin", "moderator"]);
  const unknown = validateAuth(
    { path: "smithable.auth.yml", text: AUTH.replace("review: [Listing]", "review: [Listin]") },
    ir,
  );
  expect(unknown.diagnostics.map((d) => d.code)).toContain("unknown-model");
});

test("setReview sets the fields, all or none; grant review names models; addReviewPage adds the page", () => {
  const files = { spec: spec("", ""), auth: AUTH.replace(", review: [Listing]", "") };
  const set = applyOperation(files, "setReview", { model: "Listing", fields: ["photo"] });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.spec).toContain("review: [photo]");
  const all = applyOperation(set.files, "setReview", { model: "Listing", fields: ["all"] });
  if (!all.ok) throw new Error(all.message);
  expect(all.files.spec).toContain("review: all");
  const none = applyOperation(all.files, "setReview", { model: "Listing", fields: ["none"] });
  if (!none.ok) throw new Error(none.message);
  expect(none.files.spec).not.toContain("review:");
  expect(applyOperation(files, "setReview", { model: "Listing", fields: ["price"] })).toMatchObject(
    { ok: false },
  );
  expect(applyOperation(files, "setReview", { model: "Seller", fields: ["all"] })).toMatchObject({
    ok: false,
  });
  const page = applyOperation(set.files, "addReviewPage", {});
  if (!page.ok) throw new Error(page.message);
  expect(page.files.spec).toContain("review:\n    review: all");
  const grant = applyOperation(page.files, "grant", {
    role: "moderator",
    what: "review",
    names: ["Listing"],
  });
  if (!grant.ok) throw new Error(grant.message);
  expect(grant.files.auth).toContain("review: [Listing]");
});

test("a review list follows a renamed field, and loses a removed one", () => {
  const files = { spec: spec("    review: [photo, contract]"), auth: AUTH };
  const renamed = applyOperation(files, "renameField", {
    model: "Listing",
    from: "photo",
    to: "picture",
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.spec).toContain("review: [picture, contract]");
  const removed = applyOperation(files, "removeField", { model: "Listing", field: "contract" });
  if (!removed.ok) throw new Error(removed.message);
  expect(removed.files.spec).toContain("review: [photo]");
});
