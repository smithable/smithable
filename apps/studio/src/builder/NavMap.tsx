// No code's Navigation map (A 127, docs/design/app-map.md; read-only): the app's menus and pages
// as a tree, and for a role chosen above it (or a visitor) whether each page may be opened and its
// records read, from core's explainAccess. A page's name opens it in Behavior; "Copy as Mermaid"
// gives the same tree as text. Nothing is changed from the map.
import {
  Background,
  Controls,
  type Edge,
  Handle,
  MarkerType,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { AuthIR, SpecIR } from "@smithable/core";
import { useContext, useMemo, useRef, useState } from "react";
import { Button, Label, Select } from "../ui";
import { laidOut, MapView, useDirection } from "./map-layout";
import { navMermaid } from "./mermaid";
import { type NavPage, navOf, type Verdict } from "./nav-map";

const WIDTH = 190;
const HEIGHT = 76;

const WORD: Record<Verdict, string> = { allowed: "yes", denied: "no", conditional: "depends" };
const TONE: Record<Verdict, string> = {
  allowed: "border-line",
  denied: "border-dashed border-line opacity-60",
  conditional: "border-amber-500",
};

type BoxData = { label: string; page?: NavPage };

function Box({ data }: NodeProps<Node<BoxData>>) {
  const view = useContext(MapView);
  const { label, page } = data;
  return (
    <div
      data-nav-box={page?.id ?? label}
      className={`rounded border bg-panel px-2 py-1.5 text-xs shadow-sm ${page ? TONE[page.open] : "border-line font-semibold"}`}
      style={{ width: WIDTH }}
    >
      <Handle type="target" position={view.horizontal ? Position.Left : Position.Top} />
      {page ? (
        <>
          <button
            type="button"
            className="nodrag font-semibold text-accent hover:underline"
            title={`Open the ${page.id} page in Behavior`}
            onClick={() => view.open(`page:${page.id}`)}
          >
            {page.id}
          </button>
          <p className="text-muted">Opens: {WORD[page.open]}</p>
          {page.read && (
            <p className="text-muted">
              Reads {page.model}: {WORD[page.read]}
            </p>
          )}
        </>
      ) : (
        label
      )}
      <Handle type="source" position={view.horizontal ? Position.Right : Position.Bottom} />
    </div>
  );
}

const nodeTypes = { box: Box };

export function NavMap({
  ir,
  auth,
  onOpen,
}: {
  ir: SpecIR;
  auth?: AuthIR;
  onOpen: (concept: string) => void;
}) {
  // The box's shape sets the direction: top to bottom when it is taller, left to right when wider.
  const box = useRef<HTMLDivElement>(null);
  const direction = useDirection(box);
  const signIn = Boolean(auth && auth.signIn !== "none");
  const roles = auth?.roles.map((r) => r.name) ?? [];
  // A role's view, or a visitor's (""); an app without sign-in is everyone's.
  const [as, setAs] = useState(roles[0] ?? "");
  const nav = useMemo(() => navOf(ir, auth, as || undefined), [ir, auth, as]);
  const who = !signIn ? "everyone" : as ? `${as}` : "a visitor";
  const { nodes, edges } = useMemo(() => {
    const boxes: Node<BoxData>[] = [
      { id: "app", type: "box", position: { x: 0, y: 0 }, data: { label: `The app, as ${who}` } },
      ...nav.menus.map((menu, i) => ({
        id: `menu:${i}`,
        type: "box",
        position: { x: 0, y: 0 },
        data: { label: `Menu: ${menu}` },
      })),
      ...nav.pages.map((page) => ({
        id: `page:${page.id}`,
        type: "box",
        position: { x: 0, y: 0 },
        data: { label: page.id, page },
      })),
    ];
    const lines: Edge[] = [
      ...nav.menus.map((_, i) => ({ id: `app-menu:${i}`, source: "app", target: `menu:${i}` })),
      ...nav.pages.map((page) => {
        const menu = page.menu === undefined ? -1 : nav.menus.indexOf(page.menu);
        return {
          id: `to:${page.id}`,
          source: menu >= 0 ? `menu:${menu}` : "app",
          target: `page:${page.id}`,
          // A page in no menu is reached by a link only.
          ...(menu < 0 ? { style: { strokeDasharray: "6 4" }, label: "a link only" } : {}),
        };
      }),
    ].map((e) => ({
      ...e,
      markerEnd: { type: MarkerType.ArrowClosed },
      labelStyle: { fontSize: 11 },
    }));
    const at = laidOut(
      boxes.map((b) => b.id),
      lines,
      { width: WIDTH, height: HEIGHT },
      direction,
    );
    for (const b of boxes) b.position = at[b.id] ?? b.position;
    return { nodes: boxes, edges: lines };
  }, [nav, who, direction]);
  const [copied, setCopied] = useState(false);
  return (
    <section aria-label="Navigation map" className="flex h-full min-h-0 flex-col p-3">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <p className="text-xs text-muted">
          The menus and their pages, and whether each page opens and its records can be read; a
          dashed box is closed to this role. A name opens it in Behavior.
        </p>
        <div className="flex items-end gap-2">
          {signIn && (
            <Label text="As">
              <Select
                aria-label="As"
                value={as}
                onChange={(e) => setAs(e.target.value)}
                options={[...roles.map((r) => [r, r] as [string, string]), ["", "A visitor"]]}
              />
            </Label>
          )}
          <Button
            variant="ghost"
            onClick={() =>
              void navigator.clipboard.writeText(navMermaid(nav, who)).then(() => setCopied(true))
            }
          >
            {copied ? "Copied" : "Copy as Mermaid"}
          </Button>
        </div>
      </div>
      <div ref={box} className="min-h-0 flex-1 rounded border border-line">
        <MapView.Provider value={{ horizontal: direction === "LR", open: onOpen }}>
          <ReactFlow
            // Made again for another role, so the view fits the boxes again (fitView is the first draw's).
            key={`${who}:${direction}`}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesConnectable={false}
            nodesDraggable={false}
            edgesFocusable={false}
            fitView
            fitViewOptions={{ padding: 0.15 }}
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
