import { type SpecIR, validateSpec } from "@smithable/core";
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
  it("a text is named by its path: a page's, a kind of record's or a field's", () => {
    const text = (path: string[], text?: string) =>
      describeChange("setText", text === undefined ? { path } : { path, text }, ir as SpecIR);
    expect(text(["pages", "orders", "title"], "All orders")).toBe(
      "Changed the Orders page's title to “All orders”",
    );
    expect(text(["models", "Message", "pluralLabel"], "Notes")).toBe(
      "Changed the messages' plural label to “Notes”",
    );
    expect(text(["models", "Message", "fields", "content", "label"], "Body")).toBe(
      "Changed the label of the messages' content to “Body”",
    );
    expect(text(["pages", "orders", "subtitle"])).toBe(
      "Put back the Orders page's subtitle's default",
    );
    expect(text([], "x")).toBe("Changed a text to “x”");
  });
});
