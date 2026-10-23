// dagre's layout for the app map's tree-like views (Navigation, Behaviour): top to bottom, the
// boxes all one size, each box's top left corner as React Flow places it.
import { graphlib, layout } from "@dagrejs/dagre";

export function laidOut(
  ids: string[],
  edges: { source: string; target: string }[],
  size: { width: number; height: number },
): Record<string, { x: number; y: number }> {
  const g = new graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 32, ranksep: 70 });
  g.setDefaultEdgeLabel(() => ({}));
  // A label of its own for each node: dagre writes the node's place onto it.
  for (const id of ids) g.setNode(id, { ...size });
  for (const e of edges)
    if (ids.includes(e.source) && ids.includes(e.target)) g.setEdge(e.source, e.target);
  layout(g);
  return Object.fromEntries(
    ids.map((id) => {
      const at = g.node(id);
      return [id, { x: at.x - size.width / 2, y: at.y - size.height / 2 }];
    }),
  );
}
