import { type AuthIR, emptyContent, kebab, type SpecIR } from "@smithable/core";
import { hasSignIn } from "./auth.js";
import { defaultsName, formulasName, hasFormulas } from "./formulas.js";
import {
  actionNames,
  dataKey,
  indexPath,
  join,
  names,
  storedFields,
  tableNames,
  texts,
} from "./generate.js";

/** Where a concept's code lives in the generated app. */
export interface GeneratedEntry {
  files: { path: string; symbols: string[] }[];
  routes: string[];
  tables: string[];
  tests: { file: string; name: string }[];
}

/**
 * The generated part of the implementation index (ARCHITECTURE §7): for each concept of the
 * spec, the files and symbols, routes, tables and tests the adapter generates for it.
 */
export function implementationIndex(ir: SpecIR, auth: AuthIR): Record<string, GeneratedEntry> {
  const t = texts(emptyContent());
  const index: Record<string, GeneratedEntry> = {};
  const entry = (concept: string) => {
    index[concept] ??= { files: [], routes: [], tables: [], tests: [] };
    return index[concept];
  };
  const file = (concept: string, path: string, symbols: string[]) =>
    entry(concept).files.push({ path, symbols });

  file("app", "src/generated/app.ts", ["app"]);
  file("app", "src/routes/__root.tsx", ["Route"]);
  file("app", "src/generated/pages.ts", ["pageAccess"]);
  file("app", "src/theme.css", []);
  if (hasSignIn(auth)) {
    file("app", "src/lib/auth.ts", ["auth", "PROVIDERS", "configuredProviders"]);
    file("app", "src/routes/sign-in.tsx", ["Route"]);
    entry("app").routes.push("/sign-in");
  }

  for (const model of ir.models) {
    const concept = `model:${model.name}`;
    const n = names(model, t);
    const base = `src/generated/${kebab(model.name)}`;
    file(concept, `${base}.ts`, [
      n.ui,
      n.schema,
      n.values,
      n.list,
      n.get,
      n.create,
      n.update,
      n.remove,
    ]);
    file(concept, `${base}.server.ts`, [n.access, n.data]);
    file(concept, "src/db/schema.ts", [n.tableKey]);
    entry(concept).tables.push(tableNames(model).sqlTable);
    entry(concept).tests.push({ file: "src/generated/access.test.ts", name: model.name });
    const stored = storedFields(model);
    for (const field of model.fields) {
      const fieldConcept = `field:${model.name}.${field.name}`;
      if (stored.includes(field)) {
        file(fieldConcept, "src/db/schema.ts", [`${n.tableKey}.${dataKey(field)}`]);
        entry(fieldConcept).tables.push(`${tableNames(model).sqlTable}.${dataKey(field)}`);
      }
      if (field.formula || field.defaultFormula) {
        const holder = field.formula ? formulasName(model) : defaultsName(model);
        file(fieldConcept, `${base}.formulas.ts`, [`${holder}.${field.name}`]);
      }
      if (field.examples?.length) {
        entry(fieldConcept).tests.push({
          file: `${base}.formulas.test.ts`,
          name: `${model.name}.${field.name}`,
        });
      }
    }
    if (hasFormulas(model)) entry(concept).files.push({ path: `${base}.formulas.ts`, symbols: [] });
  }

  for (const action of ir.actions.filter((a) => a.custom)) {
    const a = actionNames(action);
    const concept = `action:${action.name}`;
    file(concept, `src/generated/actions/${kebab(action.name)}.ts`, [
      a.input,
      a.inputType,
      a.outputType,
      a.ui,
      a.access,
      action.name,
    ]);
  }

  for (const page of ir.pages) {
    const concept = `page:${page.id}`;
    const dir = page.route === "/" ? "src/routes" : `src/routes${page.route}`;
    for (const name of ["index.tsx", "new.tsx", "$id.tsx"])
      file(concept, `${dir}/${name}`, ["Route"]);
    entry(concept).routes.push(
      indexPath(page.route),
      join(page.route, "new"),
      join(page.route, "$id"),
    );
    for (const name of page.actions ?? []) {
      if (!ir.actions.find((a) => a.name === name)?.custom) continue;
      const path = `${dir}/actions/${kebab(name)}.tsx`;
      const route = join(page.route, `actions/${kebab(name)}`);
      file(concept, path, ["Route"]);
      file(`action:${name}`, path, ["Route"]);
      entry(concept).routes.push(route);
      entry(`action:${name}`).routes.push(route);
    }
  }
  return index;
}
