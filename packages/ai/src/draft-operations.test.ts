import { applyOperation, type ProjectFiles } from "@smithable/core";
import { expect, test } from "vitest";
import { checkSpecFiles } from "./draft.js";
import {
  BLANK,
  blankFor,
  computedField,
  draftOperations,
  draftProjectByOperations,
  dropClosedShortcuts,
  footerLast,
  openLinked,
  repaired,
  repairFieldShorthand,
  repairLongField,
  untranslated,
  visitorFlaws,
} from "./draft-operations.js";
import type { Provider } from "./provider.js";

const toProjectFiles = (files: Record<string, string | undefined>) => ({
  spec: files["smithable.yml"] ?? "",
  auth: files["smithable.auth.yml"],
  content: files["smithable.content.yml"],
  ux: files["smithable.ux.yml"],
});

test("the empty app is valid, and the draft's operations leave out what a draft never needs", () => {
  expect(checkSpecFiles(BLANK)).toEqual([]);
  const names = draftOperations().map((o) => o.name);
  expect(names).toEqual(
    expect.arrayContaining(["setApp", "addModel", "addPage", "setRoles", "setPublic"]),
  );
  expect(names).not.toContain("editSpec");
  expect(names).not.toContain("removeField");
});

test("field shorthand slips are mended", () => {
  // The long form: its type mended the same way, a default in the type moved to its own key.
  expect(repairLongField({ type: "int required = 3", min: 1, max: 5 })).toEqual({
    type: "int!",
    min: 1,
    max: 5,
    default: 3,
  });
  expect(repairLongField({ type: "money", formula: "a = b" })).toEqual({
    type: "money",
    formula: "a = b",
  });
  expect(repairFieldShorthand("email unique!")).toBe("email! unique");
  expect(repairFieldShorthand("string required")).toBe("string!");
  expect(repairFieldShorthand("low | normal | high = normal")).toBe("normal | low | high");
  expect(repairFieldShorthand("choices: good | worn")).toBe("good | worn");
  expect(repairFieldShorthand("boolean")).toBe("bool");
  expect(repairFieldShorthand("integer! = 12")).toBe("int! = 12");
  expect(repairFieldShorthand("Customer!")).toBe("Customer!");
  // The list types, written like lists of records or with other names.
  expect(repairFieldShorthand("file[]")).toBe("files");
  expect(repairFieldShorthand("picture[]!")).toBe("pictures!");
  expect(repairFieldShorthand("attachments")).toBe("files");
  expect(repairFieldShorthand("image!")).toBe("picture!");
  expect(repairFieldShorthand("photo | video")).toBe("photo | video");
});

test("a draft starts with the starter's access default and sees the starter as its example", async () => {
  const starter = {
    "smithable.yml":
      "smithable: 0.1\napp:\n  name: Team\nmodels:\n  Task:\n    fields:\n      title: string!\npages:\n  tasks: { crud: Task }\n",
    "smithable.auth.yml":
      "smithableAuth: 0.1\nsignIn:\n  providers: [google]\ndefaultAccess: shared\n",
  };
  expect(blankFor(starter)["smithable.auth.yml"]).toContain("defaultAccess: shared");
  expect(blankFor(undefined)).toBe(BLANK);
  expect(blankFor({ "smithable.yml": "" })).toBe(BLANK);
  const prompts: string[] = [];
  const provider: Provider = {
    name: "fake",
    tier: "frontier",
    location: "eu",
    price: { input: 1, output: 3 },
    async complete({ user }) {
      prompts.push(user);
      return {
        text: JSON.stringify({
          operations: [
            { op: "setApp", args: { name: "Tasks" } },
            { op: "addModel", args: { model: "Task", fields: { title: "string!" } } },
            { op: "addPage", args: { page: "tasks", model: "Task" } },
          ],
        }),
        model: "fake",
        inputTokens: 10,
        outputTokens: 10,
      };
    },
  };
  const draft = await draftProjectByOperations({
    description: "a task list for our team",
    providers: [provider],
    starter: { name: "crm", files: starter },
  });
  expect(draft.kind).toBe("draft");
  expect(draft.kind === "draft" && draft.files["smithable.auth.yml"]).toContain(
    "defaultAccess: shared",
  );
  expect(prompts[0]).toContain("The crm starter, the example for this kind of app:");
  expect(prompts[0]).toContain("tasks: { crud: Task }");
  // The starter's roles and access are part of the example: its auth file is shown too.
  expect(prompts[0]).toContain("smithable.auth.yml:\n```yaml\nsmithableAuth: 0.1");
  expect(draftOperations().map((o) => o.name)).toContain("setDefaultAccess");
});

