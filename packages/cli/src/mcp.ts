import { spawnSync } from "node:child_process";
// The low-level Server takes tools as JSON Schema, which the operations already are: one
// definition for the CLI, MCP and AI (ARCHITECTURE §9.6). McpServer would need zod copies.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { type JsonSchema, OPERATIONS, type OperationArgs } from "@smithable/core";
import { buildContext, estimateTokens } from "@smithable/index";
import { logTokens } from "./context.js";
import { describe, TEST_ARGS } from "./inspect.js";
import { type Io, keepStdoutForProtocol } from "./io.js";
import { runOperation } from "./op.js";
import { projectIndex } from "./rules.js";
import { undo } from "./undo.js";
import { loadSpec } from "./validate.js";
import { VERSION } from "./version.js";

const INSTRUCTIONS = `This is a Smithable app. What it does is described in smithable.yml, sign-in and access in smithable.auth.yml, and visible text in smithable.content.yml; the code is generated from them.

- Change the app with the smithable_* operation tools, not by editing files. Each one checks the change, regenerates the code, migrates the database and makes a checkpoint that smithable_undo reverts.
- Find what to change with smithable_context (give it the request) or smithable_inspect; you rarely need to open source files.
- Code that the operations cannot express goes in src/custom/. Never edit src/generated/, src/kit/ or the generated routes: they are overwritten.`;

const OPERATION_NOTE =
  "Changes smithable.yml, regenerates the app, migrates the database and makes a checkpoint (undo with smithable_undo).";

interface Tool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  run(args: OperationArgs, io: Io): number;
}

const noInput = { type: "object", properties: {}, additionalProperties: false };

/** "addField" → "smithable_add_field". */
const toolName = (name: string) =>
  `smithable_${name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}`;

function tools(dir: string): Tool[] {
  const operations: Tool[] = OPERATIONS.map((op) => ({
    name: toolName(op.name),
    description: `${op.summary} ${OPERATION_NOTE}`,
    inputSchema: {
      ...op.schema,
      properties: {
        ...(op.schema.properties as JsonSchema),
        confirm: {
          type: "boolean",
          description:
            "Only after the user agreed: confirms a change that loses data, when a first call said so.",
        },
      },
    },
    run: ({ confirm, ...args }, io) =>
      runOperation(dir, io, op.name, args, { yes: confirm === true, mcp: true }),
  }));
  return [
    ...operations,
    {
      name: "smithable_context",
      description:
        "The parts of the app a request is about (models, fields, pages, actions with their meaning and rules) and the operations that can change them. Start here.",
      inputSchema: {
        type: "object",
        required: ["request"],
        additionalProperties: false,
        properties: {
          request: { type: "string", description: "What the user wants, in their words." },
        },
      },
      run: ({ request }, io) => {
        const { ir, auth } = loadSpec(dir, io);
        if (!ir || !auth) return 1;
        const slice = buildContext(projectIndex(dir, ir, auth), String(request));
        io.out(slice.text);
        return 0;
      },
    },
    {
      name: "smithable_inspect",
      description:
        "One concept of the app: its meaning, rules and their status, and the files, symbols, routes, tables and tests that implement it. Without a concept: every concept, one line each.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          concept: {
            type: "string",
            description:
              'e.g. "model:Customer", "field:Order.total", "action:mergeCustomers", "page:customers" or "app".',
          },
        },
      },
      run: ({ concept }, io) => {
        const { ir, auth } = loadSpec(dir, io);
        if (!ir || !auth) return 1;
        const index = projectIndex(dir, ir, auth);
        if (concept === undefined) {
          io.out(index.concepts.map((c) => `${c.concept}: ${c.summary}`).join("\n"));
          return 0;
        }
        const info = index.concepts.find((c) => c.concept === concept);
        if (!info) {
          io.err(
            `There is no concept "${concept}". Call smithable_inspect without a concept for the list.`,
          );
          return 1;
        }
        io.out(describe(info));
        return 0;
      },
    },
    {
      name: "smithable_validate",
      description: "Checks smithable.yml and its companion files, with the line of every problem.",
      inputSchema: noInput,
      run: (_, io) => {
        const { ir, path } = loadSpec(dir, io);
        if (ir) io.out(`${path} is valid.`);
        return ir ? 0 : 1;
      },
    },
    {
      name: "smithable_test",
      description:
        "Runs the app's tests (formula examples, access for every role, custom tests) and remembers the results for rule status.",
      inputSchema: noInput,
      run: (_, io) => {
        const result = spawnSync("pnpm", ["exec", "vitest", "run", ...TEST_ARGS], {
          cwd: dir,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, NO_COLOR: "1" },
        });
        // The summary and any failures; the full log would waste the agent's context.
        const lines = `${result.stdout}${result.stderr}`.split("\n");
        const failures = lines.filter((l) => /FAIL|×|AssertionError|Error:/.test(l)).slice(0, 40);
        const summary = lines.filter((l) => /Test Files|Tests\s/.test(l));
        io.out([...failures, ...summary].join("\n"));
        return result.status ?? 1;
      },
    },
    {
      name: "smithable_undo",
      description: "Undoes the last operation: the spec, the code and the development database.",
      inputSchema: noInput,
      run: (_, io) => undo(dir, io),
    },
  ];
}

/** `smithable mcp`: an MCP server on stdin/stdout for the project in `dir` (ARCHITECTURE §9.6). */
export async function mcp(dir: string): Promise<number> {
  keepStdoutForProtocol();
  const available = tools(dir);
  const server = new Server(
    { name: "smithable", version: VERSION },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  );
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: available.map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema: inputSchema as { type: "object" },
    })),
  }));
  server.setRequestHandler(CallToolRequestSchema, (request) => {
    const tool = available.find((t) => t.name === request.params.name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool ${request.params.name}.` }],
        isError: true,
      };
    }
    let text = "";
    const io: Io = { out: (t) => (text += t), err: (t) => (text += t) };
    const args = (request.params.arguments ?? {}) as OperationArgs;
    const code = tool.run(args, io);
    const output = text.trim() || (code === 0 ? "Done." : "Failed.");
    logTokens(dir, {
      source: "mcp",
      tool: tool.name,
      tokens: { input: estimateTokens(JSON.stringify(args)), output: estimateTokens(output) },
    });
    return { content: [{ type: "text", text: output }], isError: code !== 0 };
  });
  await server.connect(new StdioServerTransport());
  // Serve until the client closes stdin.
  await new Promise<void>((resolve) => process.stdin.on("close", resolve));
  return 0;
}
