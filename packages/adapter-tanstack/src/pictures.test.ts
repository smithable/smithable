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
app: { name: Studio }
models:
  Instructor:
    fields:
      name: string!
      portrait: picture
pages:
  instructors: { crud: Instructor }
`,
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\npublic: { read: [Instructor] }\n",
  },
  ir,
).auth as AuthIR;
const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
const file = (path: string) => files.find((f) => f.path === path)?.content ?? "";

test("a picture field: a JSON column, the form's own control, and the files routes with their table", () => {
  expect(file("src/db/schema.ts")).toContain('portrait: text({ mode: "json" }).$type<Picture>()');
  expect(file("src/generated/instructor.ts")).toContain(
    'input: bindPicture("instructor", "portrait")',
  );
  expect(file("src/generated/instructor.schema.ts")).toContain(
    "portrait: z.object({ file: z.string().regex(/^instructor\\/[a-f0-9]{24}\\.webp$/), alt: z.string().trim().max(200), width: z.int().positive(), height: z.int().positive(), generated: z.literal(true).optional(), receipt: z.string().max(64).optional() }).nullish()",
  );
  expect(file("src/generated/uploads.ts")).toContain(
    '"instructor": {\n    "portrait": { kind: "picture", data: instructorData, access: instructorAccess, key: "portrait" },',
  );
  for (const path of [
    "src/kit/uploads.ts",
    "src/kit/PictureInput.tsx",
    "src/routes/files/$model.$field.ts",
    "src/routes/files/$model.$id.$field.ts",
  ])
    expect(
      files.some((f) => f.path === path),
      path,
    ).toBe(true);
  // A replaced or removed picture loses its file, unless another record shows the same one.
  const data = file("src/generated/instructor.server.ts");
  expect(data).toContain(
    "if (row.portrait && row.portrait.file !== changed.portrait?.file) deletePicture(row.portrait,",
  );
  expect(data).toContain(
    "if (row.portrait && row.portrait.file !== undefined) deletePicture(row.portrait,",
  );
  expect(file("src/db/seed.ts")).toContain(
    'portrait: samplePicture("instructor", 0, "A picture of',
  );
});

test("without a picture field none of it is generated", () => {
  const plain = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Studio }\nmodels:\n  Instructor:\n    fields: { name: string! }\npages:\n  instructors: { crud: Instructor }\n",
  }).ir as SpecIR;
  const app = generateApp(plain, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  expect(app.some((f) => f.path.startsWith("src/routes/files/"))).toBe(false);
  expect(app.some((f) => f.path === "src/kit/uploads.ts")).toBe(false);
  expect(app.find((f) => f.path === "src/generated/instructor.server.ts")?.content).not.toContain(
    "deletePicture",
  );
});

test("a picture cannot be unique or have a default, and /files is reserved", () => {
  const bad = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Studio }\nmodels:\n  Instructor:\n    fields: { name: string!, portrait: picture unique }\npages:\n  files: { crud: Instructor }\n",
  });
  expect(bad.diagnostics.map((d) => d.code)).toEqual(
    expect.arrayContaining(["invalid-field", "reserved-route"]),
  );
});

test("several pictures: a JSON list, at most ten, the strip in the form, the n-th served", () => {
  const several = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Market }
models:
  Item:
    fields:
      title: string!
      photos: pictures
pages:
  items: { crud: Item }
`,
  }).ir as SpecIR;
  const gen = generateApp(several, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const at = (path: string) => gen.find((f) => f.path === path)?.content ?? "";
  expect(at("src/db/schema.ts")).toContain('photos: text({ mode: "json" }).$type<Picture[]>()');
  expect(at("src/generated/item.ts")).toContain('input: bindPictures("item", "photos", 10)');
  expect(at("src/generated/item.schema.ts")).toContain(".max(10).nullish()");
  expect(at("src/generated/uploads.ts")).toContain('"photos": { kind: "picture", data: itemData');
  expect(gen.some((f) => f.path === "src/routes/files/$model.$id.$field.$n.ts")).toBe(true);
  // A removed picture's file goes unless a record still shows it.
  expect(at("src/generated/item.server.ts")).toContain("for (const p of row.photos ?? [])");
});

