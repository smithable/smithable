import type { IncomingMessage, ServerResponse } from "node:http";
import { lookGeneration } from "./look-generation.js";
import { LookTicketVerifier } from "./look-ticket.js";

export interface LookPreviewConfig {
  project: string;
  parentOrigins: string[];
  previewOrigin: string;
}
/** Mounted after the preview's existing authentication guard. */
export function lookPreviewHandler(
  config: LookPreviewConfig,
  dir: string,
  boot: string,
  key: string,
) {
  const verifiers = new Map(
    config.parentOrigins.map((parentOrigin) => [
      parentOrigin,
      new LookTicketVerifier(key, { project: config.project, parentOrigin }),
    ]),
  );
  return async (incoming: unknown, outgoing: unknown) => {
    const req = incoming as IncomingMessage;
    const res = outgoing as ServerResponse;
    const json = (status: number, value: unknown) => {
      res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(value));
    };
    try {
      const generation = lookGeneration(dir, boot);
      if (req.url === "/generation" && req.method === "GET")
        return json(200, { project: config.project, generation });
      if (
        req.url !== "/verify" ||
        req.method !== "POST" ||
        req.headers.origin !== config.previewOrigin ||
        !key
      )
        return json(403, { error: "Preview binding refused." });
      let size = 0,
        body = "";
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk);
        if (size > 8192) return json(413, { error: "Preview binding too large." });
        body += chunk;
      }
      const value = JSON.parse(body) as Record<string, unknown>;
      if (
        typeof value.ticket !== "string" ||
        typeof value.document !== "string" ||
        !/^[\w-]{8,100}$/.test(value.document) ||
        value.generation !== generation
      )
        return json(403, { error: "Preview binding refused." });
      for (const verifier of verifiers.values()) {
        const checked = verifier.consume(value.ticket, value.document, generation);
        if (checked)
          return json(200, { ...checked, ttl: Math.max(0, checked.expires - Date.now()) });
      }
      return json(403, { error: "Preview binding expired or was already used." });
    } catch {
      return json(409, { error: "The current preview generation is unavailable." });
    }
  };
}
