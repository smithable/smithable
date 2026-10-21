// Point-in-time recovery for a self-hosted app (docs/design/pitr.md §3.7): `backup --continuous`
// runs Litestream next to the app's database (detected, not bundled, like the security tools),
// and `restore --at` restores a second of its stream into a scratch file, shows what is new,
// changed and removed since, and on request brings back or undoes, in place. The same
// statements as the hosted service (core's dataDiffSql and restoreOrder).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { dataKey, tableNames, titleField } from "@smithable/adapter-tanstack";
import { dataDiffSql, type ModelIR, restoreOrder, snake } from "@smithable/core";
import { BUSY_MS } from "./database.js";
import type { Io } from "./io.js";
import { loadSpec } from "./validate.js";

/** How long the stream keeps every second (the hosted service's window). */
const WINDOW = "720h";

const hasLitestream = () => spawnSync("sh", ["-c", "command -v litestream"]).status === 0;

/** Litestream's replica for a folder or an s3:// address (credentials in AWS_* variables). */
const replicaUrl = (to: string) => (to.startsWith("s3://") ? to : `file://${resolve(to)}`);

const databaseOf = (dir: string, data?: string) =>
  join(resolve(data ?? join(dir, "data")), "db", "app.db");

/** `smithable backup --continuous --to <folder|s3://…> [--data <dir>]`: runs until stopped. */
export function backupContinuous(
  dir: string,
  io: Io,
  options: { to: string; data?: string },
): Promise<number> {
  if (!hasLitestream()) {
    io.err(
      "backup --continuous runs Litestream: install it (https://litestream.io/install) and run this again.\n",
    );
    return Promise.resolve(1);
  }
  const db = databaseOf(dir, options.data);
  if (!existsSync(db)) {
    io.err(`There is no database at ${db}: give the app's data folder with --data.\n`);
    return Promise.resolve(1);
  }
  const config = join(mkdtempSync(join(tmpdir(), "smithable-litestream-")), "litestream.yml");
  writeFileSync(
    config,
    `l0-retention: ${WINDOW}\nsnapshot:\n  interval: 24h\n  retention: ${WINDOW}\ndbs:\n  - path: ${JSON.stringify(db)}\n    replica:\n      url: ${JSON.stringify(replicaUrl(options.to))}\n`,
  );
  io.out(
    `Streaming ${db} to ${options.to}: every second of the last 30 days can be restored with restore --at.\n`,
  );
  return new Promise((done) => {
    const child = spawn("litestream", ["replicate", "-config", config], { stdio: "inherit" });
    child.on("exit", (code) => done(code ?? 0));
  });
}

interface Table {
  model: ModelIR;
  table: string;
  title: string;
}

/**
 * `smithable restore --at <time> --from <folder|s3://…> [--data <dir>] [--bring-back M,…]
 * [--undo-changes M,…] [--yes]`: what is new, changed and removed since that second; with
 * --bring-back or --undo-changes and --yes, those records are written into the database, which
 * the app must not be using (stop it first).
 */
export function restoreAt(
  dir: string,
  io: Io,
  options: {
    at: string;
    from: string;
    data?: string;
    bringBack?: string[];
    undoChanges?: string[];
    yes?: boolean;
  },
): number {
  if (!hasLitestream()) {
    io.err(
      "restore --at needs Litestream: install it (https://litestream.io/install) and run this again.\n",
    );
    return 1;
  }
  const at = new Date(/Z$|[+-]\d\d:\d\d$/.test(options.at) ? options.at : `${options.at}Z`);
  if (Number.isNaN(at.getTime())) {
    io.err(`"${options.at}" is not a time like 2026-10-01T09:30:00Z.\n`);
    return 2;
  }
  const { ir } = loadSpec(dir, io);
  if (!ir) return 1;
  const db = databaseOf(dir, options.data);
  if (!existsSync(db)) {
    io.err(`There is no database at ${db}: give the app's data folder with --data.\n`);
    return 1;
  }
  const spec = ir;
  // The restored copy lives in a folder of its own, gone when this returns.
  const then = join(mkdtempSync(join(tmpdir(), "smithable-restore-")), "then.db");
  try {
    return compare(then);
  } finally {
    rmSync(dirname(then), { recursive: true, force: true });
  }

  function compare(then: string): number {
    const restored = spawnSync(
      "litestream",
      [
        "restore",
        "-o",
        then,
        "-timestamp",
        at.toISOString().replace(/\.\d+Z$/, "Z"),
        replicaUrl(options.from),
      ],
      { encoding: "utf8" },
    );
    if (restored.status !== 0) {
      io.err(
        `The stream could not be restored to ${at.toISOString()}: ${restored.stderr.trim()}\n`,
      );
      return 1;
    }
    const writing = Boolean(options.bringBack?.length || options.undoChanges?.length);
    const live = new DatabaseSync(db, { readOnly: !writing || !options.yes, timeout: BUSY_MS });
    live.exec(`ATTACH DATABASE '${then.replace(/'/g, "''")}' AS past`);
    const has = (schema: string, name: string) =>
      Boolean(
        live
          .prepare(`SELECT 1 FROM ${schema}.sqlite_master WHERE type = 'table' AND name = ?`)
          .get(name),
      );
    const tables: Table[] = restoreOrder(spec).flatMap((model) => {
      const table = tableNames(model).sqlTable;
      const field = model.fields.find((f) => f.name === titleField(model));
      return has("main", table) && has("past", table)
        ? [{ model, table, title: field ? snake(dataKey(field)) : "id" }]
        : [];
    });
    io.out(`Since ${at.toISOString().slice(0, 19).replace("T", " ")} UTC:\n`);
    for (const t of tables) {
      const sql = dataDiffSql({ table: t.table, title: t.title });
      const n = (s: string) => (live.prepare(s).get() as { n: number }).n;
      const [added, changed, removed] = [n(sql.added), n(sql.changed), n(sql.removed)];
      if (!added && !changed && !removed) continue;
      const names = live
        .prepare(sql.removedNames(10))
        .all()
        .map((r) => String((r as { name: unknown }).name));
      io.out(
        `  ${t.model.name}: ${added} new, ${changed} changed, ${removed} removed${names.length ? ` (${names.join(", ")}${removed > names.length ? ", …" : ""})` : ""}\n`,
      );
    }
    if (!writing) return 0;
    if (!options.yes) {
      io.out("Stop the app, then run this again with --yes to write those records back.\n");
      return 0;
    }
    return writeBack(live, tables, db, options.bringBack ?? [], options.undoChanges ?? [], io);
  }
}

