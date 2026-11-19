// An outgoing entry's words in Content (docs/design/outgoing-templates.md §8 step 3): the
// placeholders its texts may use, the fields its mail lists under the text (setOutgoingBody), and
// a preview of the mail filled from the model's sample record, so it reads right without a
// running app.
import {
  type AuthIR,
  channelsOf,
  type FieldIR,
  fillText,
  humanize,
  type ModelIR,
  notSendable,
  type OutgoingIR,
  placeholderProblem,
  placeholdersOf,
  type SpecIR,
  titleField,
  USER_MODEL,
} from "@smithable/core";
import { useId, useState } from "react";
import { parse } from "yaml";
import { StudioOverlay } from "../StudioOverlay";
import { Button, Input, useMedia } from "../ui";
import type { Run } from "./ChangeForms";
import { usePendingEdit } from "./pending-edit";

/** A field a placeholder or a mail's list can name, as core's validator has it. */
const sendable = (f: FieldIR) => !f.formula && !notSendable(f);

/** A model's sample records (samples/<Model>.yml), or none when the file is missing or broken. */
function records(samples: Record<string, string>, model: string): Record<string, unknown>[] {
  try {
    const list = parse(samples[model] ?? "");
    return Array.isArray(list)
      ? list.filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
      : [];
  } catch {
    return [];
  }
}

/** The placeholders an entry on `model` may use, as the validator's list has them. */
function placeholders(model: ModelIR, changed: boolean): string[] {
  const fields = model.fields.filter(sendable).map((f) => f.name);
  return [...fields, "title", "link", "by", ...(changed ? fields.map((f) => `before.${f}`) : [])];
}

/**
 * The fields one reference away, by reference ({customer.name}): a user's name and email, another
 * record's sendable fields that the validator accepts (with a warning or without).
 */
function hops(
  model: ModelIR,
  entry: OutgoingIR,
  ir: SpecIR,
  auth?: AuthIR,
): { ref: string; paths: string[] }[] {
  return model.fields.flatMap((f) => {
    if (f.type.kind !== "relation" || f.type.many) return [];
    const target = f.type.model;
    const other = ir.models.find((m) => m.name === target);
    const names =
      target === USER_MODEL
        ? ["name", "email"]
        : (other?.fields.filter(sendable).map((x) => x.name) ?? []);
    const paths = names
      .map((n) => `${f.name}.${n}`)
      .filter((p) => {
        const problem = placeholderProblem(p, entry, ir, auth);
        return !problem || problem.warning === true;
      });
    return paths.length ? [{ ref: f.name, paths }] : [];
  });
}

/** A sample value as text: a list or object compactly, a missing one as nothing. */
const shown = (value: unknown): string | undefined =>
  value == null ? undefined : typeof value === "object" ? JSON.stringify(value) : String(value);

export function mailTemplates(ir?: SpecIR) {
  return ir?.outgoing.filter((entry) => channelsOf(entry)?.includes("mail")) ?? [];
}

