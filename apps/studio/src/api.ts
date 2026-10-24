import type { ThemeIR } from "@smithable/core";
import type { ConceptInfo } from "@smithable/index";

/** The change trace (ARCHITECTURE §9.7), as `smithable studio` reports it. */
export interface TraceEntry {
  /** The change's commit. */
  id: string;
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
  /** The files it changed that a person edits (the spec files, src/custom/**). */
  files: string[];
  /** The generated files under src/ it rewrote. */
  rewritten: string[];
  /** What the person asked a model, for a change it made. */
  request?: string;
}

/** One change opened: its patch, how many generated files it changed, the files before and after. */
export interface ChangeDetail {
  patch: string;
  generated: number;
  before: Project["files"];
  after: Project["files"];
}

/** A described app being made (docs/design/while-it-is-made.md). */
export interface Making {
  description: string;
  stage: "reading" | "asking" | "drafting" | "building" | "arriving" | "failed";
  /** While "asking": what the description leaves open, at most three. */
  questions?: { about?: string; question: string; options: string[] }[];
  /** When it started (ISO time). */
  since: string;
  /** How long a draft usually takes, in ms. */
  usual?: number;
  /** The drafted app, once the model has answered. */
  files?: Project["files"];
  /** What went wrong, when it failed. */
  error?: string;
}

export interface Project {
  name: string;
  files: {
    spec?: string;
    auth?: string;
    content?: string;
    ux?: string;
    context?: string;
    /** The app's other languages' files (smithable.content.<language>.yml), by language. */
    translations?: Record<string, string>;
  };
  /** The themes the ux file may name: built in or the project's, each with its picture (an SVG). */
  themes: { name: string; source: "built-in" | "project"; font: string; thumbnail: string }[];
  /** The project's own themes (themes/<name>.yml), parsed: `theme.preset` may name them. */
  ownThemes: ThemeIR[];
  /** The project's plugins, which the engine imports from /api/plugins/<name>.mjs. */
  plugins: { name: string; version: number }[];
  concepts: ConceptInfo[];
  trace: TraceEntry[];
  /** Redo would make again the last change undone (none made since). */
  canRedo?: boolean;
  preview: string;
  /** Where the project's publishing and settings live, when Studio is hosted. */
  home?: string;
  /** A message for the first to open Studio, e.g. why a description could not be used. */
  notice?: string;
  /** A described app being made: until it is gone, `files` and `name` are a placeholder's. */
  making?: Making;
  /** Requests typed while the app was made, made in order once it is in place. */
  waiting?: string[];
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
  /** For an editSpec: the newest change's id after it (grown or new), for the editor to grow. */
  change?: string;
}

/** A hosted workspace waking: starting, preparing its packages first, or every one busy. */
export type Waking = "starting" | "preparing" | "busy" | undefined;
let wakingNow: Waking;
const wakingListeners = new Set<() => void>();
export const waking = {
  set(next: Waking) {
    if (next === wakingNow) return;
    wakingNow = next;
    for (const listener of wakingListeners) listener();
  },
  get: () => wakingNow,
  subscribe(listener: () => void) {
    wakingListeners.add(listener);
    return () => {
      wakingListeners.delete(listener);
    };
  },
};

/**
 * Studio's own API. An answer that is not OK (a refusal, the workspace restarting, a proxy's
 * plain-text error) throws an Error with a readable message; callers show it.
 */
