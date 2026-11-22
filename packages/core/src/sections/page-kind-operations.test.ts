import { expect, test } from "vitest";
import { parse } from "yaml";
import { applyOperation, type ProjectFiles } from "../apply.js";

// The operations that reach a page kind's long form and a section's options (T1242 G5–G11,
// T1247): each writes what the reader takes, and the reader refuses what it does not.
const spec = `smithable: 0.1
app: { name: Kiosken, currency: EUR, timezone: Europe/Mariehamn }
models:
  Dish:
    fields:
      name: string!
      price: money!
      listPrice: money
      available: bool = true
  Order:
    fields:
      number: { type: int!, sequence: true }
      name: string!
      lines: OrderLine[]
  OrderLine:
    fields:
      order: Order!
      dish: Dish!
      quantity: int! = 1
      unitPrice: money!
      amount: { type: money, formula: quantity * unitPrice }
  Session:
    fields:
      title: string!
      startsAt: datetime!
      endsAt: datetime
      minutes: int
      dueOn: date
  Post:
    fields:
      title: string!
      headline: string
      body: markdown
  Profile:
    fields:
      businessName: string!
      vatNumber: string
pages:
  menu:
    route: /
    order: { from: Dish, into: Order, ask: [name], price: price }
  schedule:
    calendar: { model: Session, starts: startsAt }
  blog:
    articles: Post
  home:
    landing:
      hero:
      dishes: { records: Dish }
      faq:
  overview:
    dashboard:
      sessions: { count: Session }
`;
const files: ProjectFiles = { spec };

function ok(name: string, args: Record<string, unknown>, from: ProjectFiles = files) {
  const result = applyOperation(from, name, args);
  if (!result.ok) throw new Error(result.message);
  return result;
}
/** A page as written, read back. */
const page = (text: string, name: string) => parse(text).pages[name];
const refused = (name: string, args: Record<string, unknown>, from: ProjectFiles = files) => {
  const result = applyOperation(from, name, args);
  return result.ok ? "applied" : result.message;
};

test("setCalendar writes the long form, keeps one length, and goes back to the short form", () => {
  const long = ok("setCalendar", { page: "schedule", ends: "endsAt", title: "title" });
  expect(page(long.files.spec, "schedule").calendar).toEqual({
    model: "Session",
    starts: "startsAt",
    ends: "endsAt",
    title: "title",
  });
  const byDuration = ok("setCalendar", { page: "schedule", duration: "minutes" }, long.files);
  expect(page(byDuration.files.spec, "schedule").calendar).toEqual({
    model: "Session",
    starts: "startsAt",
    title: "title",
    duration: "minutes",
  });
  const back = ok(
    "setCalendar",
    { page: "schedule", duration: "none", title: "none" },
    byDuration.files,
  );
  expect(page(back.files.spec, "schedule").calendar).toEqual({
    model: "Session",
    starts: "startsAt",
  });
  expect(refused("setCalendar", { page: "schedule", ends: "endsAt", duration: "minutes" })).toMatch(
    /its end or its duration/,
  );
  expect(refused("setCalendar", { page: "blog", title: "title" })).toMatch(/not a calendar/);
  // The reader checks the field: a string does not end a record.
  expect(refused("setCalendar", { page: "schedule", ends: "title" })).toMatch(/invalid/);
});

test("setArticles names a part, and none infers it again", () => {
  const named = ok("setArticles", { page: "blog", title: "headline" });
  expect(page(named.files.spec, "blog").articles).toEqual({ model: "Post", title: "headline" });
  const back = ok("setArticles", { page: "blog", title: "none" }, named.files);
  expect(page(back.files.spec, "blog").articles).toBe("Post");
});

