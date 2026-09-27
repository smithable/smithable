// Smithable app kit: the condition for records matching a search box's text.
import { type Column, getTableName, or, type SQL, sql, type Table } from "drizzle-orm";

/** Records where any of the columns contains the text, ignoring case (SQLite's LIKE). */
export function contains(columns: Column[], text: string): SQL | undefined {
  // % and _ are wildcards in LIKE; the text is matched literally.
  const pattern = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return or(...columns.map((column) => sql`${column} like ${pattern} escape '\\'`));
}

/**
 * Records whose reference points at a related record containing the text, e.g. orders whose
 * customer's name matches. The subquery names its table and columns itself: a list's query
 * would otherwise read them as columns of its own table.
 */
export function relatedContains(
  reference: Column,
  table: Table,
  columns: Column[],
  text: string,
): SQL {
  const pattern = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const name = sql.identifier(getTableName(table));
  const matches = or(
    ...columns.map((c) => sql`${name}.${sql.identifier(c.name)} like ${pattern} escape '\\'`),
  );
  return sql`${reference} in (select ${name}."id" from ${name} where ${matches})`;
}