async function call<T>(path: string, body?: unknown): Promise<T> {
  const send = () =>
    fetch(path, {
      method: body === undefined ? "GET" : "POST",
      ...(body === undefined
        ? {}
        : {
            // Studio's own header: the daemon takes changes only with it (a form elsewhere can't send it).
            headers: { "Content-Type": "application/json", "X-Smithable": "1" },
            body: JSON.stringify(body),
          }),
    });
  // A hosted workspace that is waking answers 503 with x-smithable-workspace (the service, B 58):
  // the same request again after retry-after, with the bar at the top, never a reload; ten
  // minutes at most.
  let response: Response;
  try {
    response = await send();
    for (let tries = 0; response.status === 503 && tries < 300; tries++) {
      const state = response.headers.get("x-smithable-workspace");
      if (state !== "starting" && state !== "busy") break;
      const answer = (await response.json().catch(() => ({}))) as { preparing?: boolean };
      waking.set(state === "busy" ? "busy" : answer.preparing ? "preparing" : "starting");
      const after = Number(response.headers.get("retry-after")) || 2;
      await new Promise((r) => setTimeout(r, after * 1000));
      response = await send();
    }
  } finally {
    // A send that failed outright ends the wait too: the bar never stays.
    waking.set(undefined);
  }
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
/** The change the last editSpec made or grew, as the server said. */
let latestChange: string | undefined;
export const lastChange = () => latestChange;

const changing = async (result: Promise<Result>) => {
  const r = await result;
  if (r.ok) window.dispatchEvent(new Event(EXPECT_RELOAD));
  latestChange = r.ok ? r.change : undefined;
  return r;
};

/** A mail the preview kept instead of sending (cli/src/outbox.ts). */
export interface KeptMail {
  file: string;
  at: string;
  to: string;
  subject: string;
  text: string;
}

export const api = {
  project: () => call<Project>("/api/project"),
  logs: () => call<string[]>("/api/logs"),
  outbox: () => call<KeptMail[]>("/api/outbox"),
  change: (id: string, all = false) => call<ChangeDetail>(`/api/change/${id}${all ? "?all" : ""}`),
  /** `file`: a picture the change brings, written under its path in the project (base64). */
  operation: (
    name: string,
    args: Record<string, unknown>,
    confirm = false,
    file?: { path: string; data: string },
  ) => changing(call<Result>("/api/op", { name, args, confirm, file })),
  customize: (page: string) => changing(call<Result>("/api/customize", { page })),
  /** The language's empty texts drafted by the configured model (smithable translate). */
  translate: (language: string) => changing(call<Result>("/api/translate", { language })),
  undo: () => changing(call<Result>("/api/undo", {})),
  /** One change undone by its id (studio-v3.md §3): an earlier one as a new change, or refused. */
  undoChange: (change: string, confirm = false) =>
    changing(call<Result>("/api/undo", { change, confirm })),
  redo: () => changing(call<Result>("/api/redo", {})),
  /** The report of the last failure, exactly as it would be sent, and the person's choice. */
  report: () => call<{ text?: string; choice: "always" | "never" | "ask" }>("/api/report"),
  sendReport: (send: boolean, choice?: "always" | "never" | "ask") =>
    call<{ ok: boolean; sent?: true; url?: string; message?: string }>("/api/report", {
      send,
      choice,
    }),
  /** The preview did not answer: its last log lines, and whether a report is offered or sent. */
  previewStuck: () => call<{ log: string[]; report?: "sent" | "offer" }>("/api/preview/stuck", {}),
  previewAnswers: () => call<{ ok: boolean }>("/api/preview/answers"),
  /** Starts the preview's server again; `why` goes to the log. */
  previewRestart: (why?: string) => call<{ ok: boolean }>("/api/preview/restart", { why }),
  /** A request, with the conversation so far and the docs' parts found for it (A 152). */
  ask: (
    request: string,
    around: {
      conversation?: { request: string; reply: string }[];
      docs?: { title: string; url: string; text: string }[];
    } = {},
  ) => call<Proposal>("/api/ask", { request, ...around }),
  /** Smith's thread lines that left no change, kept by Studio while it runs; one more with `line`. */
  said: (line?: { request: string; reply: string }) =>
    call<{ said: { at: string; request: string; reply: string }[] }>("/api/said", line),
  applyProposal: (id: string) => changing(call<Result>("/api/ask/apply", { id })),
  /** Calls `onEvent` for every change and log line the daemon reports. */
  /** Tries again to make the described app, as it was asked. */
  retryMaking: () => call<{ ok: boolean }>("/api/making/retry", {}),
  /** The answers to the making's questions, in their order ("" for one skipped). */
  answerMaking: (answers: string[]) => call<{ ok: boolean }>("/api/making/answer", { answers }),
  /** Keeps a request for when the app is in place, or takes one back. */
  waiting: (change: { add: string } | { remove: number }) =>
    call<{ ok: boolean; waiting: string[] }>("/api/waiting", change),
  events(
    onEvent: (event: "changed" | "log" | "open" | "making" | "waiting", data: unknown) => void,
  ): () => void {
    const source = new EventSource("/api/events");
    // Also after a reconnect: whatever changed meanwhile is fetched again.
    source.addEventListener("open", () => onEvent("open", null));
    source.addEventListener("changed", (e) =>
      onEvent("changed", JSON.parse((e as MessageEvent).data)),
    );
    source.addEventListener("log", (e) => onEvent("log", JSON.parse((e as MessageEvent).data)));
    source.addEventListener("making", (e) =>
      onEvent("making", JSON.parse((e as MessageEvent).data)),
    );
    source.addEventListener("waiting", (e) =>
      onEvent("waiting", JSON.parse((e as MessageEvent).data)),
    );
    return () => source.close();
  },
};
