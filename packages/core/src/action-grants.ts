import { modelAccess } from "./access.js";
import type { AuthIR } from "./auth.js";
import { YamlEditor } from "./edit.js";
import type { SpecIR } from "./ir.js";

/**
 * Writes a role's `actions: all` out as the list of custom actions where `all` would widen what
 * the role may do (docs/design/actions.md, 2026-10-21): `all` came to mean every action, standard
 * ones included, which a role without `write` on a model with standard actions did not have. Run
 * once by `smithable upgrade`; returns the text unchanged when no role widens.
 */
export function writeActionGrants(
  text: string,
  ir: SpecIR,
  auth: AuthIR,
): { text: string; written: string[] } {
  const spec = new YamlEditor(text);
  const written: string[] = [];
  // Those a role runs only when named: custom actions, and merges (intents.md §3).
  const custom = ir.actions.filter((a) => a.custom || a.merge).map((a) => a.name);
  for (const role of auth.roles) {
    if (role.name === "admin" || role.grants === "all" || role.grants.actions !== "all") continue;
    const widens = ir.models.some(
      (m) =>
        ir.actions.some((a) => !a.custom && a.on === m.name) &&
        !modelAccess(m, auth).write.roles.includes(role.name),
    );
    if (!widens) continue;
    const path = ["roles", role.name, "actions"];
    if (!spec.has(path)) continue;
    if (custom.length) spec.set(path, custom);
    else spec.remove(path);
    written.push(`${role.name}: actions ${custom.length ? custom.join(", ") : "none"}`);
  }
  return { text: written.length ? spec.text : text, written };
}