test("a shared draft with open sign-up is made invite-only, with a team page", async () => {
  const steps = [
    { op: "setApp", args: { name: "Tasks" } },
    { op: "addModel", args: { model: "Task", fields: { title: "string!" } } },
    { op: "addPage", args: { page: "tasks", model: "Task" } },
  ];
  const provider = (answer: unknown): Provider => ({
    name: "fake",
    tier: "frontier",
    location: "eu",
    price: { input: 1, output: 3 },
    async complete() {
      return { text: JSON.stringify(answer), model: "fake", inputTokens: 1, outputTokens: 1 };
    },
  });
  const shared = {
    "smithable.yml": "smithable: 0.1\napp:\n  name: Team\n",
    "smithable.auth.yml":
      "smithableAuth: 0.1\nsignIn:\n  providers: [google]\ndefaultAccess: shared\n",
  };
  const draft = await draftProjectByOperations({
    description: "a task list for our team",
    providers: [provider({ operations: steps })],
    starter: { name: "crm", files: shared },
  });
  if (draft.kind !== "draft") throw new Error("no draft");
  expect(draft.files["smithable.auth.yml"]).toContain("selfSignUp: false");
  expect(draft.files["smithable.yml"]).toContain("users: manage");
  expect(draft.operations?.slice(-2).map((o) => o.op)).toEqual(["addUsersPage", "setSignUp"]);
  expect(checkSpecFiles(draft.files)).toEqual([]);
  // A private app stays open to sign-up: each person sees only their own records.
  const own = await draftProjectByOperations({
    description: "a personal task list",
    providers: [provider({ operations: steps })],
  });
  if (own.kind !== "draft") throw new Error("no draft");
  expect(own.files["smithable.auth.yml"]).not.toContain("selfSignUp");
  expect(own.operations?.map((o) => o.op)).toEqual(["setApp", "addModel", "addPage"]);
});

const answering = (answer: unknown): Provider => ({
  name: "fake",
  tier: "frontier",
  location: "eu",
  price: { input: 1, output: 3 },
  async complete() {
    return { text: JSON.stringify(answer), model: "fake", inputTokens: 1, outputTokens: 1 };
  },
});

test("an action still refused after the last round is dropped and named, not the draft", async () => {
  const draft = await draftProjectByOperations({
    description: "event registration",
    providers: [
      answering({
        operations: [
          { op: "setApp", args: { name: "Events" } },
          { op: "addModel", args: { model: "Talk", fields: { title: "string!" } } },
          { op: "addPage", args: { page: "talks", model: "Talk" } },
          { op: "addAction", args: { action: "register", on: "Talk", set: { seats: "1" } } },
        ],
      }),
    ],
  });
  if (draft.kind !== "draft") throw new Error(draft.message);
  expect(draft.files["smithable.yml"]).not.toContain("register");
  expect(draft.dropped).toHaveLength(1);
  expect(draft.dropped?.[0]).toMatch(/^addAction register: /);
});

