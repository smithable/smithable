import { type SpecIR, validateSpec } from "@smithable/core";
import { describe, expect, it } from "vitest";
import { PreviewNavigation, pageForPreviewPath } from "./preview-follow";

const checked = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: {name: Follow}
models:
  Customer: {fields: {name: string!, orders: "Order[]"}}
  Order: {fields: {customer: Customer!, number: string!}}
pages:
  customers: {crud: Customer}
  orders: {crud: Order}
  home: {route: /, dashboard: {customers: {count: Customer}}}
  records: {data: all}
  waiting: {review: all}
  team: {users: manage}
  languageNamed: {route: /sv, crud: Order}
`,
});
const ir = checked.ir as SpecIR;

describe("the page followed from the preview", () => {
  it("uses a validated app and its generated page and record routes", () => {
    expect(checked.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    for (const [path, page] of [
      ["/", "home"],
      ["/customers", "customers"],
      ["/customers/12?back=list", "customers"],
      ["/orders/new", "orders"],
      ["/records/orders/4", "records"],
      ["/waiting/file/7", "waiting"],
      ["/team/activity", "team"],
    ])
      expect(pageForPreviewPath(ir, path as string)).toBe(page);
  });
  it("uses only configured language prefixes, preserving the root and record routes", () => {
    expect(pageForPreviewPath(ir, "/sv", ["sv"])).toBe("home");
    expect(pageForPreviewPath(ir, "/sv")).toBe("languageNamed");
    expect(pageForPreviewPath(ir, "/sv/orders/5", ["sv"])).toBe("orders");
    expect(pageForPreviewPath(ir, "/fi/orders/5", ["sv"])).toBeUndefined();
  });
  it("does not mistake system, unknown, malformed or deeper routes for an editor page", () => {
    for (const path of [
      "/sign-in",
      "/api/project",
      "/missing",
      "/customers/1/edit",
      "/customers/no-record",
      "https://other.example/orders",
      "//other.example/orders",
      "/%zz",
      "/orders/%00",
      "/orders/../customers",
      "/orders%5c1",
    ])
      expect(pageForPreviewPath(ir, path)).toBeUndefined();
  });
});

const message = (path: string, navigationId: number, followContext = 0, documentId = "first") => ({
  type: "navigated",
  path,
  navigationId,
  followContext,
  documentId,
});

describe("preview navigation ordering", () => {
  it("ignores same-route reports, out-of-order delivery and retired documents", () => {
    const follow = new PreviewNavigation();
    expect(follow.receive(message("/customers", 0), 0)).toBe("/customers");
    expect(follow.receive(message("/customers", 0), 0)).toBeUndefined();
    expect(follow.receive(message("/orders", 2), 0)).toBe("/orders");
    expect(follow.receive(message("/customers", 1), 0)).toBeUndefined();
    expect(follow.receive(message("/customers", 0, 0, "second"), 0)).toBe("/customers");
    expect(follow.receive(message("/orders", 3), 0)).toBeUndefined();
  });
  it("an explicit editor destination rejects in-flight events and their repeated handshake report", () => {
    const follow = new PreviewNavigation();
    follow.receive(message("/customers", 0), 0);
    expect(follow.receive(message("/orders", 1, 0), 1)).toBeUndefined();
    expect(follow.receive(message("/orders", 1, 1), 1)).toBeUndefined();
    expect(follow.receive(message("/customers/4", 2, 1), 1)).toBe("/customers/4");
  });
  it("malformed reports cannot poison the sequence or choose a page", () => {
    const follow = new PreviewNavigation();
    for (const value of [
      null,
      { type: "navigated" },
      message("/orders", NaN),
      message("/orders", -1),
      { ...message("/orders", 1), path: 42 },
    ])
      expect(follow.receive(value, 0)).toBeUndefined();
    expect(follow.receive(message("/customers", 0), 0)).toBe("/customers");
  });
});

it("follows a genuine return after an old-context navigation was refused", () => {
  const follow = new PreviewNavigation();
  expect(follow.receive(message("/customers", 0), 0)).toBe("/customers");
  expect(follow.receive(message("/orders", 1, 0), 1)).toBeUndefined();
  expect(follow.receive(message("/customers", 2, 1), 1)).toBe("/customers");
});

it("retires superseded documents even before their current editor context arrives", () => {
  const follow = new PreviewNavigation();
  expect(follow.receive(message("/customers", 0, 0, "first"), 1)).toBeUndefined();
  expect(follow.receive(message("/orders", 0, 0, "second"), 1)).toBeUndefined();
  expect(follow.receive(message("/customers/1", 1, 1, "first"), 1)).toBeUndefined();
  expect(follow.receive(message("/orders/1", 1, 1, "second"), 1)).toBe("/orders/1");
});
