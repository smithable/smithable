import { expect, test } from "vitest";
import { applyOperation, type ProjectFiles } from "./apply.js";
import { validateAuth } from "./auth.js";
import { validateContent } from "./content.js";
import { hasErrors } from "./diagnostics.js";
import { validateSpec } from "./spec.js";
import { validateUx } from "./ux.js";

const all = import.meta.glob("../../../examples/*/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const byName = (file: string) =>
  Object.fromEntries(Object.entries(all).filter(([p]) => p.endsWith(`/${file}`)));
const specs = byName("smithable.yml");
const auths = byName("smithable.auth.yml");
const uxs = byName("smithable.ux.yml");
const contents = byName("smithable.content.yml");
const translations = Object.fromEntries(
  Object.entries(all).filter(([p]) => /\/smithable\.content\.[a-z-]+\.yml$/.test(p)),
);

const examples = Object.keys(specs).map((path) => {
  const dir = path.slice(0, -"/smithable.yml".length);
  const name = dir.split("/").at(-1) ?? dir;
  const own = Object.fromEntries(
    Object.entries(translations)
      .filter(([p]) => p.startsWith(`${dir}/`))
      .map(([p, text]) => [
        p.slice(dir.length + "/smithable.content.".length, -".yml".length),
        text,
      ]),
  );
  const files: ProjectFiles = {
    spec: specs[path] as string,
    ...(auths[`${dir}/smithable.auth.yml`] ? { auth: auths[`${dir}/smithable.auth.yml`] } : {}),
    ...(uxs[`${dir}/smithable.ux.yml`] ? { ux: uxs[`${dir}/smithable.ux.yml`] } : {}),
    ...(contents[`${dir}/smithable.content.yml`]
      ? { content: contents[`${dir}/smithable.content.yml`] }
      : {}),
    ...(Object.keys(own).length ? { translations: own } : {}),
  };
  return { name, files };
});

/** The files as a project is: no error in any of them. */
function problems(files: ProjectFiles): string[] {
  const roles = files.auth
    ? validateAuth({ path: "smithable.auth.yml", text: files.auth }).auth?.roles.map((r) => r.name)
    : undefined;
  const spec = validateSpec({ path: "smithable.yml", text: files.spec }, roles ? { roles } : {});
  const all = [...spec.diagnostics];
  if (spec.ir) {
    if (files.auth)
      all.push(
        ...validateAuth({ path: "smithable.auth.yml", text: files.auth }, spec.ir).diagnostics,
      );
    if (files.ux)
      all.push(...validateUx({ path: "smithable.ux.yml", text: files.ux }, spec.ir).diagnostics);
    if (files.content)
      all.push(
        ...validateContent({ path: "smithable.content.yml", text: files.content }, spec.ir)
          .diagnostics,
      );
  }
  return all.filter((d) => d.severity === "error").map((d) => `${d.file}:${d.line} ${d.message}`);
}

const applied = (files: ProjectFiles, op: string, args: Record<string, string>) => {
  const result = applyOperation(files, op, args);
  if (!result.ok)
    throw new Error(
      `${op} ${JSON.stringify(args)}: ${result.message}\n${result.diagnostics.map((d) => `${d.file}:${d.line} ${d.message}`).join("\n")}`,
    );
  return {
    ...files,
    spec: result.files.spec,
    ...(result.files.auth !== undefined ? { auth: result.files.auth } : {}),
    ...(result.files.ux !== undefined ? { ux: result.files.ux } : {}),
    ...(result.files.content !== undefined ? { content: result.files.content } : {}),
    ...(result.files.translations ? { translations: result.files.translations } : {}),
  };
};

test("every model of every example renames and back, every file valid in between and identical after", () => {
  // Thirty seconds: every example, every model, two renames each; under a gate's load the five-second
  // default timed out twice on 2026-10-17 with the test itself fine.
  for (const { name, files } of examples) {
    const ir = validateSpec({ path: "smithable.yml", text: files.spec }).ir;
    if (!ir) throw new Error(`${name}: the example does not validate`);
    for (const model of ir.models) {
      const to = `${model.name}Renamed`;
      const renamed = applied(files, "renameModel", { from: model.name, to });
      expect(problems(renamed), `${name}: ${model.name} → ${to}`).toEqual([]);
      const back = applied(renamed, "renameModel", { from: to, to: model.name });
      expect(back, `${name}: ${model.name} round trip`).toEqual(files);
    }
  }
}, 30_000);

test("every page of every example renames and back, every file valid in between and identical after", () => {
  for (const { name, files } of examples) {
    const ir = validateSpec({ path: "smithable.yml", text: files.spec }).ir;
    if (!ir) throw new Error(`${name}: the example does not validate`);
    for (const page of ir.pages) {
      const to = `${page.id}-renamed`;
      const renamed = applied(files, "renamePage", { from: page.id, to });
      expect(problems(renamed), `${name}: ${page.id} → ${to}`).toEqual([]);
      const back = applied(renamed, "renamePage", { from: to, to: page.id });
      expect(back, `${name}: ${page.id} round trip`).toEqual(files);
    }
  }
}, 30_000);

test("a renamed model is followed into relations, pages, grants, texts and tones; the effect names it", () => {
  const crm = examples.find((e) => e.name === "crm");
  if (!crm) throw new Error("no crm example");
  const result = applyOperation(crm.files, "renameModel", { from: "Customer", to: "Client" });
  if (!result.ok) throw new Error(result.message);
  expect(result.effects).toEqual([{ kind: "rename-model", from: "Customer", to: "Client" }]);
  expect(result.description).toBe("Rename Customer to Client");
  expect(result.files.spec).toMatch(/^ {2}Client:$/m);
  expect(result.files.spec).toMatch(/: Client!?$/m);
  expect(result.files.spec).toMatch(/crud: Client$/m);
  expect(result.files.spec).not.toMatch(/\bCustomer\b/);
  expect(result.files.content).toMatch(/^ {2}Client:$/m);
  expect(result.files.content).not.toMatch(/^ {2}Customer:$/m);
  // The auth file names models in its grants and its public block.
  const market = examples.find((e) => e.name === "marketplace");
  if (!market) throw new Error("no marketplace example");
  const items = applyOperation(market.files, "renameModel", { from: "Item", to: "Thing" });
  if (!items.ok) throw new Error(items.message);
  expect(items.files.auth).toMatch(/read: \[Thing\]/);
  expect(items.files.auth).not.toMatch(/\bItem\b/);
});

test("a renamed page keeps its own route and says when its address changes", () => {
  const crm = examples.find((e) => e.name === "crm");
  if (!crm) throw new Error("no crm example");
  const ir = validateSpec({ path: "smithable.yml", text: crm.files.spec }).ir;
  const page = ir?.pages.find((p) => !crm.files.spec.includes(`route: /${p.id}`)) ?? ir?.pages[0];
  if (!page) throw new Error("no page");
  const result = applyOperation(crm.files, "renamePage", { from: page.id, to: "renamed-page" });
  if (!result.ok) throw new Error(result.message);
  expect(result.effects).toEqual([{ kind: "rename-page", from: page.id, to: "renamed-page" }]);
  expect(result.description).toContain("its address is now /renamed-page");
});

test("a rename is refused for a name taken, a name malformed or a page or model that is not there", () => {
  const crm = examples.find((e) => e.name === "crm");
  if (!crm) throw new Error("no crm example");
  const refused = (op: string, args: Record<string, string>) => {
    const result = applyOperation(crm.files, op, args);
    return result.ok ? "" : result.message;
  };
  expect(refused("renameModel", { from: "Customer", to: "Order" })).toMatch(/already/);
  expect(refused("renameModel", { from: "Customer", to: "client" })).toMatch(/like/);
  expect(refused("renameModel", { from: "Nothing", to: "Client" })).toMatch(/no model|There is no/);
  expect(refused("renamePage", { from: "customers", to: "orders" })).toMatch(/already/);
  expect(refused("renamePage", { from: "nothing", to: "x" })).toMatch(/no page/);
});