/** Brings back and undoes in place, in one transaction, refusing a record whose reference stays gone. */
function writeBack(
  db: DatabaseSync,
  tables: Table[],
  file: string,
  bringBack: string[],
  undo: string[],
  io: Io,
): number {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const before = `${file}.before-${new Date().toISOString().replace(/[-:.]/g, "").slice(0, 18)}`;
  db.exec(`VACUUM INTO '${before.replace(/'/g, "''")}'`);
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("BEGIN");
  const touched = new Map<string, number[]>();
  for (const t of tables) {
    const sql = dataDiffSql({ table: t.table, title: t.title });
    const columns = (schema: string) =>
      db
        .prepare(`PRAGMA ${schema}.table_info(${q(t.table)})`)
        .all()
        .map((c) => (c as { name: string }).name);
    const then = columns("past");
    const common = columns("main")
      .filter((c) => then.includes(c))
      .map(q)
      .join(", ");
    const ids = (s: string) =>
      db
        .prepare(s)
        .all()
        .map((r) => (r as { id: number }).id);
    const T = q(t.table);
    if (bringBack.includes(t.model.name)) {
      touched.set(t.table, [...(touched.get(t.table) ?? []), ...ids(sql.removedIds)]);
      db.exec(
        `INSERT INTO main.${T} (${common}) SELECT ${common} FROM past.${T} o WHERE NOT EXISTS (SELECT 1 FROM main.${T} b WHERE b.id = o.id)`,
      );
    }
    if (undo.includes(t.model.name))
      for (const id of ids(sql.changedIds)) {
        const row = db.prepare(`SELECT ${common} FROM past.${T} WHERE id = ?`).get(id) as Record<
          string,
          string | number | null
        >;
        const cols = Object.keys(row);
        db.prepare(
          `UPDATE main.${T} SET ${cols.map((c) => `${q(c)} = ?`).join(", ")} WHERE id = ?`,
        ).run(...cols.map((c) => row[c] ?? null), id);
        touched.set(t.table, [...(touched.get(t.table) ?? []), id]);
      }
  }
  const byTable = new Map(tables.map((t) => [t.table, t]));
  const refusals = db
    .prepare("PRAGMA main.foreign_key_check")
    .all()
    .flatMap((v) => {
      const { table, rowid, parent } = v as { table: string; rowid: number; parent: string };
      const t = byTable.get(table);
      if (!t || !touched.get(table)?.includes(rowid)) return [];
      const name = (
        db.prepare(`SELECT ${q(t.title)} AS n FROM main.${q(table)} WHERE rowid = ?`).get(rowid) as
          | { n: unknown }
          | undefined
      )?.n;
      return [
        `${t.model.name} “${name}” needs a ${byTable.get(parent)?.model.name ?? "record"} that is gone too: bring back both.`,
      ];
    });
  if (refusals.length) {
    db.exec("ROLLBACK");
    io.err(`Nothing was written:\n${[...new Set(refusals)].map((r) => `  ${r}\n`).join("")}`);
    return 1;
  }
  db.exec("COMMIT");
  io.out(
    `Written back: ${[...touched].map(([t, ids]) => `${ids.length} ${byTable.get(t)?.model.name}`).join(", ") || "nothing"}. The data from just before is in ${before}.\n`,
  );
  return 0;
}
