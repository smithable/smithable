// A related record's title only for who may read that record: what the generator makes for an
// app where a readable record points to one the viewer may not read (no example has that shape).
import { validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const spec = `smithable: 0.1
app: { name: Related Titles }
models:
  Folder:
    fields: { title: string!, status: draft | published, notes: "Note[]" }
  Note:
    fields: { title: string!, folder: Folder, project: Project }
  Project:
    fields: { name: string! }
pages:
  folders: { crud: Folder }
  notes: { crud: Note }
  projects: { crud: Project }
`;
const authText = `smithableAuth: 0.1
signIn: { providers: [google] }
defaultAccess: private
defaultRole: member
roles:
  admin: all
  member: { pages: all, create: all, read: [Note] }
public: { pages: [folders, notes], read: [Note, { Folder: { where: { status: published } } }] }
assistant:
  for: signed-in
`;

const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
if (!ir) throw new Error("the spec is invalid");
const auth = validateAuth({ path: "smithable.auth.yml", text: authText }, ir).auth;
if (!auth) throw new Error("the auth file is invalid");
const files = generateApp(ir, { smithableVersion: "0.0.0", auth });
const file = (path: string) => files.find((f) => f.path === path)?.content ?? "";

test("each reference is checked against its target's read rule, in lists, a record and group titles", () => {
  const notes = file("src/generated/note.server.ts");
  expect(notes).toContain('hideRefs(rows, "folder", (ids, c = folderData.readable(viewer))');
  expect(notes).toContain('"project", (ids, c = projectData.readable(viewer))');
  expect(notes).toMatch(/= noteData\.shownRefs\(viewer, await db\.query\.notes\.findMany/);
  expect(notes).toContain("fetched && noteData.shownRefs(viewer, [fetched])[0]");
  expect(notes).toContain("and(inArray(schema.folders.id, ids), folderData.readable(viewer))");
  // A record's list: the listed records' references are checked too.
  expect(file("src/generated/folder.server.ts")).toContain(
    "folderData.shownRefs(viewer, [{ ...fetched, notes: noteData.shownRefs(viewer, fetched.notes) }])[0]",
  );
});

test("the generated access tests check it: another's record, and one that stops being public", () => {
  const tests = file("src/generated/access.test.ts");
  expect(tests).toContain('test("member reading a note is not shown the folder it may not read"');
  expect(tests).toContain('test("member reading a note is not shown the project it may not read"');
  expect(tests).toContain(
    'test("a folder that stops being public disappears from the note a visitor reads"',
  );
});
