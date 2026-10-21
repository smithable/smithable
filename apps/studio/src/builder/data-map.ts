// The Data map's content (A 127, the app map's first view): the app's kinds of record as nodes,
// each with its fields, and the references and ownership between them as labelled edges. Read
// from the IR only; nothing here is a second reading of the files.
import { type AuthIR, type FieldIR, type SpecIR, USER_MODEL } from "@smithable/core";

/** The people who sign in (core's built-in model): a node when a field refers to them or a record is someone's. */
export const PEOPLE = USER_MODEL;

export interface MapNode {
  id: string;
  /** Each field as a name and what it holds: a kind of value, a choice, or the record it refers to. */
  fields: { name: string; holds: string }[];
}

export interface MapEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  /** A reference a field stores; or ownership: whose record it is (ownedBy, or who made it). */
  kind: "reference" | "owner";
}

const holds = (f: FieldIR): string =>
  f.type.kind === "scalar"
    ? f.type.name
    : f.type.kind === "choice"
      ? `one of ${f.type.values.length}`
      : f.type.many
        ? `${f.type.model} list`
        : `→ ${f.type.model}`;

export function mapOf(ir: SpecIR, auth?: AuthIR): { nodes: MapNode[]; edges: MapEdge[] } {
  const signIn = Boolean(auth && auth.signIn !== "none");
  const edges: MapEdge[] = [];
  for (const model of ir.models) {
    for (const field of model.fields) {
      // A list is the other side of a reference: drawn once, from the record that stores it.
      if (field.type.kind !== "relation" || field.type.many) continue;
      const owner = field.name === model.ownedBy;
      edges.push({
        id: `${model.name}.${field.name}`,
        source: model.name,
        target: field.type.model,
        label: owner ? `${field.name} (owns it)` : field.name,
        kind: owner ? "owner" : "reference",
      });
    }
    // Without ownedBy, a record is its maker's when people sign in.
    if (signIn && !model.ownedBy)
      edges.push({
        id: `${model.name}.owner`,
        source: model.name,
        target: PEOPLE,
        label: "made by (owns it)",
        kind: "owner",
      });
  }
  const people = edges.some((e) => e.target === PEOPLE);
  const nodes: MapNode[] = [
    ...ir.models.map((m) => ({
      id: m.name,
      fields: m.fields.map((f) => ({ name: f.name, holds: holds(f) })),
    })),
    ...(people && !ir.models.some((m) => m.name === PEOPLE) ? [{ id: PEOPLE, fields: [] }] : []),
  ];
  return { nodes, edges };
}
