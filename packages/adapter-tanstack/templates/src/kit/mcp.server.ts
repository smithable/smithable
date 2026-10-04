// Smithable app kit: the API as tools for AI assistants (docs/design/integrations.md §5b), at
// /mcp. A small JSON-RPC endpoint in the Model Context Protocol's form for a server without
// sessions: initialize, the list of tools and calling one, each answered in JSON. Same keys, same
// access, same limiter as the API; a refusal comes back as the tool's error in the app's words,
// so the assistant can read it.
import type { Viewer } from "./access";
import { BadInput, bodyOf, keyOf, problem, refusalOf } from "./api.server";

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface Message {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

const PROTOCOL = "2025-06-18";

/** Answers one request to /mcp: the tools offered, and calls to them as the key. */
export async function handleMcp(
  request: Request,
  server: {
    name: string;
    tools: Tool[];
    call: (viewer: Viewer, name: string, args: Record<string, unknown>) => Promise<unknown>;
  },
): Promise<Response> {
  let viewer: Viewer | null;
  let body: unknown;
  try {
    viewer = keyOf(request);
    if (!viewer) return problem(401, "A valid key is needed: Authorization: Bearer <key>.");
    body = await bodyOf(request);
  } catch (error) {
    const refused = refusalOf(error);
    if (refused) return problem(refused.status, refused.title);
    throw error;
  }
  const key = viewer;
  const answer = async (message: Message) => {
    const reply = (result: unknown) => ({ jsonrpc: "2.0", id: message.id ?? null, result });
    const fault = (code: number, text: string) => ({
      jsonrpc: "2.0",
      id: message.id ?? null,
      error: { code, message: text },
    });
    switch (message.method) {
      case "initialize":
        return reply({
          protocolVersion: PROTOCOL,
          capabilities: { tools: {} },
          serverInfo: { name: server.name, version: "1" },
        });
      case "ping":
        return reply({});
      case "tools/list":
        return reply({ tools: server.tools });
      case "tools/call": {
        const name = String(message.params?.name ?? "");
        const args = (message.params?.arguments ?? {}) as Record<string, unknown>;
        try {
          if (!server.tools.some((t) => t.name === name))
            throw new BadInput(`There is no tool "${name}".`);
          const result = await server.call(key, name, args);
          return reply({
            content: [{ type: "text", text: JSON.stringify(result ?? { done: true }) }],
            ...(result && typeof result === "object" ? { structuredContent: result } : {}),
          });
        } catch (error) {
          const refused = refusalOf(error);
          if (!refused) throw error;
          return reply({ content: [{ type: "text", text: refused.title }], isError: true });
        }
      }
      default:
        // A notification (no id) needs no answer; an unknown method is said to be one.
        return message.id === undefined
          ? undefined
          : fault(-32601, `Unknown method "${message.method}".`);
    }
  };
  const messages = Array.isArray(body) ? (body as Message[]) : [body as Message];
  const answers = (await Promise.all(messages.map(answer))).filter((a) => a !== undefined);
  if (!answers.length) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? answers : answers[0]);
}
