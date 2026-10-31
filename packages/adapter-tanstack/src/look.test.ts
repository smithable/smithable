import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  type ThemeIR,
  themeNamed,
  validateAuth,
  validateContent,
  validateSpec,
  validateUx,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: CRM }
models:
  Customer:
    fields:
      name: string!
      email: email
      phone: phone
      segment: smb | enterprise
      creditLimit: { type: money, min: 0, max: 100000 }
      notes: text
pages:
  customers: { crud: Customer }
`,
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [customers], read: [Customer], create: [Customer] }\n",
  },
  ir,
).auth as AuthIR;
const ux = validateUx(
  {
    path: "smithable.ux.yml",
    text: `smithableUx: 0.1
pages:
  customers:
    table: { sort: -creditLimit, view: cards }
    form:
      columns: 2
      sections:
        - { name: contact, fields: [name, email, phone] }
        - { name: terms, fields: [creditLimit, segment] }
      control: { creditLimit: slider, segment: radio, notes: textarea }
`,
  },
  ir,
).ux;
const content =
  validateContent(
    {
      path: "smithable.content.yml",
      text: "smithableContent: 0.1\npages:\n  customers:\n    form: { sections: { contact: { title: How to reach them } } }\n",
    },
    ir,
  ).content ?? emptyContent();
const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content, ux });
const file = (path: string) => files.find((f) => f.path === path)?.content ?? "";

test("the form's sections, columns and controls reach the routes as props; the list its sort and view", () => {
  const form = file("src/routes/customers/new.tsx");
  const oneLine = form.replace(/\s+/g, " ").replace(/,( ?[}\]])/g, "$1");
  expect(oneLine).toContain(
    '{ name: "contact", title: "How to reach them", fields: ["name", "email", "phone"] }',
  );
  expect(oneLine).toContain(
    '{ name: "terms", title: "Terms", fields: ["creditLimit", "segment"] }',
  );
  expect(form).toContain("formColumns={2}");
  expect(form).toContain(
    'control={{ creditLimit: "slider", segment: "radio", notes: "textarea" }}',
  );
  const list = file("src/routes/customers/index.tsx");
  expect(list).toContain('rows={sortRows(rows, "creditLimit", true)}');
  expect(list).toContain('view="cards"');
  expect(file("src/generated/customer.ts").replace(/\s+/g, " ")).toMatch(/min: 0, max: 100000/);
});

test("without any of it the routes are as before", () => {
  const plain = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const form = plain.find((f) => f.path === "src/routes/customers/new.tsx")?.content ?? "";
  expect(form).not.toContain("sections=");
  expect(form).not.toContain("control=");
  expect(plain.find((f) => f.path === "src/routes/customers/index.tsx")?.content).not.toContain(
    "sortRows",
  );
});

test("a landing section's eyebrow and its columns reach the page as props; unsaid, none", () => {
  const site = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Bistro }
models:
  Dish: { fields: { name: string! } }
pages:
  home:
    route: /
    landing: { hero: {}, dishes: { records: Dish }, faq: {}, gallery: {} }
  dishes: { crud: Dish }
`,
  }).ir as SpecIR;
  const page = (uxText: string) => {
    const texts =
      validateContent(
        {
          path: "smithable.content.yml",
          text: `smithableContent: 0.1
pages:
  home:
    hero: { eyebrow: Open daily }
    dishes: { eyebrow: Popular dishes, title: Favorite meals }
    faq: { items: [{ question: Open on Sundays?, answer: Yes. }] }
    gallery: { items: [{ image: { src: images/a.webp, alt: A table } }] }
`,
        },
        site,
      ).content ?? emptyContent();
    return (
      generateApp(site, {
        smithableVersion: "0.0.0",
        auth: validateAuth(
          {
            path: "smithable.auth.yml",
            text: "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [home, dishes], read: [Dish] }\n",
          },
          site,
        ).auth as AuthIR,
        content: texts,
        ux: validateUx({ path: "smithable.ux.yml", text: uxText }, site).ux,
      }).find((f) => f.path === "src/routes/index.tsx")?.content ?? ""
    );
  };
  const looked = page(
    "smithableUx: 0.1\npages:\n  home:\n    sections: { dishes: { layout: grid, columns: 6 }, faq: { layout: list, columns: 2 }, gallery: { columns: 5 } }\n",
  );
  expect(looked).toContain('eyebrow="Open daily"');
  expect(looked).toContain('eyebrow="Popular dishes"');
  // The FAQ has no eyebrow in the content file, so it gets none.
  expect(looked.match(/eyebrow=/g)).toHaveLength(2);
  expect(looked).toContain("columns={6}");
  expect(looked).toContain("columns={2}");
  expect(looked).toContain("columns={5}");
  // Nothing said: no columns, and the kit keeps its own (cards 3, grid 4, gallery 3, FAQ 1).
  expect(page("smithableUx: 0.1\n")).not.toContain("columns=");
});

