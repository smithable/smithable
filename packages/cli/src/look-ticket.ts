// Presentation-only, one-use preview tickets. Never use the Studio bearer as this key.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const LOOK_TICKET_TTL = 120_000;
export interface LookTicket {
  version: 1;
  session: string;
  project: string;
  document: string;
  generation: string;
  parentOrigin: string;
  expires: number;
}
export function mintLookTicket(
  secret: string,
  facts: Pick<LookTicket, "project" | "document" | "parentOrigin" | "generation">,
  now = Date.now(),
): { ticket: string; binding: LookTicket } {
  const binding: LookTicket = {
    version: 1,
    session: randomUUID(),
    project: facts.project,
    document: facts.document,
    generation: facts.generation,
    parentOrigin: facts.parentOrigin,
    expires: now + LOOK_TICKET_TTL,
  };
  const encoded = Buffer.from(JSON.stringify(binding)).toString("base64url");
  const signature = createHmac("sha256", secret).update(`v1.${encoded}`).digest("base64url");
  return { ticket: `v1.${encoded}.${signature}`, binding };
}
export function verifyLookTicket(
  ticket: string,
  secret: string,
  expected: Pick<LookTicket, "project" | "document" | "parentOrigin" | "generation">,
  now = Date.now(),
): LookTicket | undefined {
  if (ticket.length > 4096) return;
  const parts = /^v1\.([\w-]+)\.([\w-]+)$/.exec(ticket);
  if (!parts) return;
  const encoded = parts[1] as string;
  const signature = Buffer.from(parts[2] as string, "base64url");
  const wanted = createHmac("sha256", secret).update(`v1.${encoded}`).digest();
  if (signature.length !== wanted.length || !timingSafeEqual(signature, wanted)) return;
  try {
    const value: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const b = value as Record<string, unknown>;
    if (
      Object.keys(b).sort().join() !==
      "document,expires,generation,parentOrigin,project,session,version"
    )
      return;
    if (b.version !== 1 || typeof b.session !== "string" || !/^[\w-]{16,80}$/.test(b.session))
      return;
    if (
      b.project !== expected.project ||
      b.document !== expected.document ||
      b.generation !== expected.generation ||
      b.parentOrigin !== expected.parentOrigin
    )
      return;
    if (
      typeof b.expires !== "number" ||
      !Number.isSafeInteger(b.expires) ||
      b.expires <= now ||
      b.expires > now + LOOK_TICKET_TTL
    )
      return;
    return b as unknown as LookTicket;
  } catch {
    return;
  }
}
/** Each ticket binds a single current document. Runtime retries after a lost acknowledgement
 * are answered from that document's existing binding, without consuming the ticket twice. */
export class LookTicketVerifier {
  private readonly used = new Map<string, number>();
  constructor(
    private readonly secret: string,
    private readonly facts: Pick<LookTicket, "project" | "parentOrigin">,
  ) {}
  consume(
    ticket: string,
    document: string,
    generation: string,
    now = Date.now(),
  ): LookTicket | undefined {
    const binding = verifyLookTicket(
      ticket,
      this.secret,
      { ...this.facts, document, generation },
      now,
    );
    if (!binding) return;
    for (const [session, expires] of this.used) if (expires <= now) this.used.delete(session);
    if (this.used.has(binding.session) || this.used.size >= 512) return;
    this.used.set(binding.session, binding.expires);
    return binding;
  }
}
