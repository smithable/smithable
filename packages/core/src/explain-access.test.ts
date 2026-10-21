import { describe, expect, test } from "vitest";
import { actionAccess, modelAccess, pageAccess } from "./access.js";
import { type AuthIR, validateAuth } from "./auth.js";
import { type AccessScenario, type AccessVerb, explainAccess } from "./explain-access.js";
import type { SpecIR } from "./ir.js";
import { validateSpec } from "./spec.js";

const examples = import.meta.glob("../../../examples/*/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function load(name: string) {
  const spec = examples[`../../../examples/${name}/smithable.yml`] as string;
  const authText = examples[`../../../examples/${name}/smithable.auth.yml`] as string;
  const roles = validateAuth({ path: "smithable.auth.yml", text: authText }).auth?.roles.map(
    (r) => r.name,
  );
  const ir = validateSpec({ path: "smithable.yml", text: spec }, roles ? { roles } : {})
    .ir as SpecIR;
  const auth = validateAuth({ path: "smithable.auth.yml", text: authText }, ir).auth as AuthIR;
  return { ir, auth };
}

const paths = (e: { reasons: { at: { path: string } }[] }) => e.reasons.map((r) => r.at.path);

describe("booking: a private app with public pages and records", () => {
  const { ir, auth } = load("booking");
  const ask = (
    scenario: AccessScenario,
    resource: Parameters<typeof explainAccess>[3],
    verb: AccessVerb,
  ) => explainAccess(ir, auth, scenario, resource, verb);

  test("pages: public ones for anyone, the rest by the pages grant", () => {
    const schedule = ask({}, { kind: "page", page: "schedule" }, "open");
    expect(schedule.verdict).toBe("allowed");
    expect(paths(schedule)).toEqual(["public.pages"]);
    const mine = ask({}, { kind: "page", page: "my-bookings" }, "open");
    expect(mine.verdict).toBe("denied");
    expect(mine.reasons[0]?.text).toContain("needs signing in");
    const member = ask({ as: "member" }, { kind: "page", page: "my-bookings" }, "open");
    expect(member).toEqual({
      verdict: "allowed",
      reasons: [
        {
          at: { file: "smithable.auth.yml", path: "roles.member.pages" },
          text: "member's pages grant names my-bookings.",
        },
      ],
    });
    expect(
      ask({ as: "admin" }, { kind: "page", page: "my-bookings" }, "open").reasons[0]?.text,
    ).toBe("Administrators do everything.");
  });

  test("reading: anyone's sessions, only published posts, a member's own bookings", () => {
    expect(ask({}, { kind: "model", model: "Session" }, "read").verdict).toBe("allowed");
    const posts = ask({}, { kind: "model", model: "Post" }, "read");
    expect(posts.verdict).toBe("conditional");
    expect(posts.reasons.at(-1)).toEqual({
      at: { file: "smithable.auth.yml", path: "public.read.Post.where" },
      text: "Anyone reads posts only where status is published.",
    });
    expect(
      ask({ values: { status: "published" } }, { kind: "model", model: "Post" }, "read").verdict,
    ).toBe("allowed");
    const draft = ask({ values: { status: "draft" } }, { kind: "model", model: "Post" }, "read");
    expect(draft.verdict).toBe("denied");
    expect(draft.reasons.at(-1)?.text).toBe(
      "This post does not fit: anyone reads posts only where status is published.",
    );
    expect(ask({}, { kind: "model", model: "Booking" }, "read").verdict).toBe("denied");

    const member = (record?: AccessScenario["record"]) =>
      ask({ as: "member", record }, { kind: "model", model: "Booking" }, "read");
    expect(member().verdict).toBe("conditional");
    expect(paths(member())).toEqual(["defaultAccess"]);
    expect(member("own").verdict).toBe("allowed");
    expect(member("own").reasons[1]).toEqual({
      at: { file: "smithable.yml", path: "models.Booking" },
      text: "This booking is their own: they are its owner.",
    });
    expect(member("another's").verdict).toBe("denied");
    expect(member("ownerless").verdict).toBe("denied");
    // Sessions are public without a condition, so a member reads them all.
    expect(paths(ask({ as: "member" }, { kind: "model", model: "Session" }, "read"))).toEqual([
      "public.read",
    ]);
  });

  test("adding and changing: the create grant, the record rule for one's own", () => {
    expect(ask({ as: "member" }, { kind: "model", model: "Booking" }, "create")).toEqual({
      verdict: "allowed",
      reasons: [
        {
          at: { file: "smithable.auth.yml", path: "roles.member.create" },
          text: "member's create grant names Booking.",
        },
      ],
    });
    const session = ask({ as: "member" }, { kind: "model", model: "Session" }, "create");
    expect(session.verdict).toBe("denied");
    expect(session.reasons[0]?.text).toContain("the record rule adds nothing");
    expect(ask({}, { kind: "model", model: "Message" }, "create").verdict).toBe("allowed");

    expect(
      ask({ as: "member", record: "own" }, { kind: "model", model: "Booking" }, "write").verdict,
    ).toBe("allowed");
    expect(ask({ as: "member" }, { kind: "model", model: "Booking" }, "write").verdict).toBe(
      "conditional",
    );
    const other = ask(
      { as: "member", record: "another's" },
      { kind: "model", model: "Booking" },
      "delete",
    );
    expect(other.verdict).toBe("denied");
    expect(other.reasons.map((r) => r.text)).toEqual([
      "Everyone who signs in deletes their own bookings; member's delete grant does not name Booking, so not everyone's.",
      "This booking is someone else's: its owner is another person.",
    ]);
    expect(ask({}, { kind: "model", model: "Booking" }, "write").verdict).toBe("denied");
  });

  test("names it does not know, and verbs a resource does not take, are errors", () => {
    expect(() => ask({ as: "teacher" }, { kind: "page", page: "schedule" }, "open")).toThrow(
      'no role named "teacher"',
    );
    expect(() => ask({}, { kind: "page", page: "team" }, "open")).toThrow('no page named "team"');
    expect(() => ask({}, { kind: "page", page: "schedule" }, "read")).toThrow("A page is opened");
    expect(() => ask({}, { kind: "model", model: "Booking" }, "run")).toThrow(
      "Records are not run",
    );
  });
});

