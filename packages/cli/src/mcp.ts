import { spawnSync } from "node:child_process";
// The low-level Server takes tools as JSON Schema, which the operations already are: one
// definition for the CLI, MCP and AI (ARCHITECTURE §9.6). McpServer would need zod copies.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { plainSchema } from "@smithable/ai";
import { type JsonSchema, type OperationArgs, operationsFor } from "@smithable/core";
import { buildContext, estimateTokens } from "@smithable/index";
import { logTokens } from "./context.js";
import { customize } from "./customize.js";
import { describe, TEST_ARGS } from "./inspect.js";
import { type Io, keepStdoutForProtocol } from "./io.js";
import { runOperation } from "./op.js";
import { loadPlugins } from "./plugins.js";
import { projectIndex } from "./rules.js";
import { undo } from "./undo.js";
import { loadSpec } from "./validate.js";
import { VERSION } from "./version.js";

const INSTRUCTIONS = `This is a Smithable app. What it does is described in smithable.yml, sign-in and access in smithable.auth.yml, and visible text in smithable.content.yml; the code is generated from them.

- Change the app with the smithable_* operation tools, not by editing files. Each one checks the change, regenerates the code, migrates the database and makes a checkpoint that smithable_undo reverts.
- An operation's result says whether it worked: a successful one has already validated the spec, regenerated the code and migrated the database. It also says whether custom code is affected. Do not read files or run commands to verify it.
- Find what to change with smithable_context (give it the request) or smithable_inspect; you rarely need to open source files.
- When no operation fits how a page should look or behave, call smithable_customize_page and edit the file it creates in src/custom/pages/. Custom actions already in the spec are implemented in src/custom/actions/. Never edit src/generated/, src/kit/ or the generated routes: they are overwritten, and a hand edit blocks every later operation.`;

const OPERATION_NOTE =
  "Changes smithable.yml, regenerates the app, migrates the database and makes a checkpoint (undo with smithable_undo).";

interface Tool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  run(args: OperationArgs, io: Io): number | Promise<number>;
}

const noInput = { type: "object", properties: {}, additionalProperties: false };

/** "addField" → "smithable_add_field". */
const toolName = (name: string) =>
  `smithable_${name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}`;

function tools(dir: string): Tool[] {
  // Replacing the whole spec is for people in Studio's editor; agents use the specific operations.
  const operations: Tool[] = operationsFor(loadPlugins(dir))
    .filter((op) => op.name !== "editSpec")
    .map((op) => ({
      name: toolName(op.name),
      description: `${op.summary} ${OPERATION_NOTE}`,
      // Without Smithable's own annotations (x-smithable), which strict clients may refuse.
      inputSchema: {
        ...(plainSchema(op.schema) as JsonSchema),
        properties: {
          ...(plainSchema(op.schema.properties) as JsonSchema),
          confirm: {
            type: "boolean",
            description:
              "Only after the user agreed: confirms a change that loses data, when a first call said so.",
          },
        },
      },
      run: async ({ confirm, ...args }, io) => {
        // Looked up before the change: after a rename, custom code still uses the old name.
        const users = customUsers(dir, op.name, args);
        const code = await runOperation(dir, io, op.name, args, {
          yes: confirm === true,
          mcp: true,
        });
        if (code === 0) {
          io.out(
            users.length
              ? `Custom code that uses the changed field may need updating: ${users.join(", ")}. Run smithable_test.\n`
              : "No custom code is affected.\n",
          );
        }
        return code;
      },
    }));
  return [
    ...operations,
    {
      name: "smithable_customize_page",
      description:
        "When no operation can make a page look or behave as asked (a different layout, extra buttons, charts): gives the page its own component in src/custom/pages/<page>.tsx, starting as a copy of the generated one. Then edit that file; never edit generated routes. The route keeps loading data and checking access.",
      inputSchema: {
        type: "object",
        required: ["page"],
        additionalProperties: false,
        properties: {
          page: { type: "string", description: 'The page\'s name, e.g. "customers".' },
        },
      },
      run: ({ page }, io) => customize(dir, io, `page:${page}`, "mcp"),
    },
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

/** Operations that can break custom code, and the field each one changes. */
const BREAKING: Record<string, (args: OperationArgs) => string> = {
  renameField: (a) => `field:${a.model}.${a.from}`,
  removeField: (a) => `field:${a.model}.${a.field}`,
  changeField: (a) => `field:${a.model}.${a.field}`,
};

/** Custom files that use what a breaking operation changes; none for other operations. */
function customUsers(dir: string, operation: string, args: OperationArgs): string[] {
  const concept = BREAKING[operation]?.(args);
  if (!concept) return [];
  const { ir, auth } = loadSpec(dir, { out: () => {}, err: () => {} });
  if (!ir || !auth) return [];
  const info = projectIndex(dir, ir, auth).concepts.find((c) => c.concept === concept);
  return (info?.files ?? [])
    .filter((f) => f.role === "uses" || f.role === "implements")
    .map((f) => f.path);
}

/** `smithable mcp`: an MCP server on stdin/stdout for the project in `dir` (ARCHITECTURE §9.6). */
/**
 * The MCP server for a project. `onChange` is told after a tool that may have changed it
 * (Studio refreshes).
 */
export function mcpServer(dir: string, onChange: () => void = () => {}): Server {
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
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
    const code = await tool.run(args, io);
    const output = text.trim() || (code === 0 ? "Done." : "Failed.");
    logTokens(dir, {
      source: "mcp",
      tool: tool.name,
      tokens: { input: estimateTokens(JSON.stringify(args)), output: estimateTokens(output) },
    });
    onChange();
    return { content: [{ type: "text", text: output }], isError: code !== 0 };
  });
  return server;
}

/** `smithable mcp [dir]`: the MCP server on stdin/stdout. */
export async function mcp(dir: string): Promise<number> {
  keepStdoutForProtocol();
  await mcpServer(dir).connect(new StdioServerTransport());
  // Serve until the client closes stdin.
  await new Promise<void>((resolve) => process.stdin.on("close", resolve));
  return 0;
}
