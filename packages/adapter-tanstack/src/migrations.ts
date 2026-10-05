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
