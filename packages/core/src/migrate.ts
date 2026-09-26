import { type Document, isScalar, parseDocument } from "yaml";
import { SPEC_VERSION } from "./spec.js";

/** A deterministic, comment-preserving transform from one spec format version to the next. */
export interface SpecMigration {
  from: string;
  to: string;
  description: string;
  migrate(doc: Document): void;
}

/** Released migrations, oldest first. Every change to the spec format ships with one. */
export const MIGRATIONS: readonly SpecMigration[] = [];

export interface MigrateResult {
  text: string;
  from: string;
  to: string;
  applied: string[];
}

/** Migrates spec text step by step up to `target`, keeping comments and formatting. */
export function migrateSpec(
  text: string,
  migrations: readonly SpecMigration[] = MIGRATIONS,
  target: string = SPEC_VERSION,
): MigrateResult {
  const doc = parseDocument(text);
  const node = doc.get("smithable", true);
  const from = isScalar(node) ? (node.source ?? String(node.value)) : "";
  let version = from;
  const applied: string[] = [];
  while (version !== target) {
    const step = migrations.find((m) => m.from === version);
    if (!step)
      throw new Error(
        `No migration from spec version ${version || "(missing)"} towards ${target}.`,
      );
    step.migrate(doc);
    version = step.to;
    applied.push(`${step.from} → ${step.to}: ${step.description}`);
  }
  if (applied.length === 0) return { text, from, to: version, applied };
  doc.set("smithable", String(Number(version)) === version ? Number(version) : version);
  return { text: doc.toString(), from, to: version, applied };
}
