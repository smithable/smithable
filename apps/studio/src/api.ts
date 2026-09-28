import type { ConceptInfo } from "@smithable/index";

/** The change trace (ARCHITECTURE §9.7), as `smithable studio` reports it. */
export interface TraceEntry {
  description: string;
  at: string;
  engine: "generator" | "local model" | "Smithable model" | "frontier model";
  model?: string;
  tokens: number;
  cost?: number;
  currency?: "EUR" | "USD";
  ms?: number;
  undone: boolean;
  isUndo: boolean;
}

export interface Project {
  name: string;
  files: { spec?: string; auth?: string; content?: string };
  /** The project's plugins, which the engine imports from /api/plugins/<name>.mjs. */
  plugins: { name: string; version: number }[];
  concepts: ConceptInfo[];
  trace: TraceEntry[];
  preview: string;
  /** Where the project's publishing and settings live, when Studio is hosted. */
  home?: string;
}

/** A model's proposal for a request; nothing is applied until it is confirmed. */
export type Proposal = { usage: string } & (
  | {
      kind: "change";
      operations: {
        op: string;
        args: Record<string, unknown>;
        description: string;
        destructive: boolean;
      }[];
    }
  | { kind: "question"; question: string; options: string[] }
  | { kind: "none"; reason: string }
  | { kind: "failed"; message: string }
);

export interface Result {
  ok: boolean;
  output: string;
  /** A change that loses data: ask, then send it again confirmed. */
  needsConfirm?: boolean;
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  return (await response.json()) as T;
}

export const api = {
  project: () => call<Project>("/api/project"),
  logs: () => call<string[]>("/api/logs"),
  diff: () => call<{ patch: string }>("/api/diff"),
  operation: (name: string, args: Record<string, unknown>, confirm = false) =>
    call<Result>("/api/op", { name, args, confirm }),
  customize: (page: string) => call<Result>("/api/customize", { page }),
  undo: () => call<Result>("/api/undo", {}),
  ask: (request: string) => call<Proposal>("/api/ask", { request }),
  applyProposal: () => call<Result>("/api/ask/apply", {}),
  /** Calls `onEvent` for every change and log line the daemon reports. */
  events(onEvent: (event: "changed" | "log", data: unknown) => void): () => void {
    const source = new EventSource("/api/events");
    source.addEventListener("changed", (e) =>
      onEvent("changed", JSON.parse((e as MessageEvent).data)),
    );
    source.addEventListener("log", (e) => onEvent("log", JSON.parse((e as MessageEvent).data)));
    return () => source.close();
  },
};