test("a list's filters and sort: conditions in the query, controls above the list, Mine for the owner", () => {
  const market = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Market }
models:
  Item:
    fields:
      title: string!
      condition: new | used
      price: money
      available: bool
pages:
  items:
    crud: Item
    search: [title]
    filters: [condition, price, available, owner]
    sortable: [price]
`,
  }).ir as SpecIR;
  const gen = generateApp(market, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const route = gen.find((f) => f.path === "src/routes/items/index.tsx")?.content ?? "";
  expect(route).toContain(
    'data.f?.price ? inRange(schema.items.price, data.f?.price, "number", 100) : undefined',
  );
  expect(route).toContain('eq(schema.items.available, data.f?.available === "true")');
  expect(route).toContain(
    'data.f?.owner === "mine" && viewer ? eq(schema.items.ownerId, viewer.id)',
  );
  expect(route).toContain("const order = orderOf({ price: schema.items.price }, data.sort);");
  expect(route).toContain("signedIn={Boolean(viewer)}");
  expect(gen.find((f) => f.path === "src/generated/item.server.ts")?.content).toContain(
    "order?: SQL",
  );
  expect(gen.some((f) => f.path === "src/kit/Filters.tsx")).toBe(true);
});

test("favorites: each person's marks in a table of their own, a heart and a Saved view, only one's saved records", () => {
  const spec = (favorites: string) =>
    validateSpec({
      path: "smithable.yml",
      text: `smithable: 0.1
app: { name: Market }
models:
  Item:
    fields: { title: string! }
pages:
  items: { crud: Item, favorites: ${favorites} }
`,
    }).ir as SpecIR;
  const gen = generateApp(spec("true"), {
    smithableVersion: "0.0.0",
    auth,
    content: emptyContent(),
  });
  const at = (path: string) => gen.find((f) => f.path === path)?.content ?? "";
  expect(at("src/db/schema.ts")).toContain(
    'export const itemsFavorites = sqliteTable(\n  "items_favorites"',
  );
  expect(at("src/db/schema.ts")).toContain("(t) => [unique().on(t.userId, t.recordId)]");
  // Marking checks that the viewer may read the record.
  expect(at("src/generated/item.server.ts")).toContain(
    "if (!viewer || !itemData.canRead(viewer, id)) throw new AccessDenied(viewer !== null);",
  );
  expect(at("src/generated/item.ts")).toContain("export const toggleSavedItem = createServerFn");
  const list = at("src/routes/items/index.tsx");
  expect(list).toContain('data.view === "saved" ? inArray(schema.items.id, saved) : undefined');
  expect(list).toContain("saved={{ ids: saved, onToggle: toggleSaved }}");
  expect(list).toContain("<SavedTabs");
  expect(at("src/routes/items/$id.tsx")).toContain("<SaveButton saved={saved}");
  const only = generateApp(spec("only"), {
    smithableVersion: "0.0.0",
    auth,
    content: emptyContent(),
  });
  const onlyList = only.find((f) => f.path === "src/routes/items/index.tsx")?.content ?? "";
  expect(onlyList).toContain("inArray(schema.items.id, saved),");
  expect(onlyList).not.toContain("<SavedTabs");
  // Only the page is read from the address (docs/design/paging.md).
  expect(onlyList).toContain(".handler(async ({ data }) => {");
  expect(onlyList).toContain("data.page");
  // Without sign-in there is no one to save for: no table, no hearts.
  const open = generateApp(spec("true"), {
    smithableVersion: "0.0.0",
    auth: { ...auth, signIn: "none" },
    content: emptyContent(),
  });
  expect(open.find((f) => f.path === "src/db/schema.ts")?.content).not.toContain("Favorites");
  expect(open.find((f) => f.path === "src/routes/items/index.tsx")?.content).not.toContain("saved");
});

test("contact the owner: a server function that mails the owner, keeping a copy in its model", () => {
  const market = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Market }
models:
  Item:
    fields: { title: string! }
  Message:
    fields: { name: string!, email: email!, message: text! }
pages:
  items:
    crud: Item
    contact: { to: owner, keep: Message }
`,
  }).ir as SpecIR;
  const gen = generateApp(market, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const page = gen.find((f) => f.path === "src/routes/items/$id.tsx")?.content ?? "";
  expect(page).toContain("writeAllowed(viewer, getRequestHeaders());");
  expect(page).toContain("const recipient = itemData.ownerOf(viewer, row.id);");
  expect(page).toContain(
    "await messageData.create(viewer, { name: sender.name, email: sender.email, message: sender.message });",
  );
  expect(page).toContain('<ContactOwner\n        recipient="owner"');
  expect(gen.some((f) => f.path === "src/kit/ContactOwner.tsx")).toBe(true);
  // Who owns an item is told only to its owner and roles that read every record.
  const item = gen.find((f) => f.path === "src/generated/item.server.ts")?.content ?? "";
  expect(item).toContain("function shownTo<R extends { ownerId: string | null }>");
  expect(item).toContain("const rows = found.map((row) => shownTo(viewer, row));");
  expect(item).toContain("const row = found && shownTo(viewer, found);");
});

