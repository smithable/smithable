// Smithable app kit: the administrator's inspector (docs/design/assistant.md §4): ask the app a
// question as one of its roles, or as a visitor, and see what an assistant with that role's key
// would get: the answer as the app shows it, marked as worked out from the records or by an AI,
// and under it each tool called, with what, what came back, the tokens and the time. An answer
// can be read aloud by the browser's own speech (§8).
import { useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import type { Answer, Step } from "./assistant.server";

interface Asked {
  question: string;
  role: string;
  answer?: Answer;
  failed?: string;
}

export function Inspector({
  roles,
  ask,
}: {
  /** Each role an assistant may act as, and "visitor" for one without a key. */
  roles: { value: string; label: string }[];
  ask: (question: string, role: string) => Promise<Answer>;
}) {
  const [role, setRole] = useState(roles[0]?.value ?? "visitor");
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<Asked[]>([]);
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    try {
      const answer = await ask(q, role);
      setAsked((list) => [{ question: q, role, answer }, ...list]);
      setQuestion("");
    } catch (error) {
      setAsked((list) => [
        { question: q, role, failed: error instanceof Error ? error.message : String(error) },
        ...list,
      ]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">As</span>
            <select
              aria-label="Act as"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <Input
            aria-label="Question"
            placeholder="How many … are there? Show the … that …"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={busy || !question.trim()}>
            {busy ? "Asking…" : "Ask"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Answers may come from an AI and can be wrong. Check what matters.
        </p>
      </form>
      <ol className="space-y-4">
        {asked.map((a, i) => (
          <li
            key={`${asked.length - i}`}
            data-answer
            className="space-y-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">{a.question}</p>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                as {roles.find((r) => r.value === a.role)?.label ?? a.role}
                {a.answer?.source === "records" && (
                  <Badge variant="success">From your records</Badge>
                )}
                {a.answer?.source === "ai" && <Badge>AI</Badge>}
              </span>
            </div>
            {a.failed && <p className="text-sm text-destructive">{a.failed}</p>}
            {a.answer && <Shown answer={a.answer} />}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The answer as the app shows it, then how it came about. */
function Shown({ answer }: { answer: Answer }) {
  return (
    <>
      {answer.text && <p className="text-sm">{answer.text}</p>}
      {answer.steps.map((step, i) => (
        <Result key={`${i}-${step.tool}`} step={step} />
      ))}
      {answer.note && <p className="text-sm text-muted-foreground">{answer.note}</p>}
      <ReadAloud text={spoken(answer)} />
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">
          {answer.steps.length} tool {answer.steps.length === 1 ? "call" : "calls"}
          {answer.tokens
            ? `, ${answer.tokens.in} tokens in, ${answer.tokens.out} out`
            : ", no model"}
          , {answer.ms} ms
        </summary>
        <ol className="mt-2 space-y-2">
          {answer.steps.map((step, i) => (
            <li key={`${i}-${step.tool}`}>
              <code>
                {step.tool} {JSON.stringify(step.args)}
              </code>{" "}
              ({step.ms} ms)
              <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">
                {step.proposed
                  ? "Not run: a change the person would confirm first."
                  : (step.error ?? JSON.stringify(step.result, null, 2))}
              </pre>
            </li>
          ))}
        </ol>
      </details>
    </>
  );
}

/** Reads the answer aloud with the browser's speech, where the browser has it. */
function ReadAloud({ text }: { text: string }) {
  if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      }}
    >
      Read aloud
    </Button>
  );
}

/** The answer as a sentence or two to hear: the words, the numbers, the first rows. */
export function spoken(answer: Answer): string {
  const parts: string[] = answer.text ? [answer.text] : [];
  for (const step of answer.steps) {
    if (step.proposed)
      parts.push(
        `It would ${step.tool} ${String(step.args.kind ?? step.args.action ?? "")}; nothing was changed.`,
      );
    else if (step.error) parts.push(step.error);
    else {
      const r = step.result as Record<string, unknown> | null;
      if (!r || typeof r !== "object") continue;
      const number = (["total", "sum", "average", "smallest", "largest"] as const).find(
        (k) => k in r,
      );
      if (number) parts.push(`${number === "total" ? "" : `${number} `}${cell(r[number])}.`);
      else if (Array.isArray(r.rows) && typeof r.by === "string")
        parts.push(
          (r.rows as { value: unknown; title?: string; number: unknown }[])
            .slice(0, 5)
            .map((row) => `${cell(row.title ?? row.value)}: ${cell(row.number)}`)
            .join(". ") + ".",
        );
      else if (Array.isArray(r.rows)) {
        const rows = r.rows as unknown[][];
        const total = typeof r.total === "number" ? r.total : rows.length;
        const first = rows.slice(0, 3).map((row) => cell(row[1] ?? row[0]));
        parts.push(`${total} found${first.length ? `: ${first.join(", ")}` : ""}.`);
      } else if (typeof r.description === "string") parts.push(r.description);
    }
  }
  if (answer.note) parts.push(answer.note);
  return parts.join(" ");
}

/** What one call gave: a number, a table, a record, a description, or a proposed change. */
function Result({ step }: { step: Step }) {
  if (step.proposed)
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-sm">
        Would {step.tool} {String(step.args.kind ?? step.args.action ?? "")}
        {step.args.id !== undefined ? ` ${String(step.args.id)}` : ""}: an assistant with this role
        may propose it, and nothing was changed.
      </div>
    );
  if (step.error) return <p className="text-sm text-destructive">{step.error}</p>;
  const r = step.result as Record<string, unknown> | null;
  if (!r || typeof r !== "object") return <p className="text-sm">{String(r)}</p>;
  if (Array.isArray(r.columns) && Array.isArray(r.rows))
    return (
      <Table
        head={r.columns as string[]}
        rows={(r.rows as unknown[][]).map((row) => row.map(cell))}
        note={typeof r.total === "number" ? `${r.total} in all` : undefined}
      />
    );
  if (typeof r.by === "string" && Array.isArray(r.rows))
    return (
      <Table
        head={[r.by, "number"]}
        rows={(r.rows as { value: unknown; title?: string; number: unknown }[]).map((row) => [
          cell(row.title ?? row.value),
          cell(row.number),
        ])}
      />
    );
  const number = (["total", "sum", "average", "smallest", "largest"] as const).find((k) => k in r);
  if (number)
    return (
      <p className="text-sm">
        <span className="text-2xl font-semibold tabular-nums">{cell(r[number])}</span>{" "}
        {number === "total" ? "" : number}
        {r.of && typeof r.of === "object" ? ` (${cell((r.of as { title?: unknown }).title)})` : ""}
      </p>
    );
  if (typeof r.description === "string") return <p className="text-sm">{r.description}</p>;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {Object.entries(r).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd>{cell(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Table({ head, rows, note }: { head: string[]; rows: string[][]; note?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="px-2 py-1 text-left font-medium text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${i}-${row[0]}`} className="border-t border-border">
              {row.map((c, j) => (
                <td key={`${j}-${head[j]}`} className="px-2 py-1">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/** A value as text: a reference by its title, nothing as a dash. */
function cell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "–";
  if (typeof value === "object" && "title" in (value as object))
    return String((value as { title: unknown }).title);
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
