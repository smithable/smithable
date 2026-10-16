// The dev server's log lines, outside React: a line arrives many times a change (a dozen to a
// hundred), and as state of App each one re-rendered the whole page, preview panel included.
// Only the Logs tab reads them, through useLogs, so only it renders when one comes.
import { useSyncExternalStore } from "react";

const MAX = 500;
let lines: string[] = [];
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

export const logStore = {
  /** All lines as the daemon has them (on opening, and after a reconnect). */
  set(all: string[]) {
    lines = all.slice(-MAX);
    emit();
  },
  push(line: string) {
    lines = [...lines.slice(-(MAX - 1)), line];
    emit();
  },
  get: () => lines,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** The log lines, for the one component that shows them. */
export const useLogs = () => useSyncExternalStore(logStore.subscribe, logStore.get);
