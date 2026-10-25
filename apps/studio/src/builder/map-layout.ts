// dagre's layout for the app map's views, and the direction they take from their box: top to
// bottom when the box is taller than wide, left to right when it is wider (Johan, 2026-10-24),
// laid out again when the box changes shape.
import { graphlib, layout } from "@dagrejs/dagre";
import { createContext, type RefObject, useEffect, useState } from "react";

export type Direction = "TB" | "LR";

export function laidOut(
  ids: string[],
  edges: { source: string; target: string }[],
  size: { width: number; height: number },
  direction: Direction = "TB",
  spacing: { nodesep: number; ranksep: number } = { nodesep: 32, ranksep: 70 },
  /** A box taller than `size` (a data map box with a note), by id. */
  heights: Record<string, number> = {},
): Record<string, { x: number; y: number }> {
  const g = new graphlib.Graph();
  g.setGraph({ rankdir: direction, ...spacing });
  g.setDefaultEdgeLabel(() => ({}));
  // A label of its own for each node: dagre writes the node's place onto it.
  for (const id of ids) g.setNode(id, { width: size.width, height: heights[id] ?? size.height });
  for (const e of edges)
    if (ids.includes(e.source) && ids.includes(e.target)) g.setEdge(e.source, e.target);
  layout(g);
  return Object.fromEntries(
    ids.map((id) => {
      const at = g.node(id);
      return [id, { x: at.x - size.width / 2, y: at.y - (heights[id] ?? size.height) / 2 }];
    }),
  );
}

/** The box's direction, followed as it is resized. */
export function useDirection(box: RefObject<HTMLElement | null>): Direction {
  const [direction, setDirection] = useState<Direction>("TB");
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setDirection(width > height ? "LR" : "TB");
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [box]);
  return direction;
}

/** What a map's boxes need from the map: its direction (where their arrows join) and how a name opens. */
export const MapView = createContext<{ horizontal: boolean; open: (concept: string) => void }>({
  horizontal: false,
  open: () => {},
});
