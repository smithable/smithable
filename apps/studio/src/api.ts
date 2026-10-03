import type { ThemeIR } from "@smithable/core";
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
  /** The operation, for the Builder to word it like its summary. */
  operation?: { op: string; args: Record<string, unknown> };
}

export interface Project {
  name: string;
  files: { spec?: string; auth?: string; content?: string; ux?: string };
  /** The themes the ux file may name: built in or the project's, each with its picture (an SVG). */
  themes: { name: string; source: "built-in" | "project"; font: string; thumbnail: string }[];
  /** The project's own themes (themes/<name>.yml), parsed: `theme.preset` may name them. */
  ownThemes: ThemeIR[];
  /** The project's plugins, which the engine imports from /api/plugins/<name>.mjs. */
  plugins: { name: string; version: number }[];
  concepts: ConceptInfo[];
  trace: TraceEntry[];
  preview: string;
  /** Where the project's publishing and settings live, when Studio is hosted. */
  home?: string;
  /** A message for the first to open Studio, e.g. why a description could not be used. */
  notice?: string;
}

/** A model's proposal for a request; nothing is applied until it is confirmed. */
/** `id` names the proposal for applying it: only the one shown can be applied. */
export type Proposal = { usage: string; id: string } & (
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
  /** A question about the app, answered (docs/design/studio-v2.md §4). */
  | { kind: "answer"; text: string; concepts: string[] }
  | { kind: "none"; reason: string }
  | { kind: "failed"; message: string }
);

export interface Result {
  ok: boolean;
  output: string;
  /** A change that loses data: ask, then send it again confirmed. */
  needsConfirm?: boolean;
  /** A failure: its report was sent (the person chose "always"), or can be offered. */
  report?: "sent" | "offer";
}

/**
 * Studio's own API. An answer that is not OK (a refusal, the workspace restarting, a proxy's
 * plain-text error) throws an Error with a readable message; callers show it.
 */
async function call<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined
      ? {}
      : {
          // Studio's own header: the daemon takes changes only with it (a form elsewhere can't send it).
          headers: { "Content-Type": "application/json", "X-Smithable": "1" },
          body: JSON.stringify(body),
        }),
  });
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(text.trim() || `Studio answered ${response.status}.`);
  }
  if (!response.ok) {
    const answer = parsed as { output?: string; message?: string };
    throw new Error(answer.output ?? answer.message ?? `Studio answered ${response.status}.`);
  }
  return parsed as T;
}

/**
 * A change that went through will reload the preview, once the daemon says the app took it in
 * ("changed", a few seconds later): until then the preview is updating (see Preview).
 */
export const EXPECT_RELOAD = "smithable:expect-reload";
const changing = async (result: Promise<Result>) => {
  const r = await result;
  if (r.ok) window.dispatchEvent(new Event(EXPECT_RELOAD));
  return r;
};

export const api = {
  project: () => call<Project>("/api/project"),
  logs: () => call<string[]>("/api/logs"),
  diff: () => call<{ patch: string }>("/api/diff"),
  operation: (name: string, args: Record<string, unknown>, confirm = false) =>
    changing(call<Result>("/api/op", { name, args, confirm })),
  customize: (page: string) => changing(call<Result>("/api/customize", { page })),
  undo: () => changing(call<Result>("/api/undo", {})),
  /** The report of the last failure, exactly as it would be sent, and the person's choice. */
  report: () => call<{ text?: string; choice: "always" | "never" | "ask" }>("/api/report"),
  sendReport: (send: boolean, choice?: "always" | "never" | "ask") =>
    call<{ ok: boolean; sent?: true; url?: string; message?: string }>("/api/report", {
      send,
      choice,
    }),
  ask: (request: string) => call<Proposal>("/api/ask", { request }),
  applyProposal: (id: string) => changing(call<Result>("/api/ask/apply", { id })),
  /** Calls `onEvent` for every change and log line the daemon reports. */
  events(onEvent: (event: "changed" | "log" | "open", data: unknown) => void): () => void {
    const source = new EventSource("/api/events");
    // Also after a reconnect: whatever changed meanwhile is fetched again.
    source.addEventListener("open", () => onEvent("open", null));
    source.addEventListener("changed", (e) =>
      onEvent("changed", JSON.parse((e as MessageEvent).data)),
    );
    source.addEventListener("log", (e) => onEvent("log", JSON.parse((e as MessageEvent).data)));
    return () => source.close();
  },
};
