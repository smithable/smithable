// Smithable app kit: the tools an assistant is offered (docs/design/assistant.md §3), as /mcp and
// the app's own panel both describe and check them.
import { BadInput } from "./refusal";

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Reading only, or changing what exists: assistants that ask their user go by these. */
  annotations?: { readOnlyHint: boolean; destructiveHint: boolean };
}

/** What a caller is offered: the tools, and the app's summary as the server's instructions. */
export interface Offer {
  summary: string;
  tools: Tool[];
}

/**
 * The tool, when the offer has it and the call names only the kinds and actions it offers this
 * caller (a narrow key is not told of the rest); otherwise a refusal that says what there is.
 */
export function offered(offer: Offer, name: string, args: Record<string, unknown>): Tool {
  const tool = offer.tools.find((t) => t.name === name);
  if (!tool) throw new BadInput(`There is no tool "${name}".`);
  const properties = tool.inputSchema.properties as Record<string, { enum?: unknown[] }>;
  for (const key of ["kind", "action"]) {
    const allowed = properties?.[key]?.enum;
    if (allowed && !allowed.includes(args[key]))
      throw new BadInput(`"${key}" is one of ${allowed.join(", ")}.`);
  }
  return tool;
}
