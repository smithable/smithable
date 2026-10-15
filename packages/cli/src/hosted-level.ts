// The hosted service's level for a project (smithable-cloud's eu-levels.md §5, §9): an EU app at
// Strict, Normal or Relaxed, or a non-EU app, given to the workspace as SMITHABLE_HOSTED_LEVEL. The engine's grammar does not
// change; the level is read here, in the host, by two checks: validate's warning on a sign-in
// provider Strict does not allow, and the release check's line naming the level.
import type { AuthIR, Diagnostic, SpecIR } from "@smithable/core";

export type HostedLevel = "strict" | "normal" | "relaxed" | "non-eu";

const LEVELS: readonly HostedLevel[] = ["strict", "normal", "relaxed", "non-eu"];

/** The level the hosted service gave this workspace; none outside it, and a value it does not know reads as strict. */
export function hostedLevel(env: NodeJS.ProcessEnv = process.env): HostedLevel | undefined {
  const level = env.SMITHABLE_HOSTED_LEVEL?.trim().toLowerCase();
  if (!level) return undefined;
  return LEVELS.includes(level as HostedLevel) ? (level as HostedLevel) : "strict";
}

/** The sign-in providers an auth file names; none for an app without sign-in. */
const providersOf = (auth: AuthIR): string[] =>
  auth.signIn === "none" ? [] : auth.signIn.providers;

/** Sign-in with companies outside the EU, which Strict does not allow (the service refuses them). */
const OUTSIDE = { google: "Google", facebook: "Facebook" } as const;

/** At Strict, a warning for each sign-in provider the level does not allow, where the file names it. */
export function levelWarnings(
  level: HostedLevel | undefined,
  auth: AuthIR,
  file: { path: string; text: string },
): Diagnostic[] {
  if (level !== "strict") return [];
  const lines = file.text.split("\n");
  return providersOf(auth).flatMap((provider) => {
    const name = OUTSIDE[provider as keyof typeof OUTSIDE];
    if (!name) return [];
    const at = lines.findIndex((l) => new RegExp(`\\b${provider}\\b`).test(l));
    return [
      {
        severity: "warning" as const,
        code: "hosted-level-sign-in",
        message: `This project's level is Strict: sign-in with ${name} is not allowed at that level.`,
        hint: "Use sign-in by email, or ask the project's owner to choose Normal or Relaxed.",
        file: file.path,
        line: at + 1 || 1,
        column: at < 0 ? 1 : (lines[at] as string).indexOf(provider) + 1,
      },
    ];
  });
}

/** The release check's line: the level, and what the app connects to outside itself. */
export function levelLine(level: HostedLevel, ir: SpecIR, auth: AuthIR): string {
  const named = level[0]?.toUpperCase() + level.slice(1);
  const signIn = providersOf(auth)
    .filter((p) => p !== "email")
    .map((p) => `sign-in with ${OUTSIDE[p as keyof typeof OUTSIDE] ?? p}`);
  const calls = [...new Set(ir.outgoing.map((o) => o.to).filter((to) => to !== "mail"))].map(
    (to) => `calls to ${to}`,
  );
  const mail = ir.outgoing.some((o) => o.to === "mail") ? ["mail"] : [];
  const connections = [...signIn, ...calls, ...mail];
  const which = level === "non-eu" ? "This is a non-EU app" : `This app's level is ${named}`;
  return `${which}; its connections: ${connections.length ? connections.join(", ") : "none"}.`;
}
