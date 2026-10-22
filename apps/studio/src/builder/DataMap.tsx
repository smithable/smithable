// No code's Data map (A 127, the app map's first view; read-only): the app's kinds of record as
// boxes, their fields folded, and the references and ownership between them as labelled arrows.
// A first layout by dagre; boxes moved by hand keep their place in this browser. A click on a
// box's name opens Behavior at that kind of record. Nothing is changed from the map.
import { graphlib, layout } from "@dagrejs/dagre";
import {
  applyNodeChanges,
  Background,
  Controls,
  type Edge,
  Handle,
  MarkerType,
  type Node,
  type NodeChange,
  type NodeProps,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { AuthIR, SpecIR } from "@smithable/core";
import { useMemo, useState } from "react";
import { type MapNode, mapOf, PEOPLE } from "./data-map";
import { OPEN_PART } from "./NoCode";

const WIDTH = 200;
const HEIGHT = 56;
const ROW = 20;

type BoxData = { box: MapNode; people: boolean };

/** Where the boxes were moved to, kept per app in this browser. */
const placesKey = (app: string) => `smithable:data-map:${app}`;
const readPlaces = (app: string): Record<string, { x: number; y: number }> => {
  try {
    return JSON.parse(window.localStorage.getItem(placesKey(app)) ?? "{}");
  } catch {
    return {};
  }
};
const writePlaces = (app: string, nodes: Node[]) => {
  try {
    window.localStorage.setItem(
      placesKey(app),
      JSON.stringify(Object.fromEntries(nodes.map((n) => [n.id, n.position]))),
    );
  } catch {}
};

/** dagre's first layout, left to right, the referring record before the one it refers to. */
function laidOut(boxes: MapNode[], edges: { source: string; target: string }[]) {
  const g = new graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 32, ranksep: 96 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const b of boxes) g.setNode(b.id, { width: WIDTH, height: HEIGHT });
  for (const e of edges) g.setEdge(e.source, e.target);
  layout(g);
  return Object.fromEntries(
    boxes.map((b) => {
      const at = g.node(b.id);
      return [b.id, { x: at.x - WIDTH / 2, y: at.y - HEIGHT / 2 }];
    }),
  );
}

function Box({ data }: NodeProps<Node<BoxData>>) {
  const [open, setOpen] = useState(false);
  const { box, people } = data;
  return (
    <div
      data-map-box={box.id}
      className="rounded border border-line bg-panel text-xs shadow-sm"
      style={{ width: WIDTH }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        {people ? (
          <span className="font-semibold">{box.id}: the people who sign in</span>
        ) : (
          <button
            type="button"
            className="nodrag font-semibold text-accent hover:underline"
            title={`Open ${box.id} in Behavior`}
            onClick={() =>
              window.dispatchEvent(new CustomEvent(OPEN_PART, { detail: `model:${box.id}` }))
            }
          >
            {box.id}
          </button>
        )}
        {box.fields.length > 0 && (
          <button
            type="button"
            className="nodrag text-muted hover:text-current"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {box.fields.length} {box.fields.length === 1 ? "field" : "fields"}
          </button>
        )}
      </div>
      {open && (
        <ul className="border-t border-line px-2 py-1" style={{ lineHeight: `${ROW}px` }}>
          {box.fields.map((f) => (
            <li key={f.name} className="flex justify-between gap-2">
              <span>{f.name}</span>
              <span className="text-muted">{f.holds}</span>
            </li>
          ))}
        </ul>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { box: Box };

export function DataMap({ ir, auth }: { ir: SpecIR; auth?: AuthIR }) {
  const map = useMemo(() => mapOf(ir, auth), [ir, auth]);
  const app = ir.app.name;
  const first = useMemo(() => laidOut(map.nodes, map.edges), [map]);
  const [nodes, setNodes] = useState<Node<BoxData>[]>(() => {
    const kept = readPlaces(app);
    return map.nodes.map((box) => ({
      id: box.id,
      type: "box",
      position: kept[box.id] ?? first[box.id] ?? { x: 0, y: 0 },
      data: { box, people: box.id === PEOPLE && !ir.models.some((m) => m.name === PEOPLE) },
    }));
  });
  // A kind of record added or removed since: its box comes and goes, the others stay put.
  const shown = useMemo(() => {
    const at = new Map(nodes.map((n) => [n.id, n]));
    return map.nodes.map(
      (box) =>
        ({
          ...(at.get(box.id) ?? {
            id: box.id,
            type: "box",
            position: first[box.id] ?? { x: 0, y: 0 },
          }),
          data: { box, people: box.id === PEOPLE && !ir.models.some((m) => m.name === PEOPLE) },
        }) as Node<BoxData>,
    );
  }, [map, nodes, first, ir]);
  const edges: Edge[] = map.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: e.kind === "owner" ? { strokeDasharray: "6 4" } : undefined,
    labelStyle: { fontSize: 11 },
  }));
  return (
    <section aria-label="Data map" className="h-[70vh] min-h-96 p-3">
      <p className="mb-2 text-xs text-muted">
        The kinds of record and how they refer to each other; a dashed arrow says whose a record is.
        Drag a box to move it; a name opens it in Behavior.
      </p>
      <div className="h-full rounded border border-line">
        <ReactFlow
          nodes={shown}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={(changes: NodeChange<Node<BoxData>>[]) =>
            // On the latest boxes, so changes in one batch build on each other.
            setNodes((current) => {
              const next = applyNodeChanges(changes, current.length ? current : shown);
              // A drag ended: the boxes keep their places in this browser.
              if (changes.some((c) => c.type === "position" && c.dragging === false))
                writePlaces(app, next);
              return next;
            })
          }
          nodesConnectable={false}
          edgesFocusable={false}
          fitView
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}
