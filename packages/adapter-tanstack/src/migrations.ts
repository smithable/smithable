import { plural, snake } from "@smithable/core";

/**
 * The SQL table and column of a model's field, as the generated Drizzle schema names them.
 * A reference (`customer: Customer!`) is stored in `customer_id`.
 */
export function columnOf(
  model: string,
  field: string,
  reference = false,
): { table: string; column: string } {
  return { table: snake(plural(model)), column: reference ? `${snake(field)}_id` : snake(field) };
}

/**
 * drizzle-kit's SQL with the table after each REFERENCES quoted: when it adds a reference to an
 * existing table it leaves the name bare (drizzle-kit 0.31), and a table named like an SQL word
 * (`values`, from a model Value) then breaks the migration.
 */
export function quoteReferences(sql: string): string {
  return sql.replace(/REFERENCES ([A-Za-z_][A-Za-z0-9_]*)\(/g, "REFERENCES `$1`(");
}

/**
 * SQL for a choice value that goes: the records holding it get the new one, or nothing ("").
 */
export function choiceValueSql(model: string, field: string, from: string, to: string): string {
  const { table, column } = columnOf(model, field);
  const quoted = (v: string) => `'${v.replaceAll("'", "''")}'`;
  return `UPDATE \`${table}\` SET \`${column}\` = ${to ? quoted(to) : "NULL"} WHERE \`${column}\` = ${quoted(from)};\n`;
}

/** SQL for a custom migration that renames a field's column, keeping its data. */
export function renameColumnSql(
  model: string,
  from: string,
  to: string,
  reference = false,
): string {
  const { table, column } = columnOf(model, from, reference);
  const renamed = columnOf(model, to, reference).column;
  return `ALTER TABLE \`${table}\` RENAME COLUMN \`${column}\` TO \`${renamed}\`;\n`;
}

type Snapshot = {
  tables: Record<
    string,
    {
      columns: Record<string, { name: string }>;
      indexes?: Record<string, { columns: string[] }>;
      uniqueConstraints?: Record<string, { columns: string[] }>;
      compositePrimaryKeys?: Record<string, { columns: string[] }>;
      foreignKeys?: Record<
        string,
        { tableTo?: string; columnsFrom?: string[]; columnsTo?: string[] }
      >;
    }
  >;
};

/**
 * The snapshot without some tables and columns, and without every index, key and reference
 * that names them: what drizzle-kit is then asked to reach from the one before.
 */
function without(snapshot: Snapshot, tables: Set<string>, columns: Map<string, Set<string>>) {
  for (const table of tables) delete snapshot.tables[table];
  for (const [name, t] of Object.entries(snapshot.tables)) {
    const gone = columns.get(name) ?? new Set<string>();
    for (const column of gone) delete t.columns[column];
    for (const key of ["indexes", "uniqueConstraints", "compositePrimaryKeys"] as const) {
      const entries = t[key];
      if (entries)
        for (const [n, v] of Object.entries(entries))
          if (v.columns.some((c) => gone.has(c))) delete entries[n];
    }
    for (const [n, fk] of Object.entries(t.foreignKeys ?? {})) {
      const to = fk.tableTo ? columns.get(fk.tableTo) : undefined;
      if (
        fk.columnsFrom?.some((c) => gone.has(c)) ||
        (fk.tableTo && tables.has(fk.tableTo)) ||
        fk.columnsTo?.some((c) => to?.has(c))
      )
        delete t.foreignKeys?.[n];
    }
  }
  return snapshot;
}

/**
 * drizzle-kit asks whether a table (or a column of one table) that goes and another that comes
 * are one renamed, and without a terminal that question is an error. Smithable says its renames
 * itself (renameColumnSql, renameModelSql), so what is left is never a rename: when both are
 * there, this is the snapshot with what goes taken out, for a first step of drops alone and a
 * second of additions alone, neither of which asks. Undefined when nothing could be asked.
 */
export function goneFirst(
  previousJson: string,
  current: { tables: Record<string, { columns: Record<string, unknown> }> },
): string | undefined {
  const previous = JSON.parse(previousJson) as Snapshot;
  if (!previous.tables) return undefined;
  const tables = new Set(Object.keys(previous.tables).filter((t) => !current.tables[t]));
  const columns = new Map<string, Set<string>>();
  let asks = tables.size > 0 && Object.keys(current.tables).some((t) => !previous.tables[t]);
  for (const [name, t] of Object.entries(previous.tables)) {
    const now = current.tables[name];
    if (!now) continue;
    const gone = Object.keys(t.columns).filter((c) => !now.columns[c]);
    if (gone.length) columns.set(name, new Set(gone));
    if (gone.length && Object.keys(now.columns).some((c) => !t.columns[c])) asks = true;
  }
  if (!asks) return undefined;
  return `${JSON.stringify(without(previous, tables, columns), null, 2)}\n`;
}

/**
 * Renames in an order where none lands on a name another has still to leave (a, b become b, c:
 * b goes to c before a goes to b), a cycle (a and b swapped) broken through a passing name that
 * no rename names and `taken` (the schema as it is) does not have. `scope` keeps apart the names
 * of different tables.
 */
export function inTurn<T extends { from: string; to: string }>(
  renames: T[],
  scope: (rename: T) => string = () => "",
  taken: (name: string, rename: T) => boolean = () => false,
): T[] {
  const pending = [...renames];
  const ordered: T[] = [];
  while (pending.length) {
    const free = pending.findIndex(
      (r) => !pending.some((o) => o !== r && scope(o) === scope(r) && o.from === r.to),
    );
    if (free >= 0) {
      ordered.push(...pending.splice(free, 1));
      continue;
    }
    const first = pending[0] as T;
    const named = new Set(
      renames.filter((r) => scope(r) === scope(first)).flatMap((r) => [r.from, r.to]),
    );
    let n = ordered.length;
    while (named.has(`${first.from}Passing${n}`) || taken(`${first.from}Passing${n}`, first)) n++;
    const passing = `${first.from}Passing${n}`;
    ordered.push({ ...first, to: passing });
    pending[0] = { ...first, from: passing };
  }
  return ordered;
}

/**
 * drizzle-kit gives a custom migration a copy of the previous schema snapshot. After a
 * rename, the snapshot must describe the renamed column, or the next `drizzle-kit
 * generate` would see a drop plus an add and ask whether it was a rename.
 */
export function renameInSnapshot(
  snapshotJson: string,
  model: string,
  from: string,
  to: string,
  reference = false,
): string {
  const snapshot = JSON.parse(snapshotJson) as Snapshot;
  const { table, column } = columnOf(model, from, reference);
  const renamed = columnOf(model, to, reference).column;
  const t = snapshot.tables[table];
  const col = t?.columns[column];
  if (!t || !col) throw new Error(`The schema snapshot has no column ${table}.${column}.`);
  t.columns = Object.fromEntries(
    Object.entries(t.columns).map(([key, value]) =>
      key === column ? [renamed, { ...value, name: renamed }] : [key, value],
    ),
  );
  for (const index of Object.values(t.indexes ?? {})) {
    index.columns = index.columns.map((c) => (c === column ? renamed : c));
  }
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

/**
 * A rename back onto a name a newer column has taken (an older version applied, the newer field
 * going and the older coming back under its name): the newer column is dropped first, with its
 * indexes, and the snapshot no longer has it. Undefined when the name is free. The SQL is for
 * the command line's custom migration; the tools have drizzle-kit write the drop from the
 * snapshot instead, since SQLite drops no column a reference or a key names.
 */
export function dropTakenColumn(
  snapshotJson: string,
  model: string,
  to: string,
  reference = false,
): { sql: string[]; snapshot: string } | undefined {
  const snapshot = JSON.parse(snapshotJson) as Snapshot;
  const { table, column } = columnOf(model, to, reference);
  const t = snapshot.tables[table];
  if (!t?.columns[column]) return undefined;
  const sql = Object.entries(t.indexes ?? {})
    .filter(([, index]) => index.columns.includes(column))
    .map(([name]) => `DROP INDEX IF EXISTS \`${name}\`;\n`);
  sql.push(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\`;\n`);
  without(snapshot, new Set(), new Map([[table, new Set([column])]]));
  return { sql, snapshot: `${JSON.stringify(snapshot, null, 2)}\n` };
}

/** The tables a model owns: its own, and the per-person ones the kit keeps beside it. */
const OWN_TABLES = ["", "_favorites", "_reads"];

type RenameSnapshot = {
  tables: Record<
    string,
    {
      name: string;
      columns: Record<string, { name: string }>;
      indexes?: Record<
        string,
        { name: string; columns: string[]; isUnique: boolean; where?: string }
      >;
      foreignKeys?: Record<
        string,
        {
          name: string;
          tableFrom: string;
          tableTo: string;
          columnsFrom: string[];
          columnsTo: string[];
          onDelete?: string;
          onUpdate?: string;
        }
      >;
      uniqueConstraints?: Record<string, { name: string; columns: string[] }>;
      compositePrimaryKeys?: Record<string, { name: string; columns: string[] }>;
      checkConstraints?: Record<string, { name: string; value: string }>;
    }
  >;
};

/** drizzle-kit's name for a foreign key, as the generated schema leaves it unnamed. */
const foreignKeyName = (tableFrom: string, from: string[], tableTo: string, to: string[]) =>
  `${tableFrom}_${from.join("_")}_${tableTo}_${to.join("_")}_fk`;

/** The tables of `model` the snapshot has, old name to new. */
function renamedTables(
  snapshot: RenameSnapshot,
  from: string,
  to: string,
): { from: string; to: string }[] {
  const old = columnOf(from, "id").table;
  const renamed = columnOf(to, "id").table;
  return OWN_TABLES.filter((suffix) => snapshot.tables[`${old}${suffix}`]).map((suffix) => ({
    from: `${old}${suffix}`,
    to: `${renamed}${suffix}`,
  }));
}

/**
 * A model renamed back onto a name a newer model has taken (an older version applied, the newer
 * model going and the older coming back under its name): the snapshot without the newer model's
 * tables, for drizzle-kit to drop first. Undefined when the name is free.
 */
export function dropTakenTables(
  snapshotJson: string,
  from: string,
  to: string,
): string | undefined {
  const snapshot = JSON.parse(snapshotJson) as Snapshot;
  if (!renamedTables(snapshot as unknown as RenameSnapshot, from, to).length) return undefined;
  // The newer model's own tables, the kit's beside it included: they all go with it.
  const own = columnOf(to, "id").table;
  const landing = OWN_TABLES.map((suffix) => `${own}${suffix}`).filter((t) => snapshot.tables[t]);
  if (!landing.length) return undefined;
  return `${JSON.stringify(without(snapshot, new Set(landing), new Map()), null, 2)}\n`;
}

/** Whether the snapshot has a column for a model's field (or a table for a model, without one). */
export function inSnapshot(
  snapshotJson: string,
  model: string,
  field?: string,
  reference = false,
): boolean {
  const snapshot = JSON.parse(snapshotJson) as Snapshot;
  const { table, column } = columnOf(model, field ?? "id", reference);
  return field
    ? Boolean(snapshot.tables?.[table]?.columns[column])
    : Boolean(snapshot.tables?.[table]);
}

/** A partial index's condition names its table in quotes: "customers"."deleted_at" is null. */
const inWhere = (where: string, from: string, to: string) =>
  where.replaceAll(`"${from}".`, `"${to}".`);

/**
 * The statements of a custom migration that renames a model's tables (one each, since the
 * migrator runs them one at a time), keeping their rows: the table and
 * the kit's tables beside it, each index under its new name (SQLite cannot rename an index, and
 * the generated schema names them after the table), and the audit log's rows about the model.
 * Foreign keys in other tables follow a renamed table by themselves in SQLite.
 */
export function renameModelSql(snapshotJson: string, from: string, to: string): string[] {
  const snapshot = JSON.parse(snapshotJson) as RenameSnapshot;
  const lines: string[] = [];
  for (const table of renamedTables(snapshot, from, to)) {
    lines.push(`ALTER TABLE \`${table.from}\` RENAME TO \`${table.to}\`;`);
    for (const index of Object.values(snapshot.tables[table.from]?.indexes ?? {})) {
      const name = index.name.startsWith(`${table.from}_`)
        ? `${table.to}_${index.name.slice(table.from.length + 1)}`
        : index.name;
      lines.push(`DROP INDEX IF EXISTS \`${index.name}\`;`);
      lines.push(
        `CREATE ${index.isUnique ? "UNIQUE " : ""}INDEX \`${name}\` ON \`${table.to}\` (${index.columns.map((c) => `\`${c}\``).join(",")})${index.where ? ` WHERE ${inWhere(index.where, table.from, table.to)}` : ""};`,
      );
    }
  }
  if (snapshot.tables.audit_log)
    lines.push(
      `UPDATE \`audit_log\` SET \`model\` = '${to.replaceAll("'", "''")}' WHERE \`model\` = '${from.replaceAll("'", "''")}';`,
    );
  return lines;
}

/**
 * The schema snapshot after a model's rename, as drizzle-kit would describe the new schema: the
 * renamed tables under their new names, their indexes and constraints renamed with them, and
 * every foreign key that points at them following. Then the next `drizzle-kit generate` sees no
 * difference, instead of a dropped table and a new one.
 */
export function renameModelInSnapshot(snapshotJson: string, from: string, to: string): string {
  const snapshot = JSON.parse(snapshotJson) as RenameSnapshot;
  const renames = new Map(renamedTables(snapshot, from, to).map((t) => [t.from, t.to]));
  const tableName = (name: string) => renames.get(name) ?? name;
  const prefixed = (name: string, oldTable: string) =>
    name.startsWith(`${oldTable}_`)
      ? `${tableName(oldTable)}_${name.slice(oldTable.length + 1)}`
      : name;
  const renameKeys = <T extends { name: string }>(
    entries: Record<string, T> | undefined,
    oldTable: string,
    patch: (entry: T) => T = (e) => e,
  ): Record<string, T> | undefined =>
    entries &&
    Object.fromEntries(
      Object.entries(entries).map(([key, entry]) => {
        const name = prefixed(entry.name, oldTable);
        return [key === entry.name ? name : key, patch({ ...entry, name })];
      }),
    );
  snapshot.tables = Object.fromEntries(
    Object.entries(snapshot.tables).map(([key, table]) => {
      const name = tableName(table.name);
      const own = renames.has(table.name) ? table.name : undefined;
      const foreignKeys =
        table.foreignKeys &&
        Object.fromEntries(
          Object.entries(table.foreignKeys).map(([fkKey, fk]) => {
            const moved = {
              ...fk,
              tableFrom: tableName(fk.tableFrom),
              tableTo: tableName(fk.tableTo),
            };
            const conventional =
              fk.name === foreignKeyName(fk.tableFrom, fk.columnsFrom, fk.tableTo, fk.columnsTo);
            const fkName = conventional
              ? foreignKeyName(moved.tableFrom, fk.columnsFrom, moved.tableTo, fk.columnsTo)
              : fk.name;
            return [fkKey === fk.name ? fkName : fkKey, { ...moved, name: fkName }];
          }),
        );
      const renamed = {
        ...table,
        name,
        ...(foreignKeys ? { foreignKeys } : {}),
        ...(own
          ? {
              indexes: renameKeys(table.indexes, own, (index) =>
                index.where ? { ...index, where: inWhere(index.where, own, name) } : index,
              ),
              uniqueConstraints: renameKeys(table.uniqueConstraints, own),
              compositePrimaryKeys: renameKeys(table.compositePrimaryKeys, own),
              checkConstraints: renameKeys(table.checkConstraints, own),
            }
          : {}),
      };
      // Keys drizzle-kit writes as empty objects stay so, not undefined.
      for (const k of [
        "indexes",
        "uniqueConstraints",
        "compositePrimaryKeys",
        "checkConstraints",
      ] as const)
        if (k in table && renamed[k] === undefined) delete renamed[k];
      return [key === table.name ? name : key, renamed];
    }),
  );
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}
