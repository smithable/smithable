// The host's part of importRecords (ARCHITECTURE §4): the operation names a source; this reads
// it with core's readRecords, looks references up in the development database and adds every
// record in one transaction, or none. The model's hooks do not run (an import is not thousands
// of creates) and no access rule is checked per record: importing is a project-time step.
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  fieldColumn,
  insertRecord,
  recordTable,
  type StoredValue,
} from "@smithable/adapter-tanstack";
import {
  type AuthIR,
  type ContentIR,
  type Effect,
  humanize,
  type ImportRefusal,
  type ModelIR,
  plural,
  readRecords,
  type SpecIR,
  titleField,
} from "@smithable/core";
import { readBeta } from "./beta.js";
import { BUSY_MS, databasePath } from "./database.js";

type ImportEffect = Extract<Effect, { kind: "import-records" }>;

/** The records an import adds, ready to insert; or every reason it cannot. */
export interface PreparedImport {
  model: ModelIR;
  text: string;
  rows: Record<string, StoredValue>[];
  shown: string;
  refusals: ImportRefusal[];
}

/** Reads the source and looks the references up; nothing is written. */
export function prepareImport(
  dir: string,
  effect: ImportEffect,
  ir: SpecIR,
  content?: ContentIR,
): PreparedImport {
  const model = ir.models.find((m) => m.name === effect.model) as ModelIR;
  // A hosted project that may hold only fictional data takes no records from a file (legal-1.0
  // item 1.11): a file is how real customers and bookings come in.
  if (readBeta(dir)?.data === "test")
    return {
      model,
      text: "",
      rows: [],
      shown: "",
      refusals: [
        {
          line: 0,
          message:
            "Test hosting only: this project may hold fictional data alone, so records from a file are refused until real data is switched on.",
        },
      ],
    };
  const refusals: ImportRefusal[] = [];
  let text = "";
  if ("text" in effect.source) text = effect.source.text;
  if ("path" in effect.source) {
    const root = realpathSync(dir);
    const path = resolve(dir, effect.source.path);
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (
      effect.source.path.includes("..") ||
      !path.startsWith(`${resolve(dir)}${sep}`) ||
      stat?.isSymbolicLink() ||
      (stat && (!stat.isFile() || !realpathSync(path).startsWith(`${root}${sep}`)))
    ) {
      refusals.push({ line: 0, message: "The import file must be inside the project." });
    } else if (!stat) {
      refusals.push({ line: 0, message: `There is no file ${effect.source.path}.` });
    } else text = readFileSync(path, "utf8");
  }
  const read = readRecords(text, model, content, effect.map);
  refusals.push(...read.refusals);
  if (!existsSync(databasePath(dir)))
    refusals.push({
      line: 0,
      message: "The app has no database yet: run it once (smithable run), then import.",
    });
  const db = existsSync(databasePath(dir))
    ? new DatabaseSync(databasePath(dir), { readOnly: true, timeout: BUSY_MS })
    : undefined;
  const rows: Record<string, StoredValue>[] = [];
  try {
    read.rows.forEach((row, i) => {
      const out: Record<string, StoredValue> = {};
      for (const [name, value] of Object.entries(row)) {
        if (value === null || typeof value !== "object") {
          out[name] = value;
          continue;
        }
        // A reference: the record of the referenced model with this title, exactly one.
        const field = model.fields.find((f) => f.name === name);
        const target = ir.models.find(
          (m) => field?.type.kind === "relation" && m.name === field.type.model,
        );
        if (!target || !db) continue;
        const titled = target.fields.find((f) => f.name === titleField(target));
        const column = titled ? fieldColumn(titled) : "id";
        const found = db
          .prepare(`SELECT id FROM "${recordTable(target)}" WHERE "${column}" = ? LIMIT 3`)
          .all(value.title) as { id: number }[];
        const at = read.columns.find((c) => c.field === name)?.column;
        if (found.length === 1) out[name] = Number(found[0]?.id);
        else
          refusals.push({
            line: i + 2,
            column: at,
            message:
              found.length === 0
                ? `There is no ${humanize(target.name).toLowerCase()} called "${value.title}".`
                : `More than one ${humanize(target.name).toLowerCase()} is called "${value.title}" (numbers ${found.map((r) => r.id).join(", ")}); make the names unique first.`,
          });
      }
      rows.push(out);
    });
  } finally {
    db?.close();
  }
  const label = humanize(plural(model.name)).toLowerCase();
  const shown = [
    `${rows.length} ${label} from columns ${read.columns.map((c) => `${c.column} → ${c.field}`).join(", ") || "(none)"}.`,
    ...(read.ignored.length ? [`Left out (no field): ${read.ignored.join(", ")}.`] : []),
    ...rows.slice(0, 5).map((row, i) => `  ${i + 2}: ${JSON.stringify(row)}`),
  ].join("\n");
  return { model, text, rows, shown, refusals: refusals.sort((a, b) => a.line - b.line) };
}