test("a total over a list added in the same model follows the list", async () => {
  const draft = await draftProjectByOperations({
    description: "invoices",
    providers: [
      answering({
        operations: [
          { op: "setApp", args: { name: "Invoices" } },
          {
            op: "addModel",
            args: {
              model: "Invoice",
              fields: {
                number: "string!",
                lines: "InvoiceLine[]",
                total: "money = SUM(lines.amount)",
              },
            },
          },
          {
            op: "addModel",
            args: { model: "InvoiceLine", fields: { invoice: "Invoice!", amount: "money!" } },
          },
          { op: "addPage", args: { page: "invoices", model: "Invoice" } },
        ],
      }),
    ],
  });
  if (draft.kind !== "draft") throw new Error(draft.message);
  expect(draft.files["smithable.yml"]).toContain("SUM(lines.amount)");
  expect(checkSpecFiles(draft.files)).toEqual([]);
});

test("a total over a list that is never added is left out and named, not the draft", async () => {
  const draft = await draftProjectByOperations({
    description: "invoices",
    providers: [
      answering({
        operations: [
          { op: "setApp", args: { name: "Invoices" } },
          { op: "addModel", args: { model: "Invoice", fields: { number: "string!" } } },
          // Sent again in every correction round, as the bench's model did.
          {
            op: "addField",
            args: { model: "Invoice", field: "total", type: "money = SUM(lines.amount)" },
          },
          // A formula over fields the model never adds.
          {
            op: "addField",
            args: { model: "Invoice", field: "net", type: "money = price * quantity" },
          },
          { op: "addPage", args: { page: "invoices", model: "Invoice" } },
        ],
      }),
    ],
  });
  if (draft.kind !== "draft") throw new Error(draft.message);
  expect(draft.files["smithable.yml"]).toContain("number:");
  expect(draft.files["smithable.yml"]).not.toContain("SUM(");
  expect(draft.dropped).toEqual([
    expect.stringMatching(/^addField Invoice\.total: /),
    expect.stringMatching(/^addField Invoice\.net: /),
  ]);
});

test("invite-only asked before the team page gets the team page first", async () => {
  const shared = {
    "smithable.yml": "smithable: 0.1\napp:\n  name: Team\n",
    "smithable.auth.yml":
      "smithableAuth: 0.1\nsignIn:\n  providers: [google]\ndefaultAccess: shared\n",
  };
  const draft = await draftProjectByOperations({
    description: "a task list for our team",
    providers: [
      answering({
        operations: [
          { op: "setApp", args: { name: "Tasks" } },
          { op: "addModel", args: { model: "Task", fields: { title: "string!" } } },
          { op: "addPage", args: { page: "tasks", model: "Task" } },
          { op: "setSignUp", args: { who: "invited" } },
        ],
      }),
    ],
    starter: { name: "crm", files: shared },
  });
  if (draft.kind !== "draft") throw new Error(draft.message);
  expect(draft.files["smithable.auth.yml"]).toContain("selfSignUp: false");
  expect(draft.files["smithable.yml"]).toContain("users: manage");
  expect(draft.dropped).toBeUndefined();
});

test("a value worked out from other fields, written as a default, becomes a computed field", async () => {
  const draft = await draftProjectByOperations({
    description: "invoices",
    providers: [
      answering({
        operations: [
          { op: "setApp", args: { name: "Invoices" } },
          {
            op: "addModel",
            args: {
              model: "InvoiceLine",
              fields: {
                quantity: "int!",
                unitPrice: "money!",
                amount: "money! = quantity * unitPrice",
                addedOn: "date = TODAY()",
              },
            },
          },
          { op: "addPage", args: { page: "lines", model: "InvoiceLine" } },
        ],
      }),
    ],
  });
  if (draft.kind !== "draft") throw new Error(draft.message);
  expect(draft.files["smithable.yml"]).toContain(
    "      amount:\n        type: money\n        formula: quantity * unitPrice\n",
  );
  expect(draft.files["smithable.yml"]).toContain("addedOn: date = TODAY()");
  expect(checkSpecFiles(draft.files)).toEqual([]);
});

