import { describe, expect, it } from "vitest";
import { defaultColumns } from "./columns.js";
import { validateSpec } from "./spec.js";

const model = (fields: string) => {
  const { ir } = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1\napp:\n  name: Support\nmodels:\n  Case:\n    fields:\n      subject: string!\n  Message:\n    fields:\n${fields}`,
  });
  const found = ir?.models.find((m) => m.name === "Message");
  if (!found) throw new Error("no model");
  return found;
};

describe("defaultColumns", () => {
  it("shows a model's first long text when it has no short text to be titled by", () => {
    expect(
      defaultColumns(
        model(
          "      sender: customer | agent\n      content: text!\n      note: text\n      supportCase: Case!\n      attachments: files\n",
        ),
      ),
    ).toEqual(["content", "sender", "supportCase"]);
  });

  it("leaves long texts out when a short text titles the records", () => {
    expect(defaultColumns(model("      subject: string!\n      content: text!\n"))).toEqual([
      "subject",
    ]);
  });
});
