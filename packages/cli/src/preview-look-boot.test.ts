import { expect, test, vi } from "vitest";
import { RUNTIME, smithableEditor } from "./preview-editor.js";

// Exercise the emitted module's navigation hooks separately from the bound frame protocol.
vi.mock("./look-frame-runtime.js", () => ({
  LOOK_FRAME_BODY: "window.starts++;",
}));

function boot(search = "") {
  const listeners = new Map<string, () => void>();
  const window = {
    starts: 0,
    addEventListener: (name: string, listener: () => void) => listeners.set(name, listener),
  };
  const location = { search };
  const history = {
    pushState(_state: unknown, _title: string, url: string) {
      location.search = new URL(url, "http://preview.local").search;
      return "pushed";
    },
    replaceState(_state: unknown, _title: string, url: string) {
      location.search = new URL(url, "http://preview.local").search;
      return "replaced";
    },
  };
  const plugin = smithableEditor({
    look: {
      project: "preview-run",
      parentOrigins: ["http://localhost:5730"],
      previewOrigin: "http://localhost:5731",
    },
  });
  const emitted = plugin.load("\0virtual:smithable-editor");
  if (!emitted?.startsWith(RUNTIME)) throw new Error("Preview module was not emitted");
  new Function("window", "history", "location", emitted.slice(RUNTIME.length))(
    window,
    history,
    location,
  );
  return { window, history, location, pop: () => listeners.get("popstate")?.() };
}

test.each(["pushState", "replaceState"] as const)(
  "look starts once after a sign-in return through %s",
  (method) => {
    const page = boot("?redirect=%2Foverview%3F__sm_look%3D1");
    expect(page.window.starts).toBe(0);
    expect(page.history[method](null, "", "/overview?__sm_look=1")).toBe(
      method === "pushState" ? "pushed" : "replaced",
    );
    expect(page.window.starts).toBe(1);
    page.history.replaceState(null, "", "/overview?__sm_look=1&period=month");
    page.pop();
    expect(page.window.starts).toBe(1);
  },
);

test("look starts on Back navigation and direct loads without starting on ordinary pages", () => {
  const page = boot();
  page.history.pushState(null, "", "/overview");
  page.pop();
  expect(page.window.starts).toBe(0);
  page.location.search = "?__sm_look=1";
  page.pop();
  expect(page.window.starts).toBe(1);
  const direct = boot("?__sm_look=1");
  expect(direct.window.starts).toBe(1);
  direct.history.pushState(null, "", "/invoices?__sm_look=1");
  expect(direct.window.starts).toBe(1);
});
