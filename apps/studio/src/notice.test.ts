import { describe, expect, test } from "vitest";
import { type NoticesSeen, noticeStep } from "./notice";

describe("the one-time notice in a read of the project (T1602)", () => {
  test("a new one is shown, a shown one is not shown again", () => {
    const seen: NoticesSeen = { shown: new Set() };
    expect(noticeStep(seen, undefined)).toBe("none");
    expect(noticeStep(seen, "a")).toBe("show");
    seen.shown.add("a");
    expect(noticeStep(seen, "a")).toBe("none");
  });

  test("a late read with an older notice leaves the newer one on the page", () => {
    const seen: NoticesSeen = { shown: new Set(["a", "b"]) };
    expect(noticeStep(seen, "a")).toBe("none");
    expect(noticeStep(seen, "b")).toBe("none");
  });

  test("an acknowledgement that failed is sent again by the next read that has it", () => {
    const seen: NoticesSeen = { shown: new Set(["a", "b"]), failed: "b" };
    expect(noticeStep(seen, "b")).toBe("again");
    expect(noticeStep(seen, "a")).toBe("none");
  });
});