test("only a default naming the model's other fields is a formula", () => {
  expect(computedField("money = quantity * unitPrice", ["quantity", "unitPrice"])).toEqual({
    type: "money",
    formula: "quantity * unitPrice",
  });
  expect(computedField("date = TODAY()", ["quantity"])).toBeUndefined();
  expect(computedField("int! = 12", ["quantity"])).toBeUndefined();
  expect(computedField("low | high", ["quantity"])).toBeUndefined();
});

test("a model declaring a field every model has keeps the model, without that field", async () => {
  const draft = await draftProjectByOperations({
    description: "a tool library",
    providers: [
      answering({
        operations: [
          { op: "setApp", args: { name: "Tools" } },
          {
            op: "addModel",
            args: {
              model: "Tool",
              fields: { name: "string!", owner: "User!", createdAt: "datetime" },
            },
          },
          { op: "addPage", args: { page: "tools", model: "Tool" } },
        ],
      }),
    ],
  });
  if (draft.kind !== "draft") throw new Error(draft.message);
  expect(draft.files["smithable.yml"]).toContain("  Tool:");
  expect(draft.files["smithable.yml"]).not.toMatch(/owner: User/);
  expect(draft.files["smithable.yml"]).toContain("tools:");
});

test("an owner that refers to another model becomes that model's reference, by its name", () => {
  const car = (fields: Record<string, string>) =>
    repaired({ op: "addModel", args: { model: "Car", fields } })?.args.fields;
  expect(car({ plate: "string!", owner: "Customer!", createdAt: "datetime" })).toEqual({
    plate: "string!",
    customer: "Customer!",
  });
  // The name taken already: owner and the model's name.
  expect(car({ customer: "Customer", owner: "Customer!" })).toEqual({
    customer: "Customer",
    ownerCustomer: "Customer!",
  });
});

test("a capacity that can never fill goes back to the model; setPublic leaves out pages never added", async () => {
  const shared = {
    "smithable.yml": "smithable: 0.1\napp:\n  name: Talks\n",
    "smithable.auth.yml":
      "smithableAuth: 0.1\nsignIn:\n  providers: [google]\ndefaultAccess: shared\n",
  };
  const draft = await draftProjectByOperations({
    description: "conference registration",
    providers: [
      answering({
        operations: [
          { op: "setApp", args: { name: "Talks" } },
          {
            op: "addModel",
            args: { model: "Talk", fields: { title: "string!", seats: "int! = 50" } },
          },
          { op: "addModel", args: { model: "Registration", fields: { talk: "Talk! unique" } } },
          { op: "addPage", args: { page: "talks", model: "Talk" } },
          { op: "setCapacity", args: { model: "Registration", per: "talk", max: "talk.seats" } },
          { op: "addLandingPage", args: { page: "home" } },
          { op: "setPublic", args: { pages: ["home", "history"], read: ["Talk"] } },
        ],
      }),
    ],
    starter: { name: "booking", files: shared },
  });
  if (draft.kind !== "draft") throw new Error(draft.message);
  // The capacity was refused, not shipped with its warning, and is named as left out.
  expect(draft.files["smithable.yml"]).not.toContain("capacity:");
  expect(draft.dropped).toEqual([
    expect.stringMatching(/^setCapacity Registration: .*never reached/),
  ]);
  expect(draft.files["smithable.auth.yml"]).toContain("pages: [home]");
});

