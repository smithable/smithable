// Reading a CSV file: the one reader, which core's importRecords uses and which every generated
// app has a copy of as src/kit/csv-read.ts (scripts/embed.mjs copies it), so a file reads the same
// in Studio, on the command line and in an app's Import. Pure, with no imports, for that reason.

/** The rows of a CSV file (RFC 4180: quotes, doubled quotes, line breaks in quotes; ";" too). */
export function parseCsv(text: string): string[][] {
  const body = text.replace(/^﻿/, "");
  const firstLine = body.slice(0, body.search(/\r?\n|$/));
  // A spreadsheet set to a decimal comma writes ";" between columns.
  const separator =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === separator) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && body[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // Blank lines (a trailing newline, an empty row at the end) are no records.
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