test("the catalog as the start page: the site's frame at / and its records; a records section opens it", () => {
  const spec = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Torget }
models:
  Item:
    fields: { title: string!, category: furniture | other, price: money }
pages:
  catalog:
    route: /
    crud: Item
    search: [title]
    filters: [category, price]
  welcome:
    landing:
      hero: { button: catalog }
      latest: { records: Item, search: true, filters: [category, price], limit: 8 }
`,
  }).ir as SpecIR;
  const open = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\npublic: { read: [Item], pages: [catalog, welcome] }\n",
    },
    spec,
  ).auth as AuthIR;
  const gen = generateApp(spec, { smithableVersion: "0.0.0", auth: open, content: emptyContent() });
  const at = (path: string) => gen.find((f) => f.path === path)?.content ?? "";
  // Visitors see /, a record and the new form in the site's frame; not /sign-in or other pages.
  expect(at("src/routes/__root.tsx")).toContain(
    '(r === "/" ? /^\\/(new|\\d+)$/.test(pathname) : pathname.startsWith(`${r}/`))',
  );
  expect(gen.some((f) => f.path === "src/generated/site.ts")).toBe(true);
  // The section's box and chips lead to the list with the same address state; only what the
  // list reads (its search, its choice filters: no price range here).
  const landing = at("src/routes/welcome/index.tsx");
  expect(landing).toContain('to: "/",');
  expect(landing).toContain('search: { label: "Search items", placeholder: "Search by title" }');
  expect(landing).toContain('name: "category"');
  expect(landing).not.toContain('name: "price"');
  expect(landing).toContain("href: `/${row.id}`,");
  expect(landing).toContain(".slice(0, 8)");
});

test("mine: a page of only the viewer's own records, the owner condition always on, no Mine toggle", () => {
  const spec = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Torget }
models:
  Item:
    fields: { title: string! }
pages:
  myItems: { crud: Item, mine: true, filters: [owner] }
`,
  }).ir as SpecIR;
  const gen = generateApp(spec, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const list = gen.find((f) => f.path === "src/routes/my-items/index.tsx")?.content ?? "";
  expect(list).toContain('eq(schema.items.ownerId, viewer?.id ?? "")');
  expect(list).not.toContain('kind: "mine"');
  expect(list).not.toContain("<Filters");
  expect(list).toContain('w.newOne("item")');
});

test("a sample row without a field that has a default (added since) seeds the default, not null", () => {
  const spec = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Torget }
models:
  Item:
    fields: { title: string!, delivery: pickup | shipping, available: bool = true }
pages:
  items: { crud: Item }
`,
  }).ir as SpecIR;
  const gen = generateApp(spec, {
    smithableVersion: "0.0.0",
    auth,
    content: emptyContent(),
    samples: { Item: [{ title: "Lamp" }] },
  });
  expect(gen.find((f) => f.path === "src/db/seed.ts")?.content).toContain(
    '{ title: "Lamp", delivery: "pickup", available: true }',
  );
});

test("generated rows refer only to rows a sample file has (a starter's two clients, eight quotes)", () => {
  const spec = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Quotes }
models:
  Client:
    fields: { name: string! }
  Quote:
    fields: { title: string!, client: Client! }
pages:
  quotes: { crud: Quote }
`,
  }).ir as SpecIR;
  const gen = generateApp(spec, {
    smithableVersion: "0.0.0",
    auth,
    content: emptyContent(),
    samples: { Client: [{ name: "Skerry Software" }, { name: "Kallio Design" }] },
  });
  const ids = [
    ...(gen.find((f) => f.path === "src/db/seed.ts")?.content ?? "").matchAll(/clientId: (\d+)/g),
  ].map((m) => Number(m[1]));
  expect(ids.length).toBeGreaterThan(2);
  expect(Math.max(...ids)).toBe(2);
});

