import { expect, test } from "vitest";
import { holdFullReloads, previewConfig, RUNTIME, smithableEditor } from "./preview-editor.js";

/** The runtime in a page stand-in, inside a frame; returns how to send it a message and its head. */
function page(at = "/", storage: Record<string, string> = {}) {
  // One rule for the dark color scheme, as the app's styles have; and the development sign-in's buttons.
  const darkRule = { media: { mediaText: "(prefers-color-scheme: dark)" } };
  const clicked: string[] = [];
  const buttons = ["admin", "member"].map((role) => ({
    dataset: { devRole: role },
    click: () => clicked.push(role),
  }));
  const listeners: ((event: unknown) => void)[] = [];
  // The development sign-in page's own button, and the timers the runtime starts, run by hand.
  const signInButtons = [
    { textContent: " Sign in as admin ", click: () => clicked.push("sign-in") },
  ];
  const ticks: (() => void)[] = [];
  const clicks: ((event: unknown) => void)[] = [];
  const head: { id: string; textContent: string }[] = [];
  const parent = { postMessage() {} };
  const scrolled: number[] = [];
  const window = {
    parent,
    innerHeight: 800,
    scrollTo: (_x: number, y: number) => scrolled.push(y),
    addEventListener: (type: string, listener: (event: unknown) => void) =>
      type === "message" && listeners.push(listener),
  };
  const document = {
    head: {
      append: (element: { id: string; textContent: string }) => {
        if (head.includes(element)) head.splice(head.indexOf(element), 1);
        head.push(element);
      },
    },
    createElement: () => ({ id: "", textContent: "" }),
    getElementById: (id: string) => head.find((e) => e.id === id) ?? null,
    addEventListener: (type: string, listener: (event: unknown) => void) =>
      type === "click" && clicks.push(listener),
    querySelectorAll: (selector: string) =>
      selector === "[data-dev-role]" ? buttons : selector === "button" ? signInButtons : [],
    styleSheets: [{ cssRules: [darkRule] }],
    body: { dataset: { hydrated: "true" } },
    documentElement: { toggleAttribute() {}, scrollHeight: 3000 },
    readyState: "loading",
  };
  const noop = () => 0;
  new Function(
    "window",
    "document",
    "history",
    "location",
    "setInterval",
    "setTimeout",
    "clearInterval",
    "MutationObserver",
    "sessionStorage",
    RUNTIME,
  )(
    window,
    document,
    { pushState() {}, replaceState() {} },
    { pathname: at, search: "" },
    (tick: () => void) => ticks.push(tick),
    noop,
    noop,
    class {
      observe() {}
    },
    {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
    },
  );
  const send = (data: unknown, origin = "http://localhost:5173", source: unknown = parent) => {
    for (const listener of listeners) listener({ data, origin, source });
  };
  return {
    send,
    theme: () => document.getElementById("sm-theme")?.textContent,
    head,
    darkRule,
    clicked,
    scrolled,
    tick: () => {
      for (const t of [...ticks]) t();
    },
    /** The owner presses the app's Sign out. */
    signOut: () => {
      for (const c of clicks)
        c({ target: { closest: (s: string) => (s.includes("sign-out") ? {} : null) } });
    },
  };
}

test("the preview signs in whenever it shows the sign-in page, until the owner signs out", () => {
  const storage: Record<string, string> = {};
  const first = page("/sign-in", storage);
  first.tick();
  expect(first.clicked).toEqual(["sign-in"]);
  // A session lost (the server started again, a database put back): signed in again.
  const again = page("/sign-in", storage);
  again.tick();
  expect(again.clicked).toEqual(["sign-in"]);
  // The owner signs out: the sign-in page stays, to try another role.
  page("/customers", storage).signOut();
  const after = page("/sign-in", storage);
  after.tick();
  expect(after.clicked).toEqual([]);
});

