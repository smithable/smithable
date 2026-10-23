// No code's What happens map (A 127, docs/design/app-map.md; read-only): what the app does by itself
// or at a press of a button. Kinds of record, their standard actions with what they need and set,
// custom actions as code Studio does not read, timers and what they run, and the mails and calls
// with what sets each off. A name opens it in Behavior; "Copy as Mermaid" gives it as text.
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
import type { SpecIR } from "@smithable/core";
import { useMemo, useState } from "react";
import { Button } from "../ui";
import { type BehaviourNode, behaviourOf } from "./behaviour-map";
import { laidOut } from "./map-layout";
import { behaviourMermaid } from "./mermaid";
import { OPEN_PART } from "./NoCode";

const WIDTH = 210;
const HEIGHT = 72;

/** What each kind of box is, in words above its name. */
const KIND: Record<BehaviourNode["kind"], string> = {
  model: "Kind of record",
  action: "Action",
  custom: "Action, custom code",
  timer: "Timer",
  outgoing: "Mail or call",
};
/** Where a box opens in Behavior. */
const PART: Record<BehaviourNode["kind"], string> = {
  model: "model",
  action: "action",
  custom: "action",
  timer: "timer",
  outgoing: "outgoing",
};

function Box({ data }: NodeProps<Node<{ box: BehaviourNode }>>) {
  const { box } = data;
  return (
    <div
      data-behaviour-box={box.id}
      className={`rounded border bg-panel px-2 py-1.5 text-xs shadow-sm ${box.kind === "custom" ? "border-dashed border-line-strong" : "border-line"}`}
      style={{ width: WIDTH }}
    >
      <Handle type="target" position={Position.Top} />
      <p className="text-[10px] uppercase tracking-wide text-quiet">{KIND[box.kind]}</p>
      <button
        type="button"
        className="nodrag font-semibold text-accent hover:underline"
        title={`Open ${box.title} in Behavior`}
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent(OPEN_PART, { detail: `${PART[box.kind]}:${box.title}` }),
          )
        }
      >
        {box.title}
      </button>
      {box.lines.map((line) => (
        <p key={line} className="text-muted">
          {line}
        </p>
      ))}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { box: Box };

export function BehaviourMap({ ir }: { ir: SpecIR }) {
  const map = useMemo(() => behaviourOf(ir), [ir]);
  const { nodes, edges } = useMemo(() => {
    const at = laidOut(
      map.nodes.map((n) => n.id),
      map.edges,
      { width: WIDTH, height: HEIGHT },
    );
    return {
      nodes: map.nodes.map(
        (box) =>
          ({
            id: box.id,
            type: "box",
            position: at[box.id] ?? { x: 0, y: 0 },
            data: { box },
          }) as Node<{ box: BehaviourNode }>,
      ),
      edges: map.edges.map(
        (e): Edge => ({
          ...e,
          markerEnd: { type: MarkerType.ArrowClosed },
          labelStyle: { fontSize: 11 },
        }),
      ),
    };
  }, [map]);
  const [copied, setCopied] = useState(false);
  return (
    <section aria-label="What happens" className="h-[70vh] min-h-96 p-3">
      <div className="mb-2 flex items-end justify-between gap-2">
        <p className="text-xs text-muted">
          What the app does by itself or at a press of a button: actions and what they set, timers,
          and the mails and calls with what sets them off. A dashed box is custom code. A name opens
          it in Behavior.
        </p>
        <Button
          variant="ghost"
          onClick={() =>
            void navigator.clipboard.writeText(behaviourMermaid(map)).then(() => setCopied(true))
          }
        >
          {copied ? "Copied" : "Copy as Mermaid"}
        </Button>
      </div>
      {map.nodes.length === 0 ? (
        <p className="text-sm text-quiet">
          The app has no actions, timers, mails or calls yet: it does what its pages do.
        </p>
      ) : (
        <div className="h-full rounded border border-line">
          <ReactFlow
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
        </div>
      )}
    </section>
  );
}