export function OutgoingTemplate({
  entry,
  ir,
  auth,
  contentText,
  samples,
  run,
  onClose,
  fromOutbox = false,
}: {
  entry: string;
  ir: SpecIR;
  auth?: AuthIR;
  /** smithable.content.yml as it is, for the entry's subject and text. */
  contentText?: string;
  /** Each model's sample records file (samples/<Model>.yml), as text. */
  samples: Record<string, string>;
  run: Run;
  onClose?: () => void;
  fromOutbox?: boolean;
}) {
  const o = ir.outgoing.find((x) => x.name === entry);
  const [copied, setCopied] = useState<string>();
  const subjectId = useId();
  const narrow = useMedia("(max-width: 1023px)");
  const on = o && "model" in o.when ? o.when.model : undefined;
  const model = ir.models.find((m) => m.name === on);
  const changed = o && "event" in o.when && o.when.event === "changed";
  const list = o?.list;
  const offered = list ? ["count", "date"] : model ? placeholders(model, Boolean(changed)) : [];
  const fields = model?.fields.filter(sendable) ?? [];
  const listed = o?.show === "none" ? [] : (o?.show ?? fields.map((f) => f.name));
  let saved: Partial<Record<"subject" | "text", string>> = {};
  try {
    saved =
      (parse(contentText ?? "") as { outgoing?: Record<string, typeof saved> })?.outgoing?.[
        entry
      ] ?? {};
  } catch {}
  const [draft, setDraft] = useState<
    Partial<Record<"subject" | "text", { text: string; base: string | undefined }>>
  >({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const words = {
    subject: draft.subject?.text ?? saved.subject,
    text: draft.text?.text ?? saved.text,
  };
  const dirty = (["subject", "text"] as const).filter(
    (field) => (words[field] ?? "") !== (saved[field] ?? ""),
  );
  const conflicted = dirty.some((field) => draft[field]?.base !== saved[field]);
  usePendingEdit(saving || dirty.length > 0);
  if (!o) return null;
  const edit = (field: "subject" | "text", text: string) => {
    setFailed(false);
    setDraft((current) => ({
      ...current,
      [field]: { text, base: current[field] ? current[field].base : saved[field] },
    }));
  };
  const save = async () => {
    setSaving(true);
    setFailed(false);
    try {
      const texts = Object.fromEntries(
        dirty.map((field) => [`outgoing.${entry}.${field}`, words[field] ?? ""]),
      );
      if (await run("setTexts", { texts })) setDraft({});
      else setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  const sampleRecords = on ? records(samples, on) : [];
  const sample = sampleRecords[0] ?? {};
  const further = model && !list ? hops(model, o, ir, auth) : [];
  // What the validator says about the texts' placeholders, warnings included ({by} to an address).
  const problems = [
    ...new Set([...placeholdersOf(words.subject ?? ""), ...placeholdersOf(words.text ?? "")]),
  ].flatMap((p) => {
    const problem = placeholderProblem(p, o, ir, auth);
    return problem ? [{ path: p, ...problem }] : [];
  });
  // A sample names a referenced record by its title: {customer.name} is that record's field.
  const value = (path: string): string | undefined => {
    if (list) {
      if (path === "count") return String(sampleRecords.length);
      if (path === "date")
        return new Intl.DateTimeFormat(undefined, { dateStyle: "short" }).format();
      return undefined;
    }
    if (!model) return undefined;
    if (path === "title") return shown(sample[titleField(model)]);
    if (path === "link") return "https://your-app.example/…";
    if (path === "by") return "Sam Sample";
    const [first = "", second] = path.split(".");
    // A sample has one state: the value before a change is marked as such, not made up.
    if (first === "before") {
      const before = shown(sample[second ?? ""]);
      return before === undefined ? undefined : `${before} (before)`;
    }
    const v = sample[first];
    if (second === undefined) return shown(v);
    const type = model?.fields.find((x) => x.name === first)?.type;
    const target =
      type?.kind === "relation" ? ir.models.find((m) => m.name === type.model) : undefined;
    if (!target) return undefined;
    const named = records(samples, target.name).find((r) => r[titleField(target)] === v);
    return shown(named?.[second]);
  };
  const copy = async (path: string) => {
    try {
      await navigator.clipboard.writeText(`{${path}}`);
      setCopied(path);
    } catch {}
  };
  const setShow = (show: string[]) => void run("setOutgoingBody", { outgoing: entry, show });
  const settings = (
    <div className="space-y-3 text-xs">
      {!model ? (
        <p className="text-muted">The texts for a custom action take no placeholders.</p>
      ) : (
        <div className="space-y-1">
          <p className="font-medium">Placeholders for the subject and text</p>
          <div className="flex flex-wrap gap-1">
            {offered.map((p) => (
              <button
                key={p}
                type="button"
                title="Copy, to paste into the subject or the text"
                onClick={() => void copy(p)}
                className="rounded-full border border-line bg-panel px-2 py-0.5 font-mono hover:border-accent hover:text-accent"
              >
                {`{${p}}`}
              </button>
            ))}
          </div>
          {further.map(({ ref, paths }) => (
            <div key={ref} className="flex flex-wrap items-center gap-1">
              <span className="text-quiet">{humanize(ref)}:</span>
              {paths.map((p) => (
                <button
                  key={p}
                  type="button"
                  title="Copy, to paste into the subject or the text"
                  onClick={() => void copy(p)}
                  className="rounded-full border border-line bg-panel px-2 py-0.5 font-mono hover:border-accent hover:text-accent"
                >
                  {`{${p}}`}
                </button>
              ))}
            </div>
          ))}
          {copied && <p className="text-quiet">{`{${copied}}`} copied: paste it into a text.</p>}
          {problems.map((p) => (
            <p
              key={p.path}
              role={p.warning ? undefined : "alert"}
              className={p.warning ? "text-warning" : "text-red-700"}
            >
              {p.message}
              {p.hint ? ` ${p.hint}` : ""}
            </p>
          ))}
        </div>
      )}
      {onClose && model && !list && (
        <fieldset className="space-y-1">
          <legend className="font-medium">Listed under the text</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {fields.map((f) => (
              <label key={f.name} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={listed.includes(f.name)}
                  onChange={(e) =>
                    setShow(
                      e.target.checked
                        ? fields
                            .map((x) => x.name)
                            .filter((n) => n === f.name || listed.includes(n))
                        : listed.filter((n) => n !== f.name).length
                          ? listed.filter((n) => n !== f.name)
                          : ["none"],
                    )
                  }
                />
                {humanize(f.name)}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-accent underline"
              onClick={() => setShow(["default"])}
            >
              As the record page shows it
            </button>
            <button
              type="button"
              className="text-accent underline"
              onClick={() => setShow(["none"])}
            >
              The text alone
            </button>
          </div>
          {changed && (
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={Boolean(o.previous)}
                onChange={(e) =>
                  void run("setOutgoingBody", { outgoing: entry, previous: e.target.checked })
                }
              />
              Say what the changed fields were
            </label>
          )}
        </fieldset>
      )}
    </div>
  );
  if (!onClose)
    return (
      <section aria-label={`The words of ${entry}`} className="w-full rounded-md bg-subtle p-2">
        {settings}
      </section>
    );
  const title = `Edit mail template for ${humanize(entry)}`;
  return (
    <StudioOverlay
      name="mail-template"
      title={title}
      narrow={narrow}
      width="editor"
      modal
      closeLabel="Close template"
      canClose={!saving}
      onClose={onClose}
    >
      <div className="space-y-4 p-4 md:p-5">
        <div className="grid items-start gap-5 md:grid-cols-2">
          <div className="min-w-0 space-y-3">
            <label htmlFor={subjectId} className="block space-y-1 text-sm font-medium">
              Subject
              <Input
                id={subjectId}
                value={words.subject ?? ""}
                disabled={saving}
                onChange={(event) => edit("subject", event.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Text
              <textarea
                value={words.text ?? ""}
                disabled={saving}
                onChange={(event) => edit("text", event.target.value)}
                rows={7}
                className="w-full rounded-md border border-line bg-surface px-2 py-1 text-sm"
              />
            </label>
          </div>
          <section
            aria-label="Mail preview"
            className="min-w-0 space-y-2 md:col-start-2 md:row-span-2 md:row-start-1"
            data-preview
          >
            <h3 className="text-sm font-semibold">Mail preview</h3>
            {model && (
              <p className="text-xs text-muted">
                {sampleRecords.length
                  ? list
                    ? "Using the sample records"
                    : `From the first sample ${model.name.toLowerCase()}`
                  : `No sample ${model.name.toLowerCase()} yet (samples/${model.name}.yml)`}
              </p>
            )}
            <div className="space-y-2 rounded-md border border-line bg-surface p-3 text-sm whitespace-pre-wrap wrap-break-word">
              <p className="font-semibold">
                {fillText(
                  words.subject || (model ? `${humanize(model.name)}: {title}` : humanize(entry)),
                  value,
                  true,
                )}
              </p>
              {words.text && <p>{fillText(words.text, value)}</p>}
              {list && sampleRecords.length > 0 && (
                <p className="text-muted">
                  {sampleRecords
                    .map((record) =>
                      list.columns.map((column) => shown(record[column]) ?? "").join(" · "),
                    )
                    .join("\n")}
                </p>
              )}
              {!list && listed.length > 0 && (
                <p className="text-muted">
                  {listed.map((n) => `${humanize(n)}: ${value(n) ?? ""}`).join("\n")}
                </p>
              )}
            </div>
          </section>
          <div className="min-w-0 md:col-start-1 md:row-start-2">{settings}</div>
        </div>
        {conflicted && (
          <p role="alert" className="text-sm text-red-700">
            This template changed while you were editing. Reopen it to edit the latest version.
          </p>
        )}
        {failed && (
          <p role="alert" className="text-sm text-red-700">
            The template could not be saved. Check its content and try again.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={saving} onClick={onClose}>
            {fromOutbox
              ? dirty.length
                ? "Discard and return to Mail"
                : "Back to Mail"
              : dirty.length
                ? "Discard and close"
                : "Close"}
          </Button>
          <Button disabled={saving || conflicted || !dirty.length} onClick={() => void save()}>
            {saving ? "Saving…" : "Save template"}
          </Button>
        </div>
      </div>
    </StudioOverlay>
  );
}
