import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// Files reviewed before others see them (docs/design/file-review.md): a listing's required photo
// holds the listing; a tenant's optional contract holds only the file.
const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Market }
models:
  Listing:
    fields: { title: string!, photo: picture! }
    review: [photo]
  Tenant:
    fields: { name: string!, contract: file }
    review: all
  Note:
    fields: { text: string! }
pages:
  listings: { crud: Listing }
  tenants: { crud: Tenant }
  notes: { crud: Note }
  moderation: { review: all }
`,
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\ndefaultRole: member\nroles:\n  admin: all\n  moderator: { pages: all, review: [Listing] }\n  member: { pages: all, create: all }\n",
  },
  ir,
).auth as AuthIR;
const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
const file = (path: string) => files.find((f) => f.path === path)?.content ?? "";

test("the table of waiting files, and each model's reviewers", () => {
  expect(file("src/db/schema.ts")).toContain(
    'export const fileReviews = sqliteTable(\n  "file_reviews",',
  );
  expect(file("src/generated/listing.server.ts")).toContain(
    'export const REVIEWERS: string[] = ["admin","moderator"];',
  );
  expect(file("src/generated/tenant.server.ts")).toContain(
    'export const REVIEWERS: string[] = ["admin"];',
  );
  expect(file("src/generated/review.ts")).toContain(
    'export const REVIEW_PAGE: string | undefined = "/moderation";',
  );
  // A model without review has none of it.
  expect(file("src/generated/note.server.ts")).not.toContain("fileReviews");
});

test("a required reviewed field holds the record; an optional one only its file", () => {
  const listing = file("src/generated/listing.server.ts");
  expect(listing).toContain("unheld(viewer: Viewer | null)");
  expect(listing).toContain('inArray(schema.fileReviews.field, ["photo"])');
  expect(listing).not.toContain("function veiled");
  const tenant = file("src/generated/tenant.server.ts");
  expect(tenant).not.toContain("unheld(viewer");
  expect(tenant).toContain("function veiled");
  expect(tenant).toContain("return row ? veiled(viewer, [row])[0] : null;");
  // A new file waits in the save's own transaction; the reviewers are told after it.
  for (const data of [listing, tenant]) {
    expect(data).toContain("queueReviews(tx, viewer, made.id, undefined, made);");
    expect(data).toContain("queueReviews(tx, viewer, id, before, after);");
    expect(data).toContain("tellReviewers(");
    // A new file answers a rejection: the field's rejected rows go, so a held record is let go.
    expect(data).toContain(
      'or(eq(schema.fileReviews.file, file), eq(schema.fileReviews.state, "rejected"))',
    );
  }
});

test("the review page: its list, Approve and Reject, the reviewer's file, the menu's number", () => {
  expect(file("src/routes/moderation/index.tsx")).toContain(
    "reviewList(await currentViewer(), MODELS)",
  );
  expect(file("src/routes/moderation/file.$id.ts")).toContain(
    "reviewFile(request, await currentViewer()",
  );
  expect(file("src/generated/review.server.ts")).toContain("export function decide(");
  expect(file("src/routes/__root.tsx")).toContain(
    'counts: { "/moderation": waitingCount(viewer, ["Listing","Tenant"]) }',
  );
  expect(files.some((f) => f.path === "src/kit/Review.tsx")).toBe(true);
  expect(files.some((f) => f.path === "src/kit/review-mail.server.ts")).toBe(true);
  // The record's page tells its owner what waits or was rejected.
  expect(file("src/routes/listings/$id.tsx")).toContain(
    '<ReviewNotice notes={review} labels={{"photo":"Photo"}} />',
  );
});

test("an app without review gets none of its kit", () => {
  const plain = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Plain }\nmodels:\n  Note:\n    fields: { text: string! }\npages:\n  notes: { crud: Note }\n",
  }).ir as SpecIR;
  const made = generateApp(plain, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  expect(made.some((f) => f.path === "src/kit/Review.tsx")).toBe(false);
  expect(made.some((f) => f.path === "src/kit/review-mail.server.ts")).toBe(false);
});

test("trashed records enforce unheld for required reviewed files and veiled for optional reviewed files", () => {
  const withTrash = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Market }
models:
  Listing:
    fields: { title: string!, photo: picture! }
    review: [photo]
    trash: true
  Tenant:
    fields: { name: string!, contract: file }
    review: all
    trash: true
pages:
  listings: { crud: Listing }
  tenants: { crud: Tenant }
  moderation: { review: all }
`,
  }).ir as SpecIR;
  const made = generateApp(withTrash, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const at = (path: string) => made.find((f) => f.path === path)?.content ?? "";
  expect(at("src/generated/listing.server.ts")).toContain(
    "isNotNull(schema.listings.deletedAt), listingData.unheld(viewer), listingData.scoped(viewer)",
  );
  expect(at("src/generated/tenant.server.ts")).toContain("row: veiled(viewer, [shown])[0],");
});
