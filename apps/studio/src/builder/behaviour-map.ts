// The behaviour view's content (A 127, docs/design/app-map.md): what the app does by itself or at a
// press of a button, as boxes and arrows: standard actions on their kind of record with their
// `when` and `set`, custom actions as opaque code, timers and what they run, and the outgoing
// entries with what sets each off. Read from the IR only.
import type {
  ActionValueIR,
  Condition,
  OutgoingIR,
  RecipientIR,
  SpecIR,
  TimerScheduleIR,
} from "@smithable/core";

export interface BehaviourNode {
  id: string;
  kind: "model" | "action" | "custom" | "timer" | "outgoing";
  title: string;
  /** What it does, a line each: its condition, what it sets, when it runs, who is told. */
  lines: string[];
}

export interface BehaviourEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

const conditionText = (c: Condition) =>
  Object.entries(c)
    .map(([field, v]) => `${field} ${Array.isArray(v) ? `is ${v.join(" or ")}` : `= ${String(v)}`}`)
    .join(", ");

const valueText = (v: ActionValueIR) =>
  "value" in v
    ? `${v.field} = ${String(v.value)}`
    : "formula" in v
      ? `${v.field} = ${v.text}`
      : "asked" in v
        ? `${v.field}: asked`
        : `${v.field} = whoever pressed it`;

const scheduleText = (s: TimerScheduleIR) =>
  s.kind === "record"
    ? `at ${s.path.join(".")}${s.offset ? `, ${s.offset.amount} ${s.offset.unit}${s.offset.amount === 1 ? "" : "s"} ${s.offset.direction}` : ""}`
    : s.kind === "every"
      ? `every ${String(s.every)} at ${s.at}`
      : `cron ${s.cron}`;

const recipientText = (r?: RecipientIR) =>
  !r
    ? "the owner"
    : r.kind === "owner"
      ? "the owner"
      : r.kind === "role"
        ? `every ${r.role}`
        : r.kind === "field"
          ? r.path.join(".")
          : `each of ${r.list}`;

const told = (o: OutgoingIR) =>
  o.to === "mail" ? `mail to ${recipientText(o.recipient)}` : `call to ${o.to}`;

export function behaviourOf(ir: SpecIR): { nodes: BehaviourNode[]; edges: BehaviourEdge[] } {
  const nodes: BehaviourNode[] = [];
  const edges: BehaviourEdge[] = [];
  const models = new Set<string>();
  for (const a of ir.actions) {
    if (a.custom) {
      // Its code is not read here; what it is for, when the spec says so.
      nodes.push({
        id: `action:${a.name}`,
        kind: "custom",
        title: a.name,
        lines: ["custom code", ...(a.intent ? [a.intent] : [])],
      });
      continue;
    }
    models.add(a.on);
    nodes.push({
      id: `action:${a.name}`,
      kind: "action",
      title: a.name,
      lines: [
        ...(a.when ? [`when ${conditionText(a.when)}`] : []),
        ...(a.copy
          ? [`copies it${a.copy.length ? `: ${a.copy.map(valueText).join(", ")}` : ""}`]
          : []),
        ...(a.set.length ? [`sets ${a.set.map(valueText).join(", ")}`] : []),
      ],
    });
    edges.push({ id: `on:${a.name}`, source: `model:${a.on}`, target: `action:${a.name}` });
    for (const add of a.add ?? []) {
      models.add(add.model);
      edges.push({
        id: `adds:${a.name}:${add.model}`,
        source: `action:${a.name}`,
        target: `model:${add.model}`,
        label: "adds",
      });
    }
  }
  for (const t of ir.timers) {
    nodes.push({
      id: `timer:${t.name}`,
      kind: "timer",
      title: t.name,
      lines: [scheduleText(t.schedule), ...(t.where ? [`for ${conditionText(t.where)}`] : [])],
    });
    if (t.on) {
      models.add(t.on);
      edges.push({ id: `timer-on:${t.name}`, source: `model:${t.on}`, target: `timer:${t.name}` });
    }
    if (t.run)
      edges.push({
        id: `runs:${t.name}`,
        source: `timer:${t.name}`,
        target: `action:${t.run}`,
        label: "runs",
      });
  }
  for (const o of ir.outgoing) {
    nodes.push({
      id: `outgoing:${o.name}`,
      kind: "outgoing",
      title: o.name,
      lines: [told(o), ...(o.where ? [`for ${conditionText(o.where)}`] : [])],
    });
    const w = o.when;
    if ("event" in w) {
      models.add(w.model);
      edges.push({
        id: `when:${o.name}`,
        source: `model:${w.model}`,
        target: `outgoing:${o.name}`,
        label: w.event,
      });
    } else if ("action" in w)
      edges.push({
        id: `when:${o.name}`,
        source: `action:${w.action}`,
        target: `outgoing:${o.name}`,
        label: "ran",
      });
    else if ("custom" in w)
      edges.push({
        id: `when:${o.name}`,
        source: `action:${w.custom}`,
        target: `outgoing:${o.name}`,
        label: "returned",
      });
    else
      edges.push({
        id: `when:${o.name}`,
        source: `timer:${w.timer}`,
        target: `outgoing:${o.name}`,
        label: "came",
      });
  }
  return {
    nodes: [
      ...ir.models
        .filter((m) => models.has(m.name))
        .map((m) => ({ id: `model:${m.name}`, kind: "model" as const, title: m.name, lines: [] })),
      ...nodes,
    ],
    edges,
  };
}
