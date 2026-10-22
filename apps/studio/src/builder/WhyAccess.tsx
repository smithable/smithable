// Who can's "Why?" (A 127; docs/design/explain-access.md): a question built from the app's own
// pages, kinds of record and actions, answered by core's explainAccess with the rules that
// decided it, in the order they apply, each a link to its line in the file that says it.
import {
  type AccessResource,
  type AccessScenario,
  type AccessVerb,
  type AuthIR,
  explainAccess,
  type SpecIR,
} from "@smithable/core";
import { useState } from "react";
import { SHOW_CODE } from "../code-jump";

/** What the question may be about: a page, a kind of record or an action, with what it takes. */
interface Subject {
  key: string;
  label: string;
  resource: AccessResource;
  verbs: AccessVerb[];
}

const VERB_WORDS: Record<AccessVerb, string> = {
  open: "open",
  read: "read",
  create: "add",
  write: "change",
  delete: "delete",
  review: "review the files of",
  run: "run",
};

const RECORD_WORDS: [NonNullable<AccessScenario["record"]> | "", string][] = [
  ["", "any of them (a list)"],
  ["own", "their own"],
  ["another's", "someone else's"],
  ["ownerless", "one with no owner"],
];

const VERDICT_WORDS = {
  allowed: "Yes",
  denied: "No",
  conditional: "It depends on the record",
};

export function subjectsOf(ir: SpecIR): Subject[] {
  return [
    ...ir.pages.map((p) => ({
      key: `page:${p.id}`,
      label: `the ${p.id} page`,
      resource: { kind: "page", page: p.id } as const,
      verbs: ["open"] as AccessVerb[],
    })),
    ...ir.models.map((m) => ({
      key: `model:${m.name}`,
      label: `${m.name} records`,
      resource: { kind: "model", model: m.name } as const,
      verbs: [
        "read",
        "create",
        "write",
        "delete",
        ...(m.review?.length ? ["review"] : []),
      ] as AccessVerb[],
    })),
    ...ir.actions.map((a) => ({
      key: `action:${a.name}`,
      label: `the action ${a.name}`,
      resource: { kind: "action", action: a.name } as const,
      verbs: ["run"] as AccessVerb[],
    })),
  ];
}

/** Shows a reason's setting in Code: its file, at the path (App puts Code on screen). */
const showInCode = (file: string, path: string) =>
  window.dispatchEvent(new CustomEvent(SHOW_CODE, { detail: { file, path } }));

export function WhyAccess({ ir, auth }: { ir: SpecIR; auth: AuthIR }) {
  const subjects = subjectsOf(ir);
  const firstRole = auth.roles.find((r) => r.name !== "admin")?.name ?? "";
  const [chosen, setAs] = useState(firstRole);
  // A role removed since it was chosen: the first role there is (a visitor stays a visitor).
  const as = chosen === "" || auth.roles.some((r) => r.name === chosen) ? chosen : firstRole;
  const [subjectKey, setSubjectKey] = useState(subjects[0]?.key ?? "");
  const subject = subjects.find((s) => s.key === subjectKey) ?? subjects[0];
  const [verbChosen, setVerb] = useState<AccessVerb>("open");
  const verb = subject?.verbs.includes(verbChosen) ? verbChosen : subject?.verbs[0];
  const [record, setRecord] = useState<AccessScenario["record"] | "">("");
  // Whose record it is matters once a record is in question: not to open a page or add one.
  const aboutARecord = subject && verb !== "open" && verb !== "create";
  if (!subject || !verb) return null;
  let answer: ReturnType<typeof explainAccess> | undefined;
  let problem: string | undefined;
  try {
    answer = explainAccess(
      ir,
      auth,
      {
        ...(as ? { as } : {}),
        ...(aboutARecord && record ? { record } : {}),
      },
      subject.resource,
      verb,
    );
  } catch (error) {
    problem = error instanceof Error ? error.message : String(error);
  }
  return (
    <section aria-label="Why?" className="space-y-2 rounded border border-line p-3">
      <h3 className="font-semibold">Why?</h3>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1">
          May
          <select aria-label="Who" value={as} onChange={(e) => setAs(e.target.value)}>
            <option value="">a visitor (not signed in)</option>
            {auth.roles.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <select
          aria-label="Do what"
          value={verb}
          onChange={(e) => setVerb(e.target.value as AccessVerb)}
        >
          {subject.verbs.map((v) => (
            <option key={v} value={v}>
              {VERB_WORDS[v]}
            </option>
          ))}
        </select>
        <select
          aria-label="What"
          value={subject.key}
          onChange={(e) => setSubjectKey(e.target.value)}
        >
          {subjects.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        {aboutARecord && (
          <label className="inline-flex items-center gap-1">
            , namely
            <select
              aria-label="Whose record"
              value={record}
              onChange={(e) => setRecord(e.target.value as AccessScenario["record"] | "")}
            >
              {RECORD_WORDS.map(([value, words]) => (
                <option key={value} value={value}>
                  {words}
                </option>
              ))}
            </select>
          </label>
        )}
        ?
      </div>
      {problem ? (
        <p role="status" className="text-warning">
          {problem}
        </p>
      ) : (
        answer && (
          <div role="status" data-verdict={answer.verdict} className="space-y-1">
            <p className="font-semibold">{VERDICT_WORDS[answer.verdict]}.</p>
            <ol className="list-decimal space-y-1 pl-5">
              {answer.reasons.map((r) => (
                <li key={`${r.at.file}:${r.at.path}:${r.text}`}>
                  {r.text}{" "}
                  <button
                    type="button"
                    className="text-xs text-accent underline-offset-2 hover:underline"
                    title="Show it in Code"
                    onClick={() => showInCode(r.at.file, r.at.path)}
                  >
                    {r.at.file}: {r.at.path}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )
      )}
    </section>
  );
}