test("places left over a list the model gets later: the model first, the computed field after", async () => {
  const draft = await draftProjectByOperations({
    description: "hair salon booking",
    providers: [
      answering({
        operations: [
          { op: "setApp", args: { name: "Salon" } },
          {
            op: "addModel",
            args: {
              model: "Slot",
              fields: {
                startsAt: "datetime!",
                capacity: "int! = 1",
                placesLeft: "int = capacity - COUNT(bookings)",
              },
            },
          },
          { op: "addModel", args: { model: "Booking", fields: { slot: "Slot!" } } },
          { op: "addField", args: { model: "Slot", field: "bookings", type: "Booking[]" } },
          { op: "addPage", args: { page: "slots", model: "Slot" } },
        ],
      }),
    ],
  });
  if (draft.kind !== "draft") throw new Error(draft.message);
  expect(draft.files["smithable.yml"]).toContain("formula: capacity - COUNT(bookings)");
  expect(checkSpecFiles(draft.files)).toEqual([]);
});

test("a public landing page's button to a list of public records opens that list to visitors", () => {
  const build = (steps: { op: string; args: Record<string, unknown> }[]) => {
    let files: ProjectFiles = {
      spec: BLANK["smithable.yml"] ?? "",
      auth: BLANK["smithable.auth.yml"],
      content: BLANK["smithable.content.yml"],
      ux: BLANK["smithable.ux.yml"],
    };
    for (const step of steps) {
      const result = applyOperation(files, step.op, step.args);
      if (!result.ok) throw new Error(`${step.op}: ${result.message}`);
      files = result.files;
    }
    return files;
  };
  const library = [
    { op: "addModel", args: { model: "Tool", fields: { name: "string!" } } },
    { op: "addModel", args: { model: "Loan", fields: { tool: "Tool!", borrower: "User" } } },
    { op: "addPage", args: { page: "tools", model: "Tool" } },
    { op: "addPage", args: { page: "loans", model: "Loan" } },
    { op: "addLandingPage", args: { page: "home", route: "/" } },
  ];
  const publicPages = (files: { auth?: string }) =>
    /pages: \[([^\]]*)\]/.exec(files.auth ?? "")?.[1];

  // The tools are public to read, and the landing page's button leads to their list.
  const done: { op: string; args: Record<string, unknown> }[] = [];
  const opened = openLinked(
    build([
      ...library,
      { op: "addSection", args: { page: "home", section: "callToAction", button: "tools" } },
      { op: "setPublic", args: { pages: ["home"], read: ["Tool"] } },
    ]),
    done,
  );
  expect(publicPages(opened)).toBe("home, tools");
  expect(opened.auth).toContain("read: [Tool]");
  expect(done).toEqual([{ op: "setPublic", args: { pages: ["home", "tools"] } }]);

  // A button into records visitors may not read stays the way to sign-in: nothing is opened.
  const closed = build([
    ...library,
    { op: "addSection", args: { page: "home", section: "callToAction", button: "loans" } },
    { op: "setPublic", args: { pages: ["home"], read: ["Tool"] } },
  ]);
  expect(openLinked(closed, [])).toBe(closed);

  // A hero's shortcut to such a page is taken off (a shortcut that only meets sign-in looks
  // broken), and the one to a page that was opened stays.
  const mends: { op: string; args: Record<string, unknown> }[] = [];
  const tidied = dropClosedShortcuts(
    openLinked(
      build([
        ...library,
        { op: "setShortcuts", args: { page: "home", pages: ["tools", "loans"] } },
        { op: "setPublic", args: { pages: ["home"], read: ["Tool"] } },
      ]),
      mends,
    ),
    mends,
  );
  expect(publicPages(tidied)).toBe("home, tools");
  expect(mends).toEqual([
    { op: "setPublic", args: { pages: ["home", "tools"] } },
    { op: "setShortcuts", args: { page: "home", pages: ["tools"] } },
  ]);
  expect(tidied.spec).toMatch(/shortcuts: \[tools\]/);
  expect(visitorFlaws(tidied)).toEqual([]);
  // Nothing to take off: the files are the same.
  expect(dropClosedShortcuts(tidied, [])).toBe(tidied);
});

