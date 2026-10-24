// No code's Data map (A 127, the app map's first view; read-only): the app's kinds of record as
// boxes, their fields folded, and the references and ownership between them as labelled arrows.
// A first layout by dagre; boxes moved by hand keep their place in this browser. A click on a
// box's name opens Behavior at that kind of record. Nothing is changed from the map.
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
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../ui";
import { type MapNode, mapOf, PEOPLE } from "./data-map";
import { type Direction, laidOut, MapView, useDirection } from "./map-layout";
import { dataMermaid } from "./mermaid";

const WIDTH = 200;
const HEIGHT = 56;
const ROW = 20;

type BoxData = { box: MapNode; people: boolean };

/** Where the boxes were moved to, kept per app and direction in this browser. */
const placesKey = (app: string, direction: Direction) =>
  `smithable:data-map:${app}${direction === "LR" ? ":LR" : ""}`;
const readPlaces = (
  app: string,
  direction: Direction,
): Record<string, { x: number; y: number }> => {
  try {
    return JSON.parse(window.localStorage.getItem(placesKey(app, direction)) ?? "{}");
  } catch {
    return {};
  }
};
const writePlaces = (app: string, direction: Direction, nodes: Node[]) => {
  try {
    window.localStorage.setItem(
      placesKey(app, direction),
      JSON.stringify(Object.fromEntries(nodes.map((n) => [n.id, n.position]))),
    );
  } catch {}
};

function Box({ data }: NodeProps<Node<BoxData>>) {
  const view = useContext(MapView);
  const [open, setOpen] = useState(false);
  const { box, people } = data;
  return (
    <div
      data-map-box={box.id}
      className="rounded border border-line bg-panel text-xs shadow-sm"
      style={{ width: WIDTH }}
    >
      <Handle type="target" position={view.horizontal ? Position.Left : Position.Top} />
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        {people ? (
          <span className="font-semibold">{box.id}: the people who sign in</span>
        ) : (
          <button
            type="button"
            className="nodrag font-semibold text-accent hover:underline"
            title={`Open ${box.id} in Behavior`}
            onClick={() => view.open(`model:${box.id}`)}
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
      {box.madeBy && (
        <p className="border-t border-line px-2 py-1 text-muted">Each is its maker's own.</p>
      )}
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
      <Handle type="source" position={view.horizontal ? Position.Right : Position.Bottom} />
    </div>
  );
}

const nodeTypes = { box: Box };

export function DataMap({
  ir,
  auth,
  onOpen,
}: {
  ir: SpecIR;
  auth?: AuthIR;
  onOpen: (concept: string) => void;
}) {
  const map = useMemo(() => mapOf(ir, auth), [ir, auth]);
  const app = ir.app.name;
  // The box's shape sets the direction: top to bottom when it is taller, left to right when wider.
  const box = useRef<HTMLDivElement>(null);
  const direction = useDirection(box);
  // dagre's first layout, the referring record before the one it refers to; room between the
  // ranks for an arrow's label ("accountManager (owns it)") and between boxes for the arrows.
  const first = useMemo(
    () =>
      laidOut(
        map.nodes.map((n) => n.id),
        map.edges,
        { width: WIDTH, height: HEIGHT },
        direction,
        { nodesep: 48, ranksep: 110 },
      ),
    [map, direction],
  );
  // The boxes for the map as it is now: a box keeps its place, one for a kind of record added
  // since starts where dagre put it (or where it was last left), a removed one goes.
  const synced = useCallback(
    (current: Node<BoxData>[]) => {
      const at = new Map(current.map((n) => [n.id, n]));
      const kept = readPlaces(app, direction);
      return map.nodes.map(
        (box) =>
          ({
            ...(at.get(box.id) ?? {
              id: box.id,
              type: "box",
              position: kept[box.id] ?? first[box.id] ?? { x: 0, y: 0 },
            }),
            data: {
              box,
              people: box.id === PEOPLE && !ir.models.some((m) => m.name === PEOPLE),
            },
          }) as Node<BoxData>,
      );
    },
    [map, first, ir, app, direction],
  );
  const [nodes, setNodes] = useState<Node<BoxData>[]>(() => synced([]));
  // Another direction: every box starts again where that direction's layout, or a move in it, put it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only on a new direction
  useEffect(() => setNodes(synced([])), [direction]);
  const [copied, setCopied] = useState(false);
  const shown = useMemo(() => synced(nodes), [synced, nodes]);
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
    <section aria-label="Data map" className="flex h-full min-h-0 flex-col p-3">
      <div className="mb-2 flex items-end justify-between gap-2">
        <p className="text-xs text-muted">
          The kinds of record and how they refer to each other; a dashed arrow says whose a record
          is. Drag a box to move it; a name opens it in Behavior.
        </p>
        <Button
          variant="ghost"
          onClick={() =>
            void navigator.clipboard.writeText(dataMermaid(map)).then(() => setCopied(true))
          }
        >
          {copied ? "Copied" : "Copy as Mermaid"}
        </Button>
      </div>
      <div ref={box} className="min-h-0 flex-1 rounded border border-line">
        <MapView.Provider value={{ horizontal: direction === "LR", open: onOpen }}>
          <ReactFlow
            key={direction}
            nodes={shown}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={(changes: NodeChange<Node<BoxData>>[]) =>
              // On the latest boxes as the map is now, so changes in one batch build on each other
              // and a box added since moves too.
              setNodes((current) => {
                const next = applyNodeChanges(changes, synced(current));
                // A drag ended: the boxes keep their places in this browser.
                if (changes.some((c) => c.type === "position" && c.dragging === false))
                  writePlaces(app, direction, next);
                return next;
              })
            }
            nodesConnectable={false}
            edgesFocusable={false}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
            colorMode="system"
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </MapView.Provider>
      </div>
    </section>
  );
}
