import { validateSpec } from "@smithable/core";
import { describe, expect, it } from "vitest";
import { describeChange } from "./change-words.js";

const { ir } = validateSpec({
  path: "smithable.yml",
  text: "smithable: 0.1\napp:\n  name: Support\nmodels:\n  Message:\n    fields:\n      content: text!\n      sender: customer | agent\n",
});

describe("describeChange", () => {
  it("says a choice's values reordered make another one the default", () => {
    if (!ir) throw new Error("no spec");
    expect(
      describeChange(
        "changeField",
        { model: "Message", field: "sender", type: "agent | customer" },
        ir,
      ),
    ).toBe("Messages: agent is now the sender's default (it was customer)");
  });
});