test("setOrder writes the price, hours and lead, and takes them away", () => {
  const set = ok("setOrder", {
    page: "menu",
    price: "price",
    available: "none",
    hours: "mon-thu 11:00-20:00, fri-sat 11:00-22:00",
    lead: 20,
  });
  expect(page(set.files.spec, "menu").order).toMatchObject({
    price: "price",
    available: "none",
    hours: { "mon-thu": "11:00-20:00", "fri-sat": "11:00-22:00" },
    lead: 20,
  });
  const unset = ok("setOrder", { page: "menu", hours: "none", lead: 0, available: "" }, set.files);
  expect(page(unset.files.spec, "menu").order).toEqual({
    from: "Dish",
    into: "Order",
    ask: ["name"],
    price: "price",
  });
  expect(refused("setOrder", { page: "menu", hours: "monday" })).toMatch(/not a day and its hours/);
});

test("addSettingsPage and addOnboardingPage add the two pages of one record", () => {
  const settings = ok("addSettingsPage", { page: "profile", model: "Profile" });
  expect(page(settings.files.spec, "profile")).toEqual({ settings: "Profile" });
  const onboarding = ok("addOnboardingPage", {
    page: "welcome",
    model: "Profile",
    steps: { business: ["businessName"], tax: "vatNumber" },
  });
  expect(page(onboarding.files.spec, "welcome")).toEqual({
    onboarding: { model: "Profile", steps: { business: ["businessName"], tax: ["vatNumber"] } },
  });
  // A required field without a default must be asked: the reader says so.
  expect(
    refused("addOnboardingPage", {
      page: "welcome",
      model: "Profile",
      steps: { tax: ["vatNumber"] },
    }),
  ).toMatch(/invalid/);
});

test("setSectionList gives a records section its search, filters and limit", () => {
  const set = ok("setSectionList", { page: "home", section: "dishes", search: true, limit: 6 });
  expect(page(set.files.spec, "home").landing.dishes).toEqual({
    records: "Dish",
    search: true,
    limit: 6,
  });
  const unset = ok(
    "setSectionList",
    { page: "home", section: "dishes", search: false, limit: 0 },
    set.files,
  );
  expect(page(unset.files.spec, "home").landing.dishes).toEqual({ records: "Dish" });
  expect(refused("setSectionList", { page: "home", section: "faq", limit: 3 })).toMatch(
    /shows no model's records/,
  );
});

test("addSection places a section where asked and adds a calculator", () => {
  const placed = ok("addSection", {
    page: "home",
    section: "prices",
    calculator: { guests: "int = 4", total: { type: "money", formula: "guests * 25" } },
    after: "hero",
  });
  const landing = page(placed.files.spec, "home").landing;
  expect(Object.keys(landing)).toEqual(["hero", "prices", "dishes", "faq"]);
  expect(landing.prices.calculator.fields).toEqual({
    guests: "int = 4",
    total: { type: "money", formula: "guests * 25" },
  });
  expect(
    refused("addSection", { page: "home", section: "about", text: true, before: "nowhere" }),
  ).toMatch(/no section named "nowhere"/);
});

test("addTile adds a list of what is due and the app's latest changes", () => {
  const due = ok("addTile", {
    page: "overview",
    tile: "soon",
    measure: "list",
    of: "Session",
    when: "dueOn",
    within: "2 weeks",
  });
  expect(page(due.files.spec, "overview").dashboard.soon).toEqual({
    list: "Session",
    when: "dueOn",
    within: "2 weeks",
  });
  const recent = ok("addTile", {
    page: "overview",
    tile: "recent",
    measure: "activity",
    of: "changes",
  });
  expect(page(recent.files.spec, "overview").dashboard.recent).toEqual({ activity: "changes" });
  expect(
    refused("addTile", { page: "overview", tile: "x", measure: "activity", of: "Session" }),
  ).toMatch(/activity changes/);
  expect(
    refused("addTile", {
      page: "overview",
      tile: "x",
      measure: "count",
      of: "Session",
      when: "dueOn",
    }),
  ).toMatch(/goes with a list/);
});

