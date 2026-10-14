import { expect, test } from "vitest";
import { RUNTIME } from "./preview-editor.js";

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
    addEventListener() {},
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
  };
}

test("the preview signs in once a session, and again when a reload came before the sign-in did", () => {
  const storage: Record<string, string> = {};
  const first = page("/sign-in", storage);
  first.tick();
  expect(first.clicked).toEqual(["sign-in"]);
  expect(storage["smithable:signed-in"]).toBe("pending");
  // Reloaded on the sign-in page before it was through: pressed again.
  const reloaded = page("/sign-in", storage);
  reloaded.tick();
  expect(reloaded.clicked).toEqual(["sign-in"]);
  // In the app: it counts; after signing out the sign-in page stays for another role.
  page("/customers", storage);
  expect(storage["smithable:signed-in"]).toBe("1");
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
