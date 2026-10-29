// The project's sample users as the runner reads them (docs/design/sample-users.md §4–§5): who
// they are with the app's ids for them, the app in words for the model, and the labels a move is
// said with. Read again only when one of the files changed: Studio's panel asks often.
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { samplePeople } from "@smithable/adapter-tanstack";
import { humanize } from "@smithable/core";
import { summarize } from "@smithable/index";
import type { SamplePerson } from "./sample-run.js";
import { loadSpec } from "./validate.js";

/** The files the sample users' runner reads: the people, and the spec they act in. */
const PEOPLE_FILES = [
  "samples/people.yml",
  "smithable.yml",
  "smithable.auth.yml",
  "smithable.content.yml",
];

export interface ProjectPeople {
  people: SamplePerson[];
  summary: string;
  labels: Record<string, string>;
}

/** A reader of the project's sample users, kept until one of their files changes. */
export function projectPeople(dir: string): () => ProjectPeople {
  let kept: { stamp: string; value: ProjectPeople } | undefined;
  return () => {
    const stamp = PEOPLE_FILES.map((f) => {
      const path = join(dir, f);
      return existsSync(path) ? statSync(path).mtimeMs : 0;
    }).join(",");
    if (kept?.stamp === stamp) return kept.value;
    const {
      ir,
      auth,
      content,
      people: listed = [],
    } = loadSpec(dir, { out: () => {}, err: () => {} });
    // The app's ids for them, in the file's order (a visitor has none: the door knows it as such).
    const ids = samplePeople(listed).map((u) => u.id);
    const value = {
      people: listed.map((p) => ({
        ...p,
        id: p.role === "visitor" ? "visitor" : (ids.shift() as string),
      })),
      summary: ir
        ? summarize(ir, auth, content)
            .map((s) => `${s.title}: ${s.sentences.join(" ")}`)
            .join("\n")
        : "",
      // The words a move is said in: each model's and action's label.
      labels: Object.fromEntries([
        ...(ir?.models ?? []).map((m) => [
          m.name,
          content?.models[m.name]?.label ?? humanize(m.name),
        ]),
        ...(ir?.actions ?? []).map((a) => [
          a.name,
          content?.actions[a.name]?.label ?? humanize(a.name),
        ]),
      ]),
    };
    kept = { stamp, value };
    return value;
  };
}

/** A call on the app's development door at `base`, with its secret. */
export function doorAt(base: string, secret: string, headers: Record<string, string> = {}) {
  return (path: string, body?: unknown) =>
    fetch(`${base}/_dev/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { ...headers, "x-dev-door": secret, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
    });
}
