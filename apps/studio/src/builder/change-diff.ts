// An opened change in Builder, in plain language (docs/design/studio-changes.md §3): the app's
// summary made from the files before the change and after, and the sentences that differ, under
// their part. Whatever made the change (a form, the prompt, an edit in Code mode, an undo).
import type { SpecPlugin } from "@smithable/core";
import { summarize } from "@smithable/index";
import type { Project } from "../api";
import { readSpec } from "../engine";

export interface PartChange {
  concept: string;
  title: string;
  /** The sentences that went, and those that came, in the summary's order. */
  removed: string[];
  added: string[];
}

const sentences = (files: Project["files"], plugins: SpecPlugin[]) => {
  const spec = readSpec(files, files.spec, plugins);
  return spec.ir ? summarize(spec.ir, spec.auth, spec.content, plugins) : [];
};

export function summaryDiff(
  before: Project["files"],
  after: Project["files"],
  plugins: SpecPlugin[] = [],
): PartChange[] {
  const was = sentences(before, plugins);
  const now = sentences(after, plugins);
  const concepts = [...new Set([...now, ...was].map((s) => s.concept))];
  return concepts.flatMap((concept) => {
    const old = was.find((s) => s.concept === concept);
    const fresh = now.find((s) => s.concept === concept);
    const removed = (old?.sentences ?? []).filter((l) => !fresh?.sentences.includes(l));
    const added = (fresh?.sentences ?? []).filter((l) => !old?.sentences.includes(l));
    return removed.length || added.length
      ? [{ concept, title: (fresh ?? old)?.title ?? concept, removed, added }]
      : [];
  });
}
