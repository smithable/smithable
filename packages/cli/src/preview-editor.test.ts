import { expect, test } from "vitest";
import { RUNTIME } from "./preview-editor.js";

/** The runtime in a page stand-in, inside a frame; returns how to send it a message and its head. */
function page() {
  // One rule for the dark color scheme, as the app's styles have; and the development sign-in's buttons.
  const darkRule = { media: { mediaText: "(prefers-color-scheme: dark)" } };
  const clicked: string[] = [];
  const buttons = ["admin", "member"].map((role) => ({
    dataset: { devRole: role },
    click: () => clicked.push(role),
  }));
  const listeners: ((event: unknown) => void)[] = [];
  const head: { id: string; textContent: string }[] = [];
  const parent = { postMessage() {} };
  const window = {
    parent,
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
    querySelectorAll: (selector: string) => (selector === "[data-dev-role]" ? buttons : []),
    styleSheets: [{ cssRules: [darkRule] }],
    body: { dataset: { hydrated: "true" } },
    documentElement: { toggleAttribute() {} },
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
    RUNTIME,
  )(
    window,
    document,
    { pushState() {}, replaceState() {} },
    { pathname: "/", search: "" },
    noop,
    noop,
    noop,
    class {
      observe() {}
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
  };
}

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
