import { useCallback, useEffect, useState } from "react";
import { api, type Project } from "./api";
import { Builder } from "./builder/Builder";
import { useSpec } from "./engine";
import { Studio } from "./studio/Studio";
import { Button, cx } from "./ui";

type Mode = "builder" | "studio";

/** A change that stopped to ask, because it loses data. */
interface Pending {
  name: string;
  args: Record<string, unknown>;
  impact: string;
}

export function App() {
  const [project, setProject] = useState<Project>();
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem("mode") as Mode) ?? "builder");
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [pending, setPending] = useState<Pending>();
  const [version, setVersion] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setProject(await api.project());
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    refresh();
    api.logs().then(setLogs);
    return api.events((event, data) => {
      if (event === "changed") refresh();
      else setLogs((current) => [...current.slice(-499), String(data)]);
    });
  }, [refresh]);

  const spec = useSpec(project?.files ?? {});

  /** Applies an operation; a change that loses data first asks for confirmation. */
  const run = async (name: string, args: Record<string, unknown>, confirm = false) => {
    setBusy(true);
    setMessage(undefined);
    const result = await api.operation(name, args, confirm);
    setBusy(false);
    if (result.needsConfirm) {
      setPending({
        name,
        args,
        impact: result.output.replace(/\n?Run again with --yes to apply it\.$/, ""),
      });
      return false;
    }
    setPending(undefined);
    // The last line says what happened; the rest is tool output.
    const lines = result.output.split("\n").filter((l) => l.trim());
    const summary = result.ok
      ? (lines.at(-1) ?? "Done.").replace(/ Undo with: smithable undo$/, "")
      : result.output;
    setMessage({ ok: result.ok, text: summary });
    return result.ok;
  };

  const undo = async () => {
    setBusy(true);
    const result = await api.undo();
    setBusy(false);
    setMessage({ ok: result.ok, text: result.output.split("\n")[0] ?? "" });
  };

  const customize = async (page: string) => {
    setBusy(true);
    const result = await api.customize(page);
    setBusy(false);
    const lines = result.output.split("\n").filter((l) => l.trim());
    setMessage({ ok: result.ok, text: result.ok ? (lines.at(-1) ?? "") : result.output });
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    localStorage.setItem("mode", next);
  };

  if (!project) return <p className="p-6 text-sm text-neutral-500">Opening the project…</p>;
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-neutral-200 bg-white px-4">
        <span className="text-sm font-semibold tracking-tight">Smithable</span>
        <span className="text-sm text-neutral-500">{project.name}</span>
        <fieldset className="ml-4 flex rounded-md bg-neutral-100 p-0.5">
          <legend className="sr-only">Mode</legend>
          {(["builder", "studio"] as const).map((m) => (
            <label
              key={m}
              className={cx(
                "flex h-7 cursor-pointer items-center rounded px-3 text-xs font-medium has-focus-visible:ring-2 has-focus-visible:ring-accent/30",
                mode === m ? "bg-white shadow-xs" : "text-neutral-600",
              )}
            >
              <input
                type="radio"
                name="mode"
                className="sr-only"
                checked={mode === m}
                onChange={() => switchMode(m)}
              />
              {m === "builder" ? "Builder" : "Studio"}
            </label>
          ))}
        </fieldset>
        <div className="ml-auto flex items-center gap-3">
          {busy && <span className="text-xs text-neutral-500">Working…</span>}
          {project.home && (
            <a href={project.home} className="text-xs font-medium text-accent hover:underline">
              Publish and share
            </a>
          )}
          <Button
            variant="ghost"
            onClick={undo}
            disabled={busy || !project.trace.some((t) => !t.undone && !t.isUndo)}
          >
            Undo
          </Button>
        </div>
      </header>
      {(message || pending) && (
        <div
          role={message?.ok === false || pending ? "alert" : "status"}
          className={cx(
            "flex items-center gap-3 border-b px-4 py-2 text-sm",
            pending
              ? "border-amber-200 bg-amber-50"
              : message?.ok
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50",
          )}
        >
          <span className="min-w-0 flex-1 whitespace-pre-wrap">
            {pending ? pending.impact : message?.text}
          </span>
          {pending ? (
            <>
              <Button variant="danger" onClick={() => run(pending.name, pending.args, true)}>
                Apply anyway
              </Button>
              <Button variant="ghost" onClick={() => setPending(undefined)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setMessage(undefined)}>
              Dismiss
            </Button>
          )}
        </div>
      )}
      <main className="min-h-0 flex-1">
        {mode === "builder" ? (
          <Builder project={project} spec={spec} run={run} version={version} />
        ) : (
          <Studio
            project={project}
            spec={spec}
            run={run}
            version={version}
            logs={logs}
            onCustomize={customize}
          />
        )}
      </main>
    </div>
  );
}