describe("crm: a shared app, a custom action, the administrators' page", () => {
  const { ir, auth } = load("crm");
  const ask = (
    scenario: AccessScenario,
    resource: Parameters<typeof explainAccess>[3],
    verb: AccessVerb,
  ) => explainAccess(ir, auth, scenario, resource, verb);

  test("shared records are everyone's to see; changing everyone's is the write grant", () => {
    expect(ask({ as: "sales" }, { kind: "model", model: "Customer" }, "read")).toEqual({
      verdict: "allowed",
      reasons: [
        {
          at: { file: "smithable.auth.yml", path: "defaultAccess" },
          text: "With defaultAccess shared, everyone who signs in sees every record.",
        },
      ],
    });
    expect(
      ask({ as: "sales", record: "another's" }, { kind: "model", model: "Customer" }, "write")
        .reasons[0]?.text,
    ).toBe("sales's write grant is all, which covers customers.");
    expect(
      ask({ as: "sales", record: "another's" }, { kind: "model", model: "Customer" }, "delete")
        .verdict,
    ).toBe("denied");
    expect(
      ask({ as: "sales", record: "own" }, { kind: "model", model: "Customer" }, "delete").verdict,
    ).toBe("allowed");
  });

  test("pages: all leaves out the team page; a custom action needs the actions grant", () => {
    const team = ir.pages.find((p) => p.pattern.kind === "users") as SpecIR["pages"][number];
    const sales = ask({ as: "sales" }, { kind: "page", page: team.id }, "open");
    expect(sales.verdict).toBe("denied");
    expect(sales.reasons[0]?.text).toContain("leaves out the pages kept for administrators");
    expect(ask({ as: "admin" }, { kind: "page", page: team.id }, "open").verdict).toBe("allowed");
    const merge = ask({ as: "sales" }, { kind: "action", action: "mergeCustomers" }, "run");
    expect(merge.verdict).toBe("denied");
    expect(paths(merge)).toEqual(["actions.mergeCustomers", "roles.sales.actions"]);
    expect(ask({ as: "admin" }, { kind: "action", action: "mergeCustomers" }, "run").verdict).toBe(
      "allowed",
    );
    expect(ask({}, { kind: "action", action: "mergeCustomers" }, "run").verdict).toBe("denied");
  });
});

