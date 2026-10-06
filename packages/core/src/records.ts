// Records from a spreadsheet for importRecords (ARCHITECTURE §4): a CSV with a header row, its
// columns matched to a model's fields by name, label or an explicit map, each value converted
// as a sample's is (values.ts). Pure, so the CLI, MCP and Studio read a file the same way and a
// dry run shows exactly what would land. References come out as titles for the host to look up.

import type { ContentIR } from "./content.js";
import type { FieldIR, ModelIR } from "./ir.js";
import { isUpload } from "./ir.js";
import { humanize } from "./naming.js";
import { convertValue } from "./values.js";

/** At most this many records in one import. */
export const IMPORT_MAX = 10_000;

/** A converted value; a reference is the referenced record's title, looked up by the host. */
export type ImportValue = string | number | boolean | null | { title: string };

export interface ImportRefusal {
  /** The record's line in the file (the header is line 1); 0 for the file as a whole. */
  line: number;
  column?: string;
  message: string;
}

export interface ImportRecords {
  /** Each matched column and the field it fills. */
  columns: { column: string; field: string }[];
  /** Columns that fill no field, left out. */
  ignored: string[];
  rows: Record<string, ImportValue>[];
  refusals: ImportRefusal[];
}

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

/** A name compared loosely: "Credit limit", "credit_limit" and "creditLimit" are one. */
const loose = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "");

/**
 * The records a CSV file holds for `model`, converted, with every value that does not fit and
 * the row it is on. `map` names columns for fields, e.g. { "Company": "name" }.
 */
export function readRecords(
  text: string,
  model: ModelIR,
  content?: ContentIR,
  map: Record<string, string> = {},
): ImportRecords {
  const refusals: ImportRefusal[] = [];
  const [header = [], ...lines] = parseCsv(text);
  // Fields an import can fill: stored values and references, not pictures, formulas, lists of
  // records or people who sign in.
  const importable = (f: FieldIR) =>
    !f.formula &&
    !isUpload(f) &&
    !(f.type.kind === "relation" && (f.type.many || f.type.model === "User"));
  const label = (f: FieldIR) => content?.models?.[model.name]?.fields?.[f.name]?.label;
  const columns: { column: string; field: string; at: number }[] = [];
  const ignored: string[] = [];
  header.forEach((raw, at) => {
    const column = raw.trim();
    const named = map[column];
    const field = named
      ? model.fields.find((f) => f.name === named)
      : model.fields.find((f) =>
          [f.name, humanize(f.name), label(f)].some((n) => n && loose(n) === loose(column)),
        );
    if (named && !field) {
      refusals.push({ line: 1, column, message: `${model.name} has no field "${named}".` });
      return;
    }
    if (!field) {
      ignored.push(column);
      return;
    }
    if (!importable(field)) {
      refusals.push({
        line: 1,
        column,
        message: `"${field.name}" cannot be imported: ${field.type.kind === "relation" ? "it names people who sign in or a list of records" : "pictures and calculated fields are not imported"}.`,
      });
      return;
    }
    if (columns.some((c) => c.field === field.name)) {
      refusals.push({ line: 1, column, message: `Two columns fill "${field.name}".` });
      return;
    }
    columns.push({ column, field: field.name, at });
  });
  for (const field of model.fields.filter(importable))
    if (
      field.required &&
      field.default === undefined &&
      !columns.some((c) => c.field === field.name)
    )
      refusals.push({
        line: 1,
        message: `No column fills "${field.name}", which every ${humanize(model.name).toLowerCase()} needs.`,
      });
  if (lines.length > IMPORT_MAX)
    refusals.push({
      line: 0,
      message: `The file has ${lines.length.toLocaleString("en")} records; at most ${IMPORT_MAX.toLocaleString("en")} go in one import.`,
    });
  const rows = lines.slice(0, IMPORT_MAX).map((cells, i) => {
    const line = i + 2;
    const row: Record<string, ImportValue> = {};
    for (const { column, field: name, at } of columns) {
      const field = model.fields.find((f) => f.name === name) as FieldIR;
      const cell = (cells[at] ?? "").trim();
      // An empty cell is no value: the field's default, or nothing.
      if (cell === "") {
        if (field.default !== undefined) continue;
        if (field.required) refusals.push({ line, column, message: `"${name}" is required.` });
        row[name] = null;
        continue;
      }
      if (field.type.kind === "relation") {
        row[name] = { title: cell };
        continue;
      }
      const converted = convertValue(model, field, cell, content);
      if ("value" in converted) row[name] = converted.value;
      else refusals.push({ line, column, message: `"${cell}" is not ${converted.expected}.` });
    }
    return row;
  });
  return {
    columns: columns.map(({ column, field }) => ({ column, field })),
    ignored,
    rows,
    refusals,
  };
}
