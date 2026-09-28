// Builder mode: the app in plain language, forms for changes, and the preview.
import { summarize } from "@smithable/index";
import { useEffect, useMemo, useState } from "react";
import type { Project } from "../api";
import type { Spec } from "../engine";
import { isPreviewMessage, type Selection } from "../preview";
import { Preview, Trace } from "../shared";
import { Panel, Tabs } from "../ui";
import { Ask } from "./Ask";
import { ChangeForms, type Prefill, type Run } from "./ChangeForms";
import { Selected } from "./Selected";

/** Headings for the summary's groups of sections (models, actions, queries). */
const GROUPS: Record<string, string> = { model: "Records", action: "Actions", query: "Queries" };
const kind = (concept: string) => concept.split(":")[0] ?? "";

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
  // A change is described in words (the default) or made with a form.
  const [how, setHow] = useState<"describe" | "manual">("describe");
  const [prefill, setPrefill] = useState<Prefill>();
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState<Selection>();
  // The preview reports what was clicked in select mode, and columns dragged to a new place.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isPreviewMessage(e.data)) return;
      if (e.data.type === "select") setSelection(e.data);
      if (e.data.type === "columns")
        run("setColumns", { page: e.data.page, columns: e.data.columns });
      if (e.data.type === "text")
        run("setText", { path: e.data.path.split("."), text: e.data.text });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [run]);
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
            {sections.map((s, i) => (
              <section key={s.concept} aria-label={s.title}>
                {GROUPS[kind(s.concept)] &&
                  kind(sections[i - 1]?.concept ?? "") !== kind(s.concept) && (
                    <h2 className="mb-3 border-b border-neutral-200 pb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                      {GROUPS[kind(s.concept)]}
                    </h2>
                  )}
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
          <div>
            <div className="border-b border-neutral-200 px-3 py-2">
              <Tabs
                tabs={[
                  ["describe", "Describe"],
                  ["manual", "Manual"],
                ]}
                value={how}
                onChange={(h) => {
                  setPrefill(undefined);
                  setHow(h);
                }}
              />
            </div>
            {how === "describe" ? (
              <Ask
                onEdit={(p) => {
                  setPrefill(p);
                  setHow("manual");
                }}
              />
            ) : (
              <ChangeForms spec={spec} run={run} prefill={prefill} />
            )}
          </div>
        )}
      </Panel>
      <Preview
        url={project.preview}
        version={version}
        selecting={selecting}
        onSelecting={setSelecting}
      />
      {selection ? (
        <div className="grid min-h-0 grid-rows-[auto_1fr] divide-y divide-neutral-200">
          <Selected
            selection={selection}
            spec={spec}
            run={run}
            onClose={() => setSelection(undefined)}
          />
          <Trace entries={project.trace} />
        </div>
      ) : (
        <Trace entries={project.trace} />
      )}
    </div>
  );
}
