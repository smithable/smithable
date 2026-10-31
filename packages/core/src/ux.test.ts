import { describe, expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import type { PageIR } from "./ir.js";
import { validateSpec } from "./spec.js";
import { emptyUx, pageIcon, validateUx } from "./ux.js";

const crm = Object.values(
  import.meta.glob("../../../examples/crm/smithable.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
)[0] as string;
const ir = validateSpec({ path: "smithable.yml", text: crm }).ir;
if (!ir) throw new Error("invalid spec");
const codes = (text: string) =>
  validateUx({ path: "smithable.ux.yml", text }, ir).diagnostics.map((d) => d.code);

describe("smithable.ux.yml", () => {
  test("the AI badge is on unless the owner switches it off", () => {
    const read = (text: string) => validateUx({ path: "smithable.ux.yml", text }, ir);
    expect(read("smithableUx: 0.1\n").ux?.aiBadge).toBe(true);
    expect(read("smithableUx: 0.1\naiBadge: false\n").ux?.aiBadge).toBe(false);
    expect(codes("smithableUx: 0.1\naiBadge: maybe\n")).not.toEqual([]);
    const off = applyOperation({ spec: crm, ux: "smithableUx: 0.1\n" }, "setAiBadge", {
      shown: "false",
    });
    expect(off.ok && off.files.ux).toContain("aiBadge: false");
    const on = off.ok && applyOperation({ spec: crm, ux: off.files.ux }, "setAiBadge", {});
    expect(on && on.ok && on.files.ux).not.toContain("aiBadge");
  });

  test("Ask's voice: plain unless said, set and returned by its operation, an unknown one refused", () => {
    const read = (text: string) => validateUx({ path: "smithable.ux.yml", text }, ir);
    expect(read("smithableUx: 0.1\n").ux?.assistant.voice).toBe("plain");
    expect(read("smithableUx: 0.1\nassistant: { voice: formal }\n").ux?.assistant.voice).toBe(
      "formal",
    );
    expect(codes("smithableUx: 0.1\nassistant: { voice: chatty }\n")).toContain("invalid-value");
    const friendly = applyOperation({ spec: crm, ux: "smithableUx: 0.1\n" }, "setAssistantVoice", {
      voice: "friendly",
    });
    if (!friendly.ok) throw new Error(friendly.message);
    expect(friendly.files.ux).toMatch(/assistant:\n {2}voice: friendly/);
    expect(friendly.description).toBe("Ask answers in a friendly voice");
    const plain = applyOperation({ spec: crm, ux: friendly.files.ux }, "setAssistantVoice", {
      voice: "plain",
    });
    expect(plain.ok && plain.files.ux).not.toContain("assistant");
    expect(
      applyOperation({ spec: crm, ux: "smithableUx: 0.1\n" }, "setAssistantVoice", {
        voice: "chatty",
      }),
    ).toMatchObject({ ok: false });
  });

  test("theme, brand and page settings", () => {
    const { ux } = validateUx(
      {
        path: "smithable.ux.yml",
        text: `smithableUx: 0.1
theme:
  preset: corporate
  brand: { primary: "#1D4ED8", font: Inter }
  density: compact
pages:
  customers:
    table: { columns: [name, segment, email] }
    form: { fieldOrder: [name, email] }
tones:
  Order.status: { shipped: success, canceled: danger }
`,
      },
      ir,
    );
    expect(ux).toEqual({
      theme: {
        preset: "corporate",
        primary: "#1d4ed8",
        font: "Inter",
        density: "compact",
        motion: "subtle",
      },
      pages: {
        customers: { columns: ["name", "segment", "email"], fieldOrder: ["name", "email"] },
      },
      aiBadge: true,
      assistant: { voice: "plain" },
      tones: { "Order.status": { shipped: "success", canceled: "danger" } },
    });
  });

  test("the third density, standard, reads like the other two", () => {
    const { ux, diagnostics } = validateUx(
      { path: "smithable.ux.yml", text: "smithableUx: 0.1\ntheme: { density: standard }\n" },
      ir,
    );
    expect(diagnostics).toEqual([]);
    expect(ux?.theme.density).toBe("standard");
    expect(
      validateUx(
        { path: "smithable.ux.yml", text: "smithableUx: 0.1\ntheme: { density: tight }\n" },
        ir,
      ).diagnostics.map((d) => d.message),
    ).toEqual(['"density" must be comfortable, standard or compact.']);
  });

  test("mistakes are reported, with suggestions", () => {
    expect(codes("theme: {}")).toEqual(["invalid-version"]);
    expect(
      codes(`smithableUx: 0.1
theme: { preset: modrn, brand: { primary: blue, font: Comic Sans }, density: tight, motion: wild }
pages:
  customer: {}
  orders:
    table: { columns: [number, shipingCost] }
    form: { fieldOrder: [shippingCost] }
tones:
  Order.stat: { shipped: success }
  Order.number: { a: success }
  Order.status: { shiped: success, canceled: red }
`),
    ).toEqual([
      "unknown-preset",
      "invalid-color",
      "unknown-font",
      "invalid-value",
      "invalid-value",
      "unknown-page",
      "unknown-field",
      "invalid-field",
      "unknown-field",
      "invalid-field",
      "unknown-value",
      "unknown-tone",
    ]);
  });
});

describe("ux operations", () => {
  test("setTheme creates the file; setColumns and setFieldOrder add to it; empty lists remove", () => {
    const theme = applyOperation({ spec: crm }, "setTheme", {
      preset: "playful",
      primary: "#4f7c6b",
    });
    if (!theme.ok) throw new Error(theme.message);
    expect(theme.files.ux).toBe(
      'smithableUx: 0.1\ntheme:\n  preset: playful\n  brand:\n    primary: "#4f7c6b"\n',
    );
    const columns = applyOperation({ spec: crm, ux: theme.files.ux }, "setColumns", {
      page: "customers",
      columns: ["name", "email"],
    });
    if (!columns.ok) throw new Error(columns.message);
    expect(columns.files.ux).toContain("  customers:\n    table:\n      columns: [name, email]\n");
    const back = applyOperation({ spec: crm, ux: columns.files.ux }, "setColumns", {
      page: "customers",
    });
    if (!back.ok) throw new Error(back.message);
    expect(back.files.ux).toBe(theme.files.ux);
    expect(
      applyOperation({ spec: crm }, "setColumns", { page: "customers", columns: ["nme"] }),
    ).toMatchObject({
      ok: false,
      message: "setColumns would make smithable.ux.yml invalid.",
    });
    expect(
      applyOperation({ spec: crm }, "addField", { model: "Customer", field: "fax", type: "phone" }),
    ).not.toHaveProperty("files.ux");
  });
});

test("renaming or removing a field updates the search, table columns and form order that name it", () => {
  const ux =
    "smithableUx: 0.1\npages:\n  customers:\n    table: { columns: [name, email] }\n    form: { fieldOrder: [email, name] }\n";
  const renamed = applyOperation({ spec: crm, ux }, "renameField", {
    model: "Customer",
    from: "email",
    to: "mail",
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.spec).toContain("    search: [name, mail]\n");
  expect(renamed.files.ux).toContain("columns: [name, mail]");
  expect(renamed.files.ux).toContain("fieldOrder: [mail, name]");
  const removed = applyOperation({ spec: crm, ux }, "removeField", {
    model: "Customer",
    field: "email",
  });
  if (!removed.ok) throw new Error(removed.message);
  expect(removed.files.spec).toContain("    search: [name]\n");
  expect(removed.files.ux).toContain("columns: [name]");
});

test("setTone colors a choice value; the tone follows renames and goes with its field or value", () => {
  const toned = applyOperation({ spec: crm }, "setTone", {
    model: "Order",
    field: "status",
    value: "shipped",
    tone: "success",
  });
  if (!toned.ok) throw new Error(toned.message);
  expect(toned.files.ux).toBe("smithableUx: 0.1\ntones:\n  Order.status:\n    shipped: success\n");
  const ux = toned.files.ux as string;
  expect(
    applyOperation({ spec: crm, ux }, "setTone", {
      model: "Order",
      field: "status",
      value: "shipped",
      tone: "neutral",
    }),
  ).toMatchObject({ ok: true, files: { ux: "smithableUx: 0.1\n" } });
  expect(
    applyOperation({ spec: crm, ux }, "setTone", {
      model: "Order",
      field: "number",
      value: "x",
      tone: "success",
    }),
  ).toMatchObject({ ok: false, message: "Order.number is not a choice field." });
  const renamed = applyOperation({ spec: crm, ux }, "renameField", {
    model: "Order",
    from: "status",
    to: "state",
  });
  expect(renamed).toMatchObject({
    ok: true,
    files: { ux: expect.stringContaining("Order.state:") },
  });
  const removed = applyOperation({ spec: crm, ux }, "removeField", {
    model: "Order",
    field: "status",
  });
  expect(removed).toMatchObject({ ok: true, files: { ux: "smithableUx: 0.1\n" } });
  const changed = applyOperation({ spec: crm, ux }, "changeField", {
    model: "Order",
    field: "status",
    type: "draft | placed | sent",
  });
  expect(changed).toMatchObject({ ok: true, files: { ux: "smithableUx: 0.1\n" } });
});

test("a page's navigation icon is set with setIcon, or suggested by its model's name", () => {
  const empty = emptyUx();
  const page = (id: string) => ir.pages.find((p) => p.id === id) as PageIR;
  expect(pageIcon(empty, page("customers"))).toBe("users");
  expect(pageIcon(empty, page("orders"))).toBe("cart");
  expect(
    pageIcon(empty, {
      id: "widgets",
      route: "/",
      pattern: { kind: "crud", model: "Widget" },
      sections: [],
    }),
  ).toBe("list");
  expect(
    pageIcon(empty, {
      id: "home",
      route: "/",
      pattern: { kind: "landing", sections: [] },
      sections: [],
    }),
  ).toBe("home");
  const set = applyOperation({ spec: crm }, "setIcon", { page: "orders", icon: "truck" });
  if (!set.ok) throw new Error(set.message);
  const { ux } = validateUx({ path: "smithable.ux.yml", text: set.files.ux as string }, ir);
  expect(ux && pageIcon(ux, page("orders"))).toBe("truck");
  expect(codes("smithableUx: 0.1\npages:\n  orders: { icon: truk }\n")).toEqual(["unknown-icon"]);
  expect(
    applyOperation({ spec: crm, ux: set.files.ux }, "setIcon", { page: "orders", icon: "auto" }),
  ).toMatchObject({ ok: true, files: { ux: "smithableUx: 0.1\n" } });
});

test("setBelow puts a second field under a column; it follows renames and goes with either field", () => {
  const set = applyOperation({ spec: crm }, "setBelow", {
    page: "customers",
    column: "email",
    field: "phone",
  });
  if (!set.ok) throw new Error(set.message);
  const ux = set.files.ux as string;
  expect(validateUx({ path: "smithable.ux.yml", text: ux }, ir).ux?.pages.customers).toEqual({
    below: { email: "phone" },
  });
  const renamed = applyOperation({ spec: crm, ux }, "renameField", {
    model: "Customer",
    from: "phone",
    to: "mobile",
  });
  expect(renamed).toMatchObject({
    ok: true,
    files: { ux: expect.stringContaining("email: mobile") },
  });
  const removed = applyOperation({ spec: crm, ux }, "removeField", {
    model: "Customer",
    field: "email",
  });
  expect(removed).toMatchObject({ ok: true, files: { ux: "smithableUx: 0.1\n" } });
  expect(
    codes("smithableUx: 0.1\npages:\n  customers:\n    table: { below: { email: fone } }\n"),
  ).toEqual(["unknown-field"]);
});

test("addTheme adds themes/<name>.yml, --use applies it, and a bad file or a taken name is refused", () => {
  const text = `smithableTheme: 0.1\nfont: Nunito Sans\nlight:\n  primary: "#2f6b3a"\n  background: "#f6f8f4"\n  foreground: "#1f2a1f"\ndark:\n  primary: "#8fd19a"\n  background: "#141a14"\n  foreground: "#e6ece4"\n`;
  const added = applyOperation({ spec: crm }, "addTheme", { name: "forest", text, use: true });
  if (!added.ok) throw new Error(added.message);
  expect(added.added).toEqual([{ path: "themes/forest.yml", text }]);
  expect(added.files.ux).toBe("smithableUx: 0.1\ntheme:\n  preset: forest\n");
  expect(added.description).toBe("Add theme forest and use it");
  // Text that may not read is the person's choice: added, said as a warning elsewhere, never refused.
  const pale = text.replace('foreground: "#1f2a1f"', 'foreground: "#c0c8c0"');
  expect(applyOperation({ spec: crm }, "addTheme", { name: "pale", text: pale }).ok).toBe(true);
  const bad = applyOperation({ spec: crm }, "addTheme", {
    name: "forest",
    text: "smithableTheme: 0.1\nfont: Comic Sans\n",
  });
  expect(bad.ok).toBe(false);
  if (!bad.ok) expect(bad.message).toContain('"font" must be one of');
  expect(applyOperation({ spec: crm }, "addTheme", { name: "modern", text })).toMatchObject({
    ok: false,
    message: 'There is already a theme "modern", built in: choose another name.',
  });
  expect(
    applyOperation({ spec: crm }, "addTheme", { name: "woods", text: `name: forest\n${text}` }),
  ).toMatchObject({ ok: false, message: expect.stringContaining('The file says "name: forest"') });
});

test("the ux file says where the menu sits and its surface; setMenuLayout and setChrome write them (look-gap §4)", () => {
  const read = (text: string) => validateUx({ path: "smithable.ux.yml", text }, ir);
  const said = read("smithableUx: 0.1\nnavigation: topbar-centered\nchrome: light\n");
  expect(said.diagnostics).toEqual([]);
  expect(said.ux?.navigation).toBe("topbar-centered");
  expect(said.ux?.chrome).toBe("light");
  // Unsaid: the sidebar and the theme's own menu colours.
  expect(read("smithableUx: 0.1\n").ux?.navigation).toBeUndefined();
  expect(read("smithableUx: 0.1\nnavigation: top\n").diagnostics[0]?.message).toBe(
    '"navigation" is sidebar, topbar or topbar-centered.',
  );
  expect(read("smithableUx: 0.1\nchrome: grey\n").diagnostics[0]?.message).toBe(
    '"chrome" is light or dark.',
  );
  const files = { spec: crm, ux: "smithableUx: 0.1\n" };
  const top = applyOperation(files, "setMenuLayout", { navigation: "topbar" });
  if (!top.ok) throw new Error(top.message);
  expect(top.files.ux).toContain("navigation: topbar\n");
  const light = applyOperation(top.files, "setChrome", { chrome: "light" });
  if (!light.ok) throw new Error(light.message);
  expect(light.files.ux).toContain("chrome: light\n");
  const back = applyOperation(light.files, "setMenuLayout", { navigation: "default" });
  if (!back.ok) throw new Error(back.message);
  expect(back.files.ux).not.toContain("navigation");
  expect(applyOperation(files, "setChrome", { chrome: "grey" }).ok).toBe(false);
});
