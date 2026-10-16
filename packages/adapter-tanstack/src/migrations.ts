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
    }
  >;
};

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
