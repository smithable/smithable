import { type SpecIR, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import supportSpec from "../../../examples/support/smithable.yml?raw";
import { fillSources } from "./properties";

const ir = validateSpec({ path: "smithable.yml", text: supportSpec }).ir as SpecIR;
const sources = (model: string, field: string) =>
  fillSources(
    ir,
    model,
    ir.models.find((m) => m.name === model)?.fields.find((f) => f.name === field) as never,
  );

test("a field the app fills says where its value comes from", () => {
  expect(sources("Message", "agent")).toEqual(["who makes the record"]);
  expect(sources("SupportCase", "assignee")).toEqual([
    "set by the action Assign to me",
    "set by the action Assign to",
  ]);
  expect(sources("SupportCase", "priority")[0]).toBe("its default, 3");
  expect(sources("Message", "content")).toEqual(
    expect.arrayContaining([expect.stringMatching(/^set by the incoming entry /)]),
  );
});
