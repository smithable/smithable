import { type ProjectFiles, validateAuth, validateSpec } from "@smithable/core";
import { describe, expect, test } from "vitest";
import { readDescription } from "./read-description.js";
import { readEdit, STARTER_TEXTS } from "./starter-descriptions.js";

const all = import.meta.glob("../../../examples/*/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const filesOf = (starter: string): ProjectFiles => {
  const file = (name: string) =>
    Object.entries(all).find(([path]) => path.endsWith(`/examples/${starter}/${name}`))?.[1];
  return {
    spec: file("smithable.yml") ?? "",
    auth: file("smithable.auth.yml"),
    content: file("smithable.content.yml"),
    ux: file("smithable.ux.yml"),
  };
};
const starters = [...new Set(Object.keys(all).map((path) => path.split("/").at(-2) as string))];
const text = (starter: string) => STARTER_TEXTS[starter]?.text ?? "";

describe("each starter's description", () => {
  test("every starter has one", () => {
    expect(Object.keys(STARTER_TEXTS).sort()).toEqual([...starters].sort());
  });

  test.each(starters)(
    "%s: the reader reads all of it, asks nothing, and reads the starter it is",
    (starter) => {
      const reading = readDescription(text(starter));
      expect(reading.kind).toBe(starter);
      expect(reading.questions).toEqual([]);
      // Words left over are only what the app is about, never a wish.
      expect(reading.leftover.every((w) => ["yoga", "neighborhood"].includes(w))).toBe(true);
      // What it says visitors see is what the starter opens.
      const files = filesOf(starter);
      const ir = validateSpec({ path: "smithable.yml", text: files.spec }).ir;
      const auth =
        ir && validateAuth({ path: "smithable.auth.yml", text: files.auth ?? "" }, ir).auth;
      expect(reading.visitors).toBe(auth?.public.pages.length ? "read" : "nothing");
      // And every page it names for a thing is a page of the starter.
      for (const page of Object.values(STARTER_TEXTS[starter]?.pages ?? {}))
        expect(ir?.pages.map((p) => p.id)).toContain(page);
    },
  );
});

describe("an edited description", () => {
  test("unchanged, whatever its capitals and commas, is the starter", () => {
    expect(readEdit("crm", text("crm"), filesOf("crm"))).toEqual({ kind: "same" });
    expect(readEdit("crm", text("crm").toUpperCase().replaceAll(",", " "), filesOf("crm"))).toEqual(
      {
        kind: "same",
      },
    );
  });

  test("a thing added becomes a kind of record with a page, and the app is still valid", () => {
    const edit = readEdit(
      "crm",
      text("crm").replace("and their orders", "their orders and suppliers"),
      filesOf("crm"),
    );
    if (edit.kind !== "edit") throw new Error(JSON.stringify(edit));
    expect(edit.steps.map((s) => s.op)).toEqual(["addModel", "addPage"]);
    expect(edit.notes).toEqual(["Added suppliers with a name and notes: say what else they hold."]);
    const read = validateSpec({ path: "smithable.yml", text: edit.files.spec });
    expect(read.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(read.ir?.models.map((m) => m.name)).toContain("Supplier");
    expect(read.ir?.pages.map((p) => p.id)).toContain("suppliers");
  });

  test("a thing taken out takes its page; closing to visitors closes everything", () => {
    const noBlog = readEdit(
      "booking",
      text("booking").replace("a blog and a contact form", "a contact form"),
      filesOf("booking"),
    );
    if (noBlog.kind !== "edit") throw new Error(JSON.stringify(noBlog));
    expect(noBlog.steps).toEqual([{ op: "removePage", args: { page: "blog" } }]);
    const closed = readEdit(
      "marketplace",
      text("marketplace").replace("a public catalog", "a catalog").concat(" Nothing is public."),
      filesOf("marketplace"),
    );
    if (closed.kind !== "edit") throw new Error(JSON.stringify(closed));
    expect(closed.steps).toEqual([{ op: "setPublic", args: { pages: [], read: [], create: [] } }]);
    expect(closed.files.auth).not.toMatch(/read: \[Item\]/);
  });

  test("what the reader cannot do safely is a new description, and it says why", () => {
    const why = (starter: string, edited: string) => {
      const edit = readEdit(starter, edited, filesOf(starter));
      return edit.kind === "rewrite" ? edit.why : edit.kind;
    };
    // About something else: the starter's texts, samples and pictures would not fit.
    expect(why("booking", text("booking").replace("yoga", "pilates"))).toContain("pilates");
    // A wish the reader does not know.
    expect(why("booking", `${text("booking")} With SMS reminders.`)).toMatch(/sms|reminder/);
    // Another kind of app altogether.
    expect(why("crm", "A status page for our services, with incidents.")).toBe(
      "It is another kind of app.",
    );
    // Opening what was closed is a choice.
    expect(why("crm", text("crm").replace("with nothing public", "on a public site"))).toBe(
      "It opens something to visitors.",
    );
    // Another language.
    expect(why("crm", "Ett CRM för vårt säljteam med kunder och ordrar.")).toBe(
      "It is not written in English.",
    );
  });
});
