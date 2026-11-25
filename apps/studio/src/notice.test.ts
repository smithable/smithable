import { describe, expect, test } from "vitest";
import { type NoticesSeen, noticeShown, noticeStep } from "./notice";

describe("the one-time notice in a read of the project (T1602)", () => {
  test("a new one is shown, a shown one is not shown again", () => {
    const seen: NoticesSeen = { shown: new Set(), failed: new Set() };
    expect(noticeStep(seen, undefined)).toBe("none");
    expect(noticeStep(seen, "a")).toBe("show");
    seen.shown.add("a");
    expect(noticeStep(seen, "a")).toBe("none");
  });

  test("a late read with an older notice leaves the newer one on the page", () => {
    const seen: NoticesSeen = { shown: new Set(["a", "b"]), failed: new Set() };
    expect(noticeStep(seen, "a")).toBe("none");
    expect(noticeStep(seen, "b")).toBe("none");
  });

  test("each acknowledgement that failed is sent again by the next read that has it", () => {
    const seen: NoticesSeen = { shown: new Set(["a", "b", "c"]), failed: new Set(["a", "b"]) };
    expect(noticeStep(seen, "b")).toBe("again");
    expect(noticeStep(seen, "a")).toBe("again");
    expect(noticeStep(seen, "c")).toBe("none");
  });

  test("a late read with an older notice the page never showed leaves the newer one (T1604)", () => {
    const seen: NoticesSeen = { shown: new Set(), failed: new Set() };
    expect(noticeStep(seen, "r.2")).toBe("show");
    seen.shown.add("r.2");
    noticeShown(seen, "r.2");
    // The read that carried notice 1 comes late: never shown, and older than what is on the page.
    expect(noticeStep(seen, "r.1")).toBe("none");
    expect(noticeStep(seen, "r.10")).toBe("show");
    noticeShown(seen, "r.10");
    noticeShown(seen, "r.3");
    expect(seen.newest).toBe("r.10");
    // Another run (Studio started again) and ids without an order are not compared.
    expect(noticeStep(seen, "s.1")).toBe("show");
    expect(noticeStep(seen, "plain")).toBe("show");
    expect(noticeStep(seen, "a.b.9")).toBe("show");
    seen.newest = "a.b.10";
    expect(noticeStep(seen, "a.b.9")).toBe("none");
  });
});
