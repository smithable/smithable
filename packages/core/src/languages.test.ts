import { expect, test } from "vitest";
import { applyOperation, translationPath } from "./apply.js";
import { type ContentIR, textsToTranslate, validateContent } from "./content.js";
import type { SpecIR } from "./ir.js";
import { validateSpec } from "./spec.js";

const raw = import.meta.glob("../../../examples/crm/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const file = (name: string) => raw[`../../../examples/crm/${name}`] as string;
const files = {
  spec: file("smithable.yml"),
  auth: file("smithable.auth.yml"),
  content: file("smithable.content.yml"),
};
const ir = validateSpec({ path: "smithable.yml", text: files.spec }).ir as SpecIR;

test("addLanguage lists the language and writes its file with every text to fill in", () => {
  const added = applyOperation(files, "addLanguage", { language: "sv" });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.content).toMatch(/^languages:(\n {2}- sv| \[sv\])$/m);
  // The derived texts too: what the app says from names, in Swedish once filled in.
  expect(added.files.translations?.sv).toMatch(/ {6}creditLimit:\n(?: {8}.*\n)* {8}label: ""/);
  const sv = added.files.translations?.sv ?? "";
  expect(sv).toContain("smithableContent: 0.1");
  expect(sv).not.toMatch(/^language:/m);
  // Every text there, empty: shown in the app's language until filled in.
  const content = validateContent(
    { path: "smithable.content.yml", text: added.files.content ?? "" },
    ir,
  ).content as ContentIR;
  const read = validateContent({ path: translationPath("sv"), text: sv }, ir, {
    of: content,
    language: "sv",
  });
  expect(read.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(read.diagnostics.map((d) => d.code)).toContain("text-untranslated");
  // The app's own language, or one it has, is refused.
  expect(applyOperation(files, "addLanguage", { language: "en" })).toMatchObject({ ok: false });
  expect(applyOperation(added.files, "addLanguage", { language: "sv" })).toMatchObject({
    ok: false,
  });
});

test("setText --language writes the language's file; a rename follows into it; removeLanguage takes it away", () => {
  const added = applyOperation(files, "addLanguage", { language: "sv" });
  if (!added.ok) throw new Error(added.message);
  const set = applyOperation(added.files, "setText", {
    path: ["models", "Customer", "fields", "creditLimit", "label"],
    text: "Kreditgräns",
    language: "sv",
  });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.translations?.sv).toContain("label: Kreditgräns");
  expect(set.files.content).not.toContain("Kreditgräns");
  const renamed = applyOperation(set.files, "renameField", {
    model: "Customer",
    from: "creditLimit",
    to: "limit",
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.translations?.sv).toMatch(/ {6}limit:\n(?: {8}.*\n)* {8}label: Kreditgräns/);
  expect(renamed.files.translations?.sv).not.toContain("creditLimit");
  // A language the app is not in.
  expect(
    applyOperation(files, "setText", {
      path: ["pages", "customers", "title"],
      text: "Kunder",
      language: "sv",
    }),
  ).toMatchObject({ ok: false, message: expect.stringContaining("addLanguage sv") });
  const removed = applyOperation(set.files, "removeLanguage", { language: "sv" });
  if (!removed.ok) throw new Error(removed.message);
  expect(removed.files.content).not.toContain("languages:");
  expect(removed.files.translations).toBeUndefined();
  expect(removed.removed).toEqual([translationPath("sv")]);
});

test("a language file says any text the app shows, never one of a name the spec does not have", () => {
  const content = validateContent({ path: "smithable.content.yml", text: files.content }, ir)
    .content as ContentIR;
  const read = (text: string) =>
    validateContent({ path: translationPath("sv"), text }, ir, { of: content, language: "sv" })
      .diagnostics;
  const errors = (text: string) =>
    read(text)
      .filter((d) => d.severity === "error")
      .map((d) => d.code);
  // A title derived from the page's name is a text to say too.
  expect(errors("smithableContent: 0.1\npages:\n  customers:\n    title: Kunder\n")).toEqual([]);
  expect(errors("smithableContent: 0.1\npages:\n  kunder:\n    title: Kunder\n")).not.toEqual([]);
  // The languages and the mark are the content file's.
  expect(errors("smithableContent: 0.1\nlanguage: sv\n")).toContain("unknown-key");
  expect(read("smithableContent: 0.1\n").map((d) => d.code)).toContain("text-untranslated");
});

const every = import.meta.glob("../../../examples/*/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const examples = [...new Set(Object.keys(every).map((p) => p.split("/").at(-2) as string))];

test.each(examples)(
  "%s: addLanguage writes a file of texts only that validates, every text to translate in it",
  (example) => {
    const at = (name: string) => every[`../../../examples/${example}/${name}`];
    const own = {
      spec: at("smithable.yml") as string,
      ...(at("smithable.auth.yml") ? { auth: at("smithable.auth.yml") } : {}),
      ...(at("smithable.content.yml") ? { content: at("smithable.content.yml") } : {}),
      ...(at("smithable.ux.yml") ? { ux: at("smithable.ux.yml") } : {}),
    };
    const ir = validateSpec({ path: "smithable.yml", text: own.spec }).ir as SpecIR;
    const language = /^language: sv$/m.test(own.content ?? "") ? "en" : "sv";
    const added = applyOperation(own, "addLanguage", { language });
    if (!added.ok) throw new Error(`${added.message} ${JSON.stringify(added.diagnostics)}`);
    const text = added.files.translations?.[language] ?? "";
    expect(text).not.toMatch(/^\s*(src|link|generated|email|phone): \S/m);
    const content = validateContent(
      { path: "smithable.content.yml", text: added.files.content ?? "" },
      ir,
    ).content as ContentIR;
    const read = validateContent({ path: translationPath(language), text }, ir, {
      of: content,
      language: language as "sv",
    });
    expect(read.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const count = Number(
      /^(\d+) texts? (?:is|are) not/.exec(
        read.diagnostics.find((d) => d.code === "text-untranslated")?.message ?? "",
      )?.[1],
    );
    expect(count).toBe(textsToTranslate(content, ir).size);
  },
);

test("a language listed without its file: addLanguage writes the file again", () => {
  const added = applyOperation(files, "addLanguage", { language: "sv" });
  if (!added.ok) throw new Error(added.message);
  const { translations: _gone, ...without } = added.files;
  const again = applyOperation(without, "addLanguage", { language: "sv" });
  if (!again.ok) throw new Error(again.message);
  expect(again.files.translations?.sv).toContain("smithableContent: 0.1");
  expect(again.files.content).toBe(added.files.content);
});

test("a choice value named like a non-text key is a text: contact: email | phone", () => {
  const spec = files.spec.replace(
    "      phone: phone\n",
    "      phone: phone\n      contact: email | phone\n",
  );
  const added = applyOperation({ ...files, spec }, "addLanguage", { language: "sv" });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.translations?.sv).toMatch(
    / {6}contact:\n(?: {8}.*\n)* {8}values:\n {10}email: ""\n {10}phone: ""/,
  );
  const ir2 = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
  const content = validateContent(
    { path: "smithable.content.yml", text: added.files.content ?? "" },
    ir2,
  ).content as ContentIR;
  const filled = (added.files.translations?.sv ?? "").replace(
    / {10}email: ""/,
    "          email: E-post",
  );
  const read = validateContent({ path: translationPath("sv"), text: filled }, ir2, {
    of: content,
    language: "sv",
  });
  expect(read.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
});
