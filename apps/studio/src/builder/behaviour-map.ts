// The behaviour view's content (A 127, docs/design/app-map.md): what the app does by itself or at a
// press of a button, as boxes and arrows: standard actions on their kind of record with their
// `when` and `set`, custom actions as code with what their contract says they read, write and
// may send (intents.md §7), timers and what they run, and the outgoing entries with what sets
// each off. Read from the IR only.
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
  /** `input`: a custom action's input, on the left of its own picture. */
  kind: "model" | "action" | "custom" | "timer" | "outgoing" | "input";
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
      // Its code is not read here; what it is for, and what its contract says it touches.
      nodes.push({
        id: `action:${a.name}`,
        kind: "custom",
        title: a.name,
        lines: [
          "custom code",
          ...(a.intent ? [a.intent] : []),
          ...(a.output?.length ? [`gives ${a.output.map((f) => f.name).join(", ")}`] : []),
        ],
      });
      const writes = a.touches?.writes ?? [];
      for (const w of writes) {
        models.add(w.model);
        edges.push({
          id: `writes:${a.name}:${w.model}`,
          source: `action:${a.name}`,
          target: `model:${w.model}`,
          label: w.fields?.length ? `writes ${w.fields.join(", ")}` : "writes",
        });
      }
      // One it writes is read too: one arrow, the write's.
      for (const r of a.touches?.reads ?? []) {
        if (writes.some((w) => w.model === r)) continue;
        models.add(r);
        edges.push({
          id: `reads:${a.name}:${r}`,
          source: `model:${r}`,
          target: `action:${a.name}`,
          label: "reads",
        });
      }
      // Its own entry has its arrow already (returned); one on a record it writes, this one.
      for (const name of a.triggers ?? [])
        if (
          ir.outgoing.some(
            (o) => o.name === name && !("custom" in o.when && o.when.custom === a.name),
          )
        )
          edges.push({
            id: `may-send:${a.name}:${name}`,
            source: `action:${a.name}`,
            target: `outgoing:${name}`,
            label: "may send",
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

/**
 * One custom action's own picture (intents.md §7): its input on the left, the action, the kinds of
 * record it reads and writes and the mails and calls it may send or that follow it, as its
 * contract says; nothing the contract does not say. An action without `touches` is its box alone.
 */
export function pictureOf(
  ir: SpecIR,
  action: string,
): { nodes: BehaviourNode[]; edges: BehaviourEdge[] } {
  const a = ir.actions.find((x) => x.name === action && x.custom);
  if (!a?.custom) return { nodes: [], edges: [] };
  const map = behaviourOf(ir);
  const id = `action:${action}`;
  const edges = map.edges.filter((e) => e.source === id || e.target === id);
  const near = new Set([id, ...edges.flatMap((e) => [e.source, e.target])]);
  const input = a.input.length
    ? [
        {
          id: `input:${action}`,
          kind: "input" as const,
          title: "Input",
          lines: a.input.map((f) => `${f.name}${f.required ? "" : " (optional)"}`),
        },
      ]
    : [];
  return {
    nodes: [...input, ...map.nodes.filter((n) => near.has(n.id))],
    edges: [
      ...(input.length ? [{ id: `takes:${action}`, source: `input:${action}`, target: id }] : []),
      ...edges,
    ],
  };
}
