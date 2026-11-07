import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { checkOf, type Verification } from "@smithable/core";
import { expect, test } from "vitest";
import { git } from "./git.js";
import { mcpServer } from "./mcp.js";
import { tempDir } from "./test-dir.js";

/** A project with a spec, an auth file and one commit, and a client connected to its server. */
async function connected() {
  const dir = tempDir("smithable-mcp-");
  writeFileSync(
    join(dir, "smithable.yml"),
    "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Item: { fields: { name: string! } }\npages:\n  items: { crud: Item }\n",
  );
  writeFileSync(join(dir, "smithable.auth.yml"), "smithableAuth: 0.1\nsignIn: none\n");
  writeFileSync(join(dir, ".gitignore"), "data\n");
  git(dir, ["init", "-q"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "smithable: start of history"]);
  const [client, server] = InMemoryTransport.createLinkedPair();
  await mcpServer(dir).connect(server);
  const mcp = new Client({ name: "test", version: "0" });
  await mcp.connect(client);
  return { dir, mcp };
}

test("the instructions say what the result's states mean", async () => {
  const { mcp } = await connected();
  const instructions = mcp.getInstructions() ?? "";
  expect(instructions).toContain("never treat a check that was not run as passed");
  expect(instructions).toContain("not a test of the app");
  const { tools } = await mcp.listTools();
  const verify = tools.find((t) => t.name === "smithable_verify");
  expect(Object.keys(verify?.inputSchema.properties ?? {}).sort()).toEqual(["depth", "record"]);
});

test("an operation's result carries its verification as structured content", async () => {
  const { mcp } = await connected();
  const refused = await mcp.callTool({
    name: "smithable_remove_field",
    arguments: { model: "Item", field: "nope" },
  });
  expect(refused.isError).toBe(true);
  const v = refused.structuredContent as unknown as Verification;
  expect(v.revision).toBe("");
  expect(checkOf(v, "spec").state).toBe("failed");
  expect(checkOf(v, "tests").state).toBe("not-run");
  expect((refused.content as { text: string }[])[0]?.text).toContain("nope");
});

test("smithable_verify gives the current revision's result, as text and structured content", async () => {
  const { dir, mcp } = await connected();
  const result = await mcp.callTool({ name: "smithable_verify", arguments: {} });
  expect(result.isError).toBe(false);
  const v = result.structuredContent as unknown as Verification;
  expect(v.revision).toBe(git(dir, ["rev-parse", "HEAD"]).out.trim());
  expect(checkOf(v, "spec").state).toBe("passed");
  expect((result.content as { text: string }[])[0]?.text).toContain("depth change");
  const bad = await mcp.callTool({ name: "smithable_verify", arguments: { depth: "deep" } });
  expect(bad.isError).toBe(true);
  expect(bad.structuredContent).toBeUndefined();
  // Uncommitted edits: refused, and the result says nothing was verified.
  writeFileSync(join(dir, "smithable.yml"), "smithable: 0.1\napp: { name: Changed }\n");
  const dirty = await mcp.callTool({ name: "smithable_verify", arguments: {} });
  expect(dirty.isError).toBe(true);
  expect(checkOf(dirty.structuredContent as unknown as Verification, "spec").reason).toBe(
    "uncommitted edits: nothing was verified",
  );
});
