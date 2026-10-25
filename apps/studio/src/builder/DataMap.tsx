// No code's Data map (A 127, the app map's first view; read-only): the app's kinds of record as
// boxes, their fields folded, and the references and ownership between them as labelled arrows.
// A first layout by dagre; boxes moved by hand keep their place in this browser. A click on a
// box's name opens Behavior at that kind of record. Nothing is changed from the map.
import {
  applyNodeChanges,
  Background,
  BaseEdge,
  Controls,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
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
import { type MapEdge, type MapNode, mapOf, PEOPLE } from "./data-map";
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
      {box.alone && (
        // No arrow reaches it: where its records come from and go instead (A 164).
        <p className="border-t border-line px-2 py-1 text-muted">{aloneNote(box)}</p>
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

/** The note a lone box carries (A 164), in the words the box shows. */
const aloneNote = (box: MapNode) =>
  box.alone
    ? [
        "No other kind refers to it.",
        box.alone.from.length > 0 && `From ${box.alone.from.join(", ")}.`,
        box.alone.shown.length > 0 && `Shown on ${box.alone.shown.join(", ")}.`,
        box.alone.actions.length > 0 && `Actions: ${box.alone.actions.join(", ")}.`,
      ]
        .filter(Boolean)
        .join(" ")
    : "";

/** Boxes taller than the rest, for the layout: a maker line and a note take rows of their own. */
const heights = (nodes: MapNode[]) =>
  Object.fromEntries(
    nodes.map((n) => [
      n.id,
      HEIGHT + (n.madeBy ? 28 : 0) + (n.alone ? 12 + 16 * Math.ceil(aloneNote(n).length / 30) : 0),
    ]),
  );

/** Where an end's mark sits: beside the arrow, a little way out from the box it touches. */
const beside = (x: number, y: number, side: Position): [number, number] =>
  side === Position.Bottom
    ? [x + 12, y + 12]
    : side === Position.Top
      ? [x + 12, y - 14]
      : side === Position.Right
        ? [x + 14, y - 10]
        : [x - 16, y - 10];

/**
 * A reference as UML draws it (A 165): the field's name in the middle and how many at each end
 * (`*`, `1`, `0..1`), with the relation in words as the hover title.
 */
function Ends(props: EdgeProps<Edge<{ edge: MapEdge }>>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  if (!data) return null;
  const { edge } = data;
  const title = `${edge.relation}: each ${edge.source} refers to ${edge.ends[1] === "1" ? "one" : "at most one"} ${edge.target}, and ${edge.ends[0] === "*" ? "a" : "at most one"} ${edge.target} ${edge.ends[0] === "*" ? "has any number of them" : "to it"}`;
  const at = (xy: [number, number]) => ({
    transform: `translate(-50%, -50%) translate(${xy[0]}px, ${xy[1]}px)`,
  });
  return (
    <>
      <BaseEdge path={path} markerEnd={props.markerEnd} style={props.style} />
      <EdgeLabelRenderer>
        <div
          title={title}
          className="nodrag nopan absolute rounded bg-panel px-1 text-[11px]"
          style={{ ...at([labelX, labelY]), pointerEvents: "all" }}
        >
          {edge.label}
        </div>
        {([0, 1] as const).map((end) => (
          <div
            key={end}
            title={title}
            className="nodrag nopan absolute font-medium text-[11px]"
            style={{
              ...at(
                end
                  ? beside(targetX, targetY, targetPosition)
                  : beside(sourceX, sourceY, sourcePosition),
              ),
              pointerEvents: "all",
            }}
          >
            {edge.ends[end]}
          </div>
        ))}
      </EdgeLabelRenderer>
    </>
  );
}

const edgeTypes = { ends: Ends };

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
        heights(map.nodes),
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
    type: "ends",
    data: { edge: e },
    markerEnd: { type: MarkerType.ArrowClosed },
    style: e.kind === "owner" ? { strokeDasharray: "6 4" } : undefined,
  }));
  return (
    <section aria-label="Data map" className="flex h-full min-h-0 flex-col p-3">
      <div className="mb-2 flex items-end justify-between gap-2">
        <p className="text-xs text-muted">
          The kinds of record and how they refer to each other, with how many at each end (* any
          number, 1 one, 0..1 at most one); a dashed arrow says whose a record is. Drag a box to
          move it; a name opens it in Behavior.
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
            edgeTypes={edgeTypes}
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
