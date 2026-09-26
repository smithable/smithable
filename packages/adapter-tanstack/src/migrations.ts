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
