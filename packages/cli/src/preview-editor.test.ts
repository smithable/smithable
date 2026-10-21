import { expect, test } from "vitest";
import {
  guardUpgrades,
  holdFullReloads,
  type Middleware,
  previewConfig,
  RUNTIME,
  smithableEditor,
  tokenDigest,
  tokenGuard,
  type UpgradeServer,
} from "./preview-editor.js";

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
  // A words module's update reaches the components that read it: the text shows in place.
  expect(studio.hotUpdate({ file: "/app/src/generated/pages.ts" })).toBeUndefined();
  expect(studio.hotUpdate({ file: "/app/src/generated/customer.ts" })).toBeUndefined();
  expect(studio.hotUpdate({ file: "/app/src/generated/app.ts" })).toBeUndefined();
  expect(studio.hotUpdate({ file: "/app/src/generated/customer.server.ts" })).toEqual([]);
  expect(studio.hotUpdate({ file: "/app/src/generated/customer.schema.ts" })).toEqual([]);
  expect(studio.hotUpdate({ file: "/app/src/generated/actions/merge-customers.ts" })).toEqual([]);
  // Held for the browser only: the server's module runner takes the change, so the page Studio
  // reloads is rendered from the new route.
  const route = { file: "/app/src/routes/__root.tsx" };
  expect(studio.hotUpdate.call({ environment: { name: "client" } }, route)).toEqual([]);
  expect(studio.hotUpdate.call({ environment: { name: "ssr" } }, route)).toBeUndefined();
  // The theme lab and anything else: the dev server's own updates, as always.
  expect(smithableEditor().hotUpdate({ file: "/app/src/routes/orders/index.tsx" })).toBeUndefined();
  expect(previewConfig(undefined, undefined, { holdUpdates: true })).toContain(
    "smithableEditor({ holdUpdates: true })",
  );
  expect(previewConfig()).toContain("smithableEditor()");
  expect(previewConfig(undefined, undefined, { holdUpdates: true, token: true })).toContain(
    "smithableEditor({ holdUpdates: true, token: true })",
  );
});

test("on a host the preview takes Studio's token on every request, requests and upgrades alike; without a digest nothing is served", () => {
  const call = (guard: Middleware, token?: string) => {
    const res = { statusCode: 200, headers: {} as Record<string, string>, body: "" };
    let passed = false;
    guard(
      { headers: token === undefined ? {} : { "x-smithable-studio-token": token } },
      {
        get statusCode() {
          return res.statusCode;
        },
        set statusCode(code: number) {
          res.statusCode = code;
        },
        setHeader: (name, value) => {
          res.headers[name] = value;
        },
        end: (body) => {
          res.body = body;
        },
      },
      () => {
        passed = true;
      },
    );
    return passed ? "passed" : `${res.statusCode} ${res.body}`;
  };
  const digest = tokenDigest("secret-token");
  expect(digest).toMatch(/^[0-9a-f]{64}$/);
  const guard = tokenGuard(digest);
  expect(call(guard, "secret-token")).toBe("passed");
  expect(call(guard, "wrong")).toBe("401 The preview needs Studio's token.");
  expect(call(guard)).toBe("401 The preview needs Studio's token.");
  expect(call(guard, "secret-token-longer")).toBe("401 The preview needs Studio's token.");
  // Asked to guard without a digest: closed, not open.
  expect(call(tokenGuard(undefined), "secret-token")).toBe(
    "503 The preview has no token to check.",
  );
  // Once checked, the token is gone from the request, parsed and raw: the app's own code in the
  // preview never sees it.
  const passing = {
    headers: { host: "p.example", "x-smithable-studio-token": "secret-token" } as Record<
      string,
      string | string[] | undefined
    >,
    rawHeaders: ["Host", "p.example", "X-Smithable-Studio-Token", "secret-token", "Accept", "*/*"],
  };
  let passedOn = false;
  guard(passing, { statusCode: 200, setHeader: () => undefined, end: () => undefined }, () => {
    passedOn = true;
  });
  expect(passedOn).toBe(true);
  expect(passing.headers).toEqual({ host: "p.example" });
  expect(passing.rawHeaders).toEqual(["Host", "p.example", "Accept", "*/*"]);
  // Upgrades: the server's own listeners run only for an upgrade with the token.
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
  const server: UpgradeServer = {
    listeners: (event) => listeners.get(event) ?? [],
    removeAllListeners: (event) => void listeners.delete(event),
    on: (event, listener) => void listeners.set(event, [...(listeners.get(event) ?? []), listener]),
    once: (event, listener) =>
      void listeners.set(event, [...(listeners.get(event) ?? []), listener]),
  };
  const seen: string[] = [];
  const seenHeaders: unknown[] = [];
  server.on("upgrade", (req) => {
    seen.push((req as { url: string }).url);
    seenHeaders.push((req as { headers: unknown }).headers);
  });
  guardUpgrades(server, digest);
  for (const l of listeners.get("listening") ?? []) l();
  const upgrade = (token: string | undefined, url: string) => {
    const written: string[] = [];
    let destroyed = false;
    for (const l of listeners.get("upgrade") ?? [])
      l(
        { url, headers: token === undefined ? {} : { "x-smithable-studio-token": token } },
        {
          write: (t: string) => void written.push(t),
          destroy: () => {
            destroyed = true;
          },
        },
        Buffer.alloc(0),
      );
    return { written, destroyed };
  };
  expect(upgrade("secret-token", "/ok")).toEqual({ written: [], destroyed: false });
  expect(seenHeaders[0]).toEqual({});
  const refused = upgrade("wrong", "/no");
  expect(refused.destroyed).toBe(true);
  expect(refused.written[0]).toContain("401 Unauthorized");
  expect(upgrade(undefined, "/none").destroyed).toBe(true);
  expect(seen).toEqual(["/ok"]);
  // The plugin adds the guards only when asked; the digest comes from the preview's setting.
  const registered: unknown[] = [];
  const dev = {
    watcher: { on: () => undefined },
    middlewares: { use: (...args: unknown[]) => registered.push(args[0]) },
    httpServer: server,
  };
  const saved = process.env.SMITHABLE_PREVIEW_TOKEN_SHA256;
  try {
    process.env.SMITHABLE_PREVIEW_TOKEN_SHA256 = digest;
    smithableEditor({ token: true }).configureServer(dev);
    expect(registered.length).toBe(2);
    expect(typeof registered[0]).toBe("function");
    registered.length = 0;
    smithableEditor().configureServer(dev);
    expect(registered).toEqual(["/__smithable/settled"]);
    registered.length = 0;
    delete process.env.SMITHABLE_PREVIEW_TOKEN_SHA256;
    smithableEditor({ token: true }).configureServer(dev);
    expect(typeof registered[0]).toBe("function");
    expect(call(registered[0] as Middleware, "secret-token")).toContain("503");
  } finally {
    if (saved !== undefined) process.env.SMITHABLE_PREVIEW_TOKEN_SHA256 = saved;
    else delete process.env.SMITHABLE_PREVIEW_TOKEN_SHA256;
  }
});
