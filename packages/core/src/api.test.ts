import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { apiOffers, validateAuth } from "./auth.js";
import type { SpecIR } from "./ir.js";
import { validateSpec } from "./spec.js";

const spec = `smithable: 0.1
app: { name: Status }
models:
  Component:
    fields: { name: string! }
  Incident:
    fields:
      title: string!
      status: investigating | resolved
      component: Component
  Subscriber:
    fields: { email: email!, phone: phone }
actions:
  resolve:
    on: Incident
    when: { status: investigating }
    set: { status: resolved }
  rename:
    on: Component
    set: { name: Renamed }
  purge:
    custom: true
    input: { incident: Incident! }
pages:
  incidents: { crud: Incident, actions: [resolve] }
  components: { crud: Component }
  subscribers: { crud: Subscriber }
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const head =
  "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles: { admin: all, member: { pages: all } }\n";
const read = (api: string, top = head) =>
  validateAuth({ path: "smithable.auth.yml", text: `${top}${api}` }, ir);
const codes = (api: string, top = head) =>
  read(api, top).diagnostics.map((d) => `${d.severity} ${d.code}`);

test("the api block says what programs may reach: a list, or all with except", () => {
  expect(read("").auth?.api).toBeUndefined();
  const listed = read("api: { models: [Component, Incident], actions: [resolve] }\n");
  expect(listed.diagnostics).toEqual([]);
  expect(listed.auth?.api).toEqual({
    models: ["Component", "Incident"],
    except: [],
    actions: ["resolve"],
  });
  const all = read(
    "api:\n  models: all\n  except: [Subscriber]\n  actions: all\n  assistants: true\n",
  );
  expect(all.diagnostics.map((d) => d.code)).toEqual([]);
  expect(all.auth?.api).toEqual({
    models: "all",
    except: ["Subscriber"],
    actions: "all",
    assistants: { delete: false },
  });
  expect(
    read("api: { models: [Component], assistants: { delete: true } }\n").auth?.api?.assistants,
  ).toEqual({ delete: true });
  expect(read("api: { models: [Component], assistants: false }\n").auth?.api?.assistants).toBe(
    undefined,
  );
});

test("all and except resolve against the spec, and only standard actions of offered models run", () => {
  const offers = (api: string) => {
    const { auth } = read(api);
    if (!auth) throw new Error("invalid");
    return apiOffers(auth, ir);
  };
  expect(offers("")).toEqual({
    models: [],
    actions: [],
    rowsActions: [],
    visitors: { read: [], create: [] },
  });
  expect(offers("api: { models: all, except: [Subscriber], actions: all }\n")).toMatchObject({
    models: ["Component", "Incident"],
    actions: ["resolve", "rename"],
  });
  expect(offers("api: { models: [Incident], actions: all }\n")).toMatchObject({
    models: ["Incident"],
    actions: ["resolve"],
  });
  expect(offers("api: { models: [Incident] }\n")).toMatchObject({
    models: ["Incident"],
    actions: [],
  });
});

test("what the block names is checked", () => {
  expect(codes("api: { actions: [resolve] }\n")).toEqual(["error missing-key"]);
  expect(codes("api: { models: [Incidnt] }\n")).toEqual(["error unknown-model"]);
  expect(read("api: { models: [Incidnt] }\n").diagnostics[0]?.hint).toContain("Incident");
  expect(codes("api: { models: all, except: [Nothing, Subscriber] }\n")).toEqual([
    "error unknown-model",
  ]);
  expect(codes("api: { models: [Incident], except: [Component] }\n")).toEqual([
    "error invalid-api",
  ]);
  expect(codes("api: { models: [Incident], actions: [resolv] }\n")).toEqual([
    "error unknown-action",
  ]);
  // A custom action, and an action of a model that is not offered.
  expect(codes("api: { models: [Incident], actions: [purge] }\n")).toEqual(["error invalid-api"]);
  expect(codes("api: { models: [Incident], actions: [rename] }\n")).toEqual(["error invalid-api"]);
  expect(codes("api: { models: [Incident], keys: [x] }\n")).toEqual(["error unknown-key"]);
  // Keys are made by an administrator: no sign-in, no API.
  expect(codes("api: { models: [Incident] }\n", "smithableAuth: 0.1\nsignIn: none\n")).toContain(
    "error invalid-api",
  );
});

test("a model with personal data offered to programs is said", () => {
  const warned = read("api: { models: [Subscriber] }\n");
  expect(warned.diagnostics.map((d) => `${d.severity} ${d.code}`)).toEqual([
    "warning api-personal-data",
  ]);
  expect(warned.diagnostics[0]?.message).toBe(
    "Anyone holding a key with a role that may read Subscriber reads email, phone.",
  );
  expect(codes("api: { models: all }\n")).toEqual(["warning api-personal-data"]);
});

test("setApi sets, changes and turns off what is offered", () => {
  const files = { spec, auth: head };
  const set = applyOperation(files, "setApi", {
    models: ["Component", "Incident"],
    actions: ["resolve"],
  });
  if (!set.ok) throw new Error(set.message);
  expect(set.description).toBe(
    "Offer components and incidents to other programs, and let them run resolve",
  );
  expect(set.files.auth).toContain("api:\n  models: [Component, Incident]\n  actions: [resolve]\n");
  const all = applyOperation({ ...files, ...set.files }, "setApi", {
    models: ["all"],
    except: ["Subscriber"],
    actions: ["all"],
    assistants: true,
  });
  if (!all.ok) throw new Error(all.message);
  expect(all.description).toBe(
    "Offer every model, also ones added later, to other programs, and let them run every standard action, also as tools for AI assistants",
  );
  expect(all.files.auth).toContain(
    "api:\n  models: all\n  except: [Subscriber]\n  actions: all\n  assistants: true\n",
  );
  const off = applyOperation({ ...files, ...all.files }, "setApi", {});
  if (!off.ok) throw new Error(off.message);
  expect(off.description).toBe("Turn the API off");
  expect(off.files.auth).not.toContain("api:");
  expect(applyOperation(files, "setApi", { models: ["Nothing"] })).toMatchObject({ ok: false });
  expect(
    applyOperation(files, "setApi", { models: ["Incident"], except: ["Component"] }),
  ).toMatchObject({ ok: false });
  expect(
    applyOperation(files, "setApi", { models: ["Incident"], actions: ["rename"] }),
  ).toMatchObject({ ok: false });
  expect(
    applyOperation({ spec, auth: "smithableAuth: 0.1\nsignIn: none\n" }, "setApi", {
      models: ["Incident"],
    }),
  ).toMatchObject({ ok: false, message: expect.stringContaining("no sign-in") });
});

test("without a key a call is the visitor: it reads and adds what is both offered and public", () => {
  const offers = (rest: string) => {
    const { auth, diagnostics } = read(rest);
    if (!auth) throw new Error(diagnostics.map((d) => d.message).join("\n"));
    return apiOffers(auth, ir).visitors;
  };
  // Nothing public: nothing without a key, whatever the API offers.
  expect(offers("api: { models: all }\n")).toEqual({ read: [], create: [] });
  // Public and offered: readable without a key. Public but not offered: not through the API.
  expect(
    offers(
      "public:\n  read: [Component, { Incident: { where: { status: resolved } } }]\n  create: [Subscriber]\napi: { models: [Incident, Subscriber] }\n",
    ),
  ).toEqual({ read: ["Incident"], create: ["Subscriber"] });
  // A fully public API: every model offered and every model public.
  expect(
    offers("public:\n  read: [Component, Incident]\napi: { models: all, except: [Subscriber] }\n"),
  ).toEqual({ read: ["Component", "Incident"], create: [] });
});

test("setApi can let assistants delete, which is off unless said", () => {
  const files = { spec, auth: head };
  const on = applyOperation(files, "setApi", {
    models: ["Incident"],
    assistants: true,
    assistantsDelete: true,
  });
  if (!on.ok) throw new Error(on.message);
  expect(on.description).toBe(
    "Offer incidents to other programs, also as tools for AI assistants, which may delete too",
  );
  expect(read("", on.files.auth as string).auth?.api?.assistants).toEqual({ delete: true });
  // Without assistants there is nobody it could be allowed for.
  expect(
    applyOperation(files, "setApi", { models: ["Incident"], assistantsDelete: true }),
  ).toMatchObject({ ok: false });
  // Setting it again without the option takes it back.
  const off = applyOperation(on.files, "setApi", { models: ["Incident"], assistants: true });
  if (!off.ok) throw new Error(off.message);
  expect(off.files.auth).toContain("assistants: true");
});

test("a custom action on rows of an offered model is offered to programs, run on ids (A 171)", () => {
  const rows = validateSpec({
    path: "smithable.yml",
    text: spec.replace(
      "  purge:\n",
      "  close:\n    custom: true\n    input: { incidents: 'Incident[]', note: text }\n  purge:\n",
    ),
  }).ir as SpecIR;
  const offers = (api: string) =>
    validateAuth({ path: "smithable.auth.yml", text: `${head}${api}` }, rows);
  const closing = offers("api: { models: [Incident], actions: [resolve, close] }\n");
  expect(closing.diagnostics).toEqual([]);
  expect(apiOffers(closing.auth as never, rows)).toMatchObject({
    actions: ["resolve"],
    rowsActions: ["close"],
  });
  expect(
    apiOffers(offers("api: { models: all, actions: all }\n").auth as never, rows),
  ).toMatchObject({
    rowsActions: ["close"],
  });
  // Its rows' model must be offered; a custom action without rows stays refused.
  expect(
    offers("api: { models: [Component], actions: [close] }\n").diagnostics.map((d) => d.message),
  ).toEqual([
    '"close" runs on Incident rows, which "api" does not offer: add Incident to "models".',
  ]);
  expect(
    offers("api: { models: [Incident], actions: [purge] }\n").diagnostics[0]?.message,
  ).toContain("custom actions on rows (an input like customers: Customer[])");
});