/** Every refusal as a line: "line 4, Total: "lots" is not an amount, like 12.50." */
export function refusalText(refusals: ImportRefusal[]): string {
  return refusals
    .map(
      (r) =>
        `${r.line ? `line ${r.line}` : "the file"}${r.column ? `, ${r.column}` : ""}: ${r.message}`,
    )
    .join("\n");
}

/**
 * Adds the prepared records in one transaction, owned by `owner`; on the first that the
 * database refuses (a unique value taken), none, with that record's line.
 */
export function insertImport(
  dir: string,
  prepared: PreparedImport,
  ir: SpecIR,
  auth: AuthIR,
  owner: string | null,
): void {
  const db = new DatabaseSync(databasePath(dir), { timeout: BUSY_MS });
  const now = Date.now();
  db.exec("BEGIN");
  try {
    prepared.rows.forEach((row, i) => {
      const { sql, params } = insertRecord(prepared.model, auth, row, owner, now, ir.app.timezone);
      try {
        db.prepare(sql).run(...params);
      } catch (error) {
        const why = error instanceof Error ? error.message : String(error);
        throw new Error(
          `line ${i + 2} cannot be added: ${/UNIQUE/i.test(why) ? "a value that must be unique is already taken" : why}`,
        );
      }
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}

/**
 * Whom imported records belong to: the user given (by id or email: hosted, the service names who
 * is importing), else the first admin who has signed in, else no one.
 */
export function importOwner(
  dir: string,
  auth: AuthIR,
  wanted = process.env.SMITHABLE_IMPORT_OWNER,
): { id: string; email: string } | null {
  if (!existsSync(databasePath(dir))) return null;
  const db = new DatabaseSync(databasePath(dir), { readOnly: true, timeout: BUSY_MS });
  const find = (sql: string, value: string) =>
    db.prepare(sql).get(value) as { id: string; email: string } | undefined;
  try {
    if (wanted)
      return (
        find(`SELECT id, email FROM "user" WHERE id = ?`, wanted) ??
        find(`SELECT id, email FROM "user" WHERE lower(email) = lower(?)`, wanted) ??
        null
      );
    for (const email of auth.admins) {
      const row = find(`SELECT id, email FROM "user" WHERE lower(email) = lower(?)`, email);
      if (row) return row;
    }
    return null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

const SAFE_IMPORT_ID = /^[a-z0-9_-]+$/i;
const importPath = (id: string) => {
  if (!SAFE_IMPORT_ID.test(id)) throw new Error(`Invalid import id: ${id}`);
  return join("data", ".smithable", "imports", `${id}.csv`);
};

/** Keeps the raw CSV under data/.smithable/imports/ so redo can run it again; returns the path. */
export function keepImport(dir: string, id: string, text: string): string {
  const path = importPath(id);
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
  return path;
}

/** Forgets the kept file of an import that was rolled back. */
export function dropImport(dir: string, id: string): void {
  if (!SAFE_IMPORT_ID.test(id)) return;
  rmSync(join(dir, importPath(id)), { force: true });
}
