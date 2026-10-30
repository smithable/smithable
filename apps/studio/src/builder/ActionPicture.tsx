// A custom action's picture on its Behavior page (intents.md §7, A 198): what it takes on the
// left, the kinds of record it reads and writes, the mails and calls it may send, as its contract
// says and nothing more; the What happens map's boxes, a view, not an editor.
import { type Edge, MarkerType, type Node, ReactFlow, useReactFlow, useStore } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { SpecIR } from "@smithable/core";
import { useEffect, useMemo } from "react";
import { HEIGHT, nodeTypes, WIDTH } from "./BehaviourMap";
import { type BehaviourNode, pictureOf } from "./behaviour-map";
import { laidOut, MapView } from "./map-layout";

const FIT = { padding: 0.1, maxZoom: 1 };

/**
 * Fits the view once the picture has a size, and again whenever it changes: it may be drawn
 * while its entry is still folded, when there is nothing to fit into.
 */
function Fit() {
  const flow = useReactFlow();
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  useEffect(() => {
    if (!width || !height) return;
    const frame = requestAnimationFrame(() => void flow.fitView(FIT));
    return () => cancelAnimationFrame(frame);
  }, [width, height, flow]);
  return null;
}

export function ActionPicture({
  ir,
  action,
  onOpen,
}: {
  ir: SpecIR;
  action: string;
  /** Opens a box's part ("model:Invoice") in Behavior. */
  onOpen: (concept: string) => void;
}) {
  const picture = useMemo(() => pictureOf(ir, action), [ir, action]);
  const { nodes, edges } = useMemo(() => {
    const at = laidOut(
      picture.nodes.map((n) => n.id),
      picture.edges,
      { width: WIDTH, height: HEIGHT },
      "LR",
    );
    return {
      nodes: picture.nodes.map(
        (box) =>
          ({
            id: box.id,
            type: "box",
            position: at[box.id] ?? { x: 0, y: 0 },
            data: { box },
          }) as Node<{ box: BehaviourNode }>,
      ),
      edges: picture.edges.map(
        (e): Edge => ({
          ...e,
          markerEnd: { type: MarkerType.ArrowClosed },
          labelStyle: { fontSize: 11 },
        }),
      ),
    };
  }, [picture]);
  // Something read or written: an empty contract says it reaches nothing, so nothing is drawn.
  const touches = ir.actions.some(
    (a) => a.name === action && a.custom && (a.touches?.reads.length || a.touches?.writes.length),
  );
  return (
    <figure data-part="action-picture" className="space-y-1">
      <figcaption className="text-xs text-muted">
        {touches
          ? "What it takes, reads, writes and may send, as its contract says. A name opens it."
          : "Its contract names nothing it reads or writes, so no kinds of record are drawn."}
      </figcaption>
      <div className="h-64 rounded border border-line">
        <MapView.Provider value={{ horizontal: true, open: onOpen }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesConnectable={false}
            nodesDraggable={false}
            edgesFocusable={false}
            panOnScroll={false}
            zoomOnScroll={false}
            fitView
            fitViewOptions={FIT}
            minZoom={0.2}
            colorMode="system"
          >
            <Fit />
          </ReactFlow>
        </MapView.Provider>
      </div>
    </figure>
  );
}
