import { plural, snake } from "./naming.js";

/** The SQL table and column of a model's field, as the generated Drizzle schema names them. */
export function columnOf(model: string, field: string): { table: string; column: string } {
  return { table: snake(plural(model)), column: snake(field) };
}

/** SQL for a custom migration that renames a field's column, keeping its data. */
export function renameColumnSql(model: string, from: string, to: string): string {
  const { table, column } = columnOf(model, from);
  return `ALTER TABLE \`${table}\` RENAME COLUMN \`${column}\` TO \`${columnOf(model, to).column}\`;\n`;
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
): string {
  const snapshot = JSON.parse(snapshotJson) as Snapshot;
  const { table, column } = columnOf(model, from);
  const renamed = columnOf(model, to).column;
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