test("a section's band, a banded theme's every second section, a hero's second button and the photo layout reach the page", () => {
  const site = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Bistro }
models:
  Dish: { fields: { name: string! } }
pages:
  home:
    route: /
    landing:
      hero: { secondButton: dishes }
      dishes: { records: Dish }
      story: { text: }
      faq: {}
      gallery: {}
      callToAction: {}
      footer: {}
  dishes: { crud: Dish }
`,
  }).ir as SpecIR;
  const modern = themeNamed("modern") as ThemeIR;
  const stripes: ThemeIR = {
    ...modern,
    name: "stripes",
    style: { ...modern.style, surfaces: { ...modern.style.surfaces, sections: "banded" } },
  };
  const page = (uxText: string, contentText = "") => {
    const texts =
      validateContent(
        {
          path: "smithable.content.yml",
          text: `smithableContent: 0.1
pages:
  home:
${contentText}    faq: { items: [{ question: Open on Sundays?, answer: Yes. }] }
    gallery: { items: [{ image: { src: images/a.webp, alt: A table } }] }
`,
        },
        site,
      ).content ?? emptyContent();
    return (
      generateApp(site, {
        smithableVersion: "0.0.0",
        auth: validateAuth(
          {
            path: "smithable.auth.yml",
            text: "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [home, dishes], read: [Dish] }\n",
          },
          site,
        ).auth as AuthIR,
        content: texts,
        themes: [stripes],
        ux: validateUx({ path: "smithable.ux.yml", text: uxText }, site, [stripes]).ux,
      }).find((f) => f.path === "src/routes/index.tsx")?.content ?? ""
    );
  };
  const bandOf = (code: string, component: string) =>
    /band="(\w+)"/.exec(code.split(`<${component}\n`)[1]?.split("/>")[0] ?? "")?.[1];
  // Nothing said: no band anywhere, and the second button's words are its page's title.
  const plain = page("smithableUx: 0.1\n");
  expect(plain).not.toContain("band=");
  expect(plain).toContain('secondLink={{ to: "/dishes", label: pageUi["dishes"].title }}');
  // Bands as the ux file gives them, and the photo hero.
  const banded = page(
    "smithableUx: 0.1\npages:\n  home:\n    sections: { hero: { layout: photo }, faq: { band: inverse }, callToAction: { band: primary } }\n",
    "    hero: { secondButton: Our menu }\n",
  );
  expect(banded).toContain('layout="photo"');
  expect(banded).toContain('secondLink={{ to: "/dishes", label: "Our menu" }}');
  expect(bandOf(banded, "Faq")).toBe("inverse");
  expect(bandOf(banded, "CallToAction")).toBe("primary");
  expect(bandOf(banded, "RecordCards")).toBeUndefined();
  // A banded theme: counting from the first section after the hero, the second, fourth… are
  // muted (the text section with no words shows nothing and is not counted; the footer neither),
  // unless a section says its own band.
  const alternating = page("smithableUx: 0.1\ntheme: { preset: stripes }\n");
  expect(bandOf(alternating, "RecordCards")).toBeUndefined();
  expect(bandOf(alternating, "Faq")).toBe("muted");
  expect(bandOf(alternating, "Gallery")).toBeUndefined();
  expect(bandOf(alternating, "CallToAction")).toBe("muted");
  const own = page(
    "smithableUx: 0.1\ntheme: { preset: stripes }\npages:\n  home:\n    sections: { faq: { band: none }, gallery: { band: primary } }\n",
  );
  expect(bandOf(own, "Faq")).toBe("none");
  expect(bandOf(own, "Gallery")).toBe("primary");
  expect(bandOf(own, "CallToAction")).toBe("muted");
});

test("a ledger figures a model's first number when it has no money, by type, and cards do not (look-breadth §3)", () => {
  const site = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Rooms }
models:
  Room: { fields: { name: string!, note: string, seats: int } }
pages:
  home:
    route: /
    landing:
      rooms: { records: Room }
  rooms: { crud: Room }
`,
  }).ir as SpecIR;
  const home = (uxText: string) =>
    generateApp(site, {
      smithableVersion: "0.0.0",
      auth: validateAuth(
        {
          path: "smithable.auth.yml",
          text: "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [home, rooms], read: [Room] }\n",
        },
        site,
      ).auth as AuthIR,
      ux: validateUx({ path: "smithable.ux.yml", text: uxText }, site, []).ux,
    }).find((f) => f.path === "src/routes/index.tsx")?.content ?? "";
  const ledger = home(
    "smithableUx: 0.1\npages: { home: { sections: { rooms: { layout: ledger } } } }\n",
  );
  expect(ledger).toContain('layout="ledger"');
  expect(ledger).toContain(
    "amount: row.seats == null ? undefined : new Intl.NumberFormat().format(row.seats),",
  );
  expect(home("smithableUx: 0.1\n")).not.toContain("amount:");
});

test("an inline list's rows pick their references, with the choices loaded with the record (A 215)", () => {
  const shop = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Shop }
models:
  Product: { fields: { name: string! } }
  Order:
    fields:
      number: string!
      lines: OrderLine[]
  OrderLine: { fields: { order: Order!, product: Product!, quantity: int! = 1 } }
pages:
  orders: { crud: Order }
  products: { crud: Product }
navigation:
  main: [orders, products]
`,
  }).ir as SpecIR;
  const route =
    generateApp(shop, {
      smithableVersion: "0.0.0",
      auth: validateAuth(
        {
          path: "smithable.auth.yml",
          text: "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [orders, products], read: [Order, Product, OrderLine] }\n",
        },
        shop,
      ).auth as AuthIR,
      ux: validateUx(
        {
          path: "smithable.ux.yml",
          text: "smithableUx: 0.1\npages: { orders: { record: { lists: { lines: inline }, header: summary } } }\n",
        },
        shop,
        [],
      ).ux,
    }).find((f) => f.path === "src/routes/orders/$id.tsx")?.content ?? "";
  expect(route).toContain("rowOptions: { lines: { productId: await productOptions() } }");
  expect(route).toContain('fields={["productId","quantity"]}');
  expect(route).toContain("options={rowOptions.lines}");
  expect(route).toContain("createOrderLine({ data: { ...values, orderId: row.id } as never })");
  expect(route).toContain("<RecordSummary");
});
