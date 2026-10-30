// While a described app is being made (docs/design/while-it-is-made.md, stage one): the
// description, the stage, a bar on the usual time (held at half while questions wait), and once
// the model has answered the app's name and its one line, not the whole summary (Johan, round
// 4: there is no time to read it). Until the app is in place the project's own files are the
// waiting workspace's placeholder, so nothing of them is shown.
import { summarize } from "@smithable/index";
import { useEffect, useMemo, useState } from "react";
import { api, type Making as MakingState, type Project } from "./api";
import { Ask } from "./builder/Ask";
import { useSpec } from "./engine";
import { Button, cx, Input } from "./ui";

const STAGES: Record<MakingState["stage"], string> = {
  reading: "Reading your description",
  asking: "A few questions first",
  drafting: "Drafting your app",
  building: "Building it",
  arriving: "Starting the preview",
  failed: "It could not be made",
};

/** The usual time a draft takes, when the service has not said. */
const USUAL = 25_000;

/**
 * How far the bar is: along the usual time to nine tenths, then ever slower towards the end,
 * which it reaches only when the app is in place (the bar is gone then).
 */
export function progress(elapsed: number, usual = USUAL): number {
  if (elapsed <= usual) return (0.9 * Math.max(elapsed, 0)) / usual;
  return 0.9 + 0.09 * (1 - Math.exp(-(elapsed - usual) / usual));
}

/**
 * The bar when the draft waited for answers (Johan, round 4): it climbs to half and holds
 * there while the questions are open, then goes on from half once they are answered or
 * skipped, over the usual time again.
 */
export function heldProgress(
  elapsed: number,
  usual = USUAL,
  answeredAfter?: number,
  asking = false,
): number {
  if (asking) return Math.min(progress(elapsed, usual), 0.5);
  if (answeredAfter === undefined) return progress(elapsed, usual);
  return 0.5 + 0.5 * progress(elapsed - answeredAfter, usual);
}

export function Making({
  making,
  project,
}: {
  making: MakingState;
  project: Pick<Project, "plugins" | "ownThemes" | "waiting">;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (making.stage === "failed") return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [making.stage]);
  const usual = making.usual ?? USUAL;
  const elapsed = now - Date.parse(making.since);
  // "What it does" of the drafted app, as Builder says it for any app.
  const drafted = useMemo(
    () => (making.files ? { ...project, files: making.files } : undefined),
    [making.files, project],
  );
  const spec = useSpec(drafted);
  const sections = useMemo(
    () => (spec.ir ? summarize(spec.ir, spec.auth, spec.content, spec.plugins, spec.ux) : []),
    [spec],
  );
  const [retrying, setRetrying] = useState(false);
  const failed = making.stage === "failed";
  const asking = Boolean(making.stage === "asking" && making.questions?.length);
  // When the questions were answered or skipped, counted from the start: the bar goes on from
  // half from there.
  const [answeredAfter, setAnsweredAfter] = useState<number>();
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    if (asking) setAsked(true);
    else if (asked && answeredAfter === undefined)
      setAnsweredAfter(Date.now() - Date.parse(making.since));
  }, [asking, asked, answeredAfter, making.since]);
  const shown = heldProgress(elapsed, usual, answeredAfter, asking);
  // The drafted app's name and its one line, once the model has answered: there is no time to
  // read the whole summary while it is made.
  const name = spec.ir?.app.name;
  const line = spec.ir?.app.description ?? sections[0]?.sentences[0];
  return (
    <section aria-label="Your app is being made" className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold">
          {failed
            ? "Your app could not be made"
            : name
              ? `Preparing Studio for ${name}`
              : "Your app is being made"}
        </h1>
        {/* The person's own words stay in sight: whole while drafting, one line once What it
            does says what was made of them. */}
        <blockquote
          title={making.description}
          className={cx(
            "border-l-2 border-line-strong pl-3 text-sm text-fg-soft",
            line && "truncate",
          )}
        >
          {making.description}
        </blockquote>
      </div>
      {failed ? (
        <div
          role="alert"
          className="space-y-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm"
        >
          {making.error && <p className="text-red-800">{making.error}</p>}
          <Button
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              await api.retryMaking().catch(() => undefined);
              setRetrying(false);
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted">
            <span role="status">{STAGES[making.stage]}…</span>
            {!asking && elapsed > usual && <span>Taking a little longer than usual</span>}
          </div>
          <div
            role="progressbar"
            aria-label="How far it is"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(shown * 100)}
            className="h-1.5 overflow-hidden rounded-full bg-line"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
              style={{ width: `${shown * 100}%` }}
            />
          </div>
        </div>
      )}
      {asking && <Questions questions={making.questions ?? []} />}
      {line && !asking && (
        <section aria-label="What it does" className="space-y-1">
          <h2 className="text-sm font-semibold text-muted">What it does</h2>
          <p className="text-sm text-fg-soft">{line}</p>
        </section>
      )}
      {/* The words box from the start: what is typed is made once the app is in place. */}
      <div className="-mx-4 rounded-lg border border-line bg-panel">
        <Ask making waiting={project.waiting} {...(project.ai ? { ai: project.ai } : {})} />
      </div>
      {/* A place for an animation later (docs/design/while-it-is-made.md §7). */}
      <div data-slot="making-animation" />
    </section>
  );
}

/**
 * What the description leaves open, asked before the draft: each question with its suggested
 * answers, any of which may be chosen together, and words of one's own beside them; a question
 * left empty is skipped. One call sends them all and the draft starts.
 */
function Questions({ questions }: { questions: NonNullable<MakingState["questions"]> }) {
  // Per question: the suggestions chosen, and what was typed, kept apart so typing a
  // suggestion's words never empties the box.
  const [chosen, setChosen] = useState<string[][]>(() => questions.map(() => []));
  const [own, setOwn] = useState<string[]>(() => questions.map(() => ""));
  const [busy, setBusy] = useState(false);
  const send = async (given: string[]) => {
    setBusy(true);
    await api.answerMaking(given).catch(() => undefined);
    setBusy(false);
  };
  const toggle = (i: number, option: string) =>
    setChosen((all) =>
      all.map((c, j) =>
        j !== i ? c : c.includes(option) ? c.filter((o) => o !== option) : [...c, option],
      ),
    );
  const answer = (i: number) =>
    [...(chosen[i] ?? []), (own[i] ?? "").trim()].filter(Boolean).join(", ");
  return (
    <form
      aria-label="Questions"
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void send(questions.map((_, i) => answer(i)));
      }}
    >
      <p className="text-xs text-quiet">
        Choose as many answers as fit, add your own words, or leave a question empty to skip it.
      </p>
      {questions.map((q, i) => (
        <fieldset key={q.question} className="space-y-2">
          <legend className="text-sm font-medium">{q.question}</legend>
          <div className="flex flex-wrap gap-2">
            {q.options.map((option) => {
              const on = chosen[i]?.includes(option) ?? false;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(i, option)}
                  className={
                    on
                      ? "rounded-full border border-accent bg-accent-soft px-3 py-1 text-sm text-accent"
                      : "rounded-full border border-line-strong px-3 py-1 text-sm text-fg-soft hover:border-accent"
                  }
                >
                  {option}
                </button>
              );
            })}
          </div>
          <Input
            aria-label={`Your own answer: ${q.question}`}
            placeholder="Or in your own words"
            value={own[i] ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              setOwn((all) => all.map((a, j) => (j === i ? value : a)));
            }}
          />
        </fieldset>
      ))}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          Make it
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => void send(questions.map(() => ""))}
        >
          Skip all
        </Button>
      </div>
    </form>
  );
}
