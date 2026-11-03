import { type Document, isMap, isScalar } from "yaml";
import type { SpecIR } from "./ir.js";
import { type ThemeIR, themeNamed } from "./theme.js";
import { type DefaultValues, defaultLeaves } from "./theme-default-schema.js";
import { UX_CAPABILITIES, type UxCapability, type UxCapabilityId } from "./ux-capabilities.js";

export interface UxDefaultFact {
  path: string[];
  effectivePath: string[];
  value: string | number;
  theme: string;
  source: ThemeIR["source"];
  label: string;
  structural: boolean;
  page?: string;
  section?: string;
  capability?: UxCapabilityId;
}
export interface UxInherited {
  used: UxDefaultFact[];
  masked: UxDefaultFact[];
  skipped: (UxDefaultFact & { reason: string })[];
}
export interface PreparedUxDefaults {
  nodes: WeakMap<object, UxDefaultFact>;
  skipped: Map<UxDefaultFact, string>;
  facts: UxDefaultFact[];
  masked: UxDefaultFact[];
  containers: Map<string, { path: string[]; authored: boolean }>;
}
const policy = (theme: ThemeIR | undefined) => theme?.defaults;

/** Prepare only finite omitted values. Original authored nodes and their ranges stay intact. */
export function prepareUxDefaults(
  doc: Document,
  ir: SpecIR,
  themes: readonly ThemeIR[],
): PreparedUxDefaults {
  const selected = doc.getIn(["theme", "preset"]);
  const appTheme = themeNamed(typeof selected === "string" ? selected : "modern", themes);
  const candidates = new Map<string, UxDefaultFact>();
  function offer(
    theme: ThemeIR,
    scope: "app" | "page",
    values: DefaultValues | undefined,
    page?: string,
    kind?: string,
  ) {
    for (const leaf of defaultLeaves(values)) {
      const entry = Object.entries(UX_CAPABILITIES).find(([, value]) => {
        const cap: UxCapability = value;
        return (
          cap.themeDefault &&
          cap.scope === scope &&
          (!kind || cap.kinds?.includes(kind)) &&
          cap.rawPath.join(".") === leaf.path.join(".")
        );
      });
      if (!entry) continue; // Parser/schema ensure this for validated ThemeIR.
      const [id, cap] = entry;
      const path = page ? ["pages", page, ...leaf.path] : leaf.path;
      candidates.set(JSON.stringify(path), {
        path,
        effectivePath: page ? ["pages", page, ...cap.path] : [...cap.path],
        value: leaf.value,
        theme: theme.name,
        source: theme.source,
        label: cap.label,
        structural: cap.structural,
        ...(page ? { page } : {}),
        capability: id as UxCapabilityId,
      });
    }
  }
  if (appTheme) offer(appTheme, "app", policy(appTheme)?.app);
  for (const page of ir.pages) {
    const own = doc.getIn(["pages", page.id, "theme", "preset"]);
    const pageTheme = typeof own === "string" ? themeNamed(own, themes) : undefined;
    for (const theme of [appTheme, pageTheme].filter((value): value is ThemeIR => !!value)) {
      offer(theme, "page", policy(theme)?.kinds?.[page.pattern.kind], page.id, page.pattern.kind);
      for (const section of page.sections.filter((section) => !section.own)) {
        for (const leaf of defaultLeaves(policy(theme)?.sections?.[section.kind])) {
          const path = ["pages", page.id, "sections", section.name, ...leaf.path];
          candidates.set(JSON.stringify(path), {
            path,
            effectivePath: ["pages", page.id, "looks", section.name, ...leaf.path],
            value: leaf.value,
            theme: theme.name,
            source: theme.source,
            label: `${section.kind}.${leaf.path.join(".")}`,
            structural: true,
            page: page.id,
            section: section.name,
          });
        }
      }
    }
  }
  const prepared: PreparedUxDefaults = {
    nodes: new WeakMap(),
    skipped: new Map(),
    facts: [],
    masked: [],
    containers: new Map(),
  };
  // Snapshot authorship before any insertion, including normalized/raw aliases.
  for (const fact of candidates.values())
    for (let length = 2; length < fact.effectivePath.length; length++) {
      const path = fact.effectivePath.slice(0, length);
      const raw = [...path];
      if (raw[2] === "looks") raw[2] = "sections";
      prepared.containers.set(JSON.stringify(path), { path, authored: doc.hasIn(raw) });
    }
  for (const fact of candidates.values()) {
    if (doc.hasIn(fact.path)) {
      prepared.masked.push(fact);
      continue;
    }
    // A malformed explicit mapping remains malformed; inheritance never repairs it.
    if (
      fact.path.slice(0, -1).some((_, index) => {
        const node = doc.getIn(fact.path.slice(0, index + 1), true);
        return node !== undefined && !isMap(node);
      })
    )
      continue;
    const value = doc.createNode(fact.value);
    // YAMLMap.set with a string key can create raw keys, unlike parsed Scalars.
    // Build inferred mappings with document-created nodes so core validation sees
    // the same node shapes as authored YAML, without reparsing source ranges.
    let mapping = doc.contents;
    if (!isMap(mapping)) continue;
    for (const key of fact.path.slice(0, -1)) {
      if (!mapping.has(key)) mapping.add({ key: doc.createNode(key), value: doc.createNode({}) });
      const next: unknown = mapping.get(key, true);
      if (!isMap(next)) throw new Error("Invalid default ancestor");
      mapping = next;
    }
    mapping.add({ key: doc.createNode(fact.path.at(-1)), value });
    prepared.nodes.set(value, fact);
    const parent = doc.getIn(fact.path.slice(0, -1), true);
    if (isMap(parent)) {
      const pair = parent.items.find(
        (pair) => isScalar(pair.key) && pair.key.value === fact.path.at(-1),
      );
      if (pair?.key && typeof pair.key === "object") prepared.nodes.set(pair.key, fact);
    }
    prepared.facts.push(fact);
  }
  return prepared;
}

/** Remove only rejected inherited values from normalized IR, not from the author's source. */
export function finishUxDefaults(
  ux: object,
  prepared: PreparedUxDefaults,
): UxInherited | undefined {
  for (const fact of prepared.skipped.keys()) {
    let parent: unknown = ux;
    for (const key of fact.effectivePath.slice(0, -1))
      parent =
        parent && typeof parent === "object" ? (parent as Record<string, unknown>)[key] : undefined;
    const key = fact.effectivePath.at(-1);
    if (key && parent && typeof parent === "object")
      delete (parent as Record<string, unknown>)[key];
  }
  for (const container of [...prepared.containers.values()].sort(
    (a, b) => b.path.length - a.path.length,
  )) {
    if (container.authored) continue;
    let parent: unknown = ux;
    for (const key of container.path.slice(0, -1))
      parent =
        parent && typeof parent === "object" ? (parent as Record<string, unknown>)[key] : undefined;
    const key = container.path.at(-1);
    if (key && parent && typeof parent === "object") {
      const value = (parent as Record<string, unknown>)[key];
      if (value && typeof value === "object" && !Array.isArray(value) && !Object.keys(value).length)
        delete (parent as Record<string, unknown>)[key];
    }
  }
  if (!prepared.facts.length && !prepared.masked.length) return;
  return {
    used: prepared.facts.filter((fact) => !prepared.skipped.has(fact)),
    masked: prepared.masked,
    skipped: [...prepared.skipped].map(([fact, reason]) => ({ ...fact, reason })),
  };
}
