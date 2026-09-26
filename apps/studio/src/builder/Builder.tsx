// Builder mode: the app in plain language, forms for changes, and the preview.
import { summarize } from "@smithable/index";
import { useMemo, useState } from "react";
import type { Project } from "../api";
import type { Spec } from "../engine";
import { Preview, Trace } from "../shared";
import { Panel, Tabs } from "../ui";
import { ChangeForms, type Run } from "./ChangeForms";

export function Builder({
  project,
  spec,
  run,
  version,
}: {
  project: Project;
  spec: Spec;
  run: Run;
  version: number;
}) {
  const [tab, setTab] = useState<"app" | "change">("app");
  const sections = useMemo(
    () => (spec.ir ? summarize(spec.ir, spec.auth, spec.content) : []),
    [spec],
  );
  return (
    <div className="grid h-full min-h-0 grid-cols-[380px_1fr_260px] divide-x divide-neutral-200">
      <Panel
        title={
          <Tabs
            tabs={[
              ["app", "Your app"],
              ["change", "Change"],
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      >
        {tab === "app" ? (
          <div className="space-y-5 p-4">
            {sections.map((s) => (
              <section key={s.concept} aria-label={s.title}>
                <h3 className="mb-1 text-sm font-semibold">{s.title}</h3>
                {s.sentences.map((sentence) => (
                  <p key={sentence} className="text-sm leading-relaxed text-neutral-700">
                    {sentence}
                  </p>
                ))}
              </section>
            ))}
          </div>
        ) : (
          <ChangeForms spec={spec} run={run} />
        )}
      </Panel>
      <Preview url={project.preview} version={version} />
      <Trace entries={project.trace} />
    </div>
  );
}
