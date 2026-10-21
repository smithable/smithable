import { expect, test } from "vitest";
import { applyOperation, findOperation, parseOperationArgs } from "./apply.js";
import { validateAuth } from "./auth.js";
import { hoursText, readHours } from "./hours.js";
import type { PatternOf } from "./ir.js";
import { validateSpec } from "./spec.js";

// The kiosk of docs/design/orders.md §2, the parts the order page reads.
const KIOSK = `smithable: 0.1
app: { name: Kiosken, currency: EUR, timezone: Europe/Mariehamn }
models:
  Dish:
    fields:
      name: string!
      price: money!
      section: starters | mains | drinks
      available: bool = true
  Order:
    fields:
      number: { type: int!, sequence: true }
      name: string!
      phone: phone!
      wanted: datetime
      note: text
      status: new | accepted | ready
      lines: OrderLine[]
  OrderLine:
    fields:
      order: Order!
      dish: Dish!
      quantity: int! = 1
      unitPrice: money!
      amount: { type: money, formula: quantity * unitPrice }
pages:
  menu:
    route: /
    order:
      from: Dish
      into: Order
      ask: [name, phone, wanted, note]
      hours: { mon-thu: "11:00-20:00", fri-sat: "11:00-22:00" }
      lead: 20
  orders: { crud: Order }
`;
const read = (text: string) => validateSpec({ path: "smithable.yml", text });
const errors = (text: string) =>
  read(text)
    .diagnostics.filter((d) => d.severity === "error")
    .map((d) => d.message);

test("the kiosk's order page reads, with the fields it relies on found", () => {
  expect(errors(KIOSK)).toEqual([]);
  const page = read(KIOSK).ir?.pages.find((p) => p.id === "menu")?.pattern as PatternOf<"order">;
  expect(page).toMatchObject({
    kind: "order",
    from: "Dish",
    into: "Order",
    ask: ["name", "phone", "wanted", "note"],
    lead: 20,
    price: "price",
    available: "available",
    lines: "lines",
    line: "OrderLine",
    item: "dish",
    unitPrice: "unitPrice",
    quantity: "quantity",
    number: "number",
  });
  expect(hoursText(page.hours ?? {})).toBe("Mon–Thu 11:00–20:00, Fri–Sat 11:00–22:00");
});

test("what the order page lacks is said in words", () => {
  const without = (from: string, to = "") => KIOSK.replace(from, to);
  expect(errors(without("      number: { type: int!, sequence: true }\n")).join()).toContain(
    "Order needs a number counting up for the order page",
  );
  expect(errors(without("      unitPrice: money!\n", "")).join()).toContain(
    "OrderLine needs one money field for the price when ordered",
  );
  // A part found twice is named by its key, or left out with none; nothing goes by a field's name.
  expect(
    errors(without("      price: money!\n", "      price: money!\n      cost: money\n")).join(),
  ).toContain("Dish has several money fields (price, cost): name the price of the order page");
  const named = without(
    "      price: money!\n",
    "      cost: money\n      price: money!\n",
  ).replace("      into: Order\n", "      into: Order\n      price: cost\n");
  expect(errors(named)).toEqual([]);
  expect(read(named).ir?.pages[0]?.pattern).toMatchObject({ price: "cost" });
  const twoBools = without(
    "      available: bool = true\n",
    "      available: bool = true\n      vegan: bool\n",
  );
  expect(errors(twoBools).join()).toContain(
    'Dish has several yes/no fields (available, vegan): name the available of the order page of page "menu", or "available: none"',
  );
  const noneBool = twoBools.replace(
    "      into: Order\n",
    "      into: Order\n      available: none\n",
  );
  expect(errors(noneBool)).toEqual([]);
  expect(read(noneBool).ir?.pages[0]?.pattern).not.toHaveProperty("available");
  // A choice (a status staff set) is not a value the customer gives.
  expect(
    errors(without("      ask: [name, phone, wanted, note]", "      ask: [name, status]")).join(),
  ).toContain('The customer cannot be asked for "status"');
  expect(
    errors(without("      ask: [name, phone, wanted, note]", "      ask: [name]")).join(),
  ).toContain("An order needs phone, but the order page does not ask for it.");
  expect(errors(without('mon-thu: "11:00-20:00"', 'mon-thu: "20:00-11:00"')).join()).toContain(
    '"20:00-11:00" closes before it opens.',
  );
});

test("hours: days and ranges, lists of spans, and what is not one", () => {
  const { hours, problems } = readHours([
    ["mon-fri", "09:00-17:00"],
    ["sat", ["10:00-12:00", "13:00-15:00"]],
    ["funday", "09:00-10:00"],
    ["sun", ["10:00-12:00", "11:00-13:00"]],
  ]);
  expect(hours.wed).toEqual([[540, 1020]]);
  expect(hours.sat).toEqual([
    [600, 720],
    [780, 900],
  ]);
  expect(problems.map((p) => p.message)).toEqual([
    '"funday" is not a day: write mon, tue, wed, thu, fri, sat or sun, or a range like mon-fri.',
    'The spans of "sun" overlap.',
  ]);
});

test("addOrderPage adds the page, and a renamed field asked for follows into ask", () => {
  const add = findOperation("addOrderPage");
  if (!add) throw new Error("no addOrderPage");
  const base = KIOSK.replace(/ {2}menu:\n(?: {4}.*\n)+/, "");
  const made = applyOperation(
    { spec: base },
    "addOrderPage",
    parseOperationArgs(add, ["menu", "Dish", "Order", "--ask", "name,phone", "--route", "/"]),
  );
  if (!made.ok) throw new Error(made.message);
  expect(made.files.spec).toContain("order:");
  expect(errors(made.files.spec)).toEqual([]);
  const rename = findOperation("renameField");
  if (!rename) throw new Error("no renameField");
  const renamed = applyOperation(
    { spec: made.files.spec },
    "renameField",
    parseOperationArgs(rename, ["Order", "phone", "mobile"]),
  );
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.spec).toMatch(/ask:\s*(\[\s*name,\s*mobile\s*\]|\n\s*- name\n\s*- mobile)/);
});

test("visitors must read what they choose, never the orders or their lines", () => {
  const ir = read(KIOSK).ir;
  if (!ir) throw new Error("no ir");
  const warnings = (publicRead: string) =>
    validateAuth(
      {
        path: "smithable.auth.yml",
        text: `smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { staff: { pages: all } }\ndefaultRole: staff\npublic: { pages: [menu], read: [${publicRead}], create: [Order] }\n`,
      },
      ir,
    ).diagnostics.map((d) => d.message);
  expect(warnings("Dish").join()).not.toMatch(/may not read/);
  expect(warnings("").join()).toContain("may not read Dish");
  expect(warnings("").join()).not.toMatch(/may not read.*Order/);
});