test("a valid draft that a visitor would find broken goes back to the model once, with the validator's words", async () => {
  const library = [
    { op: "setApp", args: { name: "Tool library" } },
    { op: "addModel", args: { model: "Tool", fields: { name: "string!" } } },
    { op: "addPage", args: { page: "tools", model: "Tool" } },
    { op: "addLandingPage", args: { page: "home", route: "/" } },
    { op: "addSection", args: { page: "home", section: "catalogue", records: "Tool" } },
    { op: "setPublic", args: { pages: ["home"] } },
  ];
  const prompts: string[] = [];
  const provider = (answers: unknown[]): Provider => ({
    name: "fake",
    tier: "frontier",
    location: "eu",
    price: { input: 1, output: 3 },
    async complete(request) {
      prompts.push(request.user);
      const answer = answers[Math.min(prompts.length, answers.length) - 1];
      return { text: JSON.stringify(answer), model: "fake", inputTokens: 1, outputTokens: 1 };
    },
  });
  // The landing page is public and shows tools, which visitors may not read: the model is told,
  // and opens the tools.
  const fixed = await draftProjectByOperations({
    description: "a tool library",
    providers: [
      provider([
        { operations: library },
        { operations: [{ op: "setPublic", args: { pages: ["home"], read: ["Tool"] } }] },
      ]),
    ],
  });
  if (fixed.kind !== "draft") throw new Error("no draft");
  expect(prompts).toHaveLength(2);
  expect(prompts[1]).toContain("Visitors can open home, but may not read Tool");
  expect(fixed.files["smithable.auth.yml"]).toContain("read: [Tool]");
  expect(fixed.operations?.at(-1)).toEqual({
    op: "setPublic",
    args: { pages: ["home"], read: ["Tool"] },
  });

  // It is asked once: an answer that leaves it, or a remedy that cannot be applied, still gives
  // the draft that was valid before.
  for (const second of [
    { operations: [] },
    { operations: [{ op: "setPublic", args: { read: ["Nothing"] } }] },
  ]) {
    prompts.length = 0;
    const kept = await draftProjectByOperations({
      description: "a tool library",
      providers: [provider([{ operations: library }, second])],
    });
    if (kept.kind !== "draft") throw new Error("no draft");
    expect(prompts).toHaveLength(2);
    expect(kept.files["smithable.auth.yml"]).toContain("pages: [home]");
    expect(kept.files["smithable.auth.yml"]).not.toContain("read:");
    expect(checkSpecFiles(kept.files)).toEqual([]);
  }

  // A remedy that brings a new flaw is told of that one too: tools that name their keeper are
  // closed to visitors, which empties the landing page's section, which is then removed.
  prompts.length = 0;
  const twice = await draftProjectByOperations({
    description: "a tool library",
    providers: [
      provider([
        {
          operations: [
            library[0],
            {
              op: "addModel",
              args: { model: "Tool", fields: { name: "string!", keeper: "User" } },
            },
            ...library.slice(2, 5),
            { op: "setPublic", args: { pages: ["home"], read: ["Tool"] } },
          ],
        },
        { operations: [{ op: "setPublic", args: { read: [] } }] },
        { operations: [{ op: "removeSection", args: { page: "home", section: "catalogue" } }] },
      ]),
    ],
  });
  if (twice.kind !== "draft") throw new Error("no draft");
  expect(prompts).toHaveLength(3);
  expect(prompts[1]).toContain("Anyone on the internet can read Tool");
  expect(prompts[2]).toContain("remove the section of home that shows it");
  expect(twice.files["smithable.yml"]).not.toContain("catalogue");
  expect(visitorFlaws(toProjectFiles(twice.files))).toEqual([]);

  // A remedy that undoes an earlier one is not what the person gets: the tools closed in one
  // round and opened again in the next stay closed, the best the draft has been.
  prompts.length = 0;
  const back = await draftProjectByOperations({
    description: "a tool library",
    providers: [
      provider([
        {
          operations: [
            library[0],
            {
              op: "addModel",
              args: { model: "Tool", fields: { name: "string!", keeper: "User" } },
            },
            ...library.slice(2, 5),
            { op: "setPublic", args: { pages: ["home"], read: ["Tool"] } },
          ],
        },
        { operations: [{ op: "setPublic", args: { read: [] } }] },
        { operations: [{ op: "setPublic", args: { read: ["Tool"] } }] },
      ]),
    ],
  });
  if (back.kind !== "draft") throw new Error("no draft");
  expect(prompts).toHaveLength(3);
  expect(back.files["smithable.auth.yml"]).not.toContain("read:");
  expect(back.operations?.at(-1)).toEqual({ op: "setPublic", args: { read: [] } });

  // A field no app may hold (a card number, a password) is taken out by the engine itself,
  // with no call to the model; what the person gets says so in its operations.
  prompts.length = 0;
  const paying = await draftProjectByOperations({
    description: "a tool library",
    providers: [
      provider([
        {
          operations: [
            library[0],
            {
              op: "addModel",
              args: {
                model: "Member",
                fields: { name: "string!", cardNumber: "string", password: "string" },
              },
            },
            { op: "addPage", args: { page: "members", model: "Member" } },
          ],
        },
      ]),
    ],
  });
  if (paying.kind !== "draft") throw new Error("no draft");
  expect(prompts).toHaveLength(1);
  expect(paying.files["smithable.yml"]).not.toContain("cardNumber");
  expect(paying.files["smithable.yml"]).not.toContain("password");
  expect(paying.operations?.filter((o) => o.op === "removeField").map((o) => o.args.field)).toEqual(
    ["cardNumber", "password"],
  );

  // A draft without such a flaw costs no second call.
  prompts.length = 0;
  const fine = await draftProjectByOperations({
    description: "a tool library",
    providers: [
      provider([
        {
          operations: [
            ...library.slice(0, 5),
            { op: "setPublic", args: { pages: ["home"], read: ["Tool"] } },
          ],
        },
      ]),
    ],
  });
  expect(fine.kind).toBe("draft");
  expect(prompts).toHaveLength(1);
  // A whole draft round trip: seconds on a loaded machine, so not vitest's five.
}, 30_000);

