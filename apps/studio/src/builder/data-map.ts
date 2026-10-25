// The Data map's content (A 127, the app map's first view): the app's kinds of record as nodes,
// each with its fields, and the references and ownership between them as labelled edges. Read
// from the IR only; nothing here is a second reading of the files.
import {
  type AuthIR,
  type FieldIR,
  pageModel,
  pageModels,
  type SpecIR,
  USER_MODEL,
} from "@smithable/core";

/** The people who sign in (core's built-in model): a node when a field refers to them or a record is someone's. */
export const PEOPLE = USER_MODEL;

export interface MapNode {
  id: string;
  /** Its records are their maker's (sign-in, no ownedBy): said in the box, not by an arrow. */
  madeBy?: boolean;
  /** Each field as a name and what it holds: a kind of value, a choice, or the record it refers to. */
  fields: { name: string; holds: string }[];
  /**
   * A kind no arrow reaches (A 164): where its records come from (a contact form, the page that
   * adds them), the pages that show them and the actions on them, read from the pages.
   */
  alone?: { from: string[]; shown: string[]; actions: string[] };
}

export interface MapEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  /** A reference a field stores; or ownership: whose record it is (ownedBy, or who made it). */
  kind: "reference" | "owner";
  /**
   * How the two relate, read from the source: many of these to one of those, or one to one where
   * the field is unique on its own (Johan, 2026-10-23).
   */
  relation: "many to one" | "one to one";
  /** UML's marks at the two ends (A 165): how many of these (`*`, `0..1`) and of those (`1`, `0..1`). */
  ends: [string, string];
  /** The list on the other side that shows these records, when there is one (Customer.orders). */
  list?: string;
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
      // Unique on its own is the field's own word; the model's rules hold two or more fields.
      const one = Boolean(field.unique);
      const target = field.type.model;
      // The list on the other side, when this is the only reference between the two (with two,
      // which list goes with which is not known here).
      const single =
        model.fields.filter(
          (f) => f.type.kind === "relation" && !f.type.many && f.type.model === target,
        ).length === 1;
      const list = !single
        ? undefined
        : ir.models
            .find((m) => m.name === target)
            ?.fields.find(
              (f) => f.type.kind === "relation" && f.type.many && f.type.model === model.name,
            );
      const relation = one ? "one to one" : "many to one";
      edges.push({
        id: `${model.name}.${field.name}`,
        source: model.name,
        target,
        label: `${field.name}${owner ? " (owns it)" : ""}${list ? ` · ${target}.${list.name}` : ""}`,
        kind: owner ? "owner" : "reference",
        relation,
        ends: [one ? "0..1" : "*", field.required ? "1" : "0..1"],
        ...(list ? { list: `${target}.${list.name}` } : {}),
      });
    }
  }
  // Without ownedBy, a record is its maker's when people sign in: a line in its box (an arrow to
  // the people from every such box crossed the others).
  const madeBy = (name: string) => signIn && !ir.models.find((m) => m.name === name)?.ownedBy;
  const people = edges.some((e) => e.target === PEOPLE) || ir.models.some((m) => madeBy(m.name));
  const linked = new Set(edges.flatMap((e) => [e.source, e.target]));
  const alone = (name: string): MapNode["alone"] => {
    const forms = ir.pages.filter((p) => p.sections.some((s) => s.form === name));
    return {
      from: [
        ...forms.map((p) => `the contact form on ${p.id}`),
        ...ir.pages.filter((p) => pageModel(p) === name).map((p) => `the ${p.id} page`),
      ],
      shown: ir.pages
        .filter((p) => !forms.includes(p) && pageModel(p) !== name && pageModels(p).includes(name))
        .map((p) => p.id),
      actions: ir.actions.flatMap((a) => (!a.custom && a.on === name ? [a.name] : [])),
    };
  };
  const nodes: MapNode[] = [
    ...ir.models.map((m) => ({
      id: m.name,
      ...(madeBy(m.name) ? { madeBy: true } : {}),
      ...(linked.has(m.name) ? {} : { alone: alone(m.name) }),
      fields: m.fields.map((f) => ({ name: f.name, holds: holds(f) })),
    })),
    ...(people && !ir.models.some((m) => m.name === PEOPLE) ? [{ id: PEOPLE, fields: [] }] : []),
  ];
  return { nodes, edges };
}