test("changeSectionKind keeps the name, the place and the texts the new kind has, and says what goes", () => {
  const content = `smithableContent: 0.1
pages:
  home:
    dishes:
      eyebrow: Today
      title: Our dishes
      text: Cooked to order.
`;
  const changed = ok(
    "changeSectionKind",
    { page: "home", section: "dishes", kind: "callToAction" },
    { spec, content },
  );
  const landing = page(changed.files.spec, "home").landing;
  expect(landing.dishes).toEqual({ callToAction: null });
  expect(Object.keys(landing)).toEqual(["hero", "dishes", "faq"]);
  // A call to action has a title and a text, and no eyebrow.
  expect(changed.files.content).toContain("title: Our dishes");
  expect(changed.files.content).not.toContain("eyebrow");
  expect(changed.description).toContain("it no longer has its records of Dish, its eyebrow text");
  const back = ok(
    "changeSectionKind",
    { page: "home", section: "dishes", kind: "records", records: "Dish" },
    changed.files,
  );
  expect(page(back.files.spec, "home").landing.dishes).toEqual({ records: "Dish" });
  expect(
    refused("changeSectionKind", {
      page: "home",
      section: "faq",
      kind: "records",
      records: "Dish",
    }),
  ).toMatch(/needs another name/);
  expect(
    refused("changeSectionKind", {
      page: "home",
      section: "dishes",
      kind: "records",
      records: "Dish",
    }),
  ).toMatch(/records section already/);
});

test("an unknown argument is refused with the ones the operation takes", () => {
  expect(refused("moveSection", { page: "home", section: "faq", below: "hero" })).toBe(
    'moveSection: Unknown argument "below": it takes page, section, before, after.',
  );
});

test("setResults puts a calculator page's results below its inputs, and beside them again", () => {
  const calc = `smithable: 0.1
app: { name: Loans }
pages:
  mortgage:
    calculator:
      fields:
        price: money = 300000
        monthly: { type: money, formula: price / 12 }
`;
  const below = ok("setResults", { page: "mortgage", results: "below" }, { spec: calc });
  expect(parse(below.files.ux ?? "").pages.mortgage.form.results).toBe("below");
  const beside = ok("setResults", { page: "mortgage", results: "beside" }, below.files);
  expect(parse(beside.files.ux ?? "")?.pages?.mortgage?.form?.results).toBeUndefined();
  expect(refused("setResults", { page: "home", results: "below" })).toMatch(
    /not a calculator page/,
  );
});

test("changeSectionKind keeps the items that fit the new kind, and names a calculator's fields as gone", () => {
  const withItems = spec.split("      faq:\n").join("      faq:\n      plans: { features: }\n");
  const content = (items: string) => `smithableContent: 0.1
pages:
  home:
    plans:
      title: Plans
      items:
${items}`;
  const fits = ok(
    "changeSectionKind",
    { page: "home", section: "plans", kind: "pricing" },
    { spec: withItems, content: content("        - text: Monthly\n        - text: Yearly\n") },
  );
  expect(parse(fits.files.content ?? "").pages.home.plans.items).toEqual([
    { text: "Monthly" },
    { text: "Yearly" },
  ]);
  const notFit = ok(
    "changeSectionKind",
    { page: "home", section: "plans", kind: "pricing" },
    {
      spec: withItems,
      content: content("        - title: Monthly\n          text: Paid each month\n"),
    },
  );
  expect(parse(notFit.files.content ?? "").pages.home.plans.items).toBeUndefined();
  expect(notFit.description).toContain("its items");
  const calculated = ok("addSection", {
    page: "home",
    section: "costs",
    calculator: { guests: "int = 4" },
  });
  const toText = ok(
    "changeSectionKind",
    { page: "home", section: "costs", kind: "text" },
    calculated.files,
  );
  expect(page(toText.files.spec, "home").landing.costs).toEqual({ text: null });
  expect(toText.description).toContain("its calculator fields");
  expect(toText.destructive).toBe(true);
});

test("an argument named like an object's own property is still unknown", () => {
  expect(refused("setResults", { page: "home", results: "below", constructor: "x" })).toMatch(
    /Unknown argument "constructor"/,
  );
});