test("a Swedish description sets the app's language before the model answers, and a repeat is skipped", async () => {
  const draft = await draftProjectByOperations({
    description:
      "En uppgiftslista för vårt lag: varje uppgift har en titel och en ansvarig, och vi ser vad som är kvar att göra.",
    providers: [
      answering({
        operations: [
          { op: "setLanguage", args: { language: "sv" } },
          { op: "setApp", args: { name: "Uppgifter" } },
          { op: "addModel", args: { model: "Task", fields: { title: "string!" } } },
          { op: "setText", args: { path: ["models", "Task", "pluralLabel"], text: "Uppgifter" } },
          { op: "addPage", args: { page: "uppgifter", model: "Task" } },
        ],
      }),
    ],
  });
  if (draft.kind !== "draft") throw new Error("no draft");
  expect(draft.operations?.[0]).toEqual({ op: "setLanguage", args: { language: "sv" } });
  expect(draft.operations?.filter((o) => o.op === "setLanguage")).toHaveLength(1);
  expect(draft.files["smithable.content.yml"]).toContain("language: sv");
});

test("in a Swedish app, every label, choice, action and page left in English is named, to go back to the model", () => {
  let files: ProjectFiles = {
    spec: `smithable: 0.1
app: { name: Elbolaget }
models:
  Outage:
    fields:
      title: string!
      state: new | handled
pages:
  outages: { crud: Outage, actions: [resolve] }
actions:
  resolve: { on: Outage, set: { state: handled } }
`,
    auth: "smithableAuth: 0.1\nsignIn:\n  providers: [email]\ndefaultAccess: shared\n",
  };
  expect(untranslated(files)).toBeUndefined();
  const step = (op: string, args: Record<string, unknown>) => {
    const result = applyOperation(files, op, args);
    if (!result.ok) throw new Error(result.message);
    files = result.files;
  };
  step("setLanguage", { language: "sv" });
  step("setText", { path: ["models", "Outage", "label"], text: "Avbrott" });
  step("setText", { path: ["models", "Outage", "fields", "state", "values", "new"], text: "Ny" });
  expect(untranslated(files)).toEqual({
    language: "Swedish",
    paths: [
      "models.Outage.pluralLabel",
      "models.Outage.fields.title.label",
      "models.Outage.fields.state.label",
      "models.Outage.fields.state.values.handled",
      "actions.resolve.label",
      "pages.outages.title",
    ],
  });
});

