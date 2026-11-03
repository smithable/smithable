// Browser-safe shapes only. Hosts and frames separately authorize origin, window and ticket.
export const LOOK_PROTOCOL = 1;
export const LOOK_CSS_LIMIT = 262_144;
export interface LookIdentity {
  session: string;
  project: string;
  document: string;
  page: string;
  generation: string;
}
export interface LookRevision extends LookIdentity {
  revision: number;
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === "string" && /^[\w-]{8,100}$/.test(v);
const page = (v: unknown): v is string =>
  typeof v === "string" &&
  v.length <= 2048 &&
  v.startsWith("/") &&
  !v.startsWith("//") &&
  ![...v].some((c) => c.charCodeAt(0) < 32);
const generation = (v: unknown): v is string => typeof v === "string" && /^[\w.:-]{1,128}$/.test(v);
const revision = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
function identity(v: Record<string, unknown>): v is Record<string, unknown> & LookIdentity {
  return (
    id(v.session) && id(v.project) && id(v.document) && page(v.page) && generation(v.generation)
  );
}
function base(v: unknown): v is Record<string, unknown> {
  return (
    record(v) &&
    v.version === LOOK_PROTOCOL &&
    typeof v.type === "string" &&
    Object.keys(v).length <= 16
  );
}
export type LookReady = {
  type: "look-ready";
  challenge: string;
  navigation: number;
  version: 1;
  source: "smithable-preview";
  project: string;
  document: string;
  page: string;
  generation: string;
  status: "ready" | "sign-in" | "denied" | "unavailable" | "error";
};
export type LookAwake = {
  type: "look-awake";
  version: 1;
  source: "smithable-preview";
  project: string;
};
export type LookReply =
  | LookAwake
  | LookReady
  | (LookRevision & {
      type:
        | "look-bound"
        | "look-applied"
        | "look-reset-done"
        | "look-record"
        | "look-failed"
        | "look-history";
      version: 1;
      source: "smithable-preview";
      path?: string;
      status?: string;
      error?: string;
      direction?: "undo" | "redo";
      input?: number;
    });
export function parseLookReply(value: unknown): LookReply | undefined {
  if (!base(value) || value.source !== "smithable-preview") return;
  if (value.type === "look-awake") {
    if (!id(value.project)) return;
  } else if (value.type === "look-ready") {
    if (
      !id(value.challenge) ||
      !revision(value.navigation) ||
      !id(value.project) ||
      !id(value.document) ||
      !page(value.page) ||
      !generation(value.generation) ||
      !["ready", "sign-in", "denied", "unavailable", "error"].includes(String(value.status))
    )
      return;
  } else {
    if (
      ![
        "look-bound",
        "look-applied",
        "look-reset-done",
        "look-record",
        "look-failed",
        "look-history",
      ].includes(String(value.type)) ||
      !identity(value) ||
      !revision(value.revision)
    )
      return;
    if (
      value.type === "look-history" &&
      (!["undo", "redo"].includes(String(value.direction)) ||
        !revision(value.input) ||
        value.input < 1)
    )
      return;
    if (value.path !== undefined && !page(value.path)) return;
    if (
      value.status !== undefined &&
      (typeof value.status !== "string" || value.status.length > 40)
    )
      return;
    if (value.error !== undefined && (typeof value.error !== "string" || value.error.length > 500))
      return;
  }
  return value as unknown as LookReply;
}
export function sameLookIdentity(reply: LookReply, current: LookIdentity): boolean {
  return (
    reply.type !== "look-ready" &&
    reply.type !== "look-awake" &&
    reply.session === current.session &&
    reply.project === current.project &&
    reply.document === current.document &&
    reply.page === current.page &&
    reply.generation === current.generation
  );
}
export function currentLookReply(reply: LookReply, current: LookRevision): boolean {
  return (
    reply.type !== "look-ready" &&
    reply.type !== "look-awake" &&
    sameLookIdentity(reply, current) &&
    reply.revision === current.revision
  );
}
export type LookCommand = LookRevision & { version: 1 } & (
    | { type: "look-style"; css: string; mode: "light" | "dark" }
    | { type: "look-reset"; reason: "apply" | "discard" }
    | { type: "look-discover"; base: string }
    | { type: "look-tour" }
  );
export function parseLookCommand(value: unknown): LookCommand | undefined {
  if (!base(value) || !identity(value) || !revision(value.revision)) return;
  if (value.type === "look-style") {
    if (
      typeof value.css !== "string" ||
      value.css.length > LOOK_CSS_LIMIT ||
      !["light", "dark"].includes(String(value.mode))
    )
      return;
  } else if (value.type === "look-reset") {
    if (!["apply", "discard"].includes(String(value.reason))) return;
  } else if (value.type === "look-discover") {
    if (!page(value.base)) return;
  } else if (value.type !== "look-tour") return;
  return value as unknown as LookCommand;
}

/** Emit the same guards in the development-only iframe runtime. */
export function lookCommandRuntime(): string {
  return [
    `const LOOK_PROTOCOL=${LOOK_PROTOCOL}, LOOK_CSS_LIMIT=${LOOK_CSS_LIMIT};`,
    `const record=${record.toString()};`,
    `const id=${id.toString()};`,
    `const page=${page.toString()};`,
    `const generation=${generation.toString()};`,
    `const revision=${revision.toString()};`,
    identity.toString(),
    base.toString(),
    parseLookCommand.toString(),
  ].join("\n");
}

/** A fresh parent challenge is required after each load; SPA readiness is ordered within it. */
export function currentLookReady(
  reply: LookReady,
  challenge: string | undefined,
  previous?: LookReady,
): boolean {
  return (
    reply.challenge === challenge &&
    (!previous || previous.challenge !== challenge || reply.navigation > previous.navigation)
  );
}

/** History is ordered user input, independent of an in-flight style acknowledgement. */
export function currentLookHistory(
  reply: LookReply,
  current: LookRevision,
  lastInput = 0,
): boolean {
  return (
    reply.type === "look-history" &&
    sameLookIdentity(reply, current) &&
    reply.revision <= current.revision &&
    typeof reply.input === "number" &&
    reply.input > lastInput
  );
}
