// Smithable app kit: the condition for records matching a search box's text.
import { type Column, or, type SQL, sql } from "drizzle-orm";

/** Records where any of the columns contains the text, ignoring case (SQLite's LIKE). */
export function contains(columns: Column[], text: string): SQL | undefined {
  // % and _ are wildcards in LIKE; the text is matched literally.
  const pattern = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return or(...columns.map((column) => sql`${column} like ${pattern} escape '\\'`));
}
