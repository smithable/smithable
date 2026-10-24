// Smithable app kit: the API as tools for AI assistants (docs/design/integrations.md §5b), at
// /mcp (docs/design/assistant.md §3). A small JSON-RPC endpoint in the Model Context Protocol's form for a server without
// sessions: initialize, the list of tools and calling one, each answered in JSON. Same keys, same
// access, same limiter as the API; a refusal comes back as the tool's error in the app's words,
// so the assistant can read it.
import type { Viewer } from "./access";
import { bodyOf, callerOf, problem, refusalOf } from "./api.server";
import { writeAllowed } from "./limit";
import { originOf } from "./origin";
import { type Offer, offered } from "./tools";

export type { Offer, Tool } from "./tools";
export { offered };

interface Message {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

const PROTOCOL = "2025-06-18";

/**
 * Answers one request to /mcp: the tools offered to the caller (by the key's role, or to a
 * visitor without a key, when anything is open to visitors), and calls to them.
 */
export async function handleMcp(
  request: Request,
  server: {
    name: string;
    offerFor: (viewer: Viewer | null) => Offer;
    call: (viewer: Viewer | null, name: string, args: Record<string, unknown>) => Promise<unknown>;
  },
): Promise<Response> {
  let viewer: Viewer | null;
  let body: unknown;
  let offer: Offer;
  try {
    const caller = callerOf(request);
    viewer = caller.viewer;
    offer = server.offerFor(viewer);
    if (!viewer && !(caller.keyless && offer.tools.length))
      return problem(401, "A valid key is needed: Authorization: Bearer <key>.");
    // A visitor's call from a page is one of the app's own pages: its scheme and host.
    const origin = request.headers.get("origin");
    if (!viewer && origin) {
      let from: string | undefined;
      try {
        from = new URL(origin).origin;
      } catch {}
      if (from !== originOf(request))
        return problem(403, "Visitors may not call /mcp from another origin.");
    }
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
          instructions: offer.summary,
        });
      case "ping":
        return reply({});
      case "tools/list":
        return reply({ tools: offer.tools });
      case "tools/call": {
        const name = String(message.params?.name ?? "");
        const args = (message.params?.arguments ?? {}) as Record<string, unknown>;
        try {
          offered(offer, name, args);
          // Adding without a key is held to a visitor's limit, as through the API.
          if (!key && name === "add") writeAllowed(null, request.headers);
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
  // One message per request: the protocol version announced has no batches, and each call is
  // counted against the key's limit as one request.
  if (Array.isArray(body))
    return Response.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32600,
          message: "Send one message per request; batches are not supported.",
        },
      },
      { status: 400 },
    );
  const answered = await answer(body as Message);
  return answered === undefined ? new Response(null, { status: 202 }) : Response.json(answered);
}