test("a seed with nothing to add imports nothing; a choice of a record with an optional title still has a name", () => {
  const spec = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Club }
models:
  Membership:
    fields: { member: User!, since: date }
  Match:
    fields: { date: datetime!, location: string }
  Result:
    fields: { match: Match!, score: string! }
pages:
  results: { crud: Result }
`,
  }).ir as SpecIR;
  const gen = generateApp(spec, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const at = (path: string) => gen.find((f) => f.path === path)?.content ?? "";
  // Match's name is its optional location: an empty one is "Match #3", never null.
  const options = at("src/generated/match.server.ts");
  expect(options).toContain("label: sql<string>`coalesce(");
  expect(options).toContain("matches.location}, 'Match #' || ");
  const onlyPeople = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Club }\nmodels:\n  Membership:\n    fields: { member: User!, since: date }\npages:\n  memberships: { crud: Membership }\n",
  }).ir as SpecIR;
  const seed =
    generateApp(onlyPeople, { smithableVersion: "0.0.0", auth, content: emptyContent() }).find(
      (f) => f.path === "src/db/seed.ts",
    )?.content ?? "";
  expect(seed).not.toContain('import { db } from "./index"');
});

test("a document field: a JSON column, the document input, the uploads map, the file removed with it", () => {
  const spec = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Office }\nmodels:\n  Invoice:\n    fields: { number: string!, contract: file, receipts: files }\npages:\n  invoices: { crud: Invoice }\n",
  }).ir as SpecIR;
  const gen = generateApp(spec, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const at = (path: string) => gen.find((f) => f.path === path)?.content ?? "";
  expect(at("src/db/schema.ts")).toContain('contract: text({ mode: "json" }).$type<StoredFile>()');
  expect(at("src/db/schema.ts")).toContain('import type { StoredFile } from "#/kit/uploads";');
  expect(at("src/generated/invoice.ts")).toContain('input: bindFile("invoice", "contract")');
  expect(at("src/generated/invoice.ts")).toContain('input: bindFiles("invoice", "receipts", 10)');
  expect(at("src/generated/uploads.ts")).toContain('"contract": { kind: "file", data: invoiceData');
  expect(at("src/generated/invoice.server.ts")).toContain("deleteFile(row.contract,");
  expect(gen.some((f) => f.path === "src/kit/FileInput.tsx")).toBe(true);
  // Not unique, no default: a document is sent, never compared.
  const bad = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Office }\nmodels:\n  Invoice:\n    fields: { number: string!, contract: file unique }\npages:\n  invoices: { crud: Invoice }\n",
  });
  expect(bad.diagnostics.map((d) => d.code)).toContain("invalid-field");
});

test("a required picture's sample rows are inserted only with their picture", () => {
  const tools = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Tools }\nmodels:\n  Tool:\n    fields: { name: string!, photo: picture! }\npages:\n  tools: { crud: Tool }\n",
  }).ir as SpecIR;
  const seed =
    generateApp(tools, { smithableVersion: "0.0.0", auth, content: emptyContent() }).find(
      (f) => f.path === "src/db/seed.ts",
    )?.content ?? "";
  // samplePicture is null where the app has no sample pictures: such a row is left out.
  expect(seed).toContain("const pictured = rows.filter((r) => r.photo !== null) as Row[];");
  expect(seed).toContain('(Omit<Row, "photo"> & { photo: Picture | null })[]');
  expect(seed).toContain('import { type Picture, samplePicture } from "#/kit/uploads";');
});
