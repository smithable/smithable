import {
  currentLookHistory,
  currentLookReady,
  currentLookReply,
  type LookCommand,
  type LookReady,
  type LookRevision,
  parseLookReply,
} from "@smithable/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LookEditorHost } from "./LookEditor";

type Binding = LookRevision & {
  ready: LookReady;
  bound?: boolean;
  controller?: AbortController;
  input?: number;
  css?: string;
  saved?: string;
  timer?: ReturnType<typeof setTimeout>;
};
type Commit = {
  generation: string;
  frames: Set<HTMLIFrameElement>;
  resolve(): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
};
/** One binding per owned document. A WindowProxy alone cannot identify a reloaded document. */
export function useLookFrames(
  host: LookEditorHost,
  project: string | undefined,
  origin: string | undefined,
  frames: React.RefObject<Set<HTMLIFrameElement>>,
  css: string | undefined,
  mode: "light" | "dark",
  discovered: (frame: HTMLIFrameElement, path?: string, status?: string) => void,
  history: (direction: "undo" | "redo") => void,
  navigated: (frame: HTMLIFrameElement, path: string) => void,
) {
  const enabled = !!project;
  const [status, setStatus] = useState("Opening preview…");
  const current = useRef({ css, mode, discovered, history, navigated });
  current.current = { css, mode, discovered, history, navigated };
  const challenges = useRef(new Map<HTMLIFrameElement, string>());
  const tours = useRef(new Set<string>());
  const bindings = useRef(new Map<HTMLIFrameElement, Binding>());
  const commit = useRef<Commit | undefined>(undefined);
  const connected = useRef(new WeakSet<HTMLIFrameElement>());
  const connectionTimers = useRef(new Map<HTMLIFrameElement, ReturnType<typeof setTimeout>>());
  const clearConnection = useCallback((frame: HTMLIFrameElement) => {
    clearTimeout(connectionTimers.current.get(frame));
    connectionTimers.current.delete(frame);
  }, []);
  const armConnection = useCallback(
    (frame: HTMLIFrameElement) => {
      if (!enabled || frame.dataset.signIn !== undefined || connectionTimers.current.has(frame))
        return;
      for (const [old, timer] of connectionTimers.current)
        if (!old.isConnected) {
          clearTimeout(timer);
          connectionTimers.current.delete(old);
        }
      connectionTimers.current.set(
        frame,
        setTimeout(() => {
          connectionTimers.current.delete(frame);
          if (!frame.isConnected || !frames.current.has(frame)) return;
          bindings.current.get(frame)?.controller?.abort();
          setStatus("The preview did not connect. The draft is kept; reconnect to retry.");
          current.current.discovered(frame, undefined, "error");
        }, 20000),
      );
    },
    [enabled, frames],
  );
  const connect = (frame: HTMLIFrameElement) => {
    if (connected.current.has(frame)) return;
    connected.current.add(frame);
    armConnection(frame);
  };
  const send = useRef<(frame: HTMLIFrameElement, binding: Binding, reset?: boolean) => void>(
    () => {},
  );
  useEffect(() => {
    if (!enabled || !project || !origin) return;
    const controller = new AbortController();
    for (const frame of frames.current) armConnection(frame);
    const identity = (b: Binding) => ({
      version: 1 as const,
      session: b.session,
      project: b.project,
      document: b.document,
      page: b.page,
      generation: b.generation,
      revision: ++b.revision,
    });
    send.current = (frame, b, reset = false) => {
      const { css, mode } = current.current;
      const fingerprint = JSON.stringify([css, mode]);
      if (!css || (!reset && (b.css === fingerprint || b.saved === fingerprint))) return;
      b.css = fingerprint;
      const command: LookCommand = reset
        ? { ...identity(b), type: "look-reset", reason: "apply" }
        : { ...identity(b), type: "look-style", css, mode };
      clearTimeout(b.timer);
      b.timer = setTimeout(() => {
        if (bindings.current.get(frame) === b && b.revision === command.revision)
          setStatus("The preview did not acknowledge this draft. Reconnect its connection.");
      }, 20000);
      frame.contentWindow?.postMessage(command, origin);
      setStatus(reset ? "Checking saved preview…" : "Updating preview…");
    };
    const heard = async (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const frame = [...frames.current].find((f) => f.contentWindow === event.source);
      const reply = parseLookReply(event.data);
      if (!frame || !reply || reply.project !== project) return;
      if (reply.type === "look-awake") {
        const challenge = challenges.current.get(frame);
        if (challenge)
          frame.contentWindow?.postMessage({ type: "look-hello", version: 1, challenge }, origin);
        return;
      }
      if (reply.type === "look-ready") {
        if (
          !currentLookReady(
            reply,
            challenges.current.get(frame),
            bindings.current.get(frame)?.ready,
          )
        )
          return;
        if (frame.dataset.frame) current.current.navigated(frame, reply.page);
        const old = bindings.current.get(frame);
        if (
          !old?.session &&
          old?.ready.document === reply.document &&
          old.ready.page === reply.page &&
          old.ready.generation === reply.generation &&
          old.ready.status === reply.status
        )
          return;
        old?.controller?.abort();
        const b: Binding = {
          ...reply,
          session: "",
          revision: 0,
          ready: reply,
          controller: new AbortController(),
        };
        bindings.current.set(frame, b);
        armConnection(frame);
        if (reply.status !== "ready") {
          clearConnection(frame);
          const message =
            reply.status === "sign-in"
              ? "Sign in in this preview to view this page."
              : reply.status === "denied"
                ? "This page is unavailable to the current viewer."
                : "The preview is unavailable. Reload its connection.";
          setStatus(message);
          current.current.discovered(frame, undefined, reply.status);
          return;
        }
        try {
          const response =
            host.kind === "public"
              ? undefined
              : await host.request("/api/look-ticket", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    project,
                    document: reply.document,
                    generation: reply.generation,
                  }),
                  signal: AbortSignal.any([
                    controller.signal,
                    b.controller?.signal ?? controller.signal,
                  ]),
                });
          if (response && !response.ok)
            throw new Error("The preview session was refused. Reopen the editor.");
          const minted = response
            ? await response.json()
            : {
                ticket: "static-presentation",
                binding: { project, document: reply.document, session: crypto.randomUUID() },
              };
          if (bindings.current.get(frame) !== b || controller.signal.aborted || !frame.isConnected)
            return;
          if (
            typeof minted.ticket !== "string" ||
            minted.binding?.document !== reply.document ||
            minted.binding?.project !== project ||
            typeof minted.binding?.session !== "string"
          )
            throw new Error("The preview session was incomplete.");
          b.session = minted.binding.session;
          frame.contentWindow?.postMessage(
            {
              version: 1,
              type: "look-bind",
              project,
              document: b.document,
              session: b.session,
              ticket: minted.ticket,
              revision: b.revision,
            },
            origin,
          );
        } catch (error) {
          if (
            !controller.signal.aborted &&
            !b.controller?.signal.aborted &&
            bindings.current.get(frame) === b
          ) {
            clearConnection(frame);
            setStatus(String(error));
          }
        }
        return;
      }
      const b = bindings.current.get(frame);
      if (!b) return;
      if (reply.type === "look-history") {
        if (!currentLookHistory(reply, b, b.input) || !reply.direction || !reply.input) return;
        b.input = reply.input;
        current.current.history(reply.direction);
        return;
      }
      if (!currentLookReply(reply, b)) return;
      clearTimeout(b.timer);
      if (reply.type === "look-bound") {
        clearConnection(frame);
        b.bound = true;
        if (frame.dataset.discovery)
          frame.contentWindow?.postMessage(
            { ...identity(b), type: "look-discover", base: frame.dataset.base },
            origin,
          );
        else send.current(frame, b);
      } else if (reply.type === "look-record") {
        current.current.discovered(frame, reply.path, reply.status);
      } else if (reply.type === "look-applied") {
        if (commit.current?.frames.has(frame) && b.generation === commit.current.generation)
          send.current(frame, b, true);
        else {
          setStatus("Draft preview ready");
          const tour = frame.dataset.tour
            ? `${frame.dataset.frame}:${frame.dataset.tour}`
            : undefined;
          if (tour && !tours.current.has(tour)) {
            tours.current.add(tour);
            frame.contentWindow?.postMessage({ ...identity(b), type: "look-tour" }, origin);
          }
        }
      } else if (reply.type === "look-reset-done") {
        b.saved = b.css;
        const pending = commit.current;
        if (pending?.frames.delete(frame) && pending.frames.size === 0) {
          clearTimeout(pending.timer);
          commit.current = undefined;
          pending.resolve();
          setStatus("Saved preview ready");
        }
      } else if (reply.type === "look-failed") {
        setStatus(reply.error ?? "The preview could not finish. Reload its connection.");
        const pending = commit.current;
        if (pending) {
          clearTimeout(pending.timer);
          commit.current = undefined;
          pending.reject(new Error(reply.error ?? "Saved preview failed."));
        }
      }
    };
    window.addEventListener("message", heard);
    const renew = setInterval(() => {
      for (const frame of frames.current)
        frame.contentWindow?.postMessage(
          { version: 1, type: "look-hello", challenge: challenges.current.get(frame) },
          origin,
        );
    }, 90000);
    return () => {
      controller.abort();
      clearInterval(renew);
      window.removeEventListener("message", heard);
      for (const [frame, b] of bindings.current) {
        clearTimeout(b.timer);
        b.controller?.abort();
        frame.contentWindow?.postMessage(
          { ...identity(b), type: "look-reset", reason: "discard" },
          origin,
        );
      }
      bindings.current.clear();
      for (const timer of connectionTimers.current.values()) clearTimeout(timer);
      connectionTimers.current.clear();
      const pending = commit.current;
      if (pending) {
        clearTimeout(pending.timer);
        commit.current = undefined;
        pending.reject(new Error("The editor closed before its saved preview was ready."));
      }
    };
  }, [enabled, project, origin, host, frames, armConnection, clearConnection]);
  useEffect(() => {
    if (!enabled) return;
    current.current.css = css;
    current.current.mode = mode;
    for (const [frame, b] of bindings.current)
      if (b.bound && !frame.dataset.discovery) send.current(frame, b);
  }, [enabled, css, mode]);
  const loaded = (frame: HTMLIFrameElement) => {
    if (!enabled || !origin) return;
    bindings.current.get(frame)?.controller?.abort();
    bindings.current.delete(frame);
    armConnection(frame);
    challenges.current.set(frame, crypto.randomUUID());
    frame.contentWindow?.postMessage(
      { version: 1, type: "look-hello", challenge: challenges.current.get(frame) },
      origin,
    );
  };
  const waitCommitted = (generation: string) =>
    new Promise<void>((resolve, reject) => {
      if (!enabled) return resolve();
      const visible = new Set([...frames.current].filter((f) => f.isConnected && f.dataset.frame));
      if (!generation || !visible.size)
        return reject(new Error("The saved generation could not be checked. The draft is kept."));
      const timer = setTimeout(() => {
        commit.current = undefined;
        reject(
          new Error(
            "Saved, but the matching preview did not become ready. The draft is kept; reconnect before continuing.",
          ),
        );
      }, 30000);
      commit.current = { generation, frames: visible, resolve, reject, timer };
      setStatus("Waiting for the saved generation…");
      for (const frame of visible) {
        bindings.current.get(frame)?.controller?.abort();
        bindings.current.delete(frame);
        clearConnection(frame);
        armConnection(frame);
        challenges.current.delete(frame);
        const url = new URL(frame.src);
        url.searchParams.set("__sm_reload", crypto.randomUUID());
        frame.src = url.href;
      }
    });
  const reload = () => {
    for (const frame of frames.current) {
      bindings.current.get(frame)?.controller?.abort();
      bindings.current.delete(frame);
      clearConnection(frame);
      armConnection(frame);
      challenges.current.delete(frame);
      const url = new URL(frame.src);
      url.searchParams.set("__sm_reload", crypto.randomUUID());
      frame.src = url.href;
    }
    setStatus("Reconnecting preview…");
  };
  const detach = (frame: HTMLIFrameElement) =>
    queueMicrotask(() => {
      // React can detach/reattach the same ref during a render. Abort only after ownership ends.
      if (frames.current.has(frame)) return;
      const binding = bindings.current.get(frame);
      binding?.controller?.abort();
      clearTimeout(binding?.timer);
      clearConnection(frame);
      bindings.current.delete(frame);
      challenges.current.delete(frame);
    });
  return { status, loaded, waitCommitted, reload, connect, detach };
}
