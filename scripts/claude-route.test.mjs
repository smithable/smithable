// node --test scripts/claude-route.test.mjs: the benches' route to Claude, without a call to Anthropic.
import assert from "node:assert/strict";
import test from "node:test";
import { closed, messagesBody } from "./claude-route.mjs";

test("objects that list their properties are closed, nested ones too; maps and kept keywords are not", () => {
  const schema = {
    type: "object",
    properties: {
      ops: { type: "array", items: { type: "object", properties: { op: { enum: ["a", "b"] } } } },
      args: { type: "object", additionalProperties: true },
      either: { allOf: [{ type: "object", properties: { x: { type: "string" } } }] },
    },
  };
  const out = closed(schema);
  assert.equal(out.additionalProperties, false);
  assert.equal(out.properties.ops.items.additionalProperties, false);
  assert.deepEqual(out.properties.ops.items.properties.op, { enum: ["a", "b"] });
  assert.equal(out.properties.args.additionalProperties, true);
  assert.equal(out.properties.either.allOf[0].additionalProperties, undefined);
});

test("a chat request becomes a Messages request: system apart, turns joined, schema as output format, no temperature", () => {
  const body = messagesBody({
    model: "claude-haiku-5-5",
    temperature: 0,
    messages: [
      { role: "system", content: "S" },
      { role: "user", content: "U1" },
      { role: "user", content: "U2" },
    ],
    response_format: { type: "json_schema", json_schema: { name: "answer", schema: { type: "object", properties: { a: { type: "string" } } } } },
  });
  assert.equal(body.model, "claude-haiku-5-5");
  assert.equal(body.temperature, undefined);
  assert.deepEqual(body.system, [{ type: "text", text: "S", cache_control: { type: "ephemeral" } }]);
  assert.deepEqual(body.messages, [{ role: "user", content: [{ type: "text", text: "U1" }, { type: "text", text: "U2" }] }]);
  assert.deepEqual(body.output_config.format.schema, { type: "object", properties: { a: { type: "string" } }, additionalProperties: false });
});
