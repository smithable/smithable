import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  baselineKitSources,
  LANDING_KIT_FEATURES,
  type LandingKitFeature,
  landingKitSources,
  STACK_PROFILE,
} from "@smithable/adapter-tanstack";
import { git } from "./git.js";
import { VERSION } from "./version.js";

function kitHash(sources: Record<string, string>): string {
  return createHash("sha256")
    .update(
      JSON.stringify(Object.entries(sources).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    )
    .digest("hex");
}

export const templateKitRevision = kitHash(baselineKitSources);
export function landingKitRevision(features: readonly LandingKitFeature[]): string {
  if (!features.length) return templateKitRevision;
  return `${features.join(",")}:${kitHash(landingKitSources(features))}`;
}

function json(dir: string, file: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(readFileSync(join(dir, file), "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
}
export function maintenanceInfo(dir: string) {
  const lock = json(dir, "smithable.lock"),
    pkg = json(dir, "package.json");
  const generatedEngine = typeof lock?.smithable === "string" ? lock.smithable : undefined;
  const generatedProfile = typeof lock?.stackProfile === "string" ? lock.stackProfile : undefined;
  const generatedKit = typeof lock?.kitRevision === "string" ? lock.kitRevision : undefined;
  const recordedFeatures = (generatedKit?.split(":")[0] ?? "").split(",");
  const knownFeatures = LANDING_KIT_FEATURES.filter((feature) =>
    recordedFeatures.includes(feature),
  );
  const currentKit =
    knownFeatures.length === recordedFeatures.length
      ? landingKitRevision(knownFeatures)
      : templateKitRevision;
  const dependencies = Object.fromEntries(
    Object.entries({
      ...((pkg?.dependencies ?? {}) as object),
      ...((pkg?.devDependencies ?? {}) as object),
    }).filter(([, version]) => typeof version === "string"),
  );
  let upgrade: { commit: string; from: string; to: string; engine: string } | undefined;
  const history = git(dir, ["log", "-1", "--format=%H%n%b", "--grep=Smithable-Upgrade:"]);
  if (history.ok)
    try {
      const commit = history.out.split("\n")[0] ?? "",
        text = /^Smithable-Upgrade: (.+)$/m.exec(history.out)?.[1];
      const record = text ? JSON.parse(text) : undefined;
      if (
        /^[a-f0-9]{40}$/.test(commit) &&
        typeof record?.from === "string" &&
        typeof record.to === "string" &&
        typeof record.smithable === "string"
      )
        upgrade = { commit, from: record.from, to: record.to, engine: record.smithable };
    } catch {}
  const status = !lock
    ? "Generation metadata unavailable"
    : generatedProfile !== STACK_PROFILE.id
      ? "Stack profile differs; test a staged upgrade"
      : !generatedKit
        ? "Template revision unknown; test a staged upgrade"
        : generatedKit !== currentKit
          ? "Template revision differs; test a staged upgrade"
          : generatedEngine !== VERSION
            ? "Generator version differs; test a staged upgrade"
            : VERSION === "0.0.0"
              ? "Development version; source compatibility needs verification"
              : "Recorded versions match this tool; verify changes before releasing";
  return {
    generatedEngine,
    generatedProfile,
    generatedKit,
    currentEngine: VERSION,
    currentProfile: STACK_PROFILE.id,
    currentKit,
    status,
    dependencies,
    upgrade,
  };
}