test("a description that asks for two languages gets the other one added last, its file to fill in", async () => {
  const draft = await draftProjectByOperations({
    description:
      "En uppgiftslista för vårt lag, på svenska och engelska: varje uppgift har en titel och en ansvarig.",
    providers: [
      answering({
        operations: [
          { op: "setApp", args: { name: "Uppgifter" } },
          { op: "addModel", args: { model: "Task", fields: { title: "string!" } } },
          { op: "setText", args: { path: ["models", "Task", "label"], text: "Uppgift" } },
          { op: "setText", args: { path: ["models", "Task", "pluralLabel"], text: "Uppgifter" } },
          {
            op: "setText",
            args: { path: ["models", "Task", "fields", "title", "label"], text: "Titel" },
          },
          { op: "addPage", args: { page: "uppgifter", model: "Task" } },
          { op: "setText", args: { path: ["pages", "uppgifter", "title"], text: "Uppgifter" } },
        ],
      }),
    ],
  });
  if (draft.kind !== "draft") throw new Error(draft.kind === "failed" ? draft.message : "no draft");
  expect(draft.operations?.at(-1)).toEqual({ op: "addLanguage", args: { language: "en" } });
  expect(draft.files["smithable.content.yml"]).toMatch(/languages: \[\s*en\s*\]/);
  expect(draft.files["smithable.content.en.yml"]).toContain("models:");
});

test("a drafted landing page keeps its footer last, and its sections get the items drafted for them", async () => {
  const provider: Provider = {
    name: "fake",
    tier: "frontier",
    location: "eu",
    price: { input: 1, output: 3 },
    async complete() {
      return {
        text: JSON.stringify({
          operations: [
            { op: "setApp", args: { name: "Pasio Padel Club" } },
            { op: "addModel", args: { model: "Court", fields: { name: "string!" } } },
            { op: "addPage", args: { page: "courts", model: "Court" } },
            { op: "addLandingPage", args: { page: "home" } },
            { op: "addSection", args: { page: "home", section: "features" } },
            { op: "addSection", args: { page: "home", section: "faq" } },
            {
              op: "setItems",
              args: {
                page: "home",
                section: "faq",
                items: [{ question: "Can children play?", answer: "Yes, from six." }],
              },
            },
          ],
        }),
        model: "fake",
        inputTokens: 1,
        outputTokens: 1,
      };
    },
  };
  const draft = await draftProjectByOperations({
    description: "a padel club where members book courts",
    providers: [provider],
  });
  if (draft.kind !== "draft") throw new Error(draft.message);
  const spec = draft.files["smithable.yml"] ?? "";
  expect(spec.indexOf("footer")).toBeGreaterThan(spec.indexOf("faq"));
  expect(draft.operations).toContainEqual({
    op: "moveSection",
    args: { page: "home", section: "footer", after: "faq" },
  });
  expect(draft.files["smithable.content.yml"]).toContain("question: Can children play?");
  // A footer already last is left where it is.
  const files = toProjectFiles(draft.files);
  const done: { op: string; args: Record<string, unknown> }[] = [];
  expect(footerLast(files, done)).toBe(files);
  expect(done).toEqual([]);
});