describe("invoicing: a standard action with a condition", () => {
  const { ir, auth } = load("invoicing");
  const run = (scenario: AccessScenario) =>
    explainAccess(ir, auth, scenario, { kind: "action", action: "markSent" }, "run");

  test("a member runs it on their own draft invoices", () => {
    const own = run({ as: "member", record: "own", values: { status: "draft" } });
    expect(own.verdict).toBe("allowed");
    expect(paths(own)).toEqual([
      "actions.markSent",
      "defaultAccess",
      "models.Invoice",
      "actions.markSent.when",
    ]);
    expect(own.reasons.at(-1)?.text).toBe("This invoice fits: status is draft.");
    const sent = run({ as: "member", record: "own", values: { status: "sent" } });
    expect(sent.verdict).toBe("denied");
    expect(sent.reasons.at(-1)?.text).toBe(
      "This invoice does not fit: mark sent runs only while status is draft.",
    );
    expect(run({ as: "member", record: "own" }).verdict).toBe("conditional");
    expect(run({ as: "member" }).verdict).toBe("conditional");
    expect(run({ as: "member", record: "another's", values: { status: "draft" } }).verdict).toBe(
      "denied",
    );
    const admin = run({ as: "admin" });
    expect(admin.verdict).toBe("conditional");
    expect(admin.reasons.at(-1)?.text).toBe("Mark sent runs only while status is draft.");
    expect(run({ as: "admin", values: { status: "draft" } }).verdict).toBe("allowed");
  });
});

describe("every example agrees with the rules the generated app enforces", () => {
  const withAuth = [...new Set(Object.keys(examples).map((p) => p.split("/")[4] as string))].filter(
    (name) => examples[`../../../examples/${name}/smithable.auth.yml`],
  );
  test.each(withAuth)("%s", (name) => {
    const { ir, auth } = load(name);
    const viewers = [undefined, ...auth.roles.map((r) => r.name)];
    const expected = (
      a: { public: boolean; roles: string[]; owner: boolean; where?: unknown },
      as?: string,
    ) =>
      (a.public && !a.where) || (as !== undefined && a.roles.includes(as))
        ? "allowed"
        : (a.public && a.where) || (as !== undefined && a.owner)
          ? "conditional"
          : "denied";
    for (const as of viewers) {
      for (const page of ir.pages)
        expect(
          explainAccess(ir, auth, { as }, { kind: "page", page: page.id }, "open").verdict,
          `${as} opens ${page.id}`,
        ).toBe(expected(pageAccess(page, auth), as));
      for (const model of ir.models)
        for (const op of ["read", "create", "write", "delete"] as const)
          expect(
            explainAccess(ir, auth, { as }, { kind: "model", model: model.name }, op).verdict,
            `${as} ${op} ${model.name}`,
          ).toBe(expected(modelAccess(model, auth)[op], as));
      for (const action of ir.actions) {
        const a = actionAccess(action, auth, ir.models);
        const verdict = explainAccess(
          ir,
          auth,
          { as },
          { kind: "action", action: action.name },
          "run",
        ).verdict;
        const base = expected(a, as);
        const when = !action.custom && action.when;
        expect(verdict, `${as} runs ${action.name}`).toBe(
          base === "allowed" && when ? "conditional" : base,
        );
      }
    }
  });
});