test("a theme's CSS from the lab replaces the app's until reload, its fonts at Vite's paths", () => {
  const { send, theme, head } = page();
  const css = '@import "@fontsource-variable/fraunces";\n:root {\n  --radius: 0;\n}';
  send({ type: "smithable:theme-css", css });
  expect(theme()).toBe(
    '@import "/node_modules/@fontsource-variable/fraunces/index.css";\n:root {\n  --radius: 0;\n}',
  );
  // A second one replaces the first, still last in the head.
  send({ type: "smithable:theme-css", css: ":root { --radius: 4px; }" }, "http://127.0.0.1:8410");
  expect(theme()).toBe(":root { --radius: 4px; }");
  expect(head.filter((e) => e.id === "sm-theme")).toHaveLength(1);
  expect(head.at(-1)?.id).toBe("sm-theme");
});

test("only from the page the preview is in, on this machine", () => {
  const { send, theme } = page();
  send({ type: "smithable:theme-css", css: "a{}" }, "https://example.com");
  send({ type: "smithable:theme-css", css: "a{}" }, "http://localhost.example.com");
  send({ type: "smithable:theme-css", css: "a{}" }, "http://localhost:5173", {});
  send({ type: "smithable:theme-css", css: 42 });
  expect(theme()).toBeUndefined();
});

test("a frame in one mode: the app's dark rules always apply, or never", () => {
  const { send, darkRule } = page();
  send({ type: "smithable:theme-css", css: "a{}", mode: "dark" });
  expect(darkRule.media.mediaText).toBe("all");
  send({ type: "smithable:theme-css", css: "a{}", mode: "light" });
  expect(darkRule.media.mediaText).toBe("not all");
});

test("the lab signs in through the development sign-in's button for the role it asks", () => {
  const { send, clicked } = page();
  send({ type: "smithable:dev-sign-in", role: "admin" }, "https://example.com");
  expect(clicked).toEqual([]);
  send({ type: "smithable:dev-sign-in", role: "admin" });
  expect(clicked).toEqual(["admin"]);
});

test("asked by the lab, the page starts scrolling through, so its motion plays", () => {
  const { send, scrolled } = page();
  send({ type: "smithable:motion-tour" }, "https://example.com");
  expect(scrolled).toEqual([]);
  send({ type: "smithable:motion-tour" });
  expect(scrolled).toHaveLength(1);
});

test("loaded again on the same page, the preview keeps its place; on another page it starts at the top", () => {
  const storage = { "smithable:place": JSON.stringify({ path: "/orders", y: 500 }) };
  expect(page("/orders", storage).scrolled).toEqual([500]);
  expect(page("/customers", storage).scrolled).toEqual([]);
});

test("in Studio the dev server's hot updates for generated files are held back; custom code keeps them", () => {
  const studio = smithableEditor({ holdUpdates: true });
  expect(studio.hotUpdate({ file: "/app/src/routes/orders/index.tsx" })).toEqual([]);
  expect(studio.hotUpdate({ file: "/app/src/routeTree.gen.ts" })).toEqual([]);
  expect(studio.hotUpdate({ file: "/app/src/styles.css" })).toEqual([]);
  expect(studio.hotUpdate({ file: "/app/src/custom/pages/Hello.tsx" })).toBeUndefined();
  // The theme lab and anything else: the dev server's own updates, as always.
  expect(smithableEditor().hotUpdate({ file: "/app/src/routes/orders/index.tsx" })).toBeUndefined();
  expect(previewConfig(undefined, undefined, { holdUpdates: true })).toContain(
    "smithableEditor({ holdUpdates: true })",
  );
  expect(previewConfig()).toContain("smithableEditor()");
});

test("full reloads a plugin sends itself are dropped, except for custom code", () => {
  const sent: unknown[] = [];
  const server = {
    environments: { client: { hot: { send: (...args: unknown[]) => sent.push(args[0]) } } },
  };
  holdFullReloads(server);
  const hot = server.environments.client.hot;
  hot.send({ type: "full-reload", path: "*" });
  hot.send({ type: "full-reload", triggeredBy: "/app/src/routes/orders/index.tsx" });
  hot.send({ type: "full-reload", triggeredBy: "/app/src/custom/pages/Hello.tsx" });
  hot.send({ type: "update", updates: [] });
  expect(sent).toEqual([
    { type: "full-reload", triggeredBy: "/app/src/custom/pages/Hello.tsx" },
    { type: "update", updates: [] },
  ]);
});
